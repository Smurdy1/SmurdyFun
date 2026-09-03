from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# app_core: load the shared session core once before the map runner.
path = "src/js/app_core.js"
text = read(path)
old = '''        // hide main-menu decorations once a quiz is loading (non-destructive)
        try { this.hideMainMenuMap(); } catch (_) {}
        const runner = document.createElement("script");
        // load the runner from the new location
        runner.src = "/src/js/quiz_runner.js?v=20260826-target-hierarchy-1";
        runner.id = "quiz-runner-script";
'''
new = '''        // hide main-menu decorations once a quiz is loading (non-destructive)
        try { this.hideMainMenuMap(); } catch (_) {}

        // The map and flag runners share one session state machine. Keep it
        // loaded across quiz switches instead of recreating it for every run.
        if (!window.SmurdyQuizSession?.createSession) {
            try {
                await new Promise((resolve, reject) => {
                    let sessionScript = document.getElementById("quiz-session-script");
                    if (sessionScript) {
                        if (window.SmurdyQuizSession?.createSession) {
                            resolve();
                            return;
                        }
                        sessionScript.addEventListener("load", resolve, { once: true });
                        sessionScript.addEventListener("error", reject, { once: true });
                        return;
                    }

                    sessionScript = document.createElement("script");
                    sessionScript.src = "/src/js/quiz_session.js?v=20260903-session-1";
                    sessionScript.id = "quiz-session-script";
                    sessionScript.onload = resolve;
                    sessionScript.onerror = reject;
                    document.head.appendChild(sessionScript);
                });
            } catch (error) {
                console.error("Could not load shared quiz session core", error);
                return;
            }
        }

        const runner = document.createElement("script");
        // load the runner from the new location
        runner.src = "/src/js/quiz_runner.js?v=20260903-session-1";
        runner.id = "quiz-runner-script";
'''
text = replace_once(text, old, new, "app_core shared session loader")
write(path, text)


# quiz_runner: move counters, completion, misses, anti-repeat, and clock state
# onto the shared session model while leaving map-specific rendering untouched.
path = "src/js/quiz_runner.js"
text = read(path)
text = replace_once(text, '''    let currentName = null;
    let lastQuestionName = null;
    let currentFeature = null;               // <-- new: store feature object for current question
    let currentCanonicalNormalized = null;   // <-- new: normalized canonical key for comparisons
    let locked = false;
    let completed = new Set();
    let currentPoint = null; // {lng, lat}

    let attempts = 0;
    let correctAnswers = 0;
    let missedTargets = new Map();

    let timerInterval = null;
    let startTime = null;
    let finalElapsedMs = 0;
''', '''    let currentName = null;
    let currentFeature = null;
    let currentCanonicalNormalized = null;
    let locked = false;
    let currentPoint = null; // {lng, lat}

    const quizSession = window.SmurdyQuizSession?.createSession?.({
        keyOf: name => normalizeName(getCanonicalDisplayName(name)),
        nameOf: name => getCanonicalDisplayName(name)
    });
    if (!quizSession) {
        throw new Error("SmurdyQuizSession must load before quiz_runner.js");
    }

    let timerInterval = null;
''', "runner session state")

text = replace_once(text, '''                locked = true;
                attempts++;
                finishWrong(currentName, true);
''', '''                locked = true;
                finishWrong(currentName, true);
''', "runner give up attempt")

text = replace_once(text, '''    function getAnalyticsSnapshot(correct) {
        return {
            ...getAnalyticsContext(),
            correct,
            attempts,
            correctAnswers,
            completedPlaces: completed.size,
            placesTotal: getNames().length
        };
    }
''', '''    function getAnalyticsSnapshot(correct) {
        const snapshot = quizSession.snapshot({ total: getNames().length });
        return {
            ...getAnalyticsContext(),
            correct,
            attempts: snapshot.attempts,
            correctAnswers: snapshot.correctAnswers,
            completedPlaces: snapshot.completedCount,
            placesTotal: snapshot.total
        };
    }
''', "runner analytics snapshot")

text = replace_once(text, '''    function completeAnalyticsRun() {
        if (anyTestMode) return;
        try {
            window.SmurdyAnalytics?.completeQuiz({
                ...getAnalyticsSnapshot(true),
                completionTimeSeconds: finalElapsedMs / 1000
            });
        } catch (_) {}
    }
''', '''    function completeAnalyticsRun() {
        if (anyTestMode) return;
        try {
            window.SmurdyAnalytics?.completeQuiz({
                ...getAnalyticsSnapshot(true),
                completionTimeSeconds: quizSession.getElapsedMs() / 1000
            });
        } catch (_) {}
    }
''', "runner analytics completion")

text = replace_once(text, '''    function getRemaining() {
        return getNames().filter(name => !completed.has(name));
    }

    // Avoid immediately repeating the previous target when another option exists.
    // This applies after a wrong answer, Give Up, and Restart.
    function getQuestionCandidates(remaining) {
        const source = Array.isArray(remaining) ? remaining : [];
        if (source.length <= 1 || !lastQuestionName) return source;

        const previous = normalizeName(lastQuestionName);
        const filtered = source.filter(name => normalizeName(name) !== previous);
        return filtered.length ? filtered : source;
    }
''', '''    function getRemaining() {
        return quizSession.getRemaining(getNames());
    }

    // Anti-repeat behavior is shared across quiz renderers.
    function getQuestionCandidates(remaining) {
        return quizSession.getQuestionCandidates(remaining);
    }
''', "runner remaining candidates")

text = replace_once(text, '''    function updateCounter() {
        const total = getNames().length;
        SQ.setProgressText(`${completed.size} / ${total} completed`);
        const compact = `${completed.size} / ${total}`;
        const s = document.getElementById("stats-count");
        if (s) s.textContent = compact;
        const p = document.getElementById("quiz-progress");
        if (p) p.textContent = `${completed.size} / ${total} completed`;
    }

    function updateAccuracy() {
        const percent = attempts === 0
            ? 100
            : Math.round((correctAnswers / attempts) * 100);

        SQ.setAccuracyText(`${percent}% correct`);
        const s = document.getElementById("stats-accuracy");
        if (s) s.textContent = `${percent}%`;
        const a = document.getElementById("quiz-accuracy");
        if (a) a.textContent = `${percent}% correct`;
    }

    function repaintCompleted() {
        if (!persistCompletedHighlights) return;

        for (const name of completed) {
            setState(name, "correct");
        }
    }
''', '''    function updateCounter() {
        const snapshot = quizSession.snapshot({ total: getNames().length });
        SQ.setProgressText(`${snapshot.completedCount} / ${snapshot.total} completed`);
        const compact = `${snapshot.completedCount} / ${snapshot.total}`;
        const s = document.getElementById("stats-count");
        if (s) s.textContent = compact;
        const p = document.getElementById("quiz-progress");
        if (p) p.textContent = `${snapshot.completedCount} / ${snapshot.total} completed`;
    }

    function updateAccuracy() {
        const percent = quizSession.snapshot().accuracyPercent;

        SQ.setAccuracyText(`${percent}% correct`);
        const s = document.getElementById("stats-accuracy");
        if (s) s.textContent = `${percent}%`;
        const a = document.getElementById("quiz-accuracy");
        if (a) a.textContent = `${percent}% correct`;
    }

    function repaintCompleted() {
        if (!persistCompletedHighlights) return;

        for (const name of quizSession.getCompletedItems()) {
            setState(name, "correct");
        }
    }
''', "runner stats repaint")

old = '''    function recordMissedTarget(clickedOrGuess, gaveUp) {
        if (!currentName) return;

        const displayName = getCanonicalDisplayName(currentName);
        const key = normalizeName(displayName);
        const existing = missedTargets.get(key) || {
            key,
            name: displayName,
            count: 0,
            guesses: [],
            gaveUp: 0
        };

        existing.count++;
        if (gaveUp) {
            existing.gaveUp++;
        } else {
            const guess = String(clickedOrGuess || "").trim();
            if (guess && !existing.guesses.includes(guess) && existing.guesses.length < 4) {
                existing.guesses.push(guess);
            }
        }
        missedTargets.set(key, existing);

        if (!reviewTestMode) {
            try {
                const context = getAnalyticsContext();
                window.SmurdyWeakSpots?.recordMiss({
                    name: displayName,
                    mode: context.quiz_mode,
                    group: context.quiz_group
                });
            } catch (_) {}
        }
    }

    function reduceWeakSpotAfterRetry() {
        if (!retryWeakSpots || anyTestMode || !currentName) return;

        // A Weak Spot is cleared only by a clean replay. If this target was
        // missed again during the retry, keep it for the next practice round.
        const key = normalizeName(getCanonicalDisplayName(currentName));
        if (missedTargets.has(key)) return;

        try {
            const context = getAnalyticsContext();
            window.SmurdyWeakSpots?.recordRetrySuccess({
                name: getCanonicalDisplayName(currentName),
                mode: context.quiz_mode,
                group: context.quiz_group
            });
        } catch (_) {}
    }
'''
new = '''    function recordMissedTarget(clickedOrGuess, gaveUp) {
        if (!currentName) return null;

        const displayName = getCanonicalDisplayName(currentName);
        const outcome = quizSession.recordAnswer(currentName, {
            correct: false,
            guess: gaveUp ? "" : String(clickedOrGuess || ""),
            gaveUp
        });

        if (!reviewTestMode) {
            try {
                const context = getAnalyticsContext();
                window.SmurdyWeakSpots?.recordMiss({
                    name: displayName,
                    mode: context.quiz_mode,
                    group: context.quiz_group
                });
            } catch (_) {}
        }
        return outcome;
    }

    function reduceWeakSpotAfterRetry(hadMiss) {
        if (!retryWeakSpots || anyTestMode || !currentName || hadMiss) return;

        try {
            const context = getAnalyticsContext();
            window.SmurdyWeakSpots?.recordRetrySuccess({
                name: getCanonicalDisplayName(currentName),
                mode: context.quiz_mode,
                group: context.quiz_group
            });
        } catch (_) {}
    }
'''
text = replace_once(text, old, new, "runner miss model")

text = replace_once(text, '''    function showPostQuizReview() {
        const items = Array.from(missedTargets.values())
            .sort((a, b) => a.name.localeCompare(b.name));
''', '''    function showPostQuizReview() {
        const items = quizSession.getMisses()
            .sort((a, b) => a.name.localeCompare(b.name));
''', "runner review misses")

text = replace_once(text, '''    function startTimer() {
        stopTimer();
        startTime = Date.now();
        finalElapsedMs = 0;
        setTimerText(0);
 
        timerInterval = setInterval(() => {
            finalElapsedMs = Date.now() - startTime;
            setTimerText(finalElapsedMs);
        }, 100);
    }
 
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function resetTimer() {
        stopTimer();
        startTime = null;
        finalElapsedMs = 0;
        setTimerText(0);
    }
''', '''    function startTimer() {
        stopTimer();
        quizSession.startClock();
        setTimerText(0);
 
        timerInterval = setInterval(() => {
            setTimerText(quizSession.getElapsedMs());
        }, 100);
    }
 
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        const elapsed = quizSession.stopClock();
        setTimerText(elapsed);
        return elapsed;
    }

    function resetTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        quizSession.resetClock();
        setTimerText(0);
    }
''', "runner timer")

text = replace_once(text, '''            if (startTime) finalElapsedMs = Date.now() - startTime;
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
            stopTimer();
''', '''            const finalElapsedMs = stopTimer();
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
''', "runner finish timer")

text = replace_once(text, '''        lastQuestionName = currentName;
        locked = false;
''', '''        quizSession.setCurrent(currentName);
        locked = false;
''', "runner current target")

old = '''            if (reviewTestMode) {
                const names = getNames();
                completed = new Set(names);
                missedTargets = new Map(
                    names.slice(0, Math.min(3, names.length)).map((name, index) => {
                        const displayName = getCanonicalDisplayName(name);
                        const key = normalizeName(displayName);
                        return [key, {
                            key,
                            name: displayName,
                            count: index + 1,
                            guesses: [],
                            gaveUp: index === 2 ? 1 : 0
                        }];
                    })
                );
                attempts = names.length + 3;
                correctAnswers = names.length;
                updateCounter();
                updateAccuracy();
                return nextQuestion();
            }

            const currentKey = normalizeName(currentName);
            completed = new Set(
                getNames().filter(name => normalizeName(name) !== currentKey)
            );
            attempts = 0;
            correctAnswers = 0;
'''
new = '''            if (reviewTestMode) {
                const names = getNames();
                quizSession.seed({
                    total: names.length,
                    completedItems: names,
                    misses: names.slice(0, Math.min(3, names.length)).map((name, index) => {
                        const displayName = getCanonicalDisplayName(name);
                        return {
                            key: normalizeName(displayName),
                            name: displayName,
                            count: index + 1,
                            guesses: [],
                            gaveUp: index === 2 ? 1 : 0,
                            item: name
                        };
                    }),
                    attempts: names.length + 3,
                    correctAnswers: names.length,
                    firstTryCorrect: Math.max(0, names.length - 3)
                });
                updateCounter();
                updateAccuracy();
                return nextQuestion();
            }

            const currentKey = normalizeName(currentName);
            quizSession.seed({
                total: getNames().length,
                completedItems: getNames().filter(name => normalizeName(name) !== currentKey),
                attempts: 0,
                correctAnswers: 0,
                firstTryCorrect: 0
            });
'''
text = replace_once(text, old, new, "runner test seeding")

text = replace_once(text, '''    function restartQuiz() {
        currentName = null;
        locked = false;
        completed = new Set();
        attempts = 0;
        correctAnswers = 0;
        missedTargets = new Map();
        hidePostQuizReview();
''', '''    function restartQuiz() {
        currentName = null;
        locked = false;
        quizSession.reset({
            total: getNames().length,
            preserveLastQuestion: true
        });
        hidePostQuizReview();
''', "runner restart")

text = replace_once(text, '''    function finishCorrect() {
        correctAnswers++;
        reduceWeakSpotAfterRetry();
        completed.add(currentName);
        recordAnalyticsAnswer(true);
''', '''    function finishCorrect() {
        const outcome = quizSession.recordAnswer(currentName, { correct: true });
        reduceWeakSpotAfterRetry(Boolean(outcome?.hadMiss));
        recordAnalyticsAnswer(true);
''', "runner correct")

text = replace_once(text, '''    function finishWrong(clickedOrGuess, gaveUp = false) {
        recordMissedTarget(clickedOrGuess, gaveUp);
        recordAnalyticsAnswer(false);
''', '''    function finishWrong(clickedOrGuess, gaveUp = false) {
        recordMissedTarget(clickedOrGuess, gaveUp);
        recordAnalyticsAnswer(false);
''', "runner wrong marker")

old = '''            // Bordered click quizzes ignore already-completed places. In No
            // Borders, clicking one is a real wrong answer and must be counted.
            for (const c of completed) {
                if (
                    normalizeName(c) === clickedCanon &&
                    !completedCountryClicksCountAsWrong()
                ) {
                    return;
                }
            }

            locked = true;
            attempts++;
'''
new = '''            // Bordered click quizzes ignore already-completed places. In No
            // Borders, clicking one is a real wrong answer and must be counted.
            const clickedName = canonicalNameForFeature(clickedFeature) || SQ.getFeatureName(clickedFeature) || clickedCanon;
            if (quizSession.isCompleted(clickedName) && !completedCountryClicksCountAsWrong()) {
                return;
            }

            locked = true;
'''
text = replace_once(text, old, new, "runner completed click")

text = replace_once(text, '''        locked = true;
        attempts++;

        const answerCorrect = SQ.isAcceptedAnswer(currentName, guess);
''', '''        locked = true;

        const answerCorrect = SQ.isAcceptedAnswer(currentName, guess);
''', "runner typed attempt")

text = replace_once(text, '''    hidePostQuizReview();
    updateCounter();
    updateAccuracy();
    resetTimer();
''', '''    quizSession.reset({ total: getNames().length });
    hidePostQuizReview();
    updateCounter();
    updateAccuracy();
    resetTimer();
''', "runner initial reset")

# Any old state variables left after migration indicate a missed replacement.
for forbidden in ["completed.size", "missedTargets", "correctAnswers++", "attempts++", "lastQuestionName", "finalElapsedMs =", "startTime ="]:
    if forbidden in text:
        raise RuntimeError(f"runner migration left legacy state token: {forbidden}")
write(path, text)


# flag_quiz: use the same session model for counters, misses, anti-repeat, and timer state.
path = "src/js/flag_quiz.js"
text = read(path)
text = replace_once(text, '''        let allFlags = [];
        let flags = [];
        let aliases = {};
        let flagGroups = {};
        let attempts = 0;
        let correct = 0;
        let firstTryCorrect = 0;
        let locked = false;
        let misses = [];
        let completed = new Set();
        let currentFlag = null;
        let lastFlagId = null;
        let startedAt = 0;
        let elapsed = 0;
        let timerInterval = null;
''', '''        let allFlags = [];
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
''', "flag session state")

text = replace_once(text, '''        function analyticsSnapshot(answerCorrect) {
            return {
                correct: answerCorrect,
                attempts,
                correctAnswers: correct,
                completedPlaces: completed.size,
                placesTotal: flags.length,
                completionTimeSeconds: Math.round(elapsed / 1000)
            };
        }
''', '''        function analyticsSnapshot(answerCorrect) {
            const snapshot = quizSession.snapshot({ total: flags.length });
            return {
                correct: answerCorrect,
                attempts: snapshot.attempts,
                correctAnswers: snapshot.correctAnswers,
                completedPlaces: snapshot.completedCount,
                placesTotal: snapshot.total,
                completionTimeSeconds: Math.round(snapshot.elapsedMs / 1000)
            };
        }
''', "flag analytics snapshot")

text = replace_once(text, '''        function updateStats() {
            const completedCount = completed.size;
            if (progress) progress.textContent = `${completedCount} / ${flags.length} completed`;
            if (progressBar) {
                progressBar.style.width = `${flags.length ? (completedCount / flags.length) * 100 : 0}%`;
                progressBar.parentElement?.setAttribute("aria-valuenow", String(completedCount));
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
''', '''        function updateStats() {
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
''', "flag stats timer")

old = '''        function renderReview() {
            if (!review) return;
            review.hidden = misses.length === 0;
            review.innerHTML = misses.length ? `
                <h2>Flags to review</h2>
                <ul class="flag-review-grid">${misses.map(flag => `
                    <li><img src="${escapeHtml(flag.src)}" alt=""><span>${escapeHtml(flag.name)}</span></li>
                `).join("")}</ul>` : "";
        }
'''
new = '''        function renderReview() {
            if (!review) return;
            const misses = quizSession.getMisses();
            review.hidden = misses.length === 0;
            review.innerHTML = misses.length ? `
                <h2>Flags to review</h2>
                <ul class="flag-review-grid">${misses.map(item => `
                    <li><img src="${escapeHtml(item.data?.src || "")}" alt=""><span>${escapeHtml(item.name)}</span></li>
                `).join("")}</ul>` : "";
        }
'''
text = replace_once(text, old, new, "flag review")

old = '''        function finishQuiz() {
            stopTimer();
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

            const percent = attempts ? Math.round((correct / attempts) * 100) : 100;
            result.textContent = "Quiz complete";
            result.className = "flag-result is-finished";
            if (summary) {
                summary.hidden = false;
                summary.innerHTML = `
                    <h2>Results</h2>
                    <div class="flag-summary-grid">
                        <div><strong>${firstTryCorrect} / ${flags.length}</strong><span>Flags correct</span></div>
                        <div><strong>${percent}%</strong><span>Accuracy</span></div>
                        <div><strong>${formatElapsed(elapsed)}</strong><span>Time</span></div>
                    </div>`;
            }
'''
new = '''        function finishQuiz() {
            stopTimer();
            const misses = quizSession.getMisses();
            const snapshot = quizSession.snapshot({ total: flags.length });
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
                summary.hidden = false;
                summary.innerHTML = `
                    <h2>Results</h2>
                    <div class="flag-summary-grid">
                        <div><strong>${snapshot.firstTryCorrect} / ${snapshot.total}</strong><span>Flags correct</span></div>
                        <div><strong>${snapshot.accuracyPercent}%</strong><span>Accuracy</span></div>
                        <div><strong>${formatElapsed(snapshot.elapsedMs)}</strong><span>Time</span></div>
                    </div>`;
            }
'''
text = replace_once(text, old, new, "flag finish summary")

old = '''            if (completed.size >= flags.length) {
                currentFlag = null;
                finishQuiz();
                return;
            }

            currentFlag = chooseNextFlag(flags, completed, lastFlagId);
            if (!currentFlag) {
                finishQuiz();
                return;
            }
            lastFlagId = currentFlag.id;
'''
new = '''            if (quizSession.snapshot().completedCount >= flags.length) {
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
'''
text = replace_once(text, old, new, "flag question selection")

text = replace_once(text, '''            image.alt = `Flag ${completed.size + 1} of ${flags.length}`;
''', '''            image.alt = `Flag ${quizSession.snapshot().completedCount + 1} of ${flags.length}`;
''', "flag image alt")
text = replace_once(text, '''            const remaining = remainingFlags(flags, completed).filter(flag => flag.id !== currentFlag.id);
            const next = remaining[0];
''', '''            const preloadRemaining = quizSession.getRemaining(flags).filter(flag => flag.id !== currentFlag.id);
            const next = preloadRemaining[0];
''', "flag preload")

text = replace_once(text, '''        function recordMiss(current, guess, gaveUp) {
            if (!misses.some(flag => flag.id === current.id)) misses.push(current);
            try {
''', '''        function recordMiss(current, guess, gaveUp) {
            try {
''', "flag miss side effect")

old = '''        function finishQuestion(wasCorrect, guess, gaveUp = false) {
            if (locked || !currentFlag) return;
            locked = true;
            attempts++;

            const current = currentFlag;
            const hadMiss = misses.some(flag => flag.id === current.id);
            if (wasCorrect) {
                correct++;
                completed.add(current.id);
                if (!hadMiss) firstTryCorrect++;
                if (retryWeakSpots && !hadMiss) clearWeakSpot(current);
                result.textContent = "Correct!";
                result.classList.add("is-correct");
            } else {
                recordMiss(current, guess, gaveUp);
                result.textContent = `Answer: ${current.name}`;
                result.classList.add("is-wrong");
            }
'''
new = '''        function finishQuestion(wasCorrect, guess, gaveUp = false) {
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
'''
text = replace_once(text, old, new, "flag answer state")

old = '''        function startRun(items, reason = "start", isWeakSpotsRetry = false) {
            if (advanceTimeout) root.clearTimeout(advanceTimeout);
            advanceTimeout = null;
            flags = shuffle(items);
            attempts = 0;
            correct = 0;
            firstTryCorrect = 0;
            misses = [];
            completed = new Set();
            currentFlag = null;
            lastFlagId = null;
            locked = false;
'''
new = '''        function startRun(items, reason = "start", isWeakSpotsRetry = false) {
            if (advanceTimeout) root.clearTimeout(advanceTimeout);
            advanceTimeout = null;
            flags = shuffle(items);
            quizSession.reset({
                total: flags.length,
                preserveLastQuestion: reason === "restart"
            });
            currentFlag = null;
            locked = false;
'''
text = replace_once(text, old, new, "flag start reset")

text = replace_once(text, '''        retry?.addEventListener("click", () => {
            const missedFlags = misses.slice();
            if (missedFlags.length) startRun(missedFlags, "retry_missed", true);
        });
''', '''        retry?.addEventListener("click", () => {
            const missedFlags = quizSession.getMisses().map(item => item.item).filter(Boolean);
            if (missedFlags.length) startRun(missedFlags, "retry_missed", true);
        });
''', "flag retry list")

for forbidden in ["let attempts =", "let correct =", "let firstTryCorrect =", "let misses =", "let completed =", "let startedAt =", "let elapsed =", "lastFlagId"]:
    if forbidden in text:
        raise RuntimeError(f"flag migration left legacy state token: {forbidden}")
write(path, text)


# Generated flag pages must load the session core before the runner.
path = "tools/generate_flag_pages.js"
text = read(path)
text = replace_once(text, '''  <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>
  <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>
''', '''  <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>
  <script src="/src/js/quiz_session.js?v=20260903-session-1" defer></script>
  <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>
''', "flag generator session script")
text = text.replace('/src/js/flag_quiz.js?v=20260903-flag-parity-1', '/src/js/flag_quiz.js?v=20260903-session-1')
write(path, text)

print("Shared session migration applied.")
