const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode") || "countries";
const showBorders = urlParams.get("borders") === "1";
const quizGroupId = urlParams.get("group") || "world";

const TINY_COUNTRIES = new Set([
    "Andorra",
    "Antigua and Barbuda",
    "Bahrain",
    "Barbados",
    "Comoros",
    "Dominica",
    "Grenada",
    "Liechtenstein",
    "Luxembourg",
    "Maldives",
    "Malta",
    "Marshall Islands",
    "Mauritius",
    "Micronesia",
    "Monaco",
    "Nauru",
    "Palau",
    "Saint Kitts and Nevis",
    "Saint Lucia",
    "Saint Vincent and the Grenadines",
    "Samoa",
    "San Marino",
    "Sao Tome and Principe",
    "Seychelles",
    "Singapore",
    "Tonga",
    "Tuvalu",
    "Vatican"
]);

const MODE_CONFIGS = {
    countries: {
        dataFile: "/src/data/countries.json",
        tinyFile: "/src/data/tiny_countries.json",
        mapCenter: [0, 20],
        mapZoom: 1.8,
        minZoom: 1,
        maxZoom: 12,
        sourceId: "quiz-main",
        fillLayerId: "quiz-main-fill",
        outlineLayerId: null,
        usesTinyPoints: true,

        getCanonicalFeatureName(feature) {
            const p = (feature && feature.properties) ? feature.properties : {};
            // prefer human-readable sovereign/long names, fall back to NAME and common fields
            const candidates = [
                p.SOVEREIGNT,
                p.BRK_NAME,
                p.NAME_LONG,
                p.NAME,
                p.admin,
                p.ADMIN
            ].filter(Boolean);

            let raw = (candidates.length ? String(candidates[0]) : "").trim();
            // if still empty, try other common fields
            if (!raw && p.iso_a3) raw = String(p.iso_a3).trim();

            // Normalize: remove parenthetical suffixes, trim commas/spaces
            raw = raw.replace(/\s*\(.*\)\s*/g, "").replace(/\s*,\s*/g, ", ").trim();

            return raw || "Unknown";
        },

        filterFeatures(features) {
            return features;
        },

        filterTinyFeatures(features) {
            // Use the canonical-name helper (safe fallback) to decide which tiny features to keep.
            // Example: exclude Antarctica or other non-country records.
            if (!Array.isArray(features)) return [];
            return features.filter(feature => {
                try {
                    const name = String(MODE_CONFIGS.countries.getCanonicalFeatureName(feature) || "").trim();
                    if (!name) return false;
                    // exclude Antarctica and other obvious non-playable entries
                    if (/antarctica/i.test(name)) return false;
                    // keep everything else
                    return true;
                } catch (e) {
                    return false;
                }
            });
        }
    },

    states: {
        dataFile: "/src/data/states.json",
        tinyFile: null,
        mapCenter: [-96, 37.8],
        mapZoom: 3.3,
        minZoom: 2.5,
        maxZoom: 12,
        sourceId: "quiz-main",
        fillLayerId: "quiz-main-fill",
        outlineLayerId: "quiz-main-outline",
        usesTinyPoints: false,

        getRawFeatureName(feature) {
            if (!feature || !feature.properties) return "Unknown";
            const p = feature.properties;
            return (
                p.name ||
                p.name_en ||
                p.NAME ||
                p.NAME_EN ||
                p.postal ||
                p.POSTAL ||
                "Unknown"
            );
        },

        getCanonicalFeatureName(feature) {
            return this.getRawFeatureName(feature);
        },

        isWantedFeature(feature) {
            if (!feature || !feature.properties) return false;
            const p = feature.properties;

            const isUS =
                p.adm0_a3 === "USA" ||
                p.ADM0_A3 === "USA" ||
                p.admin === "United States of America" ||
                p.ADMIN === "United States of America";

            if (!isUS) return false;

            const name = this.getRawFeatureName(feature).toLowerCase();

            return ![
                "district of columbia",
                "puerto rico",
                "guam",
                "american samoa",
                "united states virgin islands",
                "northern mariana islands"
            ].includes(name);
        },

        filterFeatures(features) {
            return features.filter(feature => this.isWantedFeature(feature));
        },

        filterTinyFeatures(features) {
            return features;
        }
    }
};

const MODE = MODE_CONFIGS[mode] || MODE_CONFIGS.countries;

const map = new maplibregl.Map({
    container: "map",
    style: "https://demotiles.maplibre.org/style.json",
    center: MODE.mapCenter,
    zoom: MODE.mapZoom,
    minZoom: MODE.minZoom,
    maxZoom: MODE.maxZoom
});

map.addControl(new maplibregl.NavigationControl(), "top-right");
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

const SmurdyQuiz = {
    map,
    mode,
    mainData: null,
    tinyData: null,
    mainFillLayerId: MODE.fillLayerId,
    tinyCircleLayerId: "quiz-tiny-circle",
    sourceId: MODE.sourceId,
    rawAliases: {},
    aliases: {},
    groups: {},
    currentGroupId: quizGroupId,
    showBordersInitial: showBorders,
    currentShowBorders: showBorders,
    // currently-highlighted target name (normalized string stored as given)
    currentTargetName: null,
    // Batch feature-state writer to avoid blocking the main thread.
    // Accepts array of { source, id, state } and applies them in small chunks.
    batchSetFeatureStates(entries, chunkSize = 60) {
        if (!Array.isArray(entries) || entries.length === 0) return Promise.resolve();
        return new Promise(resolve => {
            let i = 0;
            const step = () => {
                const end = Math.min(i + chunkSize, entries.length);
                for (; i < end; i++) {
                    const e = entries[i];
                    try { map.setFeatureState({ source: e.source, id: e.id }, e.state); } catch (err) { /* ignore */ }
                }
                if (i < entries.length) {
                    // yield to render loop
                    requestAnimationFrame(step);
                } else {
                    // slight pause to let the style settle before resolving
                    setTimeout(resolve, 8);
                }
            };
            requestAnimationFrame(step);
        });
    },

    // Return true if a feature should be considered part of the current group.
    // This is used when setting feature-state "inGroup".
    isFeatureInCurrentGroup(feature) {
        if (!feature) return false;
        const groupId = this.currentGroupId || (this.currentQuiz && this.currentQuiz.group) || null;
        if (String(groupId).toLowerCase() === "world") return true;

        const allowed = this.getAllowedNamesForCurrentGroup();
        if (!allowed) return true; // no explicit group -> treat as world (no dimming)

        const canon = this.getFeatureName(feature) || "";
        const canonNorm = this.normalizeAnswer(canon);
        return allowed.has(canonNorm);
    },

    // return a list of normalized name candidates for a feature to improve matching
    getFeatureNameCandidates(feature) {
        const p = (feature && feature.properties) ? feature.properties : {};
        const candidates = [];
        // canonical getter (human-friendly)
        try { candidates.push(this.getFeatureName(feature)); } catch (e) {}
        // fallbacks from common properties
        [
            p.SOVEREIGNT,
            p.BRK_NAME,
            p.NAME_LONG,
            p.NAME,
            p.ADMIN,
            p.SUBUNIT,
            p.SUBUNIT || p.SUBUNIT,
            p.FORMAL_EN || p.FORMAL,
            p.GEOUNIT
        ].forEach(x => { if (x) candidates.push(String(x)); });

        // include resolved aliases for canonical candidate(s)
        const uniq = new Set(candidates.map(c => this.normalizeAnswer(c)));
        for (const c of Array.from(uniq)) {
            const canonical = this.normalizeAnswer(c);
            // try to find the canonical key as stored in aliases (aliases keys are original canonical strings)
            const aliasEntries = Object.entries(this.aliases || {});
            for (const [can, aliasList] of aliasEntries) {
                if (this.normalizeAnswer(can) === canonical) {
                    uniq.add(canonical);
                    for (const a of aliasList) uniq.add(this.normalizeAnswer(a));
                }
            }
        }

        return Array.from(uniq);
    },

    // build the fill-color expression used for the main fill layer.
    // If `dimOutside` is true, non-group features are drawn as a muted gray.
    buildFillColorExpression(dimOutside = false) {
        const normalMatch = [
            "match",
            ["feature-state", "quizState"],
            "target", "#ffd54f",
            "correct", "#4caf50",
            "wrong", "#f44336",
            // explicit default fill for in-group, previously transparent — make it the site base fill
            "#e8e3d3"
        ];

        if (!dimOutside) return normalMatch;

        // If dimOutside: use inGroup feature-state to decide between normal coloring or muted gray.
        return [
            "case",
            ["==", ["feature-state", "inGroup"], true],
            normalMatch,
            /* else */ "#777777ff"
        ];
    },

    // runtime API: toggle base/outline borders without reloading the page
    setShowBorders(show) {
        const effective = typeof show === "boolean" ? show : this.showBordersInitial;
        this.currentShowBorders = effective;

        try {
            if (this.map.getLayer(this.mainFillLayerId)) {
                // keep paint deterministic and driven by inGroup/quizState
                this.map.setPaintProperty(this.mainFillLayerId, "fill-color", [
                    "case",
                    ["==", ["feature-state", "inGroup"], true],
                        ["case",
                            ["==", ["feature-state", "quizState"], "correct"], "#4CAF50",
                            ["==", ["feature-state", "quizState"], "incorrect"], "#E53935",
                            // default in-group color (matches earlier theme)
                            "#e8e3d3"
                        ],
                    "#777777ff"
                ]);
                this.map.setPaintProperty(this.mainFillLayerId, "fill-opacity", [
                    "case",
                    ["==", ["feature-state", "inGroup"], true], 0.7,
                    ["!=", ["feature-state", "quizState"], null], 0.7,
                    0.16
                ]);
             }

            // toggle outline layer opacity if an outline layer id exists for this mode
            if (MODE.outlineLayerId && this.map.getLayer(MODE.outlineLayerId)) {
                this.map.setPaintProperty(MODE.outlineLayerId, "line-opacity", Boolean(effective) ? 1 : 0);
            }

        } catch (e) {
            // ignore errors if layers/sources are not yet ready
        }
    },

    normalizeAnswer(text) {
        return String(text)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    },

    buildResolvedAliases() {
        // Simple fast path: disable complex alias expansion.
        // Keep rawAliases available for manual edits, but don't expand them automatically.
        this.aliases = {};
     },

    isAcceptedAnswer(canonicalName, userAnswer) {
        const normalizedUser = this.normalizeAnswer(userAnswer);
        const normalizedCanonical = this.normalizeAnswer(canonicalName);

        if (normalizedUser === normalizedCanonical) {
            return true;
        }

        const aliases = this.aliases?.[canonicalName] || [];
        for (const alias of aliases) {
            if (this.normalizeAnswer(alias) === normalizedUser) {
                return true;
            }
        }

        return false;
    },

    getRawFeatureName(feature) {
        return MODE.getRawFeatureName(feature);
    },

    getFeatureName(feature) {
        return MODE.getCanonicalFeatureName(feature);
    },

    clearAllStates() {
        if (this.mainData && Array.isArray(this.mainData.features)) {
            for (const feature of this.mainData.features) {
                const inGroup = this.isFeatureInCurrentGroup(feature);
                this.map.setFeatureState({ source: MODE.sourceId, id: feature.id }, { inGroup });
            }
        }
        
        // Re-apply paint logic now that inGroup states exist so dimming and borders update
        try { SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders); } catch (e) {}

        if (this.tinyData) {
            for (const feature of this.tinyData.features) {
                this.map.setFeatureState(
                    { source: "quiz-tiny-source", id: feature.id },
                    { quizState: null }
                );
            }
        }
    },

    setFeatureStateByName(name, quizState) {
        const targetNorm = this.normalizeAnswer(name);
        if (!targetNorm) return false;

        // Build entries to write; do not perform heavy synchronous writes.
        const entry = this.nameIndex?.[targetNorm];
        const entries = [];
        if (entry) {
            for (const id of (entry.main || [])) entries.push({ source: MODE.sourceId, id, state: { quizState } });
            for (const id of (entry.tiny || [])) entries.push({ source: "quiz-tiny-source", id, state: { quizState } });
        } else {
            // fallback minimal scan
            if (this.mainData) {
                for (const feature of this.mainData.features) {
                    const featureName = this.getFeatureName(feature);
                    if (this.normalizeAnswer(featureName) === targetNorm) entries.push({ source: MODE.sourceId, id: feature.id, state: { quizState } });
                }
            }
            if (this.tinyData) {
                for (const feature of this.tinyData.features) {
                    const featureName = this.getFeatureName(feature);
                    if (this.normalizeAnswer(featureName) === targetNorm) entries.push({ source: "quiz-tiny-source", id: feature.id, state: { quizState } });
                }
            }
        }

        if (entries.length === 0) return false;
        // fire-and-forget but keep quick response: schedule the batch and return true immediately.
        this.batchSetFeatureStates(entries, 60).catch(()=>{});
        return true;
    },

    setTargetByName(name) {
        // highlight by canonical feature name (normalized)
        try {
            if (!name) {
                // clear previous target highlight
                if (this.currentTargetName) {
                    try { this.setFeatureStateByName(this.currentTargetName, null); } catch (e) {}
                    this.currentTargetName = null;
                }
                return;
            }
            const canon = String(name).trim();
            const norm = this.normalizeAnswer(canon);
            if (!norm) return;
            // clear previous
            if (this.currentTargetName && this.currentTargetName !== canon) {
                try { this.setFeatureStateByName(this.currentTargetName, null); } catch (e) {}
            }
            // set new target state (quizState = "target")
            try { this.setFeatureStateByName(canon, "target"); } catch (e) {}
            this.currentTargetName = canon;
        } catch (e) { /* ignore */ }
    },

    setTargetText(text, canonicalName) {
        // text: displayed label; canonicalName (optional): actual country name to highlight
        document.getElementById("quiz-target").textContent = text;

        try {
            // if a canonicalName was provided, prefer it for highlighting
            if (canonicalName) {
                this.setTargetByName(canonicalName);
                return;
            }

            // If the provided text exactly matches a canonical feature name, highlight it.
            const possibleCanon = String(text || "").trim();
            if (possibleCanon) {
                const matched = this.getFeatureByName(possibleCanon);
                if (matched) {
                    this.setTargetByName(possibleCanon);
                    return;
                }
            }

            // If text looks like a generic instruction (contains words like "guess" or "type"),
            // do not attempt to use it as a canonical name. Just clear any previous highlight.
            const lower = String(text || "").toLowerCase();
            if (/\b(guess|type|highlighted|find|click)\b/.test(lower)) {
                this.setTargetByName(null);
                return;
            }

            // Fallback: try to find a feature by normalized text and highlight if found.
            const norm = this.normalizeAnswer(text || "");
            if (norm) {
                // search nameIndex first for speed
                const entry = this.nameIndex?.[norm];
                if (entry) {
                    this.setTargetByName(entry.canonicalName || text);
                    return;
                }
                // fallback scan
                const f = this.getFeatureByName(text);
                if (f) this.setTargetByName(this.getFeatureName(f));
            }
        } catch (e) {
            // ignore
        }
    },

    setProgressText(text) {
        document.getElementById("quiz-progress").textContent = text;
    },

    setAccuracyText(text) {
        document.getElementById("quiz-accuracy").textContent = text;
    },

    setResultText(text) {
        document.getElementById("quiz-result").textContent = text;
    },

    goToMainMenu() {
        window.location.search = "";
    },

    getClickedMainFeature(point) {
        // First check tiny-country dots
        if (this.tinyData && this.map.getLayer(this.tinyCircleLayerId)) {
            const tinyHits = this.map.queryRenderedFeatures(point, {
                layers: [this.tinyCircleLayerId]
            });

            if (tinyHits.length > 0) {
                const tinyFeature = tinyHits[0];
                const tinyName = this.getFeatureName(tinyFeature);

                const mainFeature = this.getFeatureByName(tinyName);
                if (mainFeature) {
                    return mainFeature;
                }
            }
        }

        // Then check normal land polygons
        if (this.map.getLayer(this.mainFillLayerId)) {
            const mainHits = this.map.queryRenderedFeatures(point, {
                layers: [this.mainFillLayerId]
            });

            if (mainHits.length > 0) {
                const clickedName = this.getFeatureName(mainHits[0]);
                const mainFeature = this.getFeatureByName(clickedName);
                if (mainFeature) {
                    return mainFeature;
                }
            }
        }

        return null;
    },

    getRingBounds(ring) {
        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;

        for (const coord of ring) {
            const lng = coord[0];
            const lat = coord[1];

            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        }

        return {
            minLng,
            minLat,
            maxLng,
            maxLat,
            width: maxLng - minLng,
            height: maxLat - minLat,
            area: (maxLng - minLng) * (maxLat - minLat)
        };
    },

    getBestFeatureBounds(geometry) {
        if (!geometry) return null;

        if (geometry.type === "Polygon") {
            const outerRing = geometry.coordinates[0];
            const b = this.getRingBounds(outerRing);
            return [
                [b.minLng, b.minLat],
                [b.maxLng, b.maxLat]
            ];
        }

        if (geometry.type === "MultiPolygon") {
            let best = null;

            for (const polygon of geometry.coordinates) {
                const outerRing = polygon[0];
                const b = this.getRingBounds(outerRing);

                if (!best || b.area > best.area) {
                    best = b;
                }
            }

            if (!best) return null;

            return [
                [best.minLng, best.minLat],
                [best.maxLng, best.maxLat]
            ];
        }

        return null;
    },

    zoomToFeatureByName(name) {
        const feature = this.getFeatureByName(name);
        if (!feature || !feature.geometry) return false;

        const bounds = this.getBestFeatureBounds(feature.geometry);
        if (!bounds) return false;

        const [[minLng, minLat], [maxLng, maxLat]] = bounds;

        const lngSpan = Math.abs(maxLng - minLng);
        const latSpan = Math.abs(maxLat - minLat);
        const biggestSpan = Math.max(lngSpan, latSpan);

        let maxZoom = 3.4;
        if (biggestSpan < 8) maxZoom = 3.8;
        if (biggestSpan < 4) maxZoom = 4.2;
        if (biggestSpan < 2) maxZoom = 4.6;
        if (biggestSpan < 1) maxZoom = 5;

        this.map.fitBounds(bounds, {
            padding: { top: 90, right: 90, bottom: 90, left: 90 },
            maxZoom,
            duration: 700
        });

        return true;
    },

    resetView() {
        this.map.easeTo({
            center: MODE.mapCenter,
            zoom: MODE.mapZoom,
            duration: 700
        });
    },

    loadQuizScript(quizRef) {
        const oldQuizScript = document.getElementById("active-quiz-script");
        if (oldQuizScript) oldQuizScript.remove();

        const oldRunnerScript = document.getElementById("quiz-runner-script");
        if (oldRunnerScript) oldRunnerScript.remove();

        const runner = document.createElement("script");
        // load the runner from the new location
        runner.src = "/src/js/quiz_runner.js";
        runner.id = "quiz-runner-script";

        runner.onload = () => {
            try {
                // If caller passed an inline config object, call runNameQuiz directly after runner is ready
                if (quizRef && typeof quizRef === "object") {
                    // give the runner a tick to initialize its globals
                    setTimeout(() => {
                        if (typeof window.runNameQuiz === "function") {
                            window.runNameQuiz(quizRef);
                        } else {
                            console.error("Quiz runner loaded but runNameQuiz() is not available.");
                        }
                    }, 8);
                    return;
                }

                // manifest:ID references — resolve to manifest entry and either use its config or file
                if (typeof quizRef === "string" && quizRef.startsWith("manifest:")) {
                    const id = quizRef.split(":")[1];
                    const def = (window.SmurdyQuizManifest || []).find(m => m.id === id);
                    if (!def) {
                        console.error("Manifest quiz not found:", id);
                        return;
                    }

                    if (def.config && typeof def.config === "object") {
                        setTimeout(() => {
                            if (typeof window.runNameQuiz === "function") {
                                window.runNameQuiz(def.config);
                            } else {
                                console.error("Quiz runner loaded but runNameQuiz() is not available.");
                            }
                        }, 8);
                        return;
                    }

                    // fallback: if manifest still references an external file, load it (backwards compatible)
                    if (def.file && typeof def.file === "string") {
                        const quizScript = document.createElement("script");
                        quizScript.src = def.file;
                        quizScript.id = "active-quiz-script";
                        document.body.appendChild(quizScript);
                        return;
                    }

                    console.error("Manifest entry has no config or file:", id);
                    return;
                }

                // legacy: direct path string
                if (typeof quizRef === "string") {
                    const quizScript = document.createElement("script");
                    quizScript.src = quizRef;
                    quizScript.id = "active-quiz-script";
                    document.body.appendChild(quizScript);
                }
            } catch (err) {
                console.error("Failed to load quiz script", err);
            }
        };

        document.body.appendChild(runner);

        // ensure borders reflect currentShowBorders after (re)loading runner/resources
        runner.addEventListener("load", () => {
            try { this.setShowBorders(this.currentShowBorders); } catch (e) { /* ignore */ }
        });
    },

    getQuizFeaturePool() {
        const features = (this.mainData && this.mainData.features) || [];
        if (!this.currentQuiz?.group) return features;
        const allowed = this.getAllowedNamesForCurrentGroup();
        if (!allowed) return features;
        return features.filter(f => allowed.has(this.normalizeAnswer(this.getFeatureName(f))));
    },

    getCurrentGroup() {
        return this.groups?.[this.currentGroupId] || null;
    },

    getAllowedNamesForCurrentGroup() {
        const group = this.getCurrentGroup();
        if (!group) return null;

        // If explicit country list exists, build allowed set from it (including aliases)
        if (Array.isArray(group.countries) && group.countries.length > 0) {
            const allowed = new Set();
            const allFeatures = (this.mainData && Array.isArray(this.mainData.features)) ? this.mainData.features : [];

            for (const rawName of group.countries) {
                const normRaw = this.normalizeAnswer(rawName);
                if (!normRaw) continue;
                // don't add obviously tiny tokens (e.g. "of", "the", single letters)
                if (normRaw.length < 2) continue;
                allowed.add(normRaw);

                // try to find matching canonical feature and include its canonical + aliases
                const feat = allFeatures.find(f => this.normalizeAnswer(this.getFeatureName(f)) === normRaw);
                if (feat) {
                    const canonical = this.getFeatureName(feat);
                    allowed.add(this.normalizeAnswer(canonical));
                    const aliases = this.aliases?.[canonical] || [];
                    for (const a of aliases) {
                        const an = this.normalizeAnswer(a);
                        // skip too-generic or empty aliases
                        if (!an || an.length < 2) continue;
                        allowed.add(an);
                    }
                } else {
                    // also include any canonical names that contain the raw term (word-boundary)
                    for (const f of allFeatures) {
                        const canon = this.getFeatureName(f) || "";
                        const canonNorm = this.normalizeAnswer(canon);
                        if (canonNorm.includes(normRaw) || normRaw.includes(canonNorm)) {
                            allowed.add(canonNorm);
                            const aliases = this.aliases?.[canon] || [];
                            for (const a of aliases) {
                                const an = this.normalizeAnswer(a);
                                if (!an || an.length < 2) continue;
                                allowed.add(an);
                            }
                        }
                    }
                }
            }

            return allowed.size ? allowed : null;
        }

        // Fallback: derive groups by common continent/region if no explicit country list is provided.
        // Map common group ids to CONTINENT values in the GeoJSON.
        const gid = (this.currentGroupId || "").toString().toLowerCase();
        const continentMap = {
            "africa": ["Africa"],
            "europe": ["Europe"],
            "asia": ["Asia"],
            "north_america": ["North America"],
            "south_america": ["South America"],
            "americas": ["North America", "South America"],
            "eurasia": ["Europe", "Asia"],
            "oceania": ["Oceania"],
            "australia": ["Oceania"],
            "latin_america": ["South America", "North America"]
        };

        const continents = continentMap[gid] || (group.continents || null);
        if (Array.isArray(continents) && continents.length > 0) {
            const allowed = new Set();
            const allFeatures = (this.mainData && Array.isArray(this.mainData.features)) ? this.mainData.features : [];
            for (const f of allFeatures) {
                const p = f.properties || {};
                const cont = p.CONTINENT || p.continent || "";
                if (!cont) continue;
                if (continents.includes(cont)) {
                    const canonical = this.getFeatureName(f);
                    allowed.add(this.normalizeAnswer(canonical));
                    const aliases = this.aliases?.[canonical] || [];
                    for (const a of aliases) allowed.add(this.normalizeAnswer(a));
                }
            }
            return allowed.size ? allowed : null;
        }

        return null;
    },

    getQuizFeatures() {
        if (!this.mainData?.features) return [];

        const allowed = this.getAllowedNamesForCurrentGroup();
        if (!allowed) return this.mainData.features;
        return this.mainData.features.filter(feature =>
            allowed.has(this.normalizeAnswer(this.getFeatureName(feature)))
        );
    },

    getAllNames() {
        return this.getQuizFeatures()
            .map(feature => this.getFeatureName(feature))
            .filter(name => name !== "Unknown");
    },

    getFeatureByName(name) {
        const targetNorm = this.normalizeAnswer(name);
        for (const feature of this.getQuizFeatures()) {
            const featureName = this.getFeatureName(feature);
            if (this.normalizeAnswer(featureName) === targetNorm) return feature;
        }
        return null;
    }
}

window.SmurdyQuiz = SmurdyQuiz;

map.on("load", async () => {
    const style = map.getStyle();

    try {
        const aliasesResponse = await fetch("/src/data/aliases.json");
        SmurdyQuiz.rawAliases = await aliasesResponse.json();
    } catch (err) {
        console.warn("Could not load aliases.json, continuing without aliases.", err);
        SmurdyQuiz.rawAliases = {};
    }

    try {
        const groupsResponse = await fetch("/src/data/country_groups.json");
        SmurdyQuiz.groups = await groupsResponse.json();
    } catch (err) {
        console.warn("Could not load country_groups.json, continuing without groups.", err);
        SmurdyQuiz.groups = {};
    }

    for (const layer of style.layers) {
        const isSymbolLayer = layer.type === "symbol";
        const hasTextField =
            layer.layout &&
            Object.prototype.hasOwnProperty.call(layer.layout, "text-field");

        if (isSymbolLayer && hasTextField) {
            map.setLayoutProperty(layer.id, "visibility", "none");
        }
    }

    if (map.getLayer("countries-fill")) {
        map.setPaintProperty("countries-fill", "fill-color", "#e8e3d3");
    }

    if (map.getLayer("crimea-fill")) {
        map.setPaintProperty("crimea-fill", "fill-color", "#e8e3d3");
    }

    const showBaseBorders = showBorders && mode !== "states";

    if (map.getLayer("countries-boundary")) {
        map.setPaintProperty("countries-boundary", "line-color", "#999999");
        map.setPaintProperty("countries-boundary", "line-opacity", showBaseBorders ? 0.35 : 0);
    }

    if (map.getLayer("coastline")) {
        map.setPaintProperty("coastline", "line-color", "#999999");
        map.setPaintProperty("coastline", "line-opacity", showBaseBorders ? 0.35 : 0);
    }

    const response = await fetch(MODE.dataFile);
    SmurdyQuiz.mainData = await response.json();

    if (
        SmurdyQuiz.mainData.type !== "FeatureCollection" ||
        !SmurdyQuiz.mainData.features
    ) {
        console.error(`${MODE.dataFile} is not a GeoJSON FeatureCollection`);
        return;
    }

    // keep the full dataset but allow mode-specific filtering (e.g. remove non-US states)
    SmurdyQuiz.mainData.features = MODE.filterFeatures(SmurdyQuiz.mainData.features);

    // do NOT filter the mainData to the group; we'll dim non-group features via feature-state.
    const allowedNames = SmurdyQuiz.getAllowedNamesForCurrentGroup();

    // assign ids and build a fast nameIndex: normalized canonical -> { main: [ids], tiny: [ids] }
    SmurdyQuiz.mainData.features.forEach((feature, index) => { feature.id = index; });
    SmurdyQuiz.nameIndex = SmurdyQuiz.nameIndex || {};
    for (const feature of (SmurdyQuiz.mainData.features || [])) {
        const canon = SmurdyQuiz.getFeatureName(feature) || "";
        const norm = SmurdyQuiz.normalizeAnswer(canon);
        if (!norm) continue;
        if (!SmurdyQuiz.nameIndex[norm]) SmurdyQuiz.nameIndex[norm] = { canonicalName: canon, main: [], tiny: [] };
        SmurdyQuiz.nameIndex[norm].main.push(feature.id);
        feature._canonicalNorm = norm;
    }

    SmurdyQuiz.buildResolvedAliases();

    if (map.getLayer(MODE.fillLayerId)) {
        map.removeLayer(MODE.fillLayerId);
    }

    if (map.getLayer(MODE.outlineLayerId || "__none__")) {
        map.removeLayer(MODE.outlineLayerId);
    }

    if (map.getSource(MODE.sourceId)) {
        map.removeSource(MODE.sourceId);
    }

    map.addSource(MODE.sourceId, {
        type: "geojson",
        data: SmurdyQuiz.mainData
    });

    map.addLayer({
        id: MODE.fillLayerId,
        type: "fill",
        source: MODE.sourceId,
        paint: {
            // Use the theme expression for in-group features, dim gray for out-of-group.
            "fill-color": [
                "case",
                ["==", ["feature-state", "inGroup"], true],
                    SmurdyQuiz.buildFillColorExpression(Boolean(showBorders)),
                "#777777ff"
            ],
            "fill-opacity": [
                "case",
                ["==", ["feature-state", "inGroup"], true], 0.7,
                ["!=", ["feature-state", "quizState"], null], 0.7,
                0.16
            ]
         }
     });

    // Ensure an outline layer exists for borders (some MODEs may not set outlineLayerId)
    if (!MODE.outlineLayerId) {
        MODE.outlineLayerId = `${MODE.sourceId}-outline`;
    }
    
    if (!map.getLayer(MODE.outlineLayerId)) {
        map.addLayer({
            id: MODE.outlineLayerId,
            type: "line",
            source: MODE.sourceId,
            paint: {
                "line-color": "#444",
                "line-width": 0.8,
                "line-opacity": showBorders ? 1 : 0
            }
        });
    }

    // set per-feature inGroup feature-state now (so expressions using feature-state work)
    try {
        const allowed = allowedNames;
        // progressive, non-blocking outline build in worker
        try { SmurdyQuiz.requestGroupOutline(allowed); } catch (e) { /* ignore */ }

        // Minimal, fast behavior: avoid thousands of setFeatureState calls.
        // Option A (recommended): rely on data-driven paint expressions (updateLayerStyles) and skip per-feature writes entirely.
        // Option B: if you still need per-feature states, run finalizeFeatureStates() asynchronously late so UI stays responsive.
        setTimeout(() => {
            try { finalizeFeatureStates(); } catch (e) { /* ignore */ }
        }, 400);
     } catch (e) {
         // ignore if source/layers not ready
     }

    // Re-apply borders/dimming now that per-feature inGroup states exist
    try {
        SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders);
    } catch (e) { /* ignore */ }

    if (MODE.usesTinyPoints && MODE.tinyFile) {
        const tinyResponse = await fetch(MODE.tinyFile);
        SmurdyQuiz.tinyData = await tinyResponse.json();

        if (
            SmurdyQuiz.tinyData.type === "FeatureCollection" &&
            SmurdyQuiz.tinyData.features
        ) {
            SmurdyQuiz.tinyData.features = MODE.filterTinyFeatures(SmurdyQuiz.tinyData.features);
            
            // do not filter tinyData — mark inGroup via feature-state below so we can dim non-group dots

            // When loading tinyData, apply similar dedupe before assigning IDs
            {
                const seenTiny = new Set();
                const dedupTiny = [];
                for (const rawFeature of (SmurdyQuiz.tinyData.features || [])) {
                    const canon = SmurdyQuiz.getFeatureName(rawFeature) || "";
                    const norm = SmurdyQuiz.normalizeAnswer(canon);
                    if (!norm) continue;
                    if (seenTiny.has(norm)) continue;
                    seenTiny.add(norm);
                    dedupTiny.push(rawFeature);
                }
                SmurdyQuiz.tinyData.features = dedupTiny;
                SmurdyQuiz.tinyData.features.forEach((feature, index) => { feature.id = index; });
            }

            if (map.getLayer("quiz-tiny-circle")) {
                map.removeLayer("quiz-tiny-circle");
            }

            if (map.getSource("quiz-tiny-source")) {
                map.removeSource("quiz-tiny-source");
            }

            map.addSource("quiz-tiny-source", {
                type: "geojson",
                data: SmurdyQuiz.tinyData
            });

            map.addLayer({
                id: "quiz-tiny-circle",
                type: "circle",
                source: "quiz-tiny-source",
                paint: {
                    "circle-radius": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        1, 3,
                        3, 4,
                        5, 6,
                        8, 9
                    ],
                    "circle-color": [
                        "match",
                        ["feature-state", "quizState"],
                        "target", "#ffd54f",
                        "correct", "#4caf50",
                        "wrong", "#f44336",
                        "#666666"
                    ],
                    "circle-opacity": [
                        "case",
                        ["==", ["feature-state", "quizState"], null],
                        0.8,
                        0.95
                    ],
                    "circle-stroke-color": "#222222",
                    "circle-stroke-width": [
                        "case",
                        ["==", ["feature-state", "quizState"], null],
                        0.8,
                        1.4
                    ]
                }
            });

            map.on("mouseenter", "quiz-tiny-circle", () => {
                map.getCanvas().style.cursor = "pointer";
            });

            map.on("mouseleave", "quiz-tiny-circle", () => {
                map.getCanvas().style.cursor = "";
            });

            // set inGroup for tiny features as well
            try {
                if (SmurdyQuiz.tinyData && Array.isArray(SmurdyQuiz.tinyData.features)) {
                    const tiny = SmurdyQuiz.tinyData.features;
                    const batchSizeTiny = 300;
                    let j = 0;
                    const writeTiny = () => {
                        const end = Math.min(j + batchSizeTiny, tiny.length);
                        for (; j < end; j++) {
                            const f = tiny[j];
                            const inGroup = SmurdyQuiz.isFeatureInCurrentGroup(f);
                            map.setFeatureState({ source: "quiz-tiny-source", id: f.id }, { inGroup });
                        }
                        if (j < tiny.length) setTimeout(writeTiny, 8);
                        else try { SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders); } catch (e) {}
                    };
                    writeTiny();
                }
            } catch (e) {}
         }
     }

    map.on("mouseenter", MODE.fillLayerId, () => {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", MODE.fillLayerId, () => {
        map.getCanvas().style.cursor = "";
    });

    const quizFile = urlParams.get("quiz");
    if (quizFile) {
        SmurdyQuiz.loadQuizScript(quizFile);
    } else {
        const manifestScript = document.createElement("script");
        // ensure manifest comes from the new location
        manifestScript.src = "/src/js/manifest.js";
        manifestScript.id = "quiz-manifest-script";
        document.body.appendChild(manifestScript);
    }
});

// add helper to finalize and correct feature-states after batches
function finalizeFeatureStates() {
    // Batch corrections to avoid main-thread stalls on large datasets.
    const main = SmurdyQuiz.mainData?.features || [];
    const tiny = SmurdyQuiz.tinyData?.features || [];
    const batchSize = 400;

    let mi = 0;
    const processMain = () => {
        const end = Math.min(mi + batchSize, main.length);
        for (; mi < end; mi++) {
            const feature = main[mi];
            try {
                const expected = !!SmurdyQuiz.isFeatureInCurrentGroup(feature);
                const state = map.getFeatureState({ source: MODE.sourceId, id: feature.id }) || {};
                const current = !!state.inGroup;
                if (current !== expected) map.setFeatureState({ source: MODE.sourceId, id: feature.id }, { inGroup: expected });
            } catch (e) { /* ignore per-feature errors */ }
        }
        if (mi < main.length) setTimeout(processMain, 8);
        else processTiny();
    };

    let ti = 0;
    const processTiny = () => {
        const end = Math.min(ti + batchSize, tiny.length);
        for (; ti < end; ti++) {
            const feature = tiny[ti];
            try {
                const expected = !!SmurdyQuiz.isFeatureInCurrentGroup(feature);
                const state = map.getFeatureState({ source: "quiz-tiny-source", id: feature.id }) || {};
                const current = !!state.inGroup;
                if (current !== expected) map.setFeatureState({ source: "quiz-tiny-source", id: feature.id }, { inGroup: expected });
            } catch (e) { /* ignore per-feature errors */ }
        }
        if (ti < tiny.length) setTimeout(processTiny, 8);
        else {
            try { SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders); } catch(e){}
        }
    };

    try { processMain(); } catch (e) { console.warn("finalizeFeatureStates failed", e); }
}