(function initFlagQuiz(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (!root || !root.document) return;

    root.SmurdyFlagQuiz = api;
    const start = () => api.mount(root.document, root);
    if (root.document.readyState === "loading") {
        root.document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})(typeof window !== "undefined" ? window : null, function createFlagQuizApi() {
    "use strict";

    function normalizeAnswer(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[.'’]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function acceptedAnswers(name, aliases) {
        const direct = Array.isArray(aliases?.[name]) ? aliases[name] : [];
        const normalizedName = normalizeAnswer(name);
        const reverse = Object.entries(aliases || {})
            .filter(([canonical, values]) =>
                normalizeAnswer(canonical) === normalizedName ||
                (Array.isArray(values) && values.some(value => normalizeAnswer(value) === normalizedName))
            )
            .flatMap(([canonical, values]) => [canonical, ...(Array.isArray(values) ? values : [])]);
        return new Set([name, ...direct, ...reverse].map(normalizeAnswer).filter(Boolean));
    }

    function canonicalFlagName(name, aliases) {
        const normalizedName = normalizeAnswer(name);
        const match = Object.entries(aliases || {}).find(([canonical, values]) =>
            normalizeAnswer(canonical) === normalizedName ||
            (Array.isArray(values) && values.some(value => normalizeAnswer(value) === normalizedName))
        );
        return match ? match[0] : String(name);
    }

    function selectFlags(source, setId, flagGroups = {}, countryGroups = {}, aliases = {}) {
        const definition = flagGroups?.[setId] || {};
        const kind = definition.sourceKind || (setId === "us_states" ? "us-state" : "country");
        let selected = (source?.flags || []).filter(flag => flag.kind === kind && flag.name && flag.filename);

        if (definition.sourceGroup) {
            const sourceGroup = countryGroups?.[definition.sourceGroup] || {};
            const members = sourceGroup.members || sourceGroup.countries || [];
            const acceptedMembers = members.map(name => acceptedAnswers(name, aliases));
            selected = selected.filter(flag =>
                acceptedMembers.some(answers => answers.has(normalizeAnswer(flag.name)))
            );
        }

        return selected.map(flag => ({
            id: `${flag.kind}:${flag.filename}`,
            name: canonicalFlagName(flag.name, aliases),
            src: `/assets/flags/${flag.filename}`
        }));
    }

    function shuffle(items, random = Math.random) {
        const result = items.slice();
        for (let index = result.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    function formatElapsed(milliseconds) {
        const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function mount(document, root) {
        const body = document.body;
        const setId = body?.dataset.flagSet || "world";
        const launch = document.querySelector("[data-flag-launch]");
        const landing = document.querySelector("[data-flag-landing]");
        const game = document.querySelector("[data-flag-game]");
        const image = document.querySelector("[data-flag-image]");
        const form = document.querySelector("[data-flag-form]");
        const input = document.querySelector("[data-flag-input]");
        const result = document.querySelector("[data-flag-result]");
        const progress = document.querySelector("[data-flag-progress]");
        const progressBar = document.querySelector("[data-flag-progress-bar]");
        const accuracy = document.querySelector("[data-flag-accuracy]");
        const timer = document.querySelector("[data-flag-time]");
        const giveUp = document.querySelector("[data-flag-giveup]");
        const restart = document.querySelector("[data-flag-restart]");
        const retry = document.querySelector("[data-flag-retry]");
        const review = document.querySelector("[data-flag-review]");
        const summary = document.querySelector("[data-flag-summary]");
        const favorite = document.querySelector("[data-flag-favorite]");
        const afterActions = document.querySelector("[data-flag-after-actions]");

        if (!launch || !landing || !game || !image || !form || !input) return null;

        let allFlags = [];
        let flags = [];
        let aliases = {};
        let flagGroups = {};
        let index = 0;
        let attempts = 0;
        let correct = 0;
        let locked = false;
        let misses = [];
        let startedAt = 0;
        let elapsed = 0;
        let timerInterval = null;
        let advanceTimeout = null;
        let loadPromise = null;

        function analyticsSnapshot(answerCorrect) {
            return {
                correct: answerCorrect,
                attempts,
                correctAnswers: correct,
                completedPlaces: index + (locked ? 1 : 0),
                placesTotal: flags.length,
                completionTimeSeconds: Math.round(elapsed / 1000)
            };
        }

        function updateFavoriteButton() {
            if (!favorite) return;
            const saved = Boolean(root.SmurdyQuizLibrary?.isFavorite?.("type-flag", setId));
            favorite.setAttribute("aria-pressed", String(saved));
            favorite.textContent = saved ? "★ Favorited" : "☆ Add to favorites";
        }

        function updateStats() {
            const completed = Math.min(index, flags.length);
            if (progress) progress.textContent = `${completed} / ${flags.length} completed`;
            if (progressBar) {
                progressBar.style.width = `${flags.length ? (completed / flags.length) * 100 : 0}%`;
                progressBar.parentElement?.setAttribute("aria-valuenow", String(completed));
                progressBar.parentElement?.setAttribute("aria-valuemax", String(flags.length));
            }
            if (accuracy) {
                const percent = attempts ? Math.round((correct / attempts) * 100) : 100;
                accuracy.textContent = `${percent}% correct`;
            }
            if (timer) timer.textContent = formatElapsed(elapsed);
        }

        function stopTimer() {
            if (timerInterval) root.clearInterval(timerInterval);
            timerInterval = null;
            if (startedAt) elapsed = Date.now() - startedAt;
            updateStats();
        }

        function startTimer() {
            stopTimer();
            elapsed = 0;
            startedAt = Date.now();
            timerInterval = root.setInterval(() => {
                elapsed = Date.now() - startedAt;
                updateStats();
            }, 250);
        }

        function renderReview() {
            if (!review) return;
            review.hidden = misses.length === 0;
            review.innerHTML = misses.length ? `
                <h2>Flags to review</h2>
                <p>These were answered incorrectly or given up.</p>
                <ul class="flag-review-grid">${misses.map(flag => `
                    <li><img src="${escapeHtml(flag.src)}" alt=""><span>${escapeHtml(flag.name)}</span></li>
                `).join("")}</ul>` : "";
        }

        function finishQuiz() {
            stopTimer();
            image.removeAttribute("src");
            image.alt = "";
            image.hidden = true;
            form.hidden = true;
            giveUp.hidden = true;
            restart.hidden = false;
            if (retry) retry.hidden = misses.length === 0;
            if (afterActions) afterActions.hidden = false;

            const percent = attempts ? Math.round((correct / attempts) * 100) : 100;
            result.textContent = "Quiz complete";
            result.className = "flag-result is-finished";
            if (summary) {
                summary.hidden = false;
                summary.innerHTML = `
                    <h2>Results</h2>
                    <div class="flag-summary-grid">
                        <div><strong>${correct} / ${flags.length}</strong><span>Flags correct</span></div>
                        <div><strong>${percent}%</strong><span>Accuracy</span></div>
                        <div><strong>${formatElapsed(elapsed)}</strong><span>Time</span></div>
                    </div>`;
            }
            renderReview();
            updateStats();
            root.SmurdyAnalytics?.completeQuiz?.(analyticsSnapshot());
        }

        function showQuestion() {
            locked = false;
            result.textContent = "";
            result.className = "flag-result";
            input.value = "";

            if (index >= flags.length) {
                finishQuiz();
                return;
            }

            const current = flags[index];
            image.hidden = false;
            image.src = current.src;
            image.alt = `Flag ${index + 1} of ${flags.length}`;
            form.hidden = false;
            giveUp.hidden = false;
            restart.hidden = false;
            if (retry) retry.hidden = true;
            if (summary) summary.hidden = true;
            if (afterActions) afterActions.hidden = true;
            updateStats();
            input.focus({ preventScroll: true });

            const next = flags[index + 1];
            if (next) new Image().src = next.src;
        }

        function recordMiss(current, guess, gaveUp) {
            if (!misses.some(flag => flag.id === current.id)) misses.push(current);
            try {
                root.SmurdyWeakSpots?.recordMiss?.({
                    name: current.name,
                    mode: setId === "us_states" ? "type-flag-subdivision" : "type-flag",
                    group: setId,
                    guess: gaveUp ? "" : String(guess || "")
                });
            } catch (_) {}
        }

        function finishQuestion(wasCorrect, guess, gaveUp = false) {
            if (locked || !flags[index]) return;
            locked = true;
            attempts++;

            const current = flags[index];
            if (wasCorrect) {
                correct++;
                result.textContent = "Correct!";
                result.classList.add("is-correct");
            } else {
                recordMiss(current, guess, gaveUp);
                result.textContent = `Answer: ${current.name}`;
                result.classList.add("is-wrong");
            }

            root.SmurdyAnalytics?.recordAnswer?.(analyticsSnapshot(wasCorrect));
            updateStats();
            advanceTimeout = root.setTimeout(() => {
                advanceTimeout = null;
                index++;
                showQuestion();
            }, wasCorrect ? 650 : 1150);
        }

        function submitAnswer(event) {
            event.preventDefault();
            if (locked || !flags[index]) return;
            const guess = normalizeAnswer(input.value);
            if (!guess) return;
            finishQuestion(acceptedAnswers(flags[index].name, aliases).has(guess), input.value);
        }

        function startRun(items, reason = "start") {
            if (advanceTimeout) root.clearTimeout(advanceTimeout);
            advanceTimeout = null;
            flags = shuffle(items);
            index = 0;
            attempts = 0;
            correct = 0;
            misses = [];
            locked = false;
            if (review) { review.hidden = true; review.innerHTML = ""; }
            if (afterActions) afterActions.hidden = true;
            root.SmurdyAnalytics?.beginQuiz?.({
                quiz_mode: "type-flag",
                quiz_group: setId,
                places_total: flags.length,
                start_reason: reason
            });
            startTimer();
            showQuestion();
        }

        async function loadData() {
            if (!loadPromise) {
                const fetchJson = path => root.fetch(path).then(response => {
                    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
                    return response.json();
                });
                loadPromise = Promise.all([
                    fetchJson("/src/data/flag_sources.json"),
                    fetchJson("/src/data/aliases.json"),
                    fetchJson("/src/data/flag_groups.json"),
                    fetchJson("/src/data/country_groups.json")
                ]);
            }
            return loadPromise;
        }

        async function launchQuiz() {
            if (launch.disabled) return;
            launch.disabled = true;
            launch.textContent = "Loading flags...";

            try {
                const [source, loadedAliases, loadedFlagGroups, countryGroups] = await loadData();
                aliases = loadedAliases || {};
                flagGroups = loadedFlagGroups || {};
                allFlags = selectFlags(source, setId, flagGroups, countryGroups, aliases);
                const expected = Number(flagGroups?.[setId]?.memberCount || 0);
                if (!allFlags.length || (expected && allFlags.length !== expected)) {
                    throw new Error(`Expected ${expected || "some"} flags for ${setId}, found ${allFlags.length}`);
                }

                landing.hidden = true;
                game.hidden = false;
                body.classList.add("flag-quiz-running");
                try { root.SmurdyQuizLibrary?.recordPlayed?.("type-flag", setId); } catch (_) {}
                startRun(allFlags);
            } catch (error) {
                console.error("Could not start flag quiz", error);
                launch.disabled = false;
                launch.textContent = "Try again";
                result.textContent = "The flags could not load. Please try again.";
            }
        }

        launch.addEventListener("click", launchQuiz);
        form.addEventListener("submit", submitAnswer);
        giveUp?.addEventListener("click", () => finishQuestion(false, "", true));
        restart?.addEventListener("click", () => startRun(allFlags, "restart"));
        retry?.addEventListener("click", () => {
            const missedFlags = misses.slice();
            if (missedFlags.length) startRun(missedFlags, "retry_missed");
        });
        favorite?.addEventListener("click", () => {
            root.SmurdyQuizLibrary?.toggleFavorite?.("type-flag", setId);
            updateFavoriteButton();
        });
        updateFavoriteButton();

        try {
            if (new URLSearchParams(root.location?.search || "").get("play") === "1") {
                void launchQuiz();
            }
        } catch (_) {}

        return { launchQuiz, restartQuiz: () => startRun(allFlags, "restart") };
    }

    return { normalizeAnswer, acceptedAnswers, canonicalFlagName, selectFlags, shuffle, formatElapsed, mount };
});
