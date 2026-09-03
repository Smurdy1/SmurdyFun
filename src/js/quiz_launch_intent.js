(function initQuizLaunchIntent(root, factory) {
    "use strict";

    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SmurdyQuizLaunchIntent = api;
})(typeof window !== "undefined" ? window : null, function createQuizLaunchIntentApi(root) {
    "use strict";

    const STORAGE_KEY = "smurdy-quiz-launch-v1";
    const MAX_AGE_MS = 5 * 60 * 1000;

    function normalizeId(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return /^[a-z0-9_-]+$/.test(normalized) ? normalized : "";
    }

    function parseQuizPath(pathname) {
        const match = String(pathname || "")
            .match(/^\/quizzes\/([^/]+)\/([^/]+)\/?$/);
        if (!match) return null;

        try {
            const quizId = normalizeId(decodeURIComponent(match[1]));
            const groupId = normalizeId(decodeURIComponent(match[2]));
            return quizId && groupId ? { quizId, groupId } : null;
        } catch (_) {
            return null;
        }
    }

    function createClient({
        storage = null,
        now = () => Date.now(),
        pathname = () => ""
    } = {}) {
        function getStorage() {
            try {
                return typeof storage === "function" ? storage() : storage;
            } catch (_) {
                return null;
            }
        }

        function clear() {
            try { getStorage()?.removeItem(STORAGE_KEY); } catch (_) {}
        }

        function readIntent() {
            try {
                const value = getStorage()?.getItem(STORAGE_KEY);
                if (!value) return null;

                const parsed = JSON.parse(value);
                const quizId = normalizeId(parsed?.quizId);
                const groupId = normalizeId(parsed?.groupId);
                const createdAt = Number(parsed?.createdAt || 0);

                if (
                    !quizId ||
                    !groupId ||
                    !createdAt ||
                    now() - createdAt > MAX_AGE_MS
                ) {
                    clear();
                    return null;
                }

                return {
                    version: 1,
                    quizId,
                    groupId,
                    reason: String(parsed?.reason || "direct"),
                    createdAt
                };
            } catch (_) {
                clear();
                return null;
            }
        }

        function storeIntent(quizId, groupId, reason = "direct") {
            const cleanQuizId = normalizeId(quizId);
            const cleanGroupId = normalizeId(groupId);
            const target = getStorage();
            if (!cleanQuizId || !cleanGroupId || !target) return false;

            try {
                target.setItem(STORAGE_KEY, JSON.stringify({
                    version: 1,
                    quizId: cleanQuizId,
                    groupId: cleanGroupId,
                    reason: String(reason || "direct"),
                    createdAt: now()
                }));
                return true;
            } catch (_) {
                return false;
            }
        }

        function peekFor(quizId, groupId) {
            const intent = readIntent();
            if (!intent) return null;

            return (
                intent.quizId === normalizeId(quizId) &&
                intent.groupId === normalizeId(groupId)
            ) ? { ...intent } : null;
        }

        function consumeFor(quizId, groupId) {
            const intent = peekFor(quizId, groupId);
            if (!intent) return null;
            clear();
            return intent;
        }

        function currentRoute() {
            return parseQuizPath(
                typeof pathname === "function" ? pathname() : pathname
            );
        }

        function peekCurrent() {
            const route = currentRoute();
            return route ? peekFor(route.quizId, route.groupId) : null;
        }

        function consumeCurrent() {
            const route = currentRoute();
            return route ? consumeFor(route.quizId, route.groupId) : null;
        }

        return Object.freeze({
            store: storeIntent,
            clear,
            peekFor,
            consumeFor,
            peekCurrent,
            consumeCurrent
        });
    }

    const client = createClient({
        storage: () => root?.sessionStorage || null,
        pathname: () => root?.location?.pathname || ""
    });

    return Object.freeze({
        STORAGE_KEY,
        MAX_AGE_MS,
        parseQuizPath,
        createClient,
        store: client.store,
        clear: client.clear,
        peekFor: client.peekFor,
        consumeFor: client.consumeFor,
        peekCurrent: client.peekCurrent,
        consumeCurrent: client.consumeCurrent
    });
});
