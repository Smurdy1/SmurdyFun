(function initWeakSpots(root, factory) {
    "use strict";

    const api = factory(root);
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (!root || !root.document) return;

    root.SmurdyWeakSpots = Object.freeze(api);
    api.install();
})(typeof window !== "undefined" ? window : null, function createWeakSpotsApi(root) {
    "use strict";

    const STORAGE_KEY = "smurdy-weak-spots-v4";
    const LEGACY_STORAGE_KEYS = [
        "smurdy-weak-spots-v3",
        "smurdy-weak-spots-v2",
        "smurdy-weak-spots-v1"
    ];
    const PLAN_KEY = "smurdy-weak-spots-practice-v1";
    const FORMAT_VERSION = 4;
    const PRACTICE_PLAN_VERSION = 3;
    const MAX_STORED = 150;
    const MAX_VISIBLE = 20;
    const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

    const MODE_DEFINITIONS = Object.freeze({
        "click-country": { label: "Click Countries", kind: "country", defaultGroup: "world" },
        "type-country": { label: "Type Countries", kind: "country", defaultGroup: "world" },
        "find-country": { label: "No Borders", kind: "country", defaultGroup: "world" },
        "find-point": { label: "Find from a Point", kind: "country", defaultGroup: "world" },
        "type-flag": { label: "Flags", kind: "country", defaultGroup: "world", quizId: "type-flag" },
        "type-capital": { label: "Type Capitals", kind: "country", defaultGroup: "world" },
        "click-subdivision": { label: "Click States", kind: "subdivision", defaultGroup: "us_states" },
        "type-subdivision": { label: "Type States", kind: "subdivision", defaultGroup: "us_states" },
        "find-subdivision": { label: "No Borders States", kind: "subdivision", defaultGroup: "us_states" },
        "find-point-subdivision": { label: "Find State from a Point", kind: "subdivision", defaultGroup: "us_states" },
        "type-flag-subdivision": { label: "State Flags", kind: "subdivision", defaultGroup: "us_states", quizId: "type-flag" },
        "type-capital-subdivision": { label: "State Capitals", kind: "subdivision", defaultGroup: "us_states", quizId: "type-capital" }
    });

    const MODE_ORDER = Object.freeze([
        "click-country",
        "type-country",
        "find-country",
        "find-point",
        "type-flag",
        "type-capital",
        "click-subdivision",
        "type-subdivision",
        "find-subdivision",
        "find-point-subdivision",
        "type-flag-subdivision",
        "type-capital-subdivision"
    ]);

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

    function normalizeMode(mode, fallbackKind = "country") {
        const value = String(mode || "").trim();
        if (MODE_DEFINITIONS[value]) return value;
        return fallbackKind === "subdivision" ? "click-subdivision" : "click-country";
    }

    function modeDefinition(mode, fallbackKind = "country") {
        return MODE_DEFINITIONS[normalizeMode(mode, fallbackKind)];
    }

    function entryKey(name, mode) {
        return normalizeMode(mode) + ":" + normalizeName(name);
    }

    function emptyStore() {
        return { version: FORMAT_VERSION, entries: {} };
    }

    function storage() {
        return root?.localStorage || null;
    }

    function session() {
        return root?.sessionStorage || null;
    }

    function dispatchChange() {
        try {
            if (!root?.dispatchEvent) return;
            const EventCtor = root.CustomEvent || (typeof CustomEvent !== "undefined" ? CustomEvent : null);
            if (EventCtor) root.dispatchEvent(new EventCtor("smurdy:weakspotschange"));
        } catch (_) {}
    }

    function migratedEntry(name, mode, oldEntry, misses) {
        const definition = modeDefinition(mode, oldEntry?.kind);
        const normalizedMode = normalizeMode(mode, definition.kind);
        const now = Date.now();
        const group = String(oldEntry?.group || definition.defaultGroup);

        return {
            key: entryKey(name, normalizedMode),
            name: String(name),
            mode: normalizedMode,
            kind: definition.kind,
            group,
            misses: Math.max(1, Number(misses || oldEntry?.misses || 1)),
            createdAt: Number(oldEntry?.createdAt || now),
            updatedAt: Number(oldEntry?.updatedAt || now)
        };
    }

    function migrateStore(legacy) {
        const migrated = emptyStore();
        if (!legacy?.entries || typeof legacy.entries !== "object") return migrated;

        for (const oldEntry of Object.values(legacy.entries)) {
            if (!oldEntry?.name) continue;

            const remaining = Math.max(
                0,
                Number(oldEntry.misses || 1) - Number(oldEntry.retrySuccesses || 0)
            );
            if (!remaining) continue;

            if (oldEntry.mode && MODE_DEFINITIONS[oldEntry.mode]) {
                const entry = migratedEntry(oldEntry.name, oldEntry.mode, oldEntry, remaining);
                migrated.entries[entry.key] = entry;
                continue;
            }

            const modeCounts = oldEntry.modes && typeof oldEntry.modes === "object"
                ? Object.entries(oldEntry.modes).filter(([mode]) => MODE_DEFINITIONS[mode])
                : [];

            if (modeCounts.length) {
                for (const [mode, count] of modeCounts) {
                    const entry = migratedEntry(oldEntry.name, mode, oldEntry, count);
                    migrated.entries[entry.key] = entry;
                }
                continue;
            }

            const fallbackMode = oldEntry.kind === "subdivision"
                ? "click-subdivision"
                : "click-country";
            const entry = migratedEntry(oldEntry.name, fallbackMode, oldEntry, remaining);
            migrated.entries[entry.key] = entry;
        }

        return migrated;
    }

    function readStore() {
        const local = storage();
        if (!local) return emptyStore();

        try {
            const value = JSON.parse(local.getItem(STORAGE_KEY) || "null");
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
                const legacy = JSON.parse(local.getItem(legacyKey) || "null");
                if (!legacy?.entries || typeof legacy.entries !== "object") continue;

                const migrated = migrateStore(legacy);
                local.setItem(STORAGE_KEY, JSON.stringify(migrated));
                for (const oldKey of LEGACY_STORAGE_KEYS) local.removeItem(oldKey);
                return migrated;
            } catch (_) {}
        }

        return emptyStore();
    }

    function sortedEntries(store = readStore()) {
        return Object.values(store.entries || {})
            .filter(entry =>
                entry?.name &&
                MODE_DEFINITIONS[entry.mode] &&
                Date.now() - Number(entry.updatedAt || 0) <= MAX_AGE_MS
            )
            .sort((a, b) =>
                Number(b.misses || 0) - Number(a.misses || 0) ||
                Number(b.updatedAt || 0) - Number(a.updatedAt || 0) ||
                String(a.name).localeCompare(String(b.name)) ||
                String(a.mode).localeCompare(String(b.mode))
            );
    }

    function writeStore(store) {
        const local = storage();
        if (!local) return false;
        try {
            const keep = sortedEntries(store).slice(0, MAX_STORED);
            store.version = FORMAT_VERSION;
            store.entries = Object.fromEntries(keep.map(entry => [entry.key, entry]));
            local.setItem(STORAGE_KEY, JSON.stringify(store));
            dispatchChange();
            return true;
        } catch (_) {
            return false;
        }
    }

    function recordMiss(details = {}) {
        const name = String(details.name || "").trim();
        if (!normalizeName(name)) return null;

        const requestedMode = String(details.mode || "").trim();
        const fallbackKind = requestedMode.includes("subdivision") ? "subdivision" : "country";
        const mode = normalizeMode(requestedMode, fallbackKind);
        const definition = modeDefinition(mode, fallbackKind);
        const key = entryKey(name, mode);
        const store = readStore();
        const now = Date.now();
        const saved = store.entries[key];
        const group = String(details.group || saved?.group || definition.defaultGroup).trim() || definition.defaultGroup;
        const entry = saved && now - Number(saved.updatedAt || 0) <= MAX_AGE_MS
            ? saved
            : {
                key,
                name,
                mode,
                kind: definition.kind,
                group,
                misses: 0,
                createdAt: now,
                updatedAt: now
            };

        entry.name = name;
        entry.mode = mode;
        entry.kind = definition.kind;
        entry.group = group;
        entry.misses = Number(entry.misses || 0) + 1;
        entry.updatedAt = now;
        store.entries[key] = entry;
        writeStore(store);
        return { ...entry };
    }

    function recordRetrySuccess(details = {}) {
        const name = String(details.name || "").trim();
        if (!normalizeName(name)) return null;
        const requestedMode = String(details.mode || "").trim();
        const fallbackKind = requestedMode.includes("subdivision") ? "subdivision" : "country";
        const mode = normalizeMode(requestedMode, fallbackKind);
        const store = readStore();
        const key = entryKey(name, mode);
        if (!store.entries[key]) return null;

        delete store.entries[key];
        writeStore(store);
        return null;
    }

    function getAll() {
        return sortedEntries().map(entry => ({ ...entry }));
    }

    function clearAll() {
        try {
            const local = storage();
            if (local) {
                local.removeItem(STORAGE_KEY);
                for (const legacyKey of LEGACY_STORAGE_KEYS) local.removeItem(legacyKey);
            }
            session()?.removeItem(PLAN_KEY);
            dispatchChange();
            return true;
        } catch (_) {
            return false;
        }
    }

    function stageForEntries(entries, mode) {
        const definition = modeDefinition(mode);
        const seen = new Set();
        const names = [];
        for (const entry of entries || []) {
            const name = String(entry?.name || "").trim();
            const key = normalizeName(name);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            names.push(name);
        }
        return {
            mode,
            kind: definition.kind,
            label: definition.label,
            quizId: definition.quizId || mode,
            group: definition.defaultGroup,
            names
        };
    }

    function buildPracticeStagesFromEntries(entries) {
        const buckets = new Map();
        for (const entry of entries || []) {
            if (!entry?.name || !MODE_DEFINITIONS[entry.mode]) continue;
            if (!buckets.has(entry.mode)) buckets.set(entry.mode, []);
            buckets.get(entry.mode).push(entry);
        }

        return MODE_ORDER
            .filter(mode => buckets.has(mode))
            .map(mode => stageForEntries(buckets.get(mode), mode))
            .filter(stage => stage.names.length);
    }

    function buildPracticeStages() {
        return buildPracticeStagesFromEntries(getAll());
    }

    function cloneStage(stage) {
        return stage
            ? { ...stage, names: Array.isArray(stage.names) ? stage.names.slice() : [] }
            : null;
    }

    function pendingNamesForStage(stage, entries) {
        if (!stage || !MODE_DEFINITIONS[stage.mode]) return [];
        const pending = new Set(
            (entries || [])
                .filter(entry => entry?.name && entry.mode === stage.mode)
                .map(entry => entryKey(entry.name, entry.mode))
        );
        return (stage.names || []).filter(name => pending.has(entryKey(name, stage.mode)));
    }

    function progressPracticePlan(plan, entries) {
        if (!plan || !Array.isArray(plan.stages) || !Number.isInteger(plan.index)) {
            return { status: "none", plan: null, stage: null };
        }

        const stages = plan.stages.map(cloneStage).filter(Boolean);
        const index = plan.index;
        const current = stages[index];
        if (!current) return { status: "none", plan: null, stage: null };

        const currentPending = pendingNamesForStage(current, entries);
        if (currentPending.length) {
            const retryStage = {
                ...current,
                label: "Retry missed",
                names: currentPending,
                retry: true
            };
            stages[index] = retryStage;
            return {
                status: "retry",
                plan: { ...plan, version: PRACTICE_PLAN_VERSION, index, stages },
                stage: cloneStage(retryStage)
            };
        }

        for (let nextIndex = index + 1; nextIndex < stages.length; nextIndex++) {
            const next = stages[nextIndex];
            const nextPending = pendingNamesForStage(next, entries);
            if (!nextPending.length) continue;
            const nextStage = { ...next, names: nextPending, retry: false };
            stages[nextIndex] = nextStage;
            return {
                status: "next",
                plan: { ...plan, version: PRACTICE_PLAN_VERSION, index: nextIndex, stages },
                stage: cloneStage(nextStage)
            };
        }

        return { status: "complete", plan: null, stage: null };
    }

    function savePlanObject(plan) {
        try {
            const currentSession = session();
            if (!currentSession) return false;
            if (!plan) {
                currentSession.removeItem(PLAN_KEY);
                return true;
            }
            currentSession.setItem(PLAN_KEY, JSON.stringify(plan));
            return true;
        } catch (_) {
            return false;
        }
    }

    function readPracticePlan() {
        try {
            const currentSession = session();
            const plan = JSON.parse(currentSession?.getItem(PLAN_KEY) || "null");
            if (!plan || !Array.isArray(plan.stages) || !Number.isInteger(plan.index)) return null;

            if (plan.version === PRACTICE_PLAN_VERSION && plan.stages[plan.index]) {
                return plan;
            }

            // Session plans are short-lived, so upgrade an older regional plan by
            // rebuilding it from the user's current Weak Spots and staying on the
            // same mode when possible.
            const activeMode = plan.stages?.[plan.index]?.mode;
            const stages = buildPracticeStages();
            if (!stages.length) {
                currentSession?.removeItem(PLAN_KEY);
                return null;
            }
            const matchingIndex = stages.findIndex(stage => stage.mode === activeMode);
            const upgraded = {
                version: PRACTICE_PLAN_VERSION,
                index: matchingIndex >= 0 ? matchingIndex : 0,
                stages
            };
            savePlanObject(upgraded);
            return upgraded;
        } catch (_) {
            return null;
        }
    }

    function getActivePracticeStage() {
        const plan = readPracticePlan();
        const stage = plan?.stages?.[plan.index];
        return cloneStage(stage);
    }

    function advancePracticeStage() {
        const plan = readPracticePlan();
        if (!plan) return null;

        const progress = progressPracticePlan(plan, getAll());
        if (!savePlanObject(progress.plan)) return null;
        return cloneStage(progress.stage);
    }

    function practiceUrl(stage) {
        return "/quizzes/" + stage.quizId + "/" + encodeURIComponent(stage.group) + "/";
    }

    function openPracticeStage(stage) {
        if (!stage || !root?.location) return;
        let stored = false;
        try {
            stored = Boolean(root.SmurdyQuizLaunchIntent?.store?.(
                stage.quizId,
                stage.group,
                "weak_spots"
            ));
        } catch (_) {}

        if (!stored) {
            try {
                session()?.setItem("smurdy-quiz-launch-v1", JSON.stringify({
                    version: 1,
                    quizId: stage.quizId,
                    groupId: stage.group,
                    reason: "weak_spots",
                    createdAt: Date.now()
                }));
            } catch (_) {}
        }
        root.location.assign(practiceUrl(stage));
    }

    function savePracticePlan(stages) {
        const activeStages = (stages || [])
            .filter(stage => Array.isArray(stage.names) && stage.names.length)
            .map(cloneStage);
        if (!activeStages.length) return false;
        return savePlanObject({
            version: PRACTICE_PLAN_VERSION,
            index: 0,
            stages: activeStages
        });
    }

    function startPractice() {
        const stages = buildPracticeStages();
        if (!stages.length) return false;
        if (!savePracticePlan(stages)) {
            root?.alert?.("Weak Spots practice could not start because browser storage is unavailable.");
            return false;
        }
        openPracticeStage(stages[0]);
        return true;
    }

    function humanizeGroup(group) {
        const value = String(group || "").trim();
        if (!value || value === "world") return "World";
        if (value === "us_states") return "US States";
        return value
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function modeLabel(mode) {
        return modeDefinition(mode).label;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function updateMenuCount() {
        if (!root?.document) return;
        const count = getAll().length;
        root.document.querySelectorAll("[data-weak-spots-count]").forEach(badge => {
            badge.textContent = count ? String(count) : "";
            badge.hidden = count === 0;
        });
    }

    function closeDialog(dialog) {
        if (typeof dialog.close === "function" && dialog.open) dialog.close();
        else dialog.removeAttribute("open");
        root.document.body.classList.remove("weak-spots-dialog-open");
    }

    function renderDialog(dialog) {
        const list = dialog.querySelector("#weak-spots-list");
        const clearButton = dialog.querySelector("#weak-spots-clear");
        const retryButton = dialog.querySelector("#weak-spots-retry");
        const entries = getAll();
        if (!list) return;

        if (!entries.length) {
            list.innerHTML = '<li class="weak-spots-empty">No weak spots yet.</li>';
        } else {
            list.innerHTML = entries.slice(0, MAX_VISIBLE).map(entry => (
                '<li class="weak-spot-item">' +
                    '<div class="weak-spot-main">' +
                        '<span class="weak-spot-name">' + escapeHtml(entry.name) + "</span>" +
                        '<span class="weak-spot-context">' +
                            escapeHtml(humanizeGroup(entry.group)) + " / " +
                            escapeHtml(modeLabel(entry.mode)) +
                        "</span>" +
                    "</div>" +
                    '<div class="weak-spot-meta">' +
                        Number(entry.misses || 0) + " " +
                        (Number(entry.misses) === 1 ? "miss" : "misses") +
                    "</div>" +
                "</li>"
            )).join("");
        }

        const limitNote = dialog.querySelector("#weak-spots-limit-note");
        if (limitNote) limitNote.hidden = entries.length <= MAX_VISIBLE;
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
        let dialog = root.document.getElementById("weak-spots-dialog");
        if (dialog) return dialog;

        dialog = root.document.createElement("dialog");
        dialog.id = "weak-spots-dialog";
        dialog.setAttribute("aria-labelledby", "weak-spots-title");
        dialog.innerHTML =
            '<div class="weak-spots-dialog-card">' +
                '<header class="weak-spots-dialog-header">' +
                    '<div><h2 id="weak-spots-title">Weak Spots</h2></div>' +
                    '<button id="weak-spots-close" type="button">Close</button>' +
                "</header>" +
                '<ol id="weak-spots-list" class="weak-spots-list"></ol>' +
                '<footer class="weak-spots-dialog-footer">' +
                    '<span id="weak-spots-limit-note" hidden>Showing the first ' + MAX_VISIBLE + ' weak spots</span>' +
                    '<div class="weak-spots-dialog-actions">' +
                        '<button id="weak-spots-clear" type="button">Clear</button>' +
                        '<button id="weak-spots-retry" type="button">Retry Missed</button>' +
                    "</div>" +
                "</footer>" +
            "</div>";

        root.document.body.appendChild(dialog);
        dialog.querySelector("#weak-spots-close").addEventListener("click", () => closeDialog(dialog));
        dialog.querySelector("#weak-spots-clear").addEventListener("click", () => {
            if (!root.confirm("Clear every saved weak spot on this device?")) return;
            clearAll();
            renderDialog(dialog);
        });
        dialog.querySelector("#weak-spots-retry").addEventListener("click", () => startPractice());
        dialog.addEventListener("click", event => {
            if (event.target === dialog) closeDialog(dialog);
        });
        dialog.addEventListener("cancel", () => {
            root.document.body.classList.remove("weak-spots-dialog-open");
        });
        return dialog;
    }

    function openDialog() {
        const dialog = ensureDialog();
        renderDialog(dialog);
        root.document.body.classList.add("weak-spots-dialog-open");
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
    }

    function install() {
        if (!root?.document) return;
        if (!root.document.documentElement.dataset.weakSpotsDelegated) {
            root.document.documentElement.dataset.weakSpotsDelegated = "true";
            root.document.addEventListener("click", event => {
                const button = event.target.closest?.("[data-weak-spots-open]");
                if (!button) return;
                event.preventDefault();
                openDialog();
            });
        }
        updateMenuCount();
        root.addEventListener("smurdy:weakspotschange", updateMenuCount);
    }

    return {
        storageKey: STORAGE_KEY,
        practicePlanKey: PLAN_KEY,
        formatVersion: FORMAT_VERSION,
        practicePlanVersion: PRACTICE_PLAN_VERSION,
        normalizeName,
        normalizeMode,
        modeDefinition,
        entryKey,
        migrateStore,
        buildPracticeStagesFromEntries,
        pendingNamesForStage,
        progressPracticePlan,
        recordMiss,
        recordRetrySuccess,
        getAll,
        clearAll,
        startPractice,
        getActivePracticeStage,
        advancePracticeStage,
        openPracticeStage,
        refreshMenuCount: updateMenuCount,
        open: openDialog,
        install
    };
});