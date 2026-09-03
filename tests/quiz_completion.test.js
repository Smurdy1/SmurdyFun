const test = require("node:test");
const assert = require("node:assert/strict");

const completion = require("../src/js/quiz_completion.js");

function fakeSession() {
    const misses = [
        {
            key: "france",
            name: "France",
            count: 2,
            guesses: ["Spain"],
            gaveUp: 1,
            data: { src: "/fr.svg" },
            item: { id: "fr", name: "France" }
        }
    ];
    return {
        snapshot: ({ total }) => ({
            total,
            attempts: 5,
            correctAnswers: 4,
            firstTryCorrect: 3,
            completedCount: 4,
            missCount: 1,
            accuracyPercent: 80,
            elapsedMs: 65000
        }),
        getMisses: () => misses,
        getElapsedMs: () => 65000
    };
}

test("completion result is the shared source for stats, misses, and share data", () => {
    const result = completion.buildResult({
        session: fakeSession(),
        total: 4,
        quizId: "type-flag",
        groupId: "europe",
        groupLabel: "Europe",
        modeLabel: "Flags",
        itemSingular: "flag",
        itemPlural: "flags",
        shareHeadline: "I finished the Europe flag quiz"
    });

    assert.equal(result.accuracyText, "80%");
    assert.equal(result.timeText, "01:05");
    assert.equal(result.progressText, "4/4");
    assert.equal(result.firstTryCorrect, 3);
    assert.equal(result.hasMisses, true);
    assert.equal(result.missedItems.length, 1);
    assert.equal(result.missedItems[0].id, "fr");
    assert.match(result.shareText, /Europe Flags/);
    assert.match(result.shareText, /80% accuracy \| 01:05 \| 4\/4 completed/);
    assert.doesNotMatch(result.shareText, /·/);
    assert.equal(result.url, "https://smurdy.fun/quizzes/type-flag/europe/");
});

test("shared miss description avoids implementation-looking separators", () => {
    const detail = completion.describeMiss({
        count: 3,
        gaveUp: 1,
        guesses: ["Spain", "Italy"]
    });
    assert.equal(detail, "3 misses, gave up once, guessed Spain, Italy");
    assert.doesNotMatch(detail, /·/);
});

test("retry service extracts original missed items and emits one retry event", () => {
    const result = completion.buildResult({
        session: fakeSession(),
        total: 4,
        quizId: "type-flag",
        groupId: "europe"
    });
    const events = [];
    const eventTarget = {
        dispatchEvent(event) { events.push(event); },
        CustomEvent: class CustomEvent {
            constructor(type, init) { this.type = type; this.detail = init.detail; }
        }
    };
    let retried = null;
    const count = completion.retryMissed(
        result,
        items => { retried = items; },
        { eventTarget }
    );

    assert.equal(count, 1);
    assert.equal(retried[0].name, "France");
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "smurdy:quizretry");
    assert.equal(events[0].detail.count, 1);
});

test("analytics reporter gives both runners the same event payload shape", () => {
    const calls = [];
    const analytics = {
        beginQuiz(payload) { calls.push(["begin", payload]); },
        recordAnswer(payload) { calls.push(["answer", payload]); },
        completeQuiz(payload) { calls.push(["complete", payload]); }
    };
    const reporter = completion.createAnalyticsReporter({
        session: fakeSession(),
        analytics,
        context: () => ({ quiz_mode: "type-flag", quiz_group: "europe" }),
        total: () => 4
    });

    reporter.begin("start");
    reporter.answer(false);
    reporter.complete({ elapsedMs: 65000 });

    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0][1], {
        quiz_mode: "type-flag",
        quiz_group: "europe",
        places_total: 4,
        start_reason: "start"
    });
    assert.equal(calls[1][1].attempts, 5);
    assert.equal(calls[1][1].correctAnswers, 4);
    assert.equal(calls[1][1].completedPlaces, 4);
    assert.equal(calls[1][1].placesTotal, 4);
    assert.equal(calls[1][1].correct, false);
    assert.equal(calls[2][1].completionTimeSeconds, 65);
});

test("mode labels cover map, subdivision, and flag modes", () => {
    assert.equal(completion.modeLabelForQuiz("click-country"), "Click Countries");
    assert.equal(completion.modeLabelForQuiz("find-point-subdivision"), "Find State from a Point");
    assert.equal(completion.modeLabelForQuiz("type-flag"), "Flags");
});
