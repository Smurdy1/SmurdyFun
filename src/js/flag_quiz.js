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

    function filterFlagsByNames(flags, names) {
        const wanted = new Set((names || []).map(normalizeAnswer).filter(Boolean));
        if (!wanted.size) return [];
        return (flags || []).filter(flag => wanted.has(normalizeAnswer(flag?.name)));
    }

    function remainingFlags(flags, completedIds) {
        const completed = completedIds instanceof Set ? completedIds : new Set(completedIds || []);
        return (flags || []).filter(flag => !completed.has(flag.id));
    }

    function chooseNextFlag(flags, completedIds, lastId, random = Math.random) {
        const remaining = remainingFlags(flags, completedIds);
        if (!remaining.length) return null;
        const candidates = remaining.length > 1 && lastId
            ? remaining.filter(flag => flag.id !== lastId)
            : remaining;
        return candidates[Math.floor(random() * candidates.length)] || remaining[0];
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
        const stage = image?.closest?.(".flag-stage") || null;
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
        let locked = false;
        let currentFlag = null;
        let timerInterval = null;
        const quizSession = root.SmurdyQuizSession?.createSession?.({
            keyOf: flag => flag?.id || "",
            nameOf: flag => flag?.name || ""
        });
        if (!quizSession) {
            console.error("SmurdyQuizSession must load before flag_quiz.js");
            return null;
        }
        const completion = root.SmurdyQuizCompletion;
        if (!completion?.buildResult) {
            console.error("SmurdyQuizCompletion must load before flag_quiz.js");
            return null;
        }
        const analyticsReporter = completion.createAnalyticsReporter({
            root,
            session: quizSession,
            context: () => ({ quiz_mode: "type-flag", quiz_group: setId }),
            total: () => flags.length
        });
        let lastCompletionResult = null;
        let advanceTimeout = null;
        let loadPromise = null;
        let retryWeakSpots = false;
        let weakSpotsPracticeStage = null;
        let initialLaunchIntent = null;

        function weakSpotMode() {
            return setId === "us_states" ? "type-flag-subdivision" : "type-flag";
        }

        function getWeakSpotsPracticeStage() {
            try {
                if (initialLaunchIntent?.reason !== "weak_spots") return null;
                const stage = root.SmurdyWeakSpots?.getActivePracticeStage?.() || null;
                if (!stage || stage.quizId !== "type-flag") return null;
                if (String(stage.group || "") !== String(setId)) return null;
                return stage;
            } catch (_) {
                return null;
            }
        }

        function clearWeakSpot(current) {
            try {
                root.SmurdyWeakSpots?.recordRetrySuccess?.({
                    name: current.name,
                    mode: weakSpotMode(),
                    group: setId
                });
            } catch (_) {}
        }

        function removePracticeContinuation() {
            afterActions?.querySelector?.("[data-weak-spots-next]")?.remove();
        }

        function showPracticeContinuation(stage) {
            removePracticeContinuation();
            if (!stage || !afterActions) return;
            const button = document.createElement("button");
            button.className = "flag-button";
            button.type = "button";
            button.dataset.weakSpotsNext = "";
            button.textContent = `Continue: ${stage.label}`;
            button.addEventListener("click", () => {
                root.SmurdyWeakSpots?.openPracticeStage?.(stage);
            });
            afterActions.prepend(button);
        }

        function updateFavoriteButton() {
            if (!favorite) return;
            const saved = Boolean(root.SmurdyQuizLibrary?.isFavorite?.("type-flag", setId));
            favorite.setAttribute("aria-pressed", String(saved));
            favorite.textContent = saved ? "★ Favorited" : "☆ Add to favorites";
        }

        function updateStats() {
            const snapshot = quizSession.snapshot({ total: flags.length });
            if (progress) progress.textContent = `${snapshot.completedCount} / ${snapshot.total} completed`;
            if (progressBar) {
                progressBar.style.width = `${snapshot.total ? (snapshot.completedCount / snapshot.total) * 100 : 0}%`;
                progressBar.parentElement?.setAttribute("aria-valuenow", String(snapshot.completedCount));
                progressBar.parentElement?.setAttribute("aria-valuemax", String(snapshot.total));
            }
            if (accuracy) accuracy.textContent = `${snapshot.accuracyPercent}% correct`;
            if (timer) timer.textContent = formatElapsed(snapshot.elapsedMs);
        }

        function stopTimer() {
            if (timerInterval) root.clearInterval(timerInterval);
            timerInterval = null;
            quizSession.stopClock();
            updateStats();
        }

        function startTimer() {
            stopTimer();
            quizSession.startClock();
            timerInterval = root.setInterval(updateStats, 250);
        }

        function renderReview(completionResult) {
            if (!review || !completionResult) return;
            completion.renderReview(review, completionResult, {
                title: "Flags to review",
                titleTag: "h2",
                showRetry: false,
                listTag: "ul",
                listClass: "flag-review-grid",
                renderItem(item, row, document) {
                    const image = document.createElement("img");
                    image.src = item.data?.src || "";
                    image.alt = "";
                    const name = document.createElement("span");
                    name.textContent = item.name;
                    row.append(image, name);
                }
            });
        }

        function finishQuiz() {
            stopTimer();
            const groupLabel =
                flagGroups?.[setId]?.shortLabel ||
                flagGroups?.[setId]?.label ||
                completion.humanizeSlug(setId);
            lastCompletionResult = completion.buildResult({
                session: quizSession,
                total: flags.length,
                quizId: "type-flag",
                groupId: setId,
                groupLabel,
                modeLabel: "Flags",
                itemSingular: "flag",
                itemPlural: "flags",
                shareHeadline: `I finished the ${groupLabel} flag quiz`
            });
            const misses = lastCompletionResult.misses;

            image.removeAttribute("src");
            image.alt = "";
            image.hidden = true;
            if (stage) stage.hidden = true;
            form.hidden = true;
            giveUp.hidden = true;
            restart.hidden = false;
            if (retry) retry.hidden = misses.length === 0;
            game.classList.add("is-complete");
            game.classList.toggle("has-misses", misses.length > 0);
            if (afterActions) afterActions.hidden = false;

            result.textContent = "Quiz complete";
            result.className = "flag-result is-finished";
            if (summary) {
                completion.renderSummary(summary, lastCompletionResult, {
                    title: "Results",
                    gridClass: "flag-summary-grid",
                    stats: [
                        {
                            label: "Flags correct",
                            value: `${lastCompletionResult.firstTryCorrect} / ${lastCompletionResult.total}`
                        },
                        { label: "Accuracy", value: lastCompletionResult.accuracyText },
                        { label: "Time", value: lastCompletionResult.timeText }
                    ]
                });
            }
            renderReview(lastCompletionResult);
            completion.renderShare(game, lastCompletionResult, { before: afterActions });
            updateStats();
            analyticsReporter.complete(lastCompletionResult);

            if (weakSpotsPracticeStage) {
                let nextStage = null;
                try {
                    nextStage = root.SmurdyWeakSpots?.advancePracticeStage?.() || null;
                } catch (_) {}
                weakSpotsPracticeStage = null;
                showPracticeContinuation(nextStage);
            }
        }

        function showQuestion() {
            locked = false;
            result.textContent = "";
            result.className = "flag-result";
            input.value = "";

            if (quizSession.snapshot().completedCount >= flags.length) {
                currentFlag = null;
                finishQuiz();
                return;
            }

            const remaining = quizSession.getRemaining(flags);
            const candidates = quizSession.getQuestionCandidates(remaining);
            currentFlag = candidates[Math.floor(Math.random() * candidates.length)] || remaining[0] || null;
            if (!currentFlag) {
                finishQuiz();
                return;
            }
            quizSession.setCurrent(currentFlag);

            if (stage) stage.hidden = false;
            image.hidden = false;
            image.src = currentFlag.src;
            image.alt = `Flag ${quizSession.snapshot().completedCount + 1} of ${flags.length}`;
            form.hidden = false;
            giveUp.hidden = false;
            restart.hidden = false;
            if (retry) retry.hidden = true;
            if (summary) summary.hidden = true;
            if (afterActions) afterActions.hidden = true;
            updateStats();
            input.focus({ preventScroll: true });

            const preloadRemaining = quizSession.getRemaining(flags).filter(flag => flag.id !== currentFlag.id);
            const next = preloadRemaining[0];
            if (next) new Image().src = next.src;
        }

        function recordMiss(current, guess, gaveUp) {
            try {
                root.SmurdyWeakSpots?.recordMiss?.({
                    name: current.name,
                    mode: weakSpotMode(),
                    group: setId,
                    guess: gaveUp ? "" : String(guess || "")
                });
            } catch (_) {}
        }

        function finishQuestion(wasCorrect, guess, gaveUp = false) {
            if (locked || !currentFlag) return;
            locked = true;

            const current = currentFlag;
            const outcome = quizSession.recordAnswer(current, {
                correct: wasCorrect,
                guess,
                gaveUp,
                data: { src: current.src }
            });
            if (wasCorrect) {
                if (retryWeakSpots && !outcome?.hadMiss) clearWeakSpot(current);
                result.textContent = "Correct!";
                result.classList.add("is-correct");
            } else {
                recordMiss(current, guess, gaveUp);
                result.textContent = `Answer: ${current.name}`;
                result.classList.add("is-wrong");
            }

            analyticsReporter.answer(wasCorrect);
            updateStats();
            advanceTimeout = root.setTimeout(() => {
                advanceTimeout = null;
                showQuestion();
            }, wasCorrect ? 650 : 1150);
        }

        function submitAnswer(event) {
            event.preventDefault();
            if (locked || !currentFlag) return;
            const guess = normalizeAnswer(input.value);
            if (!guess) return;
            finishQuestion(acceptedAnswers(currentFlag.name, aliases).has(guess), input.value);
        }

        function startRun(items, reason = "start", isWeakSpotsRetry = false) {
            if (advanceTimeout) root.clearTimeout(advanceTimeout);
            advanceTimeout = null;
            flags = shuffle(items);
            quizSession.reset({
                total: flags.length,
                preserveLastQuestion: reason === "restart"
            });
            currentFlag = null;
            locked = false;
            retryWeakSpots = Boolean(isWeakSpotsRetry);
            lastCompletionResult = null;
            game.classList.remove("is-complete", "has-misses");
            removePracticeContinuation();
            completion.hideShare(game);
            if (review) { review.hidden = true; review.innerHTML = ""; }
            if (afterActions) afterActions.hidden = true;
            analyticsReporter.begin(reason);
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
                flagGroups = root.SmurdyFlagCatalog?.expandFlagGroups?.(loadedFlagGroups || {}, countryGroups) || loadedFlagGroups || {};
                allFlags = selectFlags(source, setId, flagGroups, countryGroups, aliases);
                const expected = Number(flagGroups?.[setId]?.memberCount || 0);
                if (!allFlags.length || (expected && allFlags.length !== expected)) {
                    throw new Error(`Expected ${expected || "some"} flags for ${setId}, found ${allFlags.length}`);
                }

                weakSpotsPracticeStage = getWeakSpotsPracticeStage();
                const runFlags = weakSpotsPracticeStage
                    ? filterFlagsByNames(allFlags, weakSpotsPracticeStage.names)
                    : allFlags;
                if (!runFlags.length) {
                    throw new Error(`Weak Spots practice has no matching flags for ${setId}`);
                }

                landing.hidden = true;
                game.hidden = false;
                body.classList.add("flag-quiz-running");
                try { root.SmurdyQuizLibrary?.recordPlayed?.("type-flag", setId); } catch (_) {}
                const startReason = weakSpotsPracticeStage
                    ? "weak_spots"
                    : (initialLaunchIntent?.reason === "browser" ? "browser" : "start");
                startRun(
                    runFlags,
                    startReason,
                    Boolean(weakSpotsPracticeStage)
                );
                initialLaunchIntent = null;
            } catch (error) {
                console.error("Could not start flag quiz", error);
                launch.disabled = false;
                launch.textContent = "Try again";
                result.textContent = "The flags could not load. Please try again.";
            }
        }

        function restartCurrentRun() {
            const restartFlags = retryWeakSpots ? flags.slice() : allFlags;
            if (restartFlags.length) startRun(restartFlags, "restart", retryWeakSpots);
        }

        launch.addEventListener("click", launchQuiz);
        form.addEventListener("submit", submitAnswer);
        giveUp?.addEventListener("click", () => finishQuestion(false, "", true));
        restart?.addEventListener("click", restartCurrentRun);
        retry?.addEventListener("click", () => {
            if (!lastCompletionResult) return;
            completion.retryMissed(
                lastCompletionResult,
                missedFlags => startRun(missedFlags, "retry_missed", true),
                { eventTarget: root }
            );
        });
        favorite?.addEventListener("click", () => {
            root.SmurdyQuizLibrary?.toggleFavorite?.("type-flag", setId);
            updateFavoriteButton();
        });
        updateFavoriteButton();

        try {
            const params = new URLSearchParams(root.location?.search || "");
            const legacyWeakSpots =
                params.get("weakSpotsPractice") === "1" &&
                Boolean(root.sessionStorage?.getItem?.("smurdy-weak-spots-practice-v1"));

            if (legacyWeakSpots) {
                root.SmurdyQuizLaunchIntent?.store?.("type-flag", setId, "weak_spots");
                params.delete("weakSpotsPractice");
                const query = params.toString();
                root.history?.replaceState?.(
                    {},
                    "",
                    (root.location?.pathname || "") +
                        (query ? "?" + query : "") +
                        (root.location?.hash || "")
                );
            }

            initialLaunchIntent =
                root.SmurdyQuizLaunchIntent?.consumeCurrent?.() ||
                (legacyWeakSpots ? { reason: "weak_spots" } : null);

            if (initialLaunchIntent) {
                void launchQuiz();
            } else {
                root.SmurdyAnalytics?.trackLandingPageView?.({
                    page_type: "quiz_landing"
                });
            }
        } catch (_) {
            root.SmurdyAnalytics?.trackLandingPageView?.({
                page_type: "quiz_landing"
            });
        }

        return { launchQuiz, restartQuiz: restartCurrentRun };
    }

    return {
        normalizeAnswer,
        acceptedAnswers,
        canonicalFlagName,
        selectFlags,
        filterFlagsByNames,
        remainingFlags,
        chooseNextFlag,
        shuffle,
        formatElapsed,
        mount
    };
});
