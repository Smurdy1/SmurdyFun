(function initCapitalQuiz(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.SmurdyCapitalQuiz = api.createController(root);
})(typeof window !== "undefined" ? window : null, function createCapitalQuizApi() {
    "use strict";

    const DATA_PATH = "/src/data/capitals.json";
    const SOURCE_ID = "smurdy-capital-answer-source";
    const LAYER_ID = "smurdy-capital-answer-layer";

    // country_groups.json intentionally uses a few classroom-friendly/common
    // country labels that differ from the canonical keys in capitals.json.
    const COUNTRY_NAME_OVERRIDES = Object.freeze({
        "czechia": "Czech Republic",
        "republic of serbia": "Serbia",
        "vatican": "Holy See",
        "brunei": "Brunei Darussalam",
        "east timor": "Timor-Leste",
        "turkey": "Türkiye",
        "ivory coast": "Côte d'Ivoire",
        "united republic of tanzania": "Tanzania",
        "the bahamas": "Bahamas"
    });

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/['’]/g, "")
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function capitalMapFromDataset(dataset) {
        if (dataset && dataset.capitals && typeof dataset.capitals === "object") {
            return dataset.capitals;
        }
        return {};
    }

    function buildIndexes(dataset) {
        const capitals = capitalMapFromDataset(dataset);
        const byName = new Map();
        const byQid = new Map();

        for (const [country, record] of Object.entries(capitals)) {
            byName.set(normalize(country), record);
            if (record && record.wikidataId) {
                byQid.set(String(record.wikidataId), record);
            }
        }

        for (const [alias, canonical] of Object.entries(COUNTRY_NAME_OVERRIDES)) {
            const record = capitals[canonical];
            if (record) byName.set(normalize(alias), record);
        }

        return { byName, byQid };
    }

    function featureWikidataId(feature) {
        const properties = feature && feature.properties ? feature.properties : {};
        return String(
            properties.WIKIDATAID ||
            properties.wikidataid ||
            properties.wikidataId ||
            ""
        ).trim();
    }

    function resolveRecord(dataset, countryName, feature = null) {
        const indexes = buildIndexes(dataset);
        const direct = indexes.byName.get(normalize(countryName));
        if (direct) return direct;

        const qid = featureWikidataId(feature);
        if (qid && indexes.byQid.has(qid)) return indexes.byQid.get(qid);
        return null;
    }

    function acceptedAnswers(record) {
        if (!record || !record.capital) return [];
        const values = Array.isArray(record.accepted)
            ? record.accepted.slice()
            : [];
        values.unshift(record.capital);

        const seen = new Set();
        return values.filter(value => {
            const key = normalize(value);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function isAccepted(record, guess) {
        const key = normalize(guess);
        if (!key) return false;
        return acceptedAnswers(record).some(answer => normalize(answer) === key);
    }

    function primaryLocation(record) {
        if (!record || !record.capital || !Array.isArray(record.locations)) {
            return null;
        }
        const capitalKey = normalize(record.capital);
        return record.locations.find(location =>
            normalize(location && location.name) === capitalKey
        ) || record.locations[0] || null;
    }

    function emptyFeatureCollection() {
        return { type: "FeatureCollection", features: [] };
    }

    function markerFeatureCollection(location) {
        if (
            !location ||
            !Number.isFinite(Number(location.lng)) ||
            !Number.isFinite(Number(location.lat))
        ) {
            return emptyFeatureCollection();
        }

        return {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [Number(location.lng), Number(location.lat)]
                },
                properties: {}
            }]
        };
    }

    function createController(browserRoot) {
        let loadPromise = null;
        let dataset = null;
        let indexes = null;

        async function load() {
            if (dataset) return dataset;
            if (!loadPromise) {
                loadPromise = fetch(DATA_PATH, { cache: "no-cache" })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(
                                "Could not load capitals data: HTTP " + response.status
                            );
                        }
                        return response.json();
                    })
                    .then(value => {
                        if (!value || !value.capitals || typeof value.capitals !== "object") {
                            throw new Error("Invalid capitals dataset");
                        }
                        dataset = value;
                        indexes = buildIndexes(dataset);
                        return dataset;
                    })
                    .finally(() => {
                        loadPromise = null;
                    });
            }
            return loadPromise;
        }

        function getFeature(countryName) {
            try {
                return browserRoot.SmurdyQuiz &&
                    typeof browserRoot.SmurdyQuiz.getFeatureByName === "function"
                    ? browserRoot.SmurdyQuiz.getFeatureByName(countryName)
                    : null;
            } catch (_) {
                return null;
            }
        }

        function getRecord(countryName) {
            if (!dataset) return null;
            if (!indexes) indexes = buildIndexes(dataset);

            const direct = indexes.byName.get(normalize(countryName));
            if (direct) return direct;

            const qid = featureWikidataId(getFeature(countryName));
            return qid ? (indexes.byQid.get(qid) || null) : null;
        }

        function getCapital(countryName) {
            return String(getRecord(countryName)?.capital || "").trim();
        }

        function getAcceptedAnswers(countryName) {
            return acceptedAnswers(getRecord(countryName));
        }

        function isAcceptedAnswer(countryName, guess) {
            return isAccepted(getRecord(countryName), guess);
        }

        function clearCapitalMarker() {
            const map = browserRoot.SmurdyQuiz?.map;
            if (!map) return;
            try {
                const source = map.getSource(SOURCE_ID);
                if (source && typeof source.setData === "function") {
                    source.setData(emptyFeatureCollection());
                }
            } catch (_) {}
        }

        function showCapitalMarker(countryName) {
            const map = browserRoot.SmurdyQuiz?.map;
            const record = getRecord(countryName);
            const location = primaryLocation(record);
            if (!map || !location) return false;

            const data = markerFeatureCollection(location);

            try {
                const existing = map.getSource(SOURCE_ID);
                if (existing && typeof existing.setData === "function") {
                    existing.setData(data);
                } else {
                    map.addSource(SOURCE_ID, {
                        type: "geojson",
                        data
                    });
                }

                if (!map.getLayer(LAYER_ID)) {
                    map.addLayer({
                        id: LAYER_ID,
                        type: "circle",
                        source: SOURCE_ID,
                        paint: {
                            "circle-radius": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                1, 5,
                                4, 7,
                                8, 9
                            ],
                            "circle-color": "#102a43",
                            "circle-stroke-color": "#ffffff",
                            "circle-stroke-width": 3,
                            "circle-opacity": 1,
                            "circle-stroke-opacity": 1
                        }
                    });
                }

                // A capital reveal is answer feedback, so it must remain above
                // both the red/green country fill and every normal map layer.
                if (typeof map.moveLayer === "function") {
                    try { map.moveLayer(LAYER_ID); } catch (_) {}
                }

                return true;
            } catch (error) {
                console.warn("Could not show capital marker", error);
                return false;
            }
        }

        return Object.freeze({
            load,
            getRecord,
            getCapital,
            getAcceptedAnswers,
            isAcceptedAnswer,
            showCapitalMarker,
            clearCapitalMarker
        });
    }

    return Object.freeze({
        DATA_PATH,
        SOURCE_ID,
        LAYER_ID,
        COUNTRY_NAME_OVERRIDES,
        normalize,
        buildIndexes,
        resolveRecord,
        acceptedAnswers,
        isAccepted,
        primaryLocation,
        markerFeatureCollection,
        createController
    });
});
