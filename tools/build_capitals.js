#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const COUNTRY_FLAGS_PATH = path.join(ROOT, "src/data/country_flags.json");
const FLAG_SOURCES_PATH = path.join(ROOT, "src/data/flag_sources.json");
const OVERRIDES_PATH = path.join(ROOT, "src/data/capital_overrides.json");
const OUTPUT_PATH = path.join(ROOT, "src/data/capitals.json");

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "smurdy.fun capitals sync/1.0 (https://smurdy.fun/contact/)";

function parseArgs(argv) {
    const options = { check: false };
    for (const arg of argv) {
        if (arg === "--check") options.check = true;
        else if (arg === "--help" || arg === "-h") options.help = true;
        else throw new Error("Unknown option: " + arg);
    }
    return options;
}

function printHelp() {
    console.log([
        "Usage: node tools/build_capitals.js [--check]",
        "",
        "Builds src/data/capitals.json from Smurdy's country and US-state lists plus",
        "Wikidata P36 (capital), P625 (coordinate location), and all available",
        "labels/aliases for accepted answers. Manual overrides handle country edge cases.",
        "",
        "Options:",
        "  --check  Build in memory and fail if capitals.json is out of date",
        "  --help   Show this message"
    ].join("\n"));
}

async function readJson(filename) {
    return JSON.parse(await fs.readFile(filename, "utf8"));
}

function chunks(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) {
        result.push(values.slice(index, index + size));
    }
    return result;
}

async function fetchWithRetry(url, attempts = 6) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000),
                headers: { "User-Agent": USER_AGENT }
            });
            if (response.ok) return response;
            if (response.status < 500 && response.status !== 429) {
                throw new Error(response.status + " " + response.statusText + " for " + url);
            }
            lastError = new Error(response.status + " " + response.statusText + " for " + url);
            const retryAfter = Number(response.headers.get("retry-after"));
            if (response.status === 429) {
                await new Promise(resolve =>
                    setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 5000)
                );
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
    throw lastError;
}

async function fetchJson(url) {
    return (await fetchWithRetry(url)).json();
}

function usableClaims(claims) {
    const all = (claims || []).filter(claim =>
        claim &&
        claim.rank !== "deprecated" &&
        claim.mainsnak &&
        claim.mainsnak.snaktype === "value" &&
        claim.mainsnak.datavalue &&
        claim.mainsnak.datavalue.value
    );
    const preferred = all.filter(claim => claim.rank === "preferred");
    return preferred.length ? preferred : all;
}

async function fetchEntities(qids, props, languages = "en") {
    const result = new Map();
    const uniqueQids = [...new Set(qids.filter(Boolean))];

    for (const batch of chunks(uniqueQids, 50)) {
        const params = {
            action: "wbgetentities",
            ids: batch.join("|"),
            props,
            format: "json",
            formatversion: "2",
            origin: "*"
        };
        if (languages) {
            params.languages = languages;
            params.languagefallback = "1";
        }
        const query = new URLSearchParams(params);
        const data = await fetchJson(WIKIDATA_API + "?" + query);
        for (const entity of Object.values(data.entities || {})) {
            result.set(entity.id, entity);
        }
    }

    return result;
}

function normalize(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function asciiVariant(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .trim();
}

function dedupeStrings(values) {
    const result = [];
    const seen = new Set();
    for (const value of values) {
        const cleaned = String(value || "").trim();
        if (!cleaned) continue;
        const key = normalize(cleaned);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
    }
    return result;
}

function seedForSource(source, flagsByName, flagsByCode) {
    const exact = flagsByName.get(source.name);
    if (exact) return exact;

    const sameCode = flagsByCode.get(String(source.code || "").toLowerCase()) || [];
    return sameCode.length === 1 ? sameCode[0] : null;
}

function capitalIdsForCountry(entity) {
    return [...new Set(
        usableClaims(entity && entity.claims ? entity.claims.P36 : [])
            .map(claim => claim.mainsnak.datavalue.value && claim.mainsnak.datavalue.value.id)
            .filter(Boolean)
    )];
}

function coordinateForCapital(entity) {
    const claims = entity && entity.claims ? entity.claims.P625 : [];
    const claim = usableClaims(claims)[0];
    const value = claim && claim.mainsnak && claim.mainsnak.datavalue
        ? claim.mainsnak.datavalue.value
        : null;
    if (!value) return null;

    const lat = Number(value.latitude);
    const lng = Number(value.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function labelForEntity(entity) {
    const labels = entity && entity.labels ? entity.labels : {};
    const preferred = labels.en || labels.mul || Object.values(labels)[0];
    return String(preferred && preferred.value ? preferred.value : "").trim();
}

function wikidataTermsForEntity(entity) {
    const terms = [];
    const labels = entity && entity.labels ? entity.labels : {};
    const aliases = entity && entity.aliases ? entity.aliases : {};

    for (const [language, label] of Object.entries(labels)) {
        const value = String(label && label.value ? label.value : "").trim();
        if (value) terms.push({ language, kind: "label", value });
    }

    for (const [language, values] of Object.entries(aliases)) {
        for (const alias of Array.isArray(values) ? values : []) {
            const value = String(alias && alias.value ? alias.value : "").trim();
            if (value) terms.push({ language, kind: "alias", value });
        }
    }

    terms.sort((left, right) =>
        left.language.localeCompare(right.language) ||
        left.kind.localeCompare(right.kind) ||
        left.value.localeCompare(right.value)
    );

    return terms.map(term => term.value);
}

function sourceCapitalMatches(seedCapital, label) {
    const seed = normalize(seedCapital);
    const candidate = normalize(label);
    return Boolean(seed && candidate && (seed === candidate || seed.includes(candidate)));
}

function buildAccepted(primary, selected, override) {
    const base = [
        primary,
        ...selected.map(candidate => candidate.name),
        ...(Array.isArray(override && override.accepted) ? override.accepted : []),
        ...selected.flatMap(candidate => candidate.wikidataTerms || [])
    ];
    const withAscii = [];
    for (const value of base) {
        withAscii.push(value);
        const ascii = asciiVariant(value);
        if (ascii && ascii !== value) withAscii.push(ascii);
    }
    return dedupeStrings(withAscii);
}

async function buildDataset() {
    const [countryFlags, flagSources, overrides] = await Promise.all([
        readJson(COUNTRY_FLAGS_PATH),
        readJson(FLAG_SOURCES_PATH),
        readJson(OVERRIDES_PATH)
    ]);

    const sources = (flagSources.flags || [])
        .filter(entry => entry.kind === "country")
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const stateSources = (flagSources.flags || [])
        .filter(entry => entry.kind === "us-state")
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const flagsByName = new Map(countryFlags.map(entry => [entry.name, entry]));
    const flagsByCode = new Map();
    for (const entry of countryFlags) {
        const code = String(entry.code || "").toLowerCase();
        if (!flagsByCode.has(code)) flagsByCode.set(code, []);
        flagsByCode.get(code).push(entry);
    }

    const missingQids = [...sources, ...stateSources]
        .filter(source => !source.wikidataId);
    if (missingQids.length) {
        throw new Error(
            "Capital sources missing Wikidata IDs:\n" +
            missingQids.map(source => "- " + source.name).join("\n")
        );
    }

    const countryEntities = await fetchEntities(
        sources.map(source => source.wikidataId),
        "claims"
    );
    const stateEntities = await fetchEntities(
        stateSources.map(source => source.wikidataId),
        "claims"
    );

    const requestedCapitalIds = new Set();
    for (const source of sources) {
        const override = overrides[source.name] || {};
        if (override.noCapital) continue;
        const entity = countryEntities.get(source.wikidataId);
        const ids = Array.isArray(override.capitalEntityIds) && override.capitalEntityIds.length
            ? override.capitalEntityIds
            : capitalIdsForCountry(entity);
        for (const id of ids) requestedCapitalIds.add(id);
    }
    for (const source of stateSources) {
        const entity = stateEntities.get(source.wikidataId);
        for (const id of capitalIdsForCountry(entity)) requestedCapitalIds.add(id);
    }

    const capitalEntities = await fetchEntities(
        [...requestedCapitalIds],
        "claims|labels|aliases",
        null
    );

    const output = {};
    const stateOutput = {};
    const errors = [];

    for (const source of sources) {
        const override = overrides[source.name] || {};
        const seed = seedForSource(source, flagsByName, flagsByCode);
        const seedCapital = String(seed && seed.capital ? seed.capital : "").trim();

        if (override.noCapital) {
            output[source.name] = {
                code: String(source.code || "").toLowerCase(),
                wikidataId: source.wikidataId,
                capital: null,
                accepted: [],
                locations: [],
                ...(override.note ? { note: String(override.note).trim() } : {})
            };
            continue;
        }

        const countryEntity = countryEntities.get(source.wikidataId);
        const capitalIds = Array.isArray(override.capitalEntityIds) && override.capitalEntityIds.length
            ? override.capitalEntityIds
            : capitalIdsForCountry(countryEntity);

        if (!capitalIds.length) {
            errors.push(source.name + ": no usable Wikidata P36 capital and no override");
            continue;
        }

        const candidates = capitalIds.map(id => {
            const entity = capitalEntities.get(id);
            return {
                id,
                name: labelForEntity(entity),
                coordinates: coordinateForCapital(entity),
                wikidataTerms: wikidataTermsForEntity(entity)
            };
        });

        for (const candidate of candidates) {
            if (!candidate.name) {
                errors.push(source.name + ": capital " + candidate.id + " has no English label");
            }
            if (!candidate.coordinates) {
                errors.push(
                    source.name + ": capital " + (candidate.name || candidate.id) +
                    " has no P625 coordinates"
                );
            }
        }
        if (candidates.some(candidate => !candidate.name || !candidate.coordinates)) continue;

        let selected;
        if (Array.isArray(override.capitalEntityIds) && override.capitalEntityIds.length) {
            selected = candidates;
        } else if (override.includeAllWikidataCapitals) {
            selected = candidates;
        } else if (seedCapital) {
            const matches = candidates.filter(candidate =>
                sourceCapitalMatches(seedCapital, candidate.name)
            );
            if (matches.length) {
                selected = matches;
            } else if (candidates.length === 1) {
                selected = candidates;
            } else {
                errors.push(
                    source.name + ": Wikidata has multiple capitals (" +
                    candidates.map(candidate => candidate.name).join(", ") +
                    ') but none match seed "' + seedCapital + '"; add an override'
                );
                continue;
            }
        } else if (candidates.length === 1) {
            selected = candidates;
        } else {
            errors.push(
                source.name + ": Wikidata has multiple capitals (" +
                candidates.map(candidate => candidate.name).join(", ") +
                ") and there is no local seed; add an override"
            );
            continue;
        }

        const primary = String(
            override.primary || (selected.length === 1 ? selected[0].name : "")
        ).trim();

        if (!primary) {
            errors.push(source.name + ": multiple selected capitals require override.primary");
            continue;
        }

        const accepted = buildAccepted(primary, selected, override);
        const locations = selected.map(candidate => ({
            name: candidate.name,
            wikidataId: candidate.id,
            lat: candidate.coordinates.lat,
            lng: candidate.coordinates.lng
        }));

        output[source.name] = {
            code: String(source.code || "").toLowerCase(),
            wikidataId: source.wikidataId,
            capital: primary,
            accepted,
            locations,
            ...(override.note ? { note: String(override.note).trim() } : {})
        };
    }

    for (const source of stateSources) {
        const stateEntity = stateEntities.get(source.wikidataId);
        const capitalIds = capitalIdsForCountry(stateEntity);

        if (!capitalIds.length) {
            errors.push(source.name + ": no usable Wikidata P36 state capital");
            continue;
        }
        if (capitalIds.length !== 1) {
            errors.push(
                source.name + ": expected one current state capital, found " +
                capitalIds.length + " (" + capitalIds.join(", ") + ")"
            );
            continue;
        }

        const id = capitalIds[0];
        const entity = capitalEntities.get(id);
        const candidate = {
            id,
            name: labelForEntity(entity),
            coordinates: coordinateForCapital(entity),
            wikidataTerms: wikidataTermsForEntity(entity)
        };

        if (!candidate.name) {
            errors.push(source.name + ": capital " + id + " has no label");
            continue;
        }
        if (!candidate.coordinates) {
            errors.push(
                source.name + ": capital " + candidate.name +
                " has no P625 coordinates"
            );
            continue;
        }

        stateOutput[source.name] = {
            code: String(source.code || "").toLowerCase(),
            wikidataId: source.wikidataId,
            capital: candidate.name,
            accepted: buildAccepted(candidate.name, [candidate], null),
            locations: [{
                name: candidate.name,
                wikidataId: candidate.id,
                lat: candidate.coordinates.lat,
                lng: candidate.coordinates.lng
            }]
        };
    }

    if (errors.length) {
        throw new Error(
            "Capital dataset validation failed:\n" +
            errors.map(error => "- " + error).join("\n")
        );
    }

    return {
        source: {
            countryList: "src/data/flag_sources.json",
            subdivisionList: "src/data/flag_sources.json (kind: us-state)",
            seedCapitals: "src/data/country_flags.json",
            capitalProperty: "Wikidata P36",
            coordinatesProperty: "Wikidata P625",
            acceptedAnswers: "Wikidata labels and aliases in all available languages, plus manual overrides",
            license: "CC0"
        },
        generatedBy: "tools/build_capitals.js",
        capitals: output,
        subdivisionCapitals: {
            us_states: stateOutput
        }
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const dataset = await buildDataset();
    const serialized = JSON.stringify(dataset, null, 2) + "\n";

    if (options.check) {
        let existing = "";
        try {
            existing = await fs.readFile(OUTPUT_PATH, "utf8");
        } catch (_) {}
        if (existing !== serialized) {
            throw new Error(
                "src/data/capitals.json is out of date; run npm run capitals:sync"
            );
        }
        console.log("capitals.json is up to date");
        return;
    }

    await fs.writeFile(OUTPUT_PATH, serialized);
    console.log(
        "Wrote " + Object.keys(dataset.capitals).length +
        " country capitals and " +
        Object.keys(dataset.subdivisionCapitals.us_states || {}).length +
        " US state capitals to src/data/capitals.json"
    );
}

main().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
