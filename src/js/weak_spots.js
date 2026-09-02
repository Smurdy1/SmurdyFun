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
    const MAX_STORED = 150;
    const MAX_VISIBLE = 18;
    const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

    const MODE_DEFINITIONS = Object.freeze({
        "click-country": { label: "Click Countries", kind: "country", defaultGroup: "world" },
        "type-country": { label: "Type Countries", kind: "country", defaultGroup: "world" },
        "find-country": { label: "No Borders", kind: "country", defaultGroup: "world" },
        "find-point": { label: "Find from a Point", kind: "country", defaultGroup: "world" },
        "click-subdivision": { label: "Click States", kind: "subdivision", defaultGroup: "us_states" },
        "type-subdivision": { label: "Type States", kind: "subdivision", defaultGroup: "us_states" },
        "find-subdivision": { label: "No Borders States", kind: "subdivision", defaultGroup: "us_states" },
        "find-point-subdivision": { label: "Find State from a Point", kind: "subdivision", defaultGroup: "us_states" },
        "type-flag": { label: "Flags", kind: "country", defaultGroup: "world", quizId: "type-flag" },
        "type-flag-subdivision": { label: "State Flags", kind: "subdivision", defaultGroup: "us_states", quizId: "type-flag" }
    });

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

        // Older stores counted modes and groups independently, so a regional
        // group cannot be safely assigned to one specific mode. Use a known
        // broad group unless the legacy entry explicitly stored one group.
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

    function humanizeGroup(group) {
        const value = String(group || "").trim();
        if (!value || value === "world") return "World";
        if (value === "us_states") return "US States";
        return value
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function stageForEntries(entries, mode, group) {
        const definition = modeDefinition(mode);
        const names = [...new Set(entries.map(entry => entry.name).filter(Boolean))];
        return {
            mode,
            kind: definition.kind,
            label: definition.label + " · " + humanizeGroup(group),
            quizId: definition.quizId || mode,
            group: group || definition.defaultGroup,
            names
        };
    }

    function buildPracticeStagesFromEntries(entries) {
        const buckets = new Map();
        for (const entry of entries || []) {
            if (!entry?.name || !MODE_DEFINITIONS[entry.mode]) continue;
            const definition = modeDefinition(entry.mode, entry.kind);
            const group = String(entry.group || definition.defaultGroup);
            const bucketKey = entry.mode + "\n" + group;
            if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
            buckets.get(bucketKey).push(entry);
        }

        return Array.from(buckets.values())
            .map(bucket => stageForEntries(bucket, bucket[0].mode, bucket[0].group))
            .filter(stage => stage.names.length);
    }

    function buildPracticeStages() {
        return buildPracticeStagesFromEntries(getAll());
    }

    function readPracticePlan() {
        try {
            const plan = JSON.parse(session()?.getItem(PLAN_KEY) || "null");
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
        const stage = plan?.stages?.[plan.index];
        return stage ? { ...stage, names: stage.names.slice() } : null;
    }

    function advancePracticeStage() {
        const plan = readPracticePlan();
        if (!plan) return null;

        plan.index++;
        if (!plan.stages[plan.index]) {
            try { session()?.removeItem(PLAN_KEY); } catch (_) {}
            return null;
        }

        try { session()?.setItem(PLAN_KEY, JSON.stringify(plan)); } catch (_) {
            return null;
        }
        return getActivePracticeStage();
    }

    function practiceUrl(stage) {
        return "/quizzes/" + stage.quizId + "/" + encodeURIComponent(stage.group) + "/?weakSpotsPractice=1";
    }

    function openPracticeStage(stage) {
        if (!stage || !root?.location) return;
        root.location.assign(practiceUrl(stage));
    }

    function savePracticePlan(stages) {
        const activeStages = (stages || []).filter(stage => Array.isArray(stage.names) && stage.names.length);
        if (!activeStages.length) return false;
        try {
            session()?.setItem(PLAN_KEY, JSON.stringify({
                version: 2,
                index: 0,
                stages: activeStages
            }));
            return true;
        } catch (_) {
            return false;
        }
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

    function currentRouteStage(names) {
        const match = String(root?.location?.pathname || "")
            .match(/^\/quizzes\/([^/]+)\/([^/]+)\/?$/);
        if (!match) return null;

        const routeQuizId = decodeURIComponent(match[1]);
        const group = decodeURIComponent(match[2]);
        let mode = routeQuizId;
        if (routeQuizId === "type-flag") {
            mode = group === "us_states" ? "type-flag-subdivision" : "type-flag";
        }
        if (!MODE_DEFINITIONS[mode]) return null;
        return stageForEntries(
            names.map(name => ({ name, mode, group })),
            mode,
            group
        );
    }

    function startCurrentModeRetry(names) {
        const stage = currentRouteStage(names);
        if (!stage || !stage.names.length) return false;
        if (!savePracticePlan([stage])) return false;
        openPracticeStage(stage);
        return true;
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
            list.innerHTML =
                '<li class="weak-spots-empty"><strong>No weak spots yet.</strong>' +
                "<span>Missed places are saved here by quiz type.</span></li>";
        } else {
            list.innerHTML = entries.slice(0, MAX_VISIBLE).map(entry => (
                '<li class="weak-spot-item">' +
                    '<div class="weak-spot-name">' + escapeHtml(entry.name) + "</div>" +
                    '<div class="weak-spot-meta">' +
                        escapeHtml(modeLabel(entry.mode)) + " · " +
                        Number(entry.misses || 0) + " " +
                        (Number(entry.misses) === 1 ? "miss" : "misses") +
                    "</div>" +
                "</li>"
            )).join("");
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
        let dialog = root.document.getElementById("weak-spots-dialog");
        if (dialog) return dialog;

        dialog = root.document.createElement("dialog");
        dialog.id = "weak-spots-dialog";
        dialog.setAttribute("aria-labelledby", "weak-spots-title");
        dialog.innerHTML =
            '<div class="weak-spots-dialog-card">' +
                '<header class="weak-spots-dialog-header">' +
                    '<div><h2 id="weak-spots-title">Weak Spots</h2>' +
                    "<p>Each quiz type is tracked separately. Retry Missed uses the same kind of question, and one clean answer clears that weak spot.</p></div>" +
                    '<button id="weak-spots-close" type="button" aria-label="Close Weak Spots">×</button>' +
                "</header>" +
                '<ol id="weak-spots-list" class="weak-spots-list"></ol>' +
                '<footer class="weak-spots-dialog-footer">' +
                    "<span>Showing up to " + MAX_VISIBLE + " weak spots</span>" +
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

    function reviewNamesFromButton(button) {
        const review = button?.closest?.("#quiz-review, [data-flag-game]") || root.document;
        const selector = button?.matches?.("[data-flag-retry]")
            ? "[data-flag-review] li span"
            : ".quiz-review-country-name";
        return Array.from(review.querySelectorAll(selector))
            .map(node => String(node.textContent || "").trim())
            .filter(Boolean);
    }

    function installRetryInterception() {
        if (root.document.documentElement.dataset.weakSpotsRetryDelegated) return;
        root.document.documentElement.dataset.weakSpotsRetryDelegated = "true";
        root.document.addEventListener("click", event => {
            const button = event.target.closest?.("#quiz-review-retry, [data-flag-retry]");
            if (!button || button.disabled) return;
            const names = reviewNamesFromButton(button);
            if (!names.length || !startCurrentModeRetry(names)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
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
        installRetryInterception();
        updateMenuCount();
        root.addEventListener("smurdy:weakspotschange", updateMenuCount);
    }

    return {
        storageKey: STORAGE_KEY,
        practicePlanKey: PLAN_KEY,
        formatVersion: FORMAT_VERSION,
        normalizeName,
        normalizeMode,
        modeDefinition,
        entryKey,
        migrateStore,
        buildPracticeStagesFromEntries,
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
