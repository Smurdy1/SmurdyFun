(function initQuizSession(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.SmurdyQuizSession = api;
})(typeof window !== "undefined" ? window : null, function createQuizSessionApi() {
    "use strict";

    function defaultKey(value) {
        if (value && typeof value === "object") {
            if (value.id != null) return String(value.id);
            if (value.name != null) return String(value.name);
        }
        return String(value == null ? "" : value);
    }

    function defaultName(value) {
        if (value && typeof value === "object" && value.name != null) {
            return String(value.name);
        }
        return String(value == null ? "" : value);
    }

    function normalizeMiss(raw) {
        const guesses = Array.isArray(raw?.guesses)
            ? raw.guesses.map(value => String(value)).filter(Boolean).slice(0, 4)
            : [];
        return {
            key: String(raw?.key || ""),
            name: String(raw?.name || ""),
            count: Math.max(0, Number(raw?.count) || 0),
            guesses,
            gaveUp: Math.max(0, Number(raw?.gaveUp) || 0),
            data: raw?.data ?? null,
            item: raw?.item ?? null
        };
    }

    function createSession(options = {}) {
        const keyOf = typeof options.keyOf === "function" ? options.keyOf : defaultKey;
        const nameOf = typeof options.nameOf === "function" ? options.nameOf : defaultName;
        const now = typeof options.now === "function" ? options.now : Date.now;

        let completed = new Map();
        let misses = new Map();
        let attempts = 0;
        let correctAnswers = 0;
        let firstTryCorrect = 0;
        let total = 0;
        let currentKey = "";
        let lastQuestionKey = "";
        let startedAt = 0;
        let elapsedMs = 0;
        let running = false;

        function itemKey(item) {
            return String(keyOf(item) || "");
        }

        function itemName(item) {
            return String(nameOf(item) || "");
        }

        function reset({ total: nextTotal = 0, preserveLastQuestion = false } = {}) {
            completed = new Map();
            misses = new Map();
            attempts = 0;
            correctAnswers = 0;
            firstTryCorrect = 0;
            total = Math.max(0, Number(nextTotal) || 0);
            currentKey = "";
            if (!preserveLastQuestion) lastQuestionKey = "";
            resetClock();
            return snapshot();
        }

        function startClock() {
            elapsedMs = 0;
            startedAt = now();
            running = true;
            return startedAt;
        }

        function stopClock() {
            if (running && startedAt) elapsedMs = Math.max(0, now() - startedAt);
            running = false;
            startedAt = 0;
            return elapsedMs;
        }

        function resetClock() {
            running = false;
            startedAt = 0;
            elapsedMs = 0;
        }

        function getElapsedMs() {
            return running && startedAt
                ? Math.max(0, now() - startedAt)
                : Math.max(0, elapsedMs);
        }

        function setCurrent(item) {
            const key = itemKey(item);
            currentKey = key;
            if (key) lastQuestionKey = key;
            return key;
        }

        function isCompleted(item) {
            const key = itemKey(item);
            return Boolean(key && completed.has(key));
        }

        function hasMiss(item) {
            const key = itemKey(item);
            return Boolean(key && misses.has(key));
        }

        function getRemaining(items) {
            return (Array.isArray(items) ? items : []).filter(item => !isCompleted(item));
        }

        function getQuestionCandidates(items) {
            const source = Array.isArray(items) ? items : [];
            if (source.length <= 1 || !lastQuestionKey) return source.slice();
            const filtered = source.filter(item => itemKey(item) !== lastQuestionKey);
            return filtered.length ? filtered : source.slice();
        }

        function recordMiss(item, { guess = "", gaveUp = false, data = null } = {}) {
            const key = itemKey(item);
            if (!key) return null;

            const existing = misses.get(key) || normalizeMiss({
                key,
                name: itemName(item),
                count: 0,
                guesses: [],
                gaveUp: 0,
                data,
                item
            });

            existing.count += 1;
            existing.item = item;
            if (data !== null && data !== undefined) existing.data = data;

            if (gaveUp) {
                existing.gaveUp += 1;
            } else {
                const cleanGuess = String(guess || "").trim();
                if (
                    cleanGuess &&
                    !existing.guesses.includes(cleanGuess) &&
                    existing.guesses.length < 4
                ) {
                    existing.guesses.push(cleanGuess);
                }
            }

            misses.set(key, existing);
            return normalizeMiss(existing);
        }

        function recordAnswer(item, { correct = false, guess = "", gaveUp = false, data = null } = {}) {
            const key = itemKey(item);
            if (!key) return null;

            const hadMiss = misses.has(key);
            attempts += 1;

            if (correct) {
                correctAnswers += 1;
                completed.set(key, item);
                if (!hadMiss) firstTryCorrect += 1;
                return {
                    correct: true,
                    hadMiss,
                    miss: misses.has(key) ? normalizeMiss(misses.get(key)) : null
                };
            }

            return {
                correct: false,
                hadMiss,
                miss: recordMiss(item, { guess, gaveUp, data })
            };
        }

        function getCompletedItems() {
            return Array.from(completed.values());
        }

        function getCompletedKeys() {
            return Array.from(completed.keys());
        }

        function getMisses() {
            return Array.from(misses.values()).map(normalizeMiss);
        }

        function accuracyPercent() {
            return attempts === 0 ? 100 : Math.round((correctAnswers / attempts) * 100);
        }

        function snapshot({ total: totalOverride } = {}) {
            const resolvedTotal = totalOverride == null
                ? total
                : Math.max(0, Number(totalOverride) || 0);
            return {
                total: resolvedTotal,
                attempts,
                correctAnswers,
                firstTryCorrect,
                completedCount: completed.size,
                missCount: misses.size,
                accuracyPercent: accuracyPercent(),
                elapsedMs: getElapsedMs(),
                currentKey,
                lastQuestionKey,
                running
            };
        }

        function seed(state = {}) {
            reset({
                total: state.total,
                preserveLastQuestion: Boolean(state.preserveLastQuestion)
            });

            for (const item of (state.completedItems || [])) {
                const key = itemKey(item);
                if (key) completed.set(key, item);
            }

            for (const raw of (state.misses || [])) {
                const normalized = normalizeMiss(raw);
                if (normalized.key) misses.set(normalized.key, normalized);
            }

            attempts = Math.max(0, Number(state.attempts) || 0);
            correctAnswers = Math.max(0, Number(state.correctAnswers) || 0);
            firstTryCorrect = Math.max(0, Number(state.firstTryCorrect) || 0);
            return snapshot();
        }

        return {
            reset,
            seed,
            startClock,
            stopClock,
            resetClock,
            getElapsedMs,
            setCurrent,
            isCompleted,
            hasMiss,
            getRemaining,
            getQuestionCandidates,
            recordMiss,
            recordAnswer,
            getCompletedItems,
            getCompletedKeys,
            getMisses,
            snapshot
        };
    }

    return {
        createSession,
        normalizeMiss
    };
});
