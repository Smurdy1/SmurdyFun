// fix_alias_keys_from_canonicals.js
const fs = require("fs");
const path = require("path");

const countriesPath = path.join(__dirname, "countries.json");
const aliasesPath = path.join(__dirname, "aliases.json");

function readJson(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeName(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function stripLeadingArticle(text) {
    return String(text || "").replace(/^\s*the\s+/i, "").trim();
}

function getCanonicalFeatureName(feature) {
    if (!feature || !feature.properties) return "Unknown";

    const p = feature.properties;

    const rawName =
        p.ADMIN ||
        p.NAME_LONG ||
        p.NAME_EN ||
        p.NAME ||
        p.name ||
        "Unknown";

    const sovereign =
        p.SOVEREIGNT ||
        p.BRK_NAME ||
        p.NAME_LONG ||
        rawName;

    const typeString =
        typeof p.TYPE === "string" ? p.TYPE.toLowerCase() : "";

    const isTerritory =
        p.ADM0_DIF === 1 ||
        typeString.includes("dependency") ||
        typeString.includes("territory");

    return isTerritory ? sovereign : rawName;
}

function dedupeAliases(arr, canonicalName) {
    const seen = new Set();
    const normalizedCanonical = normalizeName(canonicalName);
    const out = [];

    for (const value of arr) {
        const str = String(value || "").trim();
        if (!str) continue;

        const norm = normalizeName(str);
        if (!norm) continue;
        if (norm === normalizedCanonical) continue;
        if (seen.has(norm)) continue;

        seen.add(norm);
        out.push(str);
    }

    return out;
}

function namesEquivalent(a, b) {
    const a1 = normalizeName(a);
    const b1 = normalizeName(b);
    if (a1 === b1) return true;

    const a2 = normalizeName(stripLeadingArticle(a));
    const b2 = normalizeName(stripLeadingArticle(b));
    return a2 === b2;
}

function canonicalMatchesAliasEntry(canonicalName, aliasKey, aliasValues) {
    if (namesEquivalent(canonicalName, aliasKey)) {
        return true;
    }

    for (const value of aliasValues) {
        if (namesEquivalent(canonicalName, value)) {
            return true;
        }
    }

    return false;
}

function main() {
    const countries = readJson(countriesPath);
    if (!countries || !Array.isArray(countries.features)) {
        throw new Error("countries.json is missing or invalid.");
    }

    const aliases = readJson(aliasesPath, {});
    if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) {
        throw new Error("aliases.json must be a JSON object.");
    }

    const canonicalNames = [...new Set(
        countries.features
            .map(getCanonicalFeatureName)
            .filter(name => name && name !== "Unknown")
    )].sort((a, b) => a.localeCompare(b));

    // Start by preserving all current alias entries.
    // Extra keys that don't match any canonical are allowed to remain.
    const result = {};
    for (const [key, value] of Object.entries(aliases)) {
        result[key] = Array.isArray(value) ? [...value] : [value];
    }

    const usedAliasKeys = new Set();
    const missingCanonicals = [];
    let renamedCount = 0;

    for (const canonicalName of canonicalNames) {
        const existingCanonical = result[canonicalName];
        const existingCanonicalArray = Array.isArray(existingCanonical) ? existingCanonical : [];

        // First priority: exact existing canonical key already present
        if (canonicalName in result) {
            result[canonicalName] = dedupeAliases(existingCanonicalArray, canonicalName);
            usedAliasKeys.add(canonicalName);
            continue;
        }

        // Otherwise search all alias entries for one that matches this canonical
        let matchedKey = null;
        let matchedValues = null;

        for (const [aliasKey, rawValue] of Object.entries(aliases)) {
            if (usedAliasKeys.has(aliasKey)) continue;

            const aliasValues = Array.isArray(rawValue) ? rawValue : [rawValue];

            if (canonicalMatchesAliasEntry(canonicalName, aliasKey, aliasValues)) {
                matchedKey = aliasKey;
                matchedValues = aliasValues;
                break;
            }
        }

        if (matchedKey) {
            const merged = [];

            if (!namesEquivalent(matchedKey, canonicalName)) {
                merged.push(matchedKey);
            }

            merged.push(...matchedValues);

            result[canonicalName] = dedupeAliases(merged, canonicalName);
            usedAliasKeys.add(matchedKey);

            if (matchedKey !== canonicalName) {
                delete result[matchedKey];
                renamedCount++;
                console.log(`Renaming "${matchedKey}" -> "${canonicalName}"`);
            }

            continue;
        }

        // No matching alias entry found for this canonical
        missingCanonicals.push(canonicalName);

        // Keep it present, but do not overwrite anything else
        result[canonicalName] = [];
    }

    const sortedResult = {};
    for (const key of Object.keys(result).sort((a, b) => a.localeCompare(b))) {
        const value = Array.isArray(result[key]) ? result[key] : [result[key]];
        sortedResult[key] = value;
    }

    fs.writeFileSync(
        aliasesPath,
        JSON.stringify(sortedResult, null, 4) + "\n",
        "utf8"
    );

    console.log("");
    console.log("Done.");
    console.log(`Renamed keys: ${renamedCount}`);
    console.log(`Canonical countries missing from aliases: ${missingCanonicals.length}`);

    if (missingCanonicals.length > 0) {
        console.log("");
        console.log("These canonical countries were not found in aliases.json:");
        for (const name of missingCanonicals) {
            console.log(`- ${name}`);
        }
    }
}

main();