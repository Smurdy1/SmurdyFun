const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const perfect = require("../src/js/perfect.js");

test("perfect requires a completed quiz with no mistakes", () => {
    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 10,
        accuracyPercent: 100,
        firstTryCorrect: 10
    }), true);

    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 10,
        accuracyPercent: 90,
        firstTryCorrect: 9
    }), false);

    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 9,
        accuracyPercent: 100,
        firstTryCorrect: 9
    }), false);

    assert.equal(perfect.isPerfectResult({
        total: 0,
        completedCount: 0,
        accuracyPercent: 100,
        firstTryCorrect: 0
    }), false);
});

test("perfect feature stays limited to the indicator surfaces", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/perfect.js"), "utf8");
    assert.match(source, /smurdy-perfect-indicator/);
    assert.match(source, /smurdy-share-perfect/);
    assert.doesNotMatch(source, /buildShareImageBlob|sharePerfectResult|stats|RELEASE_VERSION/);
});

test("quiz session loads the small perfect-result module for map and flag quizzes", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/quiz_session.js"), "utf8");
    assert.match(source, /\/src\/js\/perfect\.js\?v=20260914-perfect-1/);
    assert.match(source, /data-smurdy-perfect-module|smurdyPerfectModule/);
});
