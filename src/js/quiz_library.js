(function initQuizLibrary(root, factory) {
    "use strict";

    const createQuizLibrary = factory;

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { createQuizLibrary };
    }

    if (!root || !root.document) return;

    let browserStorage = null;
    try {
        browserStorage = root.localStorage;
    } catch (_) {}

    const library = createQuizLibrary({
        storage: browserStorage,
        onChange(snapshot) {
            try {
                root.dispatchEvent(new CustomEvent(
                    "smurdy:quiz-library-change",
                    { detail: snapshot }
                ));
            } catch (_) {}
        }
    });

    root.SmurdyQuizLibrary = library;

    const pathMatch = String(root.location?.pathname || "").match(
        /^\/quizzes\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i
    );

    if (pathMatch && root.document.getElementById("map")) {
        library.recordPlayed(pathMatch[1], pathMatch[2]);
    }
})(
    typeof window !== "undefined" ? window : null,
    function createQuizLibrary({
        storage = null,
        now = () => Date.now(),
        onChange = () => {}
    } = {}) {
        const STORAGE_KEY = "smurdy-quiz-library-v1";
        const FORMAT_VERSION = 1;
        const MAX_RECENT = 12;
        const MAX_FAVORITES = 200;
        let memoryStore = emptyStore();

        function normalizeId(value) {
            const id = String(value || "")
                .trim()
                .toLowerCase();
            return /^[a-z0-9_-]+$/.test(id) ? id : "";
        }

        function quizKey(manifestId, groupId) {
            const manifest = normalizeId(manifestId);
            const group = normalizeId(groupId);
            return manifest && group
                ? `${manifest}:${group}`
                : "";
        }

        function emptyStore() {
            return {
                version: FORMAT_VERSION,
                favorites: {},
                recent: []
            };
        }

        function cleanEntry(value, timestampField) {
            const manifestId = normalizeId(value?.manifestId);
            const groupId = normalizeId(value?.groupId);
            const key = quizKey(manifestId, groupId);
            const timestamp = Number(value?.[timestampField]);

            if (!key || !Number.isFinite(timestamp)) return null;

            return {
                key,
                manifestId,
                groupId,
                [timestampField]: timestamp
            };
        }

        function sanitizeStore(value) {
            const store = emptyStore();
            const favorites = value?.favorites;

            if (favorites && typeof favorites === "object") {
                for (const favorite of Object.values(favorites)) {
                    const entry = cleanEntry(favorite, "savedAt");
                    if (entry) store.favorites[entry.key] = entry;
                    if (
                        Object.keys(store.favorites).length >=
                        MAX_FAVORITES
                    ) {
                        break;
                    }
                }
            }

            if (Array.isArray(value?.recent)) {
                const seen = new Set();
                for (const recent of value.recent) {
                    const entry = cleanEntry(recent, "playedAt");
                    if (!entry || seen.has(entry.key)) continue;
                    seen.add(entry.key);
                    store.recent.push(entry);
                    if (store.recent.length >= MAX_RECENT) break;
                }
            }

            store.recent.sort((a, b) => b.playedAt - a.playedAt);
            return store;
        }

        function readStore() {
            try {
                const value = JSON.parse(
                    storage?.getItem(STORAGE_KEY) || "null"
                );
                if (value && value.version === FORMAT_VERSION) {
                    memoryStore = sanitizeStore(value);
                }
            } catch (_) {}

            return sanitizeStore(memoryStore);
        }

        function writeStore(store) {
            memoryStore = sanitizeStore(store);
            try {
                storage?.setItem(
                    STORAGE_KEY,
                    JSON.stringify(memoryStore)
                );
            } catch (_) {}

            const snapshot = getSnapshot();
            onChange(snapshot);
            return snapshot;
        }

        function getSnapshot() {
            const store = readStore();
            return {
                favorites: Object.values(store.favorites)
                    .sort((a, b) => b.savedAt - a.savedAt),
                recent: [...store.recent]
            };
        }

        function isFavorite(manifestId, groupId) {
            const key = quizKey(manifestId, groupId);
            return Boolean(key && readStore().favorites[key]);
        }

        function setFavorite(manifestId, groupId, favorite) {
            const key = quizKey(manifestId, groupId);
            if (!key) return false;

            const store = readStore();
            if (favorite) {
                store.favorites[key] = {
                    key,
                    manifestId: normalizeId(manifestId),
                    groupId: normalizeId(groupId),
                    savedAt: Number(now())
                };
            } else {
                delete store.favorites[key];
            }

            writeStore(store);
            return Boolean(store.favorites[key]);
        }

        function toggleFavorite(manifestId, groupId) {
            return setFavorite(
                manifestId,
                groupId,
                !isFavorite(manifestId, groupId)
            );
        }

        function recordPlayed(manifestId, groupId) {
            const key = quizKey(manifestId, groupId);
            if (!key) return getSnapshot();

            const store = readStore();
            store.recent = [
                {
                    key,
                    manifestId: normalizeId(manifestId),
                    groupId: normalizeId(groupId),
                    playedAt: Number(now())
                },
                ...store.recent.filter(entry => entry.key !== key)
            ].slice(0, MAX_RECENT);

            return writeStore(store);
        }

        return {
            storageKey: STORAGE_KEY,
            quizKey,
            getSnapshot,
            isFavorite,
            setFavorite,
            toggleFavorite,
            recordPlayed
        };
    }
);
