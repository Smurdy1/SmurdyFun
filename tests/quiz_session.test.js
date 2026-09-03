const test = require("node:test");
const assert = require("node:assert/strict");

const { createSession } = require("../src/js/quiz_session.js");

test("session tracks completion, misses, accuracy, and first-try answers", () => {
    const session = createSession({
        keyOf: item => item.id,
        nameOf: item => item.name,
        now: () => 1000
    });
    const alpha = { id: "a", name: "Alpha" };
    const beta = { id: "b", name: "Beta" };

    session.reset({ total: 2 });
    session.recordAnswer(alpha, { correct: false, guess: "Alfa" });
    session.recordAnswer(beta, { correct: true });
    session.recordAnswer(alpha, { correct: true });

    assert.deepEqual(session.getCompletedKeys().sort(), ["a", "b"]);
    assert.equal(session.hasMiss(alpha), true);
    assert.equal(session.hasMiss(beta), false);
    assert.deepEqual(session.getMisses(), [{
        key: "a",
        name: "Alpha",
        count: 1,
        guesses: ["Alfa"],
        gaveUp: 0,
        data: null,
        item: alpha
    }]);

    assert.deepEqual(session.snapshot(), {
        total: 2,
        attempts: 3,
        correctAnswers: 2,
        firstTryCorrect: 1,
        completedCount: 2,
        missCount: 1,
        accuracyPercent: 67,
        elapsedMs: 0,
        currentKey: "",
        lastQuestionKey: "",
        running: false
    });
});

test("session aggregates miss detail without duplicating guesses", () => {
    const session = createSession({ keyOf: item => item.id, nameOf: item => item.name });
    const item = { id: "x", name: "Example" };

    session.reset({ total: 1 });
    session.recordAnswer(item, { correct: false, guess: "Exampel", data: { src: "/x.svg" } });
    session.recordAnswer(item, { correct: false, guess: "Exampel" });
    session.recordAnswer(item, { correct: false, gaveUp: true });

    assert.deepEqual(session.getMisses()[0], {
        key: "x",
        name: "Example",
        count: 3,
        guesses: ["Exampel"],
        gaveUp: 1,
        data: { src: "/x.svg" },
        item
    });
});

test("session provides shared remaining and anti-repeat candidates", () => {
    const session = createSession({ keyOf: item => item.id });
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    session.reset({ total: items.length });
    session.setCurrent(items[0]);
    assert.deepEqual(session.getQuestionCandidates(items).map(item => item.id), ["b", "c"]);

    session.recordAnswer(items[1], { correct: true });
    assert.deepEqual(session.getRemaining(items).map(item => item.id), ["a", "c"]);

    session.reset({ total: items.length, preserveLastQuestion: true });
    assert.deepEqual(session.getQuestionCandidates(items).map(item => item.id), ["b", "c"]);
});

test("session clock is reusable by different quiz renderers", () => {
    let current = 1000;
    const session = createSession({ now: () => current });

    session.reset({ total: 4 });
    session.startClock();
    current = 3450;
    assert.equal(session.getElapsedMs(), 2450);
    assert.equal(session.stopClock(), 2450);
    current = 9000;
    assert.equal(session.getElapsedMs(), 2450);

    session.resetClock();
    assert.equal(session.getElapsedMs(), 0);
});
