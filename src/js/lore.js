(function initSmurdyLore(root, factory) {
    "use strict";

    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root && root.document) {
        root.SmurdyLore = api;
        api.install();
    }
})(typeof window !== "undefined" ? window : null, function createSmurdyLore(root) {
    "use strict";

    /* OCVLVS SMVRDII OMNIA VIDET */
    /* CO-OP WAS BCE */
    /* 8 was correct */
    /* 8 was never correct */

    const MASTER_ENABLED = true;
    const RELEASE_VERSION = "1.16.1";
    const STORAGE_KEY = "smurdy-lore-v1";
    const LORE_STYLE_ID = "smurdy-lore-runtime-style";
    const SAFE_PATHS = new Set([
        "/turnover/", "/jailtime/", "/8/", "/4824/", "/1313/",
        "/bouvet/", "/tps/", "/overlap/", "/archive/", "/fields/"
    ]);
    const STATE_KEYS = [
        "seen_turnover", "seen_jailtime", "seen_cat_box", "seen_4824",
        "seen_bouvet", "seen_tps", "seen_eye_variant", "march17_seen",
        "jan17_seen", "forbidden8_count", "turnover_count", "lore_seed"
    ];

    let completionPatched = false;
    let runnerPatched = false;
    let installed = false;
    let answerEventStamp = 0;
    const completionSeen = typeof WeakSet === "function" ? new WeakSet() : null;
    const share1313 = typeof WeakMap === "function" ? new WeakMap() : null;

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "'")
            .replace(/\s+/g, " ")
            .trim();
    }

    function hash32(value) {
        let hash = 2166136261;
        const text = String(value || "");
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function stableUnit(seed, key) {
        return hash32(`${seed}:${key}`) / 4294967296;
    }

    function randomSeed() {
        try {
            if (root?.crypto?.getRandomValues) {
                const values = new Uint32Array(2);
                root.crypto.getRandomValues(values);
                return `${values[0].toString(36)}${values[1].toString(36)}`;
            }
        } catch (_) {}
        return `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
    }

    function blankState(seed = randomSeed()) {
        return {
            seen_turnover: false,
            seen_jailtime: false,
            seen_cat_box: false,
            seen_4824: false,
            seen_bouvet: false,
            seen_tps: false,
            seen_eye_variant: false,
            march17_seen: false,
            jan17_seen: false,
            forbidden8_count: 0,
            turnover_count: 0,
            lore_seed: String(seed)
        };
    }

    function readState() {
        const fallback = blankState();
        if (!root?.localStorage) return fallback;
        try {
            const parsed = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || "null") || {};
            const next = blankState(parsed.lore_seed || fallback.lore_seed);
            for (const key of STATE_KEYS) {
                if (key in parsed) next[key] = parsed[key];
            }
            next.forbidden8_count = Math.max(0, Number(next.forbidden8_count) || 0);
            next.turnover_count = Math.max(0, Number(next.turnover_count) || 0);
            next.lore_seed = String(next.lore_seed || fallback.lore_seed);
            return next;
        } catch (_) {
            return fallback;
        }
    }

    let state = readState();

    function saveState() {
        try { root?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
        return state;
    }

    function setState(values) {
        state = { ...state, ...(values || {}) };
        return saveState();
    }

    function increment(key) {
        if (!STATE_KEYS.includes(key)) return 0;
        const next = Math.max(0, Number(state[key]) || 0) + 1;
        setState({ [key]: next });
        return next;
    }

    function isLocalDev() {
        const host = String(root?.location?.hostname || "").toLowerCase();
        return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
    }

    function forced(name) {
        if (!isLocalDev()) return false;
        try {
            const params = new URLSearchParams(root.location.search);
            if (params.get("loreTest") !== "1") return false;
            return String(params.get("loreForce") || "").split(",").map(item => item.trim()).includes(name);
        } catch (_) {
            return false;
        }
    }

    function isAutomatedQuizTest() {
        if (!root) return false;
        try {
            const params = new URLSearchParams(root.location.search);
            const explicitLoreTest = isLocalDev() && params.get("loreTest") === "1";
            if (explicitLoreTest) return false;
            return params.has("smurdyTest") || Boolean(root.navigator?.webdriver);
        } catch (_) {
            return Boolean(root.navigator?.webdriver);
        }
    }

    function roll(name, denominator, options = {}) {
        if (forced(name)) return true;
        const den = Math.max(1, Number(denominator) || 1);
        if (options.stable) {
            return stableUnit(state.lore_seed, `${name}:${options.salt || ""}`) < 1 / den;
        }
        return Math.random() < 1 / den;
    }

    function variant(name, count, salt = "") {
        const total = Math.max(1, Math.floor(Number(count) || 1));
        return Math.floor(stableUnit(state.lore_seed, `${name}:${salt}`) * total) % total;
    }

    function localDate(now = new Date()) {
        return {
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes()
        };
    }

    function isMarch17(now = new Date()) {
        const value = localDate(now);
        return value.month === 3 && value.day === 17;
    }

    function isJan17(now = new Date()) {
        const value = localDate(now);
        return value.month === 1 && value.day === 17;
    }

    function is505(now = new Date()) {
        const value = localDate(now);
        return value.hour === 5 && value.minute === 5;
    }

    function is1313(now = new Date()) {
        const value = localDate(now);
        return value.hour === 13 && value.minute === 13;
    }

    function activeMarch17() { return isMarch17() || forced("march17"); }
    function activeJan17() { return isJan17() || forced("jan17"); }
    function active505() { return is505() || forced("505"); }
    function active1313() { return is1313() || forced("1313-hour"); }

    function addRuntimeStyle() {
        const document = root?.document;
        if (!document || document.getElementById(LORE_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = LORE_STYLE_ID;
        style.textContent = `
            .smurdy-lore-bttc{display:block;margin-top:3px;color:#777;font:9px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:400;letter-spacing:.12em}
            .smurdy-lore-eye-react{transform:translateX(2px) rotate(-2deg)!important;opacity:.72!important}
            .lore-bouvet-home-link{display:block;width:max-content;margin:18px 12px 8px auto;color:inherit;font-size:11px;opacity:.52;text-decoration:none}
            .lore-bouvet-home-link:hover{opacity:.78}
        `;
        document.head.appendChild(style);
    }

    function appendComment(text) {
        try { root.document.documentElement.appendChild(root.document.createComment(text)); } catch (_) {}
    }

    function installSourceDetails() {
        const document = root?.document;
        if (!document) return;
        try {
            document.documentElement.dataset.observed = "true";
            if (SAFE_PATHS.has(root.location.pathname)) document.documentElement.dataset.archive = "1353";
        } catch (_) {}

        if (activeMarch17()) {
            appendComment("1353");
            setState({ march17_seen: true });
        }
        if (activeJan17()) {
            appendComment("RETURN CONFIRMED.");
            setState({ jan17_seen: true });
        }
    }

    function safeNavigate(path) {
        if (!root?.location) return;
        root.location.assign(path);
    }

    function brandEye() {
        return root?.document?.querySelector?.(".panel-brand img, .site-brand img, [data-smurdy-brand] img") || null;
    }

    function briefEyeReaction() {
        const eye = brandEye();
        if (!eye) return;
        eye.classList.add("smurdy-lore-eye-react");
        setState({ seen_eye_variant: true });
        root.setTimeout(() => eye.classList.remove("smurdy-lore-eye-react"), 900);
    }

    function replaceEyeWithReverse() {
        const eye = brandEye();
        if (!eye) return false;
        if (!eye.dataset.smurdyLoreOriginalSrc) eye.dataset.smurdyLoreOriginalSrc = eye.getAttribute("src") || "";
        eye.src = "/assets/lore/turnover.png";
        eye.alt = "";
        setState({ seen_eye_variant: true });
        return true;
    }

    function hideEyeBriefly() {
        const eye = brandEye();
        if (!eye) return;
        const previous = eye.style.visibility;
        eye.style.visibility = "hidden";
        root.setTimeout(() => { eye.style.visibility = previous; }, 1700);
    }

    function installVersionBehavior() {
        if (!root?.document) return;
        function update() {
            const badge = root.document.getElementById("app-version");
            if (!badge) return;
            const wanted = active505() ? "v37.32" : `v${RELEASE_VERSION}`;
            if (badge.textContent !== wanted) badge.textContent = wanted;
        }
        update();
        root.setInterval(update, 1000);
    }

    function installHomepageCodes() {
        if (!root?.document || root.location.pathname !== "/") return;
        let buffer = "";
        const actions = [
            ["where the fields lie", () => safeNavigate("/fields/")],
            ["ocvlvs smvrdii omnia videt", () => briefEyeReaction()],
            ["co-op was bce", () => safeNavigate("/8/")],
            ["turnover", () => safeNavigate("/turnover/")],
            ["1313", () => safeNavigate("/1313/")],
            ["oibv", () => safeNavigate("/bouvet/")],
            ["4824", () => safeNavigate("/4824/")],
            ["1353", () => briefEyeReaction()]
        ];

        root.document.addEventListener("keydown", event => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
            const target = event.target;
            if (target?.matches?.("input, textarea, select, [contenteditable='true']")) return;
            buffer = (buffer + event.key.toLowerCase()).slice(-80).replace(/\s+/g, " ");
            for (const [code, action] of actions) {
                if (buffer.endsWith(code)) {
                    buffer = "";
                    action();
                    break;
                }
            }
        }, true);
    }

    function appendBouvetLink() {
        const document = root?.document;
        if (!document || document.querySelector(".lore-bouvet-home-link")) return true;
        const browser = document.getElementById("quiz-browser");
        if (!browser) return false;
        const link = document.createElement("a");
        link.className = "lore-bouvet-home-link";
        link.href = "/jailtime/";
        link.textContent = "Bouvet";
        browser.appendChild(link);
        return true;
    }

    function installHomepageRareEvents() {
        if (!root?.document || root.location.pathname !== "/" || isAutomatedQuizTest()) return;
        const reverseDenominator = activeJan17() ? 1353 : 13530;
        const showReverse = roll("home-reverse", reverseDenominator);
        const showBouvet = roll("home-bouvet", 5729);
        const hideEye = roll("home-eye-missing", 80000);
        const offsetEye = !showReverse && roll("home-eye-offset", 5729);
        const emptyEye = !showReverse && !offsetEye && roll("home-eye-empty", 8888);

        const apply = () => {
            if (showReverse) replaceEyeWithReverse();
            else if (offsetEye) {
                const eye = brandEye();
                if (eye) {
                    eye.src = "/assets/lore/eye-offset.png";
                    eye.alt = "";
                    setState({ seen_eye_variant: true });
                }
            } else if (emptyEye) {
                const eye = brandEye();
                if (eye) {
                    eye.src = "/assets/lore/eye-empty.png";
                    eye.alt = "";
                    setState({ seen_eye_variant: true });
                }
            }
            if (hideEye) hideEyeBriefly();
            if (showBouvet) appendBouvetLink();
        };

        if (root.document.readyState === "loading") {
            root.document.addEventListener("DOMContentLoaded", apply, { once: true });
        } else apply();
        if (showBouvet) root.setTimeout(appendBouvetLink, 900);
    }

    function relevantQuizInput(target) {
        if (!target?.matches) return false;
        return target.matches("#type-quiz-controls input, [data-flag-input]");
    }

    function inputValue(input) {
        return normalize(input?.value || "");
    }

    function maybeRecordQuietInput(value) {
        if (value === "bouvet" || value === "oibv") setState({ seen_bouvet: true });
        if (value === "ferfect" && Date.now() - answerEventStamp > 120) {
            answerEventStamp = Date.now();
            if (roll("ferfect-ack", 5729)) {
                root.setTimeout(() => {
                    const result = root.document.querySelector("[data-flag-result], #quiz-result");
                    if (result && /wrong|answer:/i.test(result.textContent || "")) result.textContent = "Ferfect?";
                }, 30);
            }
        }
    }

    function installQuizInputInterceptors() {
        const document = root?.document;
        if (!document || isAutomatedQuizTest()) return;

        document.addEventListener("keydown", event => {
            if (event.key !== "Enter" || !relevantQuizInput(event.target)) return;
            const value = inputValue(event.target);
            if (value === "turnover") {
                event.preventDefault();
                event.stopImmediatePropagation();
                increment("turnover_count");
                setState({ seen_turnover: true });
                safeNavigate("/turnover/");
                return;
            }
            maybeRecordQuietInput(value);
        }, true);

        document.addEventListener("click", event => {
            const button = event.target?.closest?.("#type-quiz-controls button, [data-flag-form] button");
            if (!button) return;
            const input = button.closest("form")?.querySelector?.("[data-flag-input]") ||
                button.closest("#type-quiz-controls")?.querySelector?.("input");
            if (!input) return;
            const value = inputValue(input);
            if (value === "turnover") {
                event.preventDefault();
                event.stopImmediatePropagation();
                increment("turnover_count");
                setState({ seen_turnover: true });
                safeNavigate("/turnover/");
                return;
            }
            maybeRecordQuietInput(value);
        }, true);

        document.addEventListener("submit", event => {
            const input = event.target?.querySelector?.("[data-flag-input]");
            if (!input) return;
            const value = inputValue(input);
            if (value === "turnover") {
                event.preventDefault();
                event.stopImmediatePropagation();
                increment("turnover_count");
                setState({ seen_turnover: true });
                safeNavigate("/turnover/");
                return;
            }
            maybeRecordQuietInput(value);
        }, true);
    }

    function clearFieldsOverlay() {
        const SQ = root?.SmurdyQuiz;
        const map = SQ?.map;
        if (!map) return;
        try { if (map.getLayer("smurdy-lore-fields-fill")) map.removeLayer("smurdy-lore-fields-fill"); } catch (_) {}
        try { if (map.getLayer("smurdy-lore-fields-line")) map.removeLayer("smurdy-lore-fields-line"); } catch (_) {}
        try { if (map.getSource("smurdy-lore-fields")) map.removeSource("smurdy-lore-fields"); } catch (_) {}
    }

    function showFieldsWrong() {
        const SQ = root?.SmurdyQuiz;
        if (!SQ) return;
        increment("turnover_count");
        setState({ seen_turnover: true });
        try { SQ.setResultText?.("Turnover"); } catch (_) {}

        try {
            const feature = SQ.getFeatureByName?.("West Virginia");
            const map = SQ.map;
            if (!feature || !map) return;
            clearFieldsOverlay();
            map.addSource("smurdy-lore-fields", { type: "geojson", data: feature });
            map.addLayer({
                id: "smurdy-lore-fields-fill",
                type: "fill",
                source: "smurdy-lore-fields",
                paint: { "fill-color": "#aac1c1", "fill-opacity": 0.92 }
            });
            map.addLayer({
                id: "smurdy-lore-fields-line",
                type: "line",
                source: "smurdy-lore-fields",
                paint: { "line-color": "#6f8989", "line-width": 1.5 }
            });
            root.setTimeout(clearFieldsOverlay, 830);
        } catch (_) {}
    }

    function wrapQuizConfig(config) {
        if (!config || config.__smurdyLoreWrapped) return config;
        const originalAccepted = config.isAcceptedGuess;
        const wrapped = { ...config, __smurdyLoreWrapped: true };
        wrapped.isAcceptedGuess = function loreAcceptedGuess(country, guess) {
            const cleanGuess = normalize(guess);
            const cleanCountry = normalize(country);
            if (
                cleanCountry === "west virginia" &&
                (cleanGuess === "1353" || cleanGuess === "where the fields lie")
            ) {
                root.setTimeout(showFieldsWrong, 0);
                return false;
            }
            if (typeof originalAccepted === "function") {
                try { return Boolean(originalAccepted(country, guess)); } catch (_) { return false; }
            }
            try { return Boolean(root.SmurdyQuiz?.isAcceptedAnswer?.(country, guess)); } catch (_) { return false; }
        };
        return wrapped;
    }

    function installRunnerPatch() {
        if (!root || runnerPatched || isAutomatedQuizTest()) return;

        function patchValue(value) {
            if (typeof value !== "function") return value;
            if (value.__smurdyLoreWrapped) {
                runnerPatched = true;
                return value;
            }
            function loreRunNameQuiz(config) {
                return value.call(this, wrapQuizConfig(config));
            }
            loreRunNameQuiz.__smurdyLoreWrapped = true;
            runnerPatched = true;
            return loreRunNameQuiz;
        }

        if (typeof root.runNameQuiz === "function") {
            root.runNameQuiz = patchValue(root.runNameQuiz);
            return;
        }

        let pendingValue;
        try {
            Object.defineProperty(root, "runNameQuiz", {
                configurable: true,
                enumerable: true,
                get() { return pendingValue; },
                set(value) {
                    pendingValue = value;
                    delete root.runNameQuiz;
                    root.runNameQuiz = patchValue(value);
                }
            });
        } catch (_) {
            const timer = root.setInterval(() => {
                if (typeof root.runNameQuiz !== "function") return;
                root.runNameQuiz = patchValue(root.runNameQuiz);
                root.clearInterval(timer);
            }, 1000);
        }
    }

    function checkFlagImage(image) {
        if (!image || isAutomatedQuizTest()) return;
        const src = String(image.getAttribute("src") || "");
        if (!src || src.includes("/assets/lore/")) return;
        if (!/\/gb\.svg(?:\?|$)/i.test(src)) return;
        if (image.dataset.smurdyLoreChecked === src) return;
        image.dataset.smurdyLoreChecked = src;
        if (!roll("uk-box", 8888)) return;
        image.src = "/assets/lore/cat-box.png";
        setState({ seen_cat_box: true });
        increment("forbidden8_count");
    }

    function installFlagAnomaly() {
        const document = root?.document;
        if (!document || isAutomatedQuizTest()) return;
        const scan = () => document.querySelectorAll("[data-flag-image]").forEach(checkFlagImage);
        scan();
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.target?.matches?.("[data-flag-image]")) {
                    checkFlagImage(mutation.target);
                }
                for (const node of mutation.addedNodes || []) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches?.("[data-flag-image]")) checkFlagImage(node);
                    node.querySelectorAll?.("[data-flag-image]").forEach(checkFlagImage);
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    }

    function completionStatus(container) {
        return container?.querySelector?.(".flag-result.is-finished") || container?.querySelector?.("#quiz-target") || null;
    }

    function isPerfectResult(result) {
        if (!result) return false;
        const total = Math.max(0, Number(result.total) || 0);
        const completed = Math.max(0, Number(result.completedCount) || 0);
        return total > 0 && completed === total && Number(result.accuracyPercent) === 100 && result.hasMisses !== true;
    }

    function addBTTC(container) {
        const status = completionStatus(container);
        if (!status || container.querySelector("[data-smurdy-lore-bttc]")) return;
        const node = root.document.createElement("span");
        node.dataset.smurdyLoreBttc = "";
        node.className = "smurdy-lore-bttc";
        node.textContent = "BTTC";
        status.insertAdjacentElement("afterend", node);
        setState({ seen_4824: true });
    }

    function alterPerfectToFerfect(container) {
        const apply = () => {
            const indicator = container?.querySelector?.("[data-smurdy-perfect]");
            if (indicator) indicator.textContent = "Ferfect";
        };
        apply();
        root.setTimeout(apply, 0);
        root.setTimeout(apply, 80);
    }

    function styleCompletionOnce(container) {
        const status = completionStatus(container);
        if (!status) return;
        status.style.fontFamily = 'Georgia, "Times New Roman", serif';
        status.style.letterSpacing = ".08em";
    }

    function applyCompletionLore(container, result) {
        if (!container || !result || isAutomatedQuizTest()) return;
        if (completionSeen?.has(result)) return;
        completionSeen?.add(result);

        const bttc = roll("completion-bttc", 4824);
        const ferfect = isPerfectResult(result) && roll("completion-ferfect", 1353);
        const oddStyle = roll("completion-style", 5729);
        const shareOdd = roll("share-1313", 13130);
        if (share1313) share1313.set(result, shareOdd);

        if (bttc) addBTTC(container);
        if (ferfect) alterPerfectToFerfect(container);
        if (oddStyle) styleCompletionOnce(container);
    }

    function canvasBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas export failed")), "image/png");
        });
    }

    function blobImage(blob) {
        return new Promise((resolve, reject) => {
            const url = root.URL.createObjectURL(blob);
            const image = new root.Image();
            image.onload = () => { root.URL.revokeObjectURL(url); resolve(image); };
            image.onerror = () => { root.URL.revokeObjectURL(url); reject(new Error("Image decode failed")); };
            image.src = url;
        });
    }

    async function loadLoreImage(src) {
        return new Promise((resolve, reject) => {
            const image = new root.Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Lore image decode failed"));
            image.src = src;
        });
    }

    async function add1313ToShareImage(blob, result) {
        if (!share1313?.get(result) || !root?.document || !root?.URL || !root?.Image) return blob;
        try {
            const image = await blobImage(blob);
            const eye = await loadLoreImage("/assets/lore/eye-outline.png");
            const canvas = root.document.createElement("canvas");
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return blob;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const size = Math.max(28, Math.round(canvas.width * 0.045));
            const x = canvas.width - size - 34;
            const y = canvas.height - size - 28;
            ctx.save();
            ctx.globalAlpha = 0.72;
            ctx.drawImage(eye, x, y, size, size);
            ctx.fillStyle = "rgba(20,20,20,.72)";
            ctx.font = "12px ui-monospace, monospace";
            ctx.fillText("1313", x - 2, y - 5);
            ctx.restore();
            return await canvasBlob(canvas);
        } catch (_) {
            return blob;
        }
    }

    function patchCompletion() {
        if (completionPatched || isAutomatedQuizTest()) return completionPatched;
        const api = root?.SmurdyQuizCompletion;
        if (!api?.renderShare || !api?.buildShareImageBlob) return false;

        const originalRenderShare = api.renderShare;
        const originalBuildShareImageBlob = api.buildShareImageBlob;

        api.renderShare = function loreRenderShare(container, result, options) {
            const section = originalRenderShare.call(this, container, result, options);
            applyCompletionLore(container, result);
            return section;
        };
        api.renderShare.__smurdyLoreWrapped = true;

        api.buildShareImageBlob = async function loreBuildShareImage(result) {
            const blob = await originalBuildShareImageBlob.call(this, result);
            return add1313ToShareImage(blob, result);
        };
        api.buildShareImageBlob.__smurdyLoreWrapped = true;

        completionPatched = true;
        return true;
    }

    function installCompletionPatch() {
        if (patchCompletion()) return;
        const timer = root.setInterval(() => {
            if (patchCompletion()) root.clearInterval(timer);
        }, 1000);
    }

    function pageRoot(className = "lore-center") {
        const main = root.document.createElement("main");
        main.className = className;
        root.document.body.replaceChildren(main);
        return main;
    }

    function artifact(src, alt = "") {
        const image = root.document.createElement("img");
        image.className = "lore-artifact";
        image.src = src;
        image.alt = alt;
        return image;
    }

    function smallCopy(text) {
        const node = root.document.createElement("p");
        node.className = "lore-small-copy";
        node.textContent = text;
        return node;
    }

    function renderTurnover() {
        setState({ seen_turnover: true });
        increment("turnover_count");
        const main = pageRoot("lore-turnover");
        if (active1313() && roll("1313-hour-layout", 3)) main.classList.add("lore-alt");
        const face = root.document.createElement("div");
        face.className = "lore-turnover-face";
        const poem = root.document.createElement("div");
        poem.className = "lore-turnover-text";
        const lines = [
            "OLIM • INSVLAM • BOVVET • VINCAM",
            "COLVMBAM • MENDACEM • VICI",
            "III👁️XVII • IN • I👁️+XVII • VERSVM • EST",
            "ININVESTIGABILEM • INVENI",
            "AETERNVM • AMBVLANS • ITERVM • EFFVGIAM",
            "DEPREHENSVM • PERFECI"
        ];
        for (const line of lines) {
            const p = root.document.createElement("p");
            p.textContent = line;
            poem.appendChild(p);
        }
        const end = root.document.createElement("span");
        end.className = "lore-turnover-end";
        end.textContent = "The long con never ends";
        main.append(face, poem, end);
    }

    function renderJailtime() {
        setState({ seen_jailtime: true });
        const main = pageRoot();
        const wrap = root.document.createElement("div");
        wrap.appendChild(artifact("/assets/lore/jailtime.png"));
        if (activeMarch17()) wrap.appendChild(smallCopy("RECOVERED 03/17"));
        main.appendChild(wrap);
    }

    function renderEight() {
        root.document.documentElement.dataset.era = "bce";
        increment("forbidden8_count");
        let choice = variant("page-8", 10);
        if (forced("8-cat")) choice = 6;
        if (forced("8-bce")) choice = 8;
        if (forced("8-number")) choice = 9;
        const main = pageRoot();
        if (choice <= 4) return;
        if (choice <= 6) {
            main.appendChild(artifact("/assets/lore/cat-box.png"));
            setState({ seen_cat_box: true });
            return;
        }
        if (choice <= 8) {
            const copy = smallCopy("CO-OP WAS BCE");
            copy.style.fontSize = "12px";
            main.appendChild(copy);
            return;
        }
        main.appendChild(artifact("/assets/lore/forsaken8.png"));
    }

    function render4824() {
        setState({ seen_4824: true });
        const main = pageRoot();
        const wrap = root.document.createElement("div");
        const title = root.document.createElement("h1");
        title.className = "lore-route-title";
        title.textContent = "route";
        wrap.append(title, artifact("/assets/lore/route-4824.png"));
        main.appendChild(wrap);
    }

    function render1313() {
        increment("turnover_count");
        let redirect = stableUnit(state.lore_seed, "1313-redirect") < (activeJan17() ? .17 : .08);
        if (forced("1313-redirect")) redirect = true;
        if (redirect) {
            safeNavigate("/turnover/");
            return;
        }
        const main = pageRoot();
        const wrap = root.document.createElement("div");
        const icon = artifact("/assets/lore/turnover.png");
        icon.className = "lore-1313-icon";
        const lines = activeJan17()
            ? ["RETURN CONFIRMED.", "returned by another route", ""]
            : ["returned by another route", "SOURCE DISPUTED", "", "return confirmed"];
        const line = lines[variant("1313-line", lines.length, activeJan17() ? "jan17" : "ordinary")];
        wrap.appendChild(icon);
        if (line) wrap.appendChild(smallCopy(line));
        if (active1313() && roll("1313-page-layout", 2)) {
            wrap.style.transform = "translateX(10vw)";
            wrap.style.textAlign = "right";
        }
        main.appendChild(wrap);
    }

    function renderBouvet() {
        setState({ seen_bouvet: true });
        const main = pageRoot();
        const chained = state.seen_turnover && state.seen_jailtime && state.seen_4824;
        if (chained || forced("bouvet-reveal")) {
            const text = root.document.createElement("div");
            text.className = "lore-bouvet-reveal";
            text.textContent = "OLIM INSVLA BOVVET VINCAM";
            main.append(text, artifact("/assets/lore/bouvet.png"));
            return;
        }
        const choice = variant("bouvet-page", 4);
        if (choice === 0) {
            const copy = root.document.createElement("div");
            copy.className = "lore-bouvet-coordinates";
            copy.textContent = "54.42°S  3.36°E";
            main.appendChild(copy);
        } else if (choice === 1) {
            root.document.body.classList.add("lore-ocean");
        } else if (choice === 2) {
            const copy = root.document.createElement("div");
            copy.className = "lore-oibv";
            copy.textContent = "OIBV";
            main.appendChild(copy);
        }
    }

    function renderTPS() {
        setState({ seen_tps: true });
        const main = pageRoot();
        const wrap = root.document.createElement("div");
        wrap.appendChild(artifact("/assets/lore/tps.png"));
        if (variant("tps-caption", 2) === 1) wrap.appendChild(smallCopy("STRUCTURE UNCHANGED."));
        main.appendChild(wrap);
    }

    function renderOverlap() {
        const main = pageRoot();
        const wrap = root.document.createElement("div");
        wrap.appendChild(artifact("/assets/lore/overlap.png"));
        if (variant("overlap-caption", 2) === 1) wrap.appendChild(smallCopy("Overlap remained negligible."));
        main.appendChild(wrap);
    }

    function renderFields() {
        const main = pageRoot("lore-fields");
        const phrase = root.document.createElement("span");
        phrase.textContent = activeMarch17() ? "where the fields lie. 1353" : "where the fields lie.";
        main.appendChild(phrase);
    }

    function renderArchive() {
        const main = pageRoot("lore-archive");
        const title = root.document.createElement("h1");
        title.textContent = "archive";
        const list = root.document.createElement("div");
        list.className = "lore-archive-list";
        const output = root.document.createElement("div");
        output.className = "lore-archive-output";

        const files = [
            ["FILE 8-BCE", "image", "/assets/lore/forsaken8.png"],
            ["SUBJECT 121", "image", "/assets/lore/cat-dark.png"],
            ["RECOVERED 03/17", "image", "/assets/lore/eye-bars.png"],
            ["ROUTE 4824", "image", "/assets/lore/road.png"],
            ["ARCHIVE 1353", "image", "/assets/lore/smurdencryption.png"],
            ["OBSERVATION INCOMPLETE", "image", "/assets/lore/eye-batman.png"],
            ["SOURCE DISPUTED", "image", "/assets/lore/purple-shadow.jpg"],
            ["BASELINE A", "image", "/assets/lore/eye-normal-a.png"],
            ["BASELINE B", "image", "/assets/lore/eye-normal-b.png"],
            ["WINDOW RECORD", "image", "/assets/lore/cat-window.png"],
            ["STATUS: FORSAKEN", "image", "/assets/lore/tree.png"],
            ["SIGNAL LOST", "image", "/assets/lore/sign.png"],
            ["HYPER", "image", "/assets/lore/hyper-dark.png"],
            ["SINCE 1984", "image", "/assets/lore/since-1984.png"],
            ["FAN RECORD", "image", "/assets/lore/faucet-fan.png"],
            ["OBJECT 505", "image", "/assets/lore/pumpkin.png"],
            ["STRUCTURE UNCHANGED", "image", "/assets/lore/old-map.png"],
            ["EARLY ICON", "image", "/assets/lore/pixel-creature.png"],
            ["EYE / RED", "image", "/assets/lore/eye-red.png"],
            ["EYE / OUTLINE", "image", "/assets/lore/eye-outline.png"],
            ["AUDIO 5729", "audio", "/assets/lore/trombone.wav"],
            ["5729.txt", "text", "DEPREHENSVM PERFECI\nNO FURTHER RECORD."]
        ];
        const recovered = variant("archive-recovered", files.length);
        files.forEach((file, index) => {
            const button = root.document.createElement("button");
            button.type = "button";
            button.textContent = file[0];
            button.addEventListener("click", () => {
                output.replaceChildren();
                if (index !== recovered) {
                    output.textContent = variant(`archive-dead-${index}`, 3) === 0 ? "NO FURTHER RECORD." : "";
                    return;
                }
                if (file[1] === "text") {
                    output.textContent = file[2];
                    return;
                }
                output.textContent = "RECOVERED";
                if (file[1] === "audio") {
                    const audio = root.document.createElement("audio");
                    audio.controls = true;
                    audio.preload = "none";
                    audio.src = file[2];
                    output.appendChild(audio);
                    return;
                }
                output.appendChild(artifact(file[2]));
            });
            list.appendChild(button);
        });
        main.append(title, list, output);
    }

    function renderSecretPage() {
        const page = root?.document?.body?.dataset?.lorePage;
        if (!page) return false;
        root.document.documentElement.classList.add("lore-page");
        const renderers = {
            turnover: renderTurnover,
            jailtime: renderJailtime,
            "8": renderEight,
            "4824": render4824,
            "1313": render1313,
            bouvet: renderBouvet,
            tps: renderTPS,
            overlap: renderOverlap,
            archive: renderArchive,
            fields: renderFields
        };
        const renderer = renderers[page];
        if (!renderer) return false;
        renderer();
        return true;
    }

    function install() {
        if (installed || !MASTER_ENABLED || !root?.document) return false;
        installed = true;
        if (isAutomatedQuizTest()) return false;

        addRuntimeStyle();
        installSourceDetails();
        if (renderSecretPage()) return true;
        installVersionBehavior();
        installHomepageCodes();
        installHomepageRareEvents();
        installQuizInputInterceptors();
        installRunnerPatch();
        installFlagAnomaly();
        installCompletionPatch();
        return true;
    }

    const api = {
        MASTER_ENABLED,
        RELEASE_VERSION,
        STORAGE_KEY,
        normalize,
        hash32,
        stableUnit,
        blankState,
        isMarch17,
        isJan17,
        is505,
        is1313,
        isLocalDev,
        forced,
        roll,
        variant,
        wrapQuizConfig,
        isPerfectResult,
        install
    };

    return Object.freeze(api);
});
