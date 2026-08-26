(() => {
    "use strict";

    const STORAGE_KEY = "smurdy-weak-spots-v3";
    const LEGACY_STORAGE_KEYS = [
        "smurdy-weak-spots-v2",
        "smurdy-weak-spots-v1"
    ];
    const PLAN_KEY = "smurdy-weak-spots-practice-v1";
    const FORMAT_VERSION = 3;
    const MAX_STORED = 100;
    const MAX_VISIBLE = 15;
    const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

    function normalizeName(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function kindForMode(mode) {
        return String(mode || "").includes("subdivision")
            ? "subdivision"
            : "country";
    }

    function entryKey(name, modeOrKind) {
        const kind = modeOrKind === "subdivision" || modeOrKind === "country"
            ? modeOrKind
            : kindForMode(modeOrKind);
        return kind + ":" + normalizeName(name);
    }

    function emptyStore() {
        return { version: FORMAT_VERSION, entries: {} };
    }

    function readStore() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (
                value &&
                value.version === FORMAT_VERSION &&
                value.entries &&
                typeof value.entries === "object"
            ) {
                return value;
            }
        } catch (_) {}

        for (const legacyKey of LEGACY_STORAGE_KEYS) {
            try {
                const legacy = JSON.parse(localStorage.getItem(legacyKey) || "null");
                if (!legacy || !legacy.entries || typeof legacy.entries !== "object") {
                    continue;
                }

                const migrated = emptyStore();
                for (const oldEntry of Object.values(legacy.entries)) {
                    if (!oldEntry || !oldEntry.name) continue;

                    const remaining = Math.max(
                        0,
                        Number(oldEntry.misses || 1) -
                        Number(oldEntry.retrySuccesses || 0)
                    );
                    if (remaining === 0) continue;

                    const modes = Object.keys(oldEntry.modes || {});
                    const kind = oldEntry.kind || (
                        modes.length && modes.every(mode => mode.includes("subdivision"))
                            ? "subdivision"
                            : "country"
                    );
                    const key = entryKey(oldEntry.name, kind);
                    migrated.entries[key] = {
                        ...oldEntry,
                        key,
                        kind,
                        score: 1
                    };
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                for (const oldKey of LEGACY_STORAGE_KEYS) {
                    localStorage.removeItem(oldKey);
                }
                return migrated;
            } catch (_) {}
        }

        return emptyStore();
    }

    function sortedEntries(store = readStore()) {
        return Object.values(store.entries || {})
            .filter(entry =>
                entry &&
                entry.name &&
                Number(entry.score) > 0 &&
                Date.now() - Number(entry.updatedAt || 0) <= MAX_AGE_MS
            )
            .sort((a, b) =>
                Number(b.score || 0) - Number(a.score || 0) ||
                Number(b.updatedAt || 0) - Number(a.updatedAt || 0) ||
                String(a.name).localeCompare(String(b.name))
            );
    }

    function writeStore(store) {
        try {
            const keep = sortedEntries(store).slice(0, MAX_STORED);
            store.entries = Object.fromEntries(keep.map(entry => [entry.key, entry]));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
            window.dispatchEvent(new CustomEvent("smurdy:weakspotschange"));
            return true;
        } catch (_) {
            return false;
        }
    }

    function recordMiss(details = {}) {
        const name = String(details.name || "").trim();
        const mode = String(details.mode || "unknown").trim() || "unknown";
        const kind = kindForMode(mode);
        const key = entryKey(name, kind);
        if (!normalizeName(name)) return null;

        const store = readStore();
        const group = String(details.group || "").trim();
        const now = Date.now();
        const saved = store.entries[key];
        const entry = saved && now - Number(saved.updatedAt || 0) <= MAX_AGE_MS
            ? saved
            : {
                key,
                kind,
                name,
                score: 0,
                misses: 0,
                retrySuccesses: 0,
                modes: {},
                groups: {},
                createdAt: now,
                updatedAt: now
            };

        entry.name = name;
        entry.kind = kind;
        entry.score = 1;
        entry.misses = Number(entry.misses || 0) + 1;
        entry.updatedAt = now;
        entry.modes[mode] = Number(entry.modes[mode] || 0) + 1;
        if (group) entry.groups[group] = Number(entry.groups[group] || 0) + 1;

        store.entries[key] = entry;
        writeStore(store);
        return { ...entry };
    }

    function recordRetrySuccess(details = {}) {
        const mode = String(details.mode || "click-country");
        const key = entryKey(details.name, kindForMode(mode));
        const store = readStore();
        const entry = store.entries[key];
        if (!entry) return null;

        // One clean correct replay fully resolves this Weak Spot.
        delete store.entries[key];
        writeStore(store);
        return null;
    }

    function getAll() {
        return sortedEntries().map(entry => ({
            ...entry,
            modes: { ...(entry.modes || {}) },
            groups: { ...(entry.groups || {}) }
        }));
    }

    function clearAll() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            for (const legacyKey of LEGACY_STORAGE_KEYS) {
                localStorage.removeItem(legacyKey);
            }
            sessionStorage.removeItem(PLAN_KEY);
            window.dispatchEvent(new CustomEvent("smurdy:weakspotschange"));
            return true;
        } catch (_) {
            return false;
        }
    }

    function buildPracticeStages() {
        const entries = getAll();
        const countryNames = entries
            .filter(entry => entry.kind !== "subdivision")
            .map(entry => entry.name);
        const stateNames = entries
            .filter(entry => entry.kind === "subdivision")
            .map(entry => entry.name);
        const stages = [];

        if (countryNames.length) {
            stages.push({
                kind: "country",
                label: "Countries",
                quizId: "click-country",
                group: "world",
                names: countryNames
            });
        }
        if (stateNames.length) {
            stages.push({
                kind: "subdivision",
                label: "US States",
                quizId: "click-subdivision",
                group: "us_states",
                names: stateNames
            });
        }
        return stages;
    }

    function readPracticePlan() {
        try {
            const plan = JSON.parse(sessionStorage.getItem(PLAN_KEY) || "null");
            if (
                plan &&
                Array.isArray(plan.stages) &&
                Number.isInteger(plan.index) &&
                plan.stages[plan.index]
            ) {
                return plan;
            }
        } catch (_) {}
        return null;
    }

    function getActivePracticeStage() {
        const plan = readPracticePlan();
        return plan ? { ...plan.stages[plan.index], names: plan.stages[plan.index].names.slice() } : null;
    }

    function advancePracticeStage() {
        const plan = readPracticePlan();
        if (!plan) return null;

        plan.index++;
        if (!plan.stages[plan.index]) {
            try { sessionStorage.removeItem(PLAN_KEY); } catch (_) {}
            return null;
        }

        try { sessionStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch (_) {
            return null;
        }
        return getActivePracticeStage();
    }

    function practiceUrl(stage) {
        return "/quizzes/" + stage.quizId + "/" + stage.group + "/?weakSpotsPractice=1";
    }

    function openPracticeStage(stage) {
        if (!stage) return;
        window.location.assign(practiceUrl(stage));
    }

    function startPractice() {
        const stages = buildPracticeStages();
        if (!stages.length) return false;

        try {
            sessionStorage.setItem(PLAN_KEY, JSON.stringify({
                version: 1,
                index: 0,
                stages
            }));
        } catch (_) {
            window.alert("Weak Spots practice could not start because browser storage is unavailable.");
            return false;
        }

        openPracticeStage(stages[0]);
        return true;
    }

    function modeLabel(mode) {
        return ({
            "click-country": "Click Countries",
            "type-country": "Type Countries",
            "find-country": "No Borders",
            "find-point": "Find from a Point",
            "click-subdivision": "Click States",
            "type-subdivision": "Type States",
            "find-subdivision": "No Borders States",
            "find-point-subdivision": "Find State from a Point"
        })[mode] || String(mode || "Quiz");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function updateMenuCount() {
        const badge = document.getElementById("weak-spots-count");
        if (!badge) return;
        const count = getAll().length;
        badge.textContent = count ? String(count) : "";
        badge.hidden = count === 0;
    }

    function closeDialog(dialog) {
        if (typeof dialog.close === "function" && dialog.open) dialog.close();
        else dialog.removeAttribute("open");
        document.body.classList.remove("weak-spots-dialog-open");
    }

    function renderDialog(dialog) {
        const list = dialog.querySelector("#weak-spots-list");
        const clearButton = dialog.querySelector("#weak-spots-clear");
        const retryButton = dialog.querySelector("#weak-spots-retry");
        const entries = getAll();
        if (!list) return;

        if (!entries.length) {
            list.innerHTML =
                '<li class="weak-spots-empty"><strong>No weak spots yet.</strong>' +
                "<span>Places you miss during quizzes will appear here.</span></li>";
        } else {
            const duplicateNames = new Set(
                entries
                    .filter((entry, index) =>
                        entries.some((other, otherIndex) =>
                            index !== otherIndex &&
                            normalizeName(entry.name) === normalizeName(other.name)
                        )
                    )
                    .map(entry => normalizeName(entry.name))
            );

            list.innerHTML = entries.slice(0, MAX_VISIBLE).map(entry => {
                const suffix = duplicateNames.has(normalizeName(entry.name))
                    ? (entry.kind === "subdivision" ? " (state)" : " (country)")
                    : "";
                return (
                    '<li class="weak-spot-item">' +
                        '<div class="weak-spot-name">' +
                            escapeHtml(entry.name + suffix) +
                        "</div>" +
                        '<div class="weak-spot-meta">' +
                            Number(entry.misses || 0) + " " +
                            (Number(entry.misses) === 1 ? "miss" : "misses") +
                        "</div>" +
                    "</li>"
                );
            }).join("");
        }

        if (clearButton) clearButton.disabled = entries.length === 0;
        if (retryButton) {
            retryButton.disabled = entries.length === 0;
            retryButton.textContent = entries.length
                ? "Retry Missed (" + entries.length + ")"
                : "Retry Missed";
        }
        updateMenuCount();
    }

    function ensureDialog() {
        let dialog = document.getElementById("weak-spots-dialog");
        if (dialog) return dialog;

        dialog = document.createElement("dialog");
        dialog.id = "weak-spots-dialog";
        dialog.setAttribute("aria-labelledby", "weak-spots-title");
        dialog.innerHTML =
            '<div class="weak-spots-dialog-card">' +
                '<header class="weak-spots-dialog-header">' +
                    '<div><h2 id="weak-spots-title">Weak Spots</h2>' +
                    "<p>Mistakes stay on this device. A clean correct answer in Retry Missed removes the place.</p></div>" +
                    '<button id="weak-spots-close" type="button" aria-label="Close Weak Spots">×</button>' +
                "</header>" +
                '<ol id="weak-spots-list" class="weak-spots-list"></ol>' +
                '<footer class="weak-spots-dialog-footer">' +
                    "<span>Showing up to " + MAX_VISIBLE + " places</span>" +
                    '<div class="weak-spots-dialog-actions">' +
                        '<button id="weak-spots-clear" type="button">Clear</button>' +
                        '<button id="weak-spots-retry" type="button">Retry Missed</button>' +
                    "</div>" +
                "</footer>" +
            "</div>";

        document.body.appendChild(dialog);
        dialog.querySelector("#weak-spots-close").addEventListener("click", () => {
            closeDialog(dialog);
        });
        dialog.querySelector("#weak-spots-clear").addEventListener("click", () => {
            if (!window.confirm("Clear every saved weak spot on this device?")) return;
            clearAll();
            renderDialog(dialog);
        });
        dialog.querySelector("#weak-spots-retry").addEventListener("click", () => {
            startPractice();
        });
        dialog.addEventListener("click", event => {
            if (event.target === dialog) closeDialog(dialog);
        });
        dialog.addEventListener("cancel", () => {
            document.body.classList.remove("weak-spots-dialog-open");
        });
        return dialog;
    }

    function openDialog() {
        const dialog = ensureDialog();
        renderDialog(dialog);
        document.body.classList.add("weak-spots-dialog-open");
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
    }

    function install() {
        const button = document.getElementById("weak-spots-open");
        if (button && !button.dataset.weakSpotsBound) {
            button.dataset.weakSpotsBound = "true";
            button.addEventListener("click", openDialog);
        }
        updateMenuCount();
    }

    window.SmurdyWeakSpots = Object.freeze({
        storageKey: STORAGE_KEY,
        practicePlanKey: PLAN_KEY,
        recordMiss,
        recordRetrySuccess,
        getAll,
        clearAll,
        startPractice,
        getActivePracticeStage,
        advancePracticeStage,
        openPracticeStage,
        open: openDialog
    });

    window.addEventListener("smurdy:weakspotschange", updateMenuCount);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
        install();
    }
})();
