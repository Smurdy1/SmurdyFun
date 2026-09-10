(function initSmurdyTestTools(root, factory) {
    "use strict";

    const createSmurdyTestTools = factory;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { createSmurdyTestTools };
    }

    if (!root) return;
    if (!root.SmurdyTestTools) {
        root.SmurdyTestTools = createSmurdyTestTools(root);
    }
})(typeof window !== "undefined" ? window : null, function createSmurdyTestTools(root = {}) {
    const UNLOCK_KEY = "smurdy-test-tools-enabled-v1";
    const MODES = Object.freeze(["last-answer", "review"]);
    const MODE_SET = new Set(MODES);
    const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
    let activeCapture = null;

    function getSessionStorage() {
        try { return root.sessionStorage || null; } catch (_) { return null; }
    }

    function isLocalHost() {
        try {
            return LOCAL_HOSTS.has(String(root.location?.hostname || "").toLowerCase());
        } catch (_) {
            return false;
        }
    }

    function isUnlocked() {
        if (isLocalHost()) return true;
        try { return getSessionStorage()?.getItem(UNLOCK_KEY) === "1"; } catch (_) { return false; }
    }

    function rawRequestedMode() {
        try {
            return String(new URLSearchParams(root.location?.search || "").get("smurdyTest") || "").trim();
        } catch (_) {
            return "";
        }
    }

    function getRequestedMode() {
        const mode = rawRequestedMode();
        return isUnlocked() && MODE_SET.has(mode) ? mode : "";
    }

    function getActiveMode() {
        return activeCapture?.mode || getRequestedMode();
    }

    function isStatless() {
        return Boolean(activeCapture?.statless || getRequestedMode());
    }

    function itemKey(item, keyOf) {
        try { return String(keyOf(item) || ""); } catch (_) { return ""; }
    }

    function itemName(item, nameOf) {
        try { return String(nameOf(item) || ""); } catch (_) { return ""; }
    }

    function buildScenarioForMode(mode, items, currentItem, options = {}) {
        if (!MODE_SET.has(mode)) return null;

        const source = Array.isArray(items) ? items.slice() : [];
        if (!source.length) return null;

        const keyOf = typeof options.keyOf === "function"
            ? options.keyOf
            : item => item?.id ?? item?.name ?? item;
        const nameOf = typeof options.nameOf === "function"
            ? options.nameOf
            : item => item?.name ?? item;
        const dataOf = typeof options.dataOf === "function"
            ? options.dataOf
            : () => null;
        const itemLabel = String(options.itemLabel || "item");

        if (mode === "last-answer") {
            const current = currentItem || source[source.length - 1];
            const currentKey = itemKey(current, keyOf);
            if (!currentKey) return null;

            return {
                mode,
                complete: false,
                message: `Test mode: answer this final ${itemLabel}.`,
                seed: {
                    total: source.length,
                    completedItems: source.filter(item => itemKey(item, keyOf) !== currentKey),
                    attempts: 0,
                    correctAnswers: 0,
                    firstTryCorrect: 0
                }
            };
        }

        const sample = source.slice(0, Math.min(3, source.length));
        return {
            mode,
            complete: true,
            message: "Test mode: generated review state.",
            seed: {
                total: source.length,
                completedItems: source,
                misses: sample.map((item, index) => ({
                    key: itemKey(item, keyOf),
                    name: itemName(item, nameOf),
                    count: index + 1,
                    guesses: [],
                    gaveUp: index === 2 ? 1 : 0,
                    data: dataOf(item),
                    item
                })).filter(miss => miss.key && miss.name),
                attempts: source.length + sample.length,
                correctAnswers: source.length,
                firstTryCorrect: Math.max(0, source.length - sample.length)
            }
        };
    }

    const INACTIVE_CAPTURE = Object.freeze({
        mode: "",
        active: false,
        statless: false,
        buildScenario() { return null; }
    });

    function capture() {
        if (activeCapture) return activeCapture;
        const mode = getRequestedMode();
        if (!mode) return INACTIVE_CAPTURE;

        activeCapture = Object.freeze({
            mode,
            active: true,
            statless: true,
            buildScenario(items, currentItem, options = {}) {
                return buildScenarioForMode(mode, items, currentItem, options);
            }
        });
        return activeCapture;
    }

    function enable() {
        try { getSessionStorage()?.setItem(UNLOCK_KEY, "1"); } catch (_) {}
        return status();
    }

    function disable() {
        try { getSessionStorage()?.removeItem(UNLOCK_KEY); } catch (_) {}
        return status();
    }

    function navigateWithMode(mode) {
        if (!MODE_SET.has(mode)) {
            throw new Error(`Unknown smurdyTest mode: ${mode}`);
        }
        enable();
        const url = new URL(root.location?.href || "https://smurdy.fun/");
        url.searchParams.set("smurdyTest", mode);
        if (typeof root.location?.assign === "function") root.location.assign(url.href);
        else if (root.location) root.location.href = url.href;
        return url.href;
    }

    function clear() {
        const url = new URL(root.location?.href || "https://smurdy.fun/");
        url.searchParams.delete("smurdyTest");
        if (typeof root.location?.replace === "function") root.location.replace(url.href);
        else if (root.location) root.location.href = url.href;
        return url.href;
    }

    function status() {
        return {
            unlocked: isUnlocked(),
            local: isLocalHost(),
            requestedMode: getRequestedMode(),
            activeMode: activeCapture?.mode || "",
            statless: isStatless()
        };
    }

    return Object.freeze({
        modes: MODES,
        enable,
        disable,
        run: navigateWithMode,
        clear,
        status,
        capture,
        isUnlocked,
        isStatless,
        getRequestedMode,
        getActiveMode,
        buildScenario: buildScenarioForMode
    });
});