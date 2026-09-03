from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, replacement, flags=re.S):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: regex anchor not found exactly once: {pattern[:100]!r}")
    write(path, updated)


# App loader: bump the visible version, load completion before the map runner,
# and cache-bust the migrated runner.
replace_once(
    "src/js/app_core.js",
    'const APP_VERSION = "1.13.6";',
    'const APP_VERSION = "1.13.7";'
)
replace_once(
    "src/js/app_core.js",
    '''        const runner = document.createElement("script");
        // load the runner from the new location
        runner.src = "/src/js/quiz_runner.js?v=20260903-session-1";''',
    '''        if (!window.SmurdyQuizCompletion?.buildResult) {
            try {
                await new Promise((resolve, reject) => {
                    let completionScript = document.getElementById("quiz-completion-script");
                    if (completionScript) {
                        if (window.SmurdyQuizCompletion?.buildResult) {
                            resolve();
                            return;
                        }
                        completionScript.addEventListener("load", resolve, { once: true });
                        completionScript.addEventListener("error", reject, { once: true });
                        return;
                    }

                    completionScript = document.createElement("script");
                    completionScript.src = "/src/js/quiz_completion.js?v=20260903-completion-1";
                    completionScript.id = "quiz-completion-script";
                    completionScript.onload = resolve;
                    completionScript.onerror = reject;
                    document.head.appendChild(completionScript);
                });
            } catch (error) {
                console.error("Could not load shared quiz completion flow", error);
                return;
            }
        }

        const runner = document.createElement("script");
        // load the runner from the new location
        runner.src = "/src/js/quiz_runner.js?v=20260903-completion-1";'''
)

# Generated flag pages load the same completion module before the runner.
replace_once(
    "tools/generate_flag_pages.js",
    '''  <script src="/src/js/quiz_session.js?v=20260903-session-1" defer></script>
  <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>''',
    '''  <script src="/src/js/quiz_session.js?v=20260903-session-1" defer></script>
  <script src="/src/js/quiz_completion.js?v=20260903-completion-1" defer></script>
  <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>'''
)
replace_once(
    "tools/generate_flag_pages.js",
    '<script src="/src/js/flag_quiz.js?v=20260903-session-1" defer></script>',
    '<script src="/src/js/flag_quiz.js?v=20260903-completion-1" defer></script>'
)

# Flag runner: require the completion layer and use its analytics reporter.
replace_once(
    "src/js/flag_quiz.js",
    '''        if (!quizSession) {
            console.error("SmurdyQuizSession must load before flag_quiz.js");
            return null;
        }
        let advanceTimeout = null;''',
    '''        if (!quizSession) {
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
        let advanceTimeout = null;'''
)
regex_once(
    "src/js/flag_quiz.js",
    r'''\n        function analyticsSnapshot\(answerCorrect\) \{.*?\n        \}\n\n        function updateFavoriteButton''',
    '''\n        function updateFavoriteButton'''
)
regex_once(
    "src/js/flag_quiz.js",
    r'''        function renderReview\(\) \{.*?\n        \}\n\n        function finishQuiz''',
    '''        function renderReview(completionResult) {
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

        function finishQuiz'''
)
regex_once(
    "src/js/flag_quiz.js",
    r'''        function finishQuiz\(\) \{.*?\n        \}\n\n        function showQuestion''',
    '''        function finishQuiz() {
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

        function showQuestion'''
)
replace_once(
    "src/js/flag_quiz.js",
    '            root.SmurdyAnalytics?.recordAnswer?.(analyticsSnapshot(wasCorrect));',
    '            analyticsReporter.answer(wasCorrect);'
)
replace_once(
    "src/js/flag_quiz.js",
    '''            retryWeakSpots = Boolean(isWeakSpotsRetry);
            game.classList.remove("is-complete", "has-misses");
            removePracticeContinuation();
            if (review) { review.hidden = true; review.innerHTML = ""; }
            if (afterActions) afterActions.hidden = true;
            root.SmurdyAnalytics?.beginQuiz?.({
                quiz_mode: "type-flag",
                quiz_group: setId,
                places_total: flags.length,
                start_reason: reason
            });''',
    '''            retryWeakSpots = Boolean(isWeakSpotsRetry);
            lastCompletionResult = null;
            game.classList.remove("is-complete", "has-misses");
            removePracticeContinuation();
            completion.hideShare(game);
            if (review) { review.hidden = true; review.innerHTML = ""; }
            if (afterActions) afterActions.hidden = true;
            analyticsReporter.begin(reason);'''
)
replace_once(
    "src/js/flag_quiz.js",
    '''        retry?.addEventListener("click", () => {
            const missedFlags = quizSession.getMisses().map(item => item.item).filter(Boolean);
            if (missedFlags.length) startRun(missedFlags, "retry_missed", true);
        });''',
    '''        retry?.addEventListener("click", () => {
            if (!lastCompletionResult) return;
            completion.retryMissed(
                lastCompletionResult,
                missedFlags => startRun(missedFlags, "retry_missed", true),
                { eventTarget: root }
            );
        });'''
)

# Map runner: move analytics/review/retry/share orchestration to the same module.
replace_once(
    "src/js/quiz_runner.js",
    '''    if (!quizSession) {
        throw new Error("SmurdyQuizSession must load before quiz_runner.js");
    }

    let timerInterval = null;''',
    '''    if (!quizSession) {
        throw new Error("SmurdyQuizSession must load before quiz_runner.js");
    }
    const completion = window.SmurdyQuizCompletion;
    if (!completion?.buildResult) {
        throw new Error("SmurdyQuizCompletion must load before quiz_runner.js");
    }
    const analyticsReporter = completion.createAnalyticsReporter({
        root: window,
        session: quizSession,
        context: getAnalyticsContext,
        total: () => getNames().length,
        disabled: () => anyTestMode
    });
    let lastCompletionResult = null;

    let timerInterval = null;'''
)
regex_once(
    "src/js/quiz_runner.js",
    r'''    function getAnalyticsSnapshot\(correct\) \{.*?\n    \}\n\n    function beginAnalyticsRun\(startReason\) \{.*?\n    \}\n\n    function recordAnalyticsAnswer\(correct\) \{.*?\n    \}\n\n    function completeAnalyticsRun\(\) \{.*?\n    \}''',
    '''    function beginAnalyticsRun(startReason) {
        analyticsReporter.begin(startReason);
    }

    function recordAnalyticsAnswer(correct) {
        analyticsReporter.answer(correct);
    }

    function completeAnalyticsRun(completionResult) {
        analyticsReporter.complete(completionResult);
    }'''
)
replace_once(
    "src/js/quiz_runner.js",
    '''    function hidePostQuizReview() {
        const review = document.getElementById("quiz-review");
        if (review) review.hidden = true;
        const continuation = document.getElementById("weak-spots-practice-next");
        if (continuation) continuation.hidden = true;
    }''',
    '''    function hidePostQuizReview() {
        const review = document.getElementById("quiz-review");
        if (review) review.hidden = true;
        const continuation = document.getElementById("weak-spots-practice-next");
        if (continuation) continuation.hidden = true;
        const panel = document.getElementById("quiz-panel");
        if (panel) completion.hideShare(panel);
    }'''
)
replace_once(
    "src/js/quiz_runner.js",
    '            const share = document.getElementById("quiz-share-section");',
    '            const share = panel.querySelector("[data-smurdy-share]");'
)
replace_once(
    "src/js/quiz_runner.js",
    '''            '<span>' + stage.label + ' · ' + count + ' ' +
                (count === 1 ? 'place' : 'places') + '</span>' +''',
    '''            '<span>' + stage.label + ' (' + count + ' ' +
                (count === 1 ? 'place' : 'places') + ')</span>' +'''
)
regex_once(
    "src/js/quiz_runner.js",
    r'''\n    function describeReviewMiss\(item\) \{.*?\n    \}\n''',
    '\n'
)
replace_once(
    "src/js/quiz_runner.js",
    '''    function startMissedRetry(items) {
        const names = items.map(item => item.name).filter(Boolean);
        if (!names.length || typeof window.runNameQuiz !== "function") return;''',
    '''    function startMissedRetry(names) {
        names = (Array.isArray(names) ? names : [])
            .map(name => getCanonicalDisplayName(name))
            .filter(Boolean);
        if (!names.length || typeof window.runNameQuiz !== "function") return;'''
)
replace_once(
    "src/js/quiz_runner.js",
    '''        hidePostQuizReview();
        window.dispatchEvent(new CustomEvent("smurdy:quizretry"));

        window.runNameQuiz({''',
    '''        hidePostQuizReview();

        window.runNameQuiz({'''
)
regex_once(
    "src/js/quiz_runner.js",
    r'''    function showPostQuizReview\(\) \{.*?\n    \}\n\n    function normalizeName''',
    '''    function buildCompletionResult() {
        const context = getAnalyticsContext();
        let groupLabel = "";
        try { groupLabel = String(SQ.getCurrentGroup?.()?.label || ""); } catch (_) {}
        if (!groupLabel) groupLabel = completion.humanizeSlug(context.quiz_group || "world");
        const subdivision = isSubdivisionMapMode();
        return completion.buildResult({
            session: quizSession,
            total: getNames().length,
            quizId: context.quiz_mode,
            groupId: context.quiz_group,
            groupLabel,
            modeLabel: completion.modeLabelForQuiz(context.quiz_mode),
            itemSingular: subdivision ? "state" : "country",
            itemPlural: subdivision ? "states" : "countries",
            shareHeadline: `I finished the ${groupLabel} map quiz`,
            url: window.location.pathname
        });
    }

    function showPostQuizReview(completionResult = lastCompletionResult) {
        if (!completionResult) return;
        const items = completionResult.misses
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));

        if (!items.length) {
            const review = document.getElementById("quiz-review");
            if (review) review.hidden = true;
            return;
        }

        clearStates();
        for (const item of items) {
            try { setState(item.name, "wrong"); } catch (_) {}
        }

        const panel = document.getElementById("quiz-panel");
        if (!panel) return;

        let review = document.getElementById("quiz-review");
        if (!review) {
            review = document.createElement("section");
            review.id = "quiz-review";
            const share = panel.querySelector("[data-smurdy-share]");
            if (share && share.parentNode === panel) panel.insertBefore(review, share);
            else panel.appendChild(review);
        }

        const placeNoun = isSubdivisionMapMode()
            ? (items.length === 1 ? "state" : "states")
            : (items.length === 1 ? "country" : "countries");
        const reviewResult = {
            ...completionResult,
            misses: items,
            missedItems: items.map(item => item.item).filter(Boolean)
        };
        completion.renderReview(review, reviewResult, {
            ariaLabelledBy: "quiz-review-heading",
            headerClass: "quiz-review-header",
            titleId: "quiz-review-heading",
            titleClass: "quiz-review-heading",
            summaryClass: "quiz-review-summary",
            summary: `${items.length} ${placeNoun} highlighted on the map`,
            retryId: "quiz-review-retry",
            listTag: "ol",
            listClass: "quiz-review-list",
            eventTarget: window,
            onRetry: startMissedRetry,
            renderItem(item, row, document, index) {
                const button = document.createElement("button");
                button.className = "quiz-review-country";
                button.type = "button";
                button.dataset.reviewIndex = String(index);
                const name = document.createElement("span");
                name.className = "quiz-review-country-name";
                name.textContent = item.name;
                const detail = document.createElement("span");
                detail.className = "quiz-review-country-detail";
                detail.textContent = completion.describeMiss(item);
                button.append(name, detail);
                button.addEventListener("click", () => focusReviewCountry(item.name));
                row.appendChild(button);
            }
        });
    }

    function normalizeName'''
)
replace_once(
    "src/js/quiz_runner.js",
    '''            const finalElapsedMs = stopTimer();
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
            completeAnalyticsRun();''',
    '''            const finalElapsedMs = stopTimer();
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
            lastCompletionResult = buildCompletionResult();
            completeAnalyticsRun(lastCompletionResult);'''
)
replace_once(
    "src/js/quiz_runner.js",
    '''            showPostQuizReview();

            if (weakSpotsPracticeStage) {''',
    '''            showPostQuizReview(lastCompletionResult);
            const completionPanel = document.getElementById("quiz-panel");
            if (completionPanel) completion.renderShare(completionPanel, lastCompletionResult);

            if (weakSpotsPracticeStage) {'''
)
replace_once(
    "src/js/quiz_runner.js",
    '''    function restartQuiz() {
        currentName = null;
        locked = false;
        quizSession.reset({''',
    '''    function restartQuiz() {
        currentName = null;
        locked = false;
        lastCompletionResult = null;
        quizSession.reset({'''
)

# The old share implementation polled and scraped map-runner DOM. The explicit
# shared completion renderer replaces it for both modalities.
runner = read("src/js/quiz_runner.js")
marker = "\n/* --- Smurdy share result module v3 --- */"
if runner.count(marker) != 1:
    raise RuntimeError("quiz_runner.js: old share module marker not found exactly once")
runner = runner.split(marker, 1)[0].rstrip() + "\n"
write("src/js/quiz_runner.js", runner)

# Route regression should require the shared completion dependency and new
# cache version on generated flag pages.
replace_once(
    "tests/flag_quiz.test.js",
    '''        assert.match(html, /src\\/js\\/flag_quiz\\.js/);
        assert.match(html, /flag_quiz\\.js\\?v=20260903-session-1/);
        assert.match(html, /quiz_session\\.js\\?v=20260903-session-1/);
        assert.match(html, /quiz_launch_intent\\.js/);''',
    '''        assert.match(html, /src\\/js\\/flag_quiz\\.js/);
        assert.match(html, /flag_quiz\\.js\\?v=20260903-completion-1/);
        assert.match(html, /quiz_session\\.js\\?v=20260903-session-1/);
        assert.match(html, /quiz_completion\\.js\\?v=20260903-completion-1/);
        assert.match(html, /quiz_launch_intent\\.js/);'''
)

# Architecture regression: neither runner should own a second share system or
# manually extract missed items for Retry Missed.
completion_test = ROOT / "tests/quiz_completion.test.js"
completion_test.write_text(completion_test.read_text() + '''\n
test("both runners delegate completion flow instead of keeping a map-only share module", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.join(__dirname, "..");
    const mapRunner = fs.readFileSync(path.join(root, "src/js/quiz_runner.js"), "utf8");
    const flagRunner = fs.readFileSync(path.join(root, "src/js/flag_quiz.js"), "utf8");
    const appCore = fs.readFileSync(path.join(root, "src/js/app_core.js"), "utf8");

    assert.match(mapRunner, /SmurdyQuizCompletion/);
    assert.match(flagRunner, /SmurdyQuizCompletion/);
    assert.doesNotMatch(mapRunner, /Smurdy share result module v3/);
    assert.doesNotMatch(mapRunner, /navigator\\.share/);
    assert.match(mapRunner, /completion\\.retryMissed|renderReview/);
    assert.match(flagRunner, /completion\\.retryMissed/);
    assert.match(appCore, /quiz_completion\\.js\\?v=20260903-completion-1/);
});
''')

print("Shared completion migration applied.")
