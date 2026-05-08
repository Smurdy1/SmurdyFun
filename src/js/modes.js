// Expose MODE_CONFIGS and TINY_COUNTRIES as a single global object used by app_core.js
(function(){
    const TINY_COUNTRIES = new Set([
        "Andorra","Antigua and Barbuda","Bahrain","Barbados","Comoros","Dominica",
        "Grenada","Liechtenstein","Luxembourg","Maldives","Malta","Marshall Islands",
        "Mauritius","Micronesia","Monaco","Nauru","Palau","Saint Kitts and Nevis",
        "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
        "Sao Tome and Principe","Seychelles","Singapore","Tonga","Tuvalu","Vatican"
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
                const candidates = [
                    p.SOVEREIGNT,
                    p.BRK_NAME,
                    p.NAME_LONG,
                    p.NAME,
                    p.admin,
                    p.ADMIN
                ].filter(Boolean);

                let raw = (candidates.length ? String(candidates[0]) : "").trim();
                if (!raw && p.iso_a3) raw = String(p.iso_a3).trim();

                raw = raw.replace(/\s*\(.*\)\s*/g, "").replace(/\s*,\s*/g, ", ").trim();

                return raw || "Unknown";
            },

            filterFeatures(features) {
                return features;
            },

            filterTinyFeatures(features) {
                if (!Array.isArray(features)) return [];
                return features.filter(feature => {
                    try {
                        const name = String(MODE_CONFIGS.countries.getCanonicalFeatureName(feature) || "").trim();
                        if (!name) return false;
                        if (/antarctica/i.test(name)) return false;
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

    // Infer runtime mode and borders for a launch request.
    // Inputs: manifestItem (may be null), groupId (may be null), explicitMode, explicitBorders, groups (map)
    // Returns: { mode: "countries"|"states"|..., bordersFlag: 0|1, borderset: string|null, reason: string }
    function inferRunOptions({ manifestItem = null, groupId = null, explicitMode = null, explicitBorders = undefined, groups = {} } = {}) {
        // Do NOT rely on manifest.mode (removed). Priority:
        // 1) explicitMode (caller intent)
        // 2) group.borderset (country_groups.json) — preferred
        // 3) manifest.borders / manifest.type as weak hints
        // 4) heuristics on groupId
        // 5) fallback to "countries"
        let mode = null;
        let borderset = null;

        // 1) explicit override
        if (explicitMode) mode = String(explicitMode);

        // 2) group-level hint (preferred)
        const g = (groups && groupId) ? groups[groupId] : null;
        if (g && g.borderset) {
            borderset = String(g.borderset);
            if (!mode) mode = borderset;
        }

        // 3) manifest-level weak hints (do NOT read manifest.mode)
        if (!mode && manifestItem) {
            // manifest.borders is a weak hint about border visibility only
            if (manifestItem && typeof manifestItem.borders !== "undefined" && manifestItem.borders !== null) {
                // leave mode unset; bordersFlag computed below
            }
            // manifest.type can be a hint (e.g. "states" or "find")
            if (!mode && typeof manifestItem.type === "string" && manifestItem.type === "states") {
                mode = "states";
            }
        }

        // 4) heuristics: group id naming
        if (!mode && groupId) {
            const gid = String(groupId).toLowerCase();
            if (gid.includes("state") || gid.endsWith("_states") || gid === "us_states") mode = "states";
        }

        // 5) final fallback
        if (!mode) mode = "countries";

        // compute numeric bordersFlag (0/1) preferring explicitBorders -> manifest.borders -> group.borderset
        let bordersFlag = 1;
        if (typeof explicitBorders !== "undefined" && explicitBorders !== null) {
            bordersFlag = explicitBorders ? 1 : 0;
        } else if (manifestItem && typeof manifestItem.borders !== "undefined" && manifestItem.borders !== null) {
            bordersFlag = manifestItem.borders ? 1 : 0;
        } else if (g && typeof g.borderset !== "undefined") {
            bordersFlag = (String(g.borderset) === "states" || String(g.borderset) === "countries") ? 1 : 0;
        } else {
            bordersFlag = (manifestItem && manifestItem.type === "find") ? 0 : 1;
        }

        return { mode: String(mode), bordersFlag: Number(bordersFlag), borderset: borderset || null, reason: "inferred (groups-first)" };
    }

    window.AppModes = window.AppModes || { MODE_CONFIGS, TINY_COUNTRIES };
    // expose helper
    window.AppModes.inferRunOptions = inferRunOptions;
    console.debug("smurdy: modes.js loaded, AppModes available for app_core");
})();