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
        dataFile: "./countries.json",
        tinyFile: "./tiny_countries.json",
        mapCenter: [0, 20],
        mapZoom: 1.8,
        minZoom: 1,
        maxZoom: 12,
        sourceId: "quiz-main",
        fillLayerId: "quiz-main-fill",
        outlineLayerId: null,
        usesTinyPoints: true,

        getRawFeatureName(feature) {
            if (!feature || !feature.properties) return "Unknown";
            const p = feature.properties;
            return (
                p.ADMIN ||
                p.NAME_LONG ||
                p.NAME_EN ||
                p.NAME ||
                p.name ||
                "Unknown"
            );
        },

        getCanonicalFeatureName(feature) {
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
        },

        filterFeatures(features) {
            return features;
        },

        filterTinyFeatures(features) {
            return features.filter(feature => {
                const rawName = this.getRawFeatureName(feature);
                const canonicalName = this.getCanonicalFeatureName(feature);
                const isMergedTerritory = rawName !== canonicalName;
                return !isMergedTerritory && TINY_COUNTRIES.has(canonicalName);
            });
        }
    },

    states: {
        dataFile: "./states.json",
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
        const resolved = {};
        const canonicalNames = this.getAllNames();

        const canonicalByNormalized = new Map();
        for (const name of canonicalNames) {
            canonicalByNormalized.set(this.normalizeAnswer(name), name);
        }

        for (const [key, value] of Object.entries(this.rawAliases || {})) {
            const aliasList = Array.isArray(value) ? value : [value];

            const matchedCanonical =
                canonicalByNormalized.get(this.normalizeAnswer(key)) || null;

            if (!matchedCanonical) {
                console.warn(`Alias key "${key}" did not match any canonical feature name.`);
                continue;
            }

            if (!resolved[matchedCanonical]) {
                resolved[matchedCanonical] = [];
            }

            const allAliases = [key, ...aliasList];

            for (const alias of allAliases) {
                const normalizedAlias = this.normalizeAnswer(alias);
                const normalizedCanonical = this.normalizeAnswer(matchedCanonical);

                if (
                    normalizedAlias &&
                    normalizedAlias !== normalizedCanonical &&
                    !resolved[matchedCanonical].some(
                        existing => this.normalizeAnswer(existing) === normalizedAlias
                    )
                ) {
                    resolved[matchedCanonical].push(alias);
                }
            }
        }

        this.aliases = resolved;
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
        if (this.mainData) {
            for (const feature of this.mainData.features) {
                this.map.setFeatureState(
                    { source: MODE.sourceId, id: feature.id },
                    { quizState: null }
                );
            }
        }

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
        const target = String(name).toLowerCase();
        let found = false;

        if (this.mainData) {
            for (const feature of this.mainData.features) {
                const featureName = this.getFeatureName(feature);
                if (featureName.toLowerCase() === target) {
                    this.map.setFeatureState(
                        { source: MODE.sourceId, id: feature.id },
                        { quizState }
                    );
                    found = true;
                }
            }
        }

        if (this.tinyData) {
            for (const feature of this.tinyData.features) {
                const featureName = this.getFeatureName(feature);
                if (featureName.toLowerCase() === target) {
                    this.map.setFeatureState(
                        { source: "quiz-tiny-source", id: feature.id },
                        { quizState }
                    );
                    found = true;
                }
            }
        }

        return found;
    },

    setTargetText(text) {
        document.getElementById("quiz-target").textContent = text;
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

    loadQuizScript(path) {
        const oldQuizScript = document.getElementById("active-quiz-script");
        if (oldQuizScript) oldQuizScript.remove();

        const oldRunnerScript = document.getElementById("quiz-runner-script");
        if (oldRunnerScript) oldRunnerScript.remove();

        const runner = document.createElement("script");
        runner.src = "./quizzes/quiz_runner.js";
        runner.id = "quiz-runner-script";

        runner.onload = () => {
            const script = document.createElement("script");
            script.src = path;
            script.id = "active-quiz-script";
            document.body.appendChild(script);
        };

        document.body.appendChild(runner);
    },

    getQuizFeaturePool() {
        let features = this.mainData.features;

        if (!this.currentQuiz?.group) {
            return features;
        }

        const allowedNames = new Set(this.groups?.[this.currentQuiz.group] || []);
        return features.filter(f => allowedNames.has(this.getFeatureName(f)));
    },

    getCurrentGroup() {
        return this.groups?.[this.currentGroupId] || null;
    },

    getAllowedNamesForCurrentGroup() {
        const group = this.getCurrentGroup();
        if (!group) return null;

        if (!Array.isArray(group.countries) || group.countries.length === 0) {
            return null;
        }

        return new Set(group.countries);
    },

    getQuizFeatures() {
        if (!this.mainData?.features) return [];

        const allowedNames = this.getAllowedNamesForCurrentGroup();
        if (!allowedNames) {
            return this.mainData.features;
        }

        return this.mainData.features.filter(feature =>
            allowedNames.has(this.getFeatureName(feature))
        );
    },

    getAllNames() {
        return this.getQuizFeatures()
            .map(feature => this.getFeatureName(feature))
            .filter(name => name !== "Unknown");
    },

    getFeatureByName(name) {
        const target = String(name).toLowerCase();

        for (const feature of this.getQuizFeatures()) {
            const featureName = this.getFeatureName(feature);
            if (featureName.toLowerCase() === target) {
                return feature;
            }
        }

        return null;
    }
}

window.SmurdyQuiz = SmurdyQuiz;

map.on("load", async () => {
    const style = map.getStyle();

    try {
        const aliasesResponse = await fetch("./aliases.json");
        SmurdyQuiz.rawAliases = await aliasesResponse.json();
    } catch (err) {
        console.warn("Could not load aliases.json, continuing without aliases.", err);
        SmurdyQuiz.rawAliases = {};
    }

    try {
        const groupsResponse = await fetch("./country_groups.json");
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

    SmurdyQuiz.mainData.features = MODE.filterFeatures(SmurdyQuiz.mainData.features);

    const allowedNames = SmurdyQuiz.getAllowedNamesForCurrentGroup();
    if (allowedNames) {
        SmurdyQuiz.mainData.features = SmurdyQuiz.mainData.features.filter(feature =>
            allowedNames.has(SmurdyQuiz.getFeatureName(feature))
        );
    }

    SmurdyQuiz.mainData.features.forEach((feature, index) => {
        feature.id = index;
    });

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
            "fill-color": [
                "match",
                ["feature-state", "quizState"],
                "target", "#ffd54f",
                "correct", "#4caf50",
                "wrong", "#f44336",
                "completed", "#64b5f6",
                "rgba(0,0,0,0)"
            ],
            "fill-opacity": [
                "case",
                ["!=", ["feature-state", "quizState"], null],
                0.6,
                0
            ]
        }
    });

    if (MODE.outlineLayerId && showBorders) {
        map.addLayer({
            id: MODE.outlineLayerId,
            type: "line",
            source: MODE.sourceId,
            paint: {
                "line-color": "#666666",
                "line-width": 1.2,
                "line-opacity": 0.9
            }
        });
    }

    if (MODE.usesTinyPoints && MODE.tinyFile) {
        const tinyResponse = await fetch(MODE.tinyFile);
        SmurdyQuiz.tinyData = await tinyResponse.json();

        if (
            SmurdyQuiz.tinyData.type === "FeatureCollection" &&
            SmurdyQuiz.tinyData.features
        ) {
            SmurdyQuiz.tinyData.features = MODE.filterTinyFeatures(SmurdyQuiz.tinyData.features);
            
            const tinyAllowedNames = SmurdyQuiz.getAllowedNamesForCurrentGroup();
            if (tinyAllowedNames) {
                SmurdyQuiz.tinyData.features = SmurdyQuiz.tinyData.features.filter(feature =>
                    tinyAllowedNames.has(SmurdyQuiz.getFeatureName(feature))
                );
            }

            SmurdyQuiz.tinyData.features.forEach((feature, index) => {
                feature.id = index;
            });

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
                        "completed", "#64b5f6",
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
        manifestScript.src = "./quizzes/manifest.js";
        manifestScript.onload = () => {
            const browseScript = document.createElement("script");
            browseScript.src = "./browse.js";
            document.body.appendChild(browseScript);
        };
        document.body.appendChild(manifestScript);
    }
});