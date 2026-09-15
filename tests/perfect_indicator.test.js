const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const perfect = require("../src/js/perfect.js");

test("perfect requires a completed quiz with 100% accuracy and every item correct first try", () => {
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

test("perfect share text adds one plain Perfect line", () => {
    const result = {
        total: 4,
        completedCount: 4,
        accuracyPercent: 100,
        firstTryCorrect: 4,
        shareText: "I finished Europe Flags on Smurdy\n100% accuracy | 00:21 | 4/4 completed\nCan you beat it? https://smurdy.fun/"
    };
    const decorated = perfect.decorateShareText(result);
    assert.equal(
        decorated,
        "I finished Europe Flags on Smurdy\nPerfect\n100% accuracy | 00:21 | 4/4 completed\nCan you beat it? https://smurdy.fun/"
    );
    assert.equal((decorated.match(/Perfect/g) || []).length, 1);
});

test("quiz session loads the perfect-result module for both map and flag runners", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/quiz_session.js"), "utf8");
    assert.match(source, /\/src\/js\/perfect\.js\?v=20260914-perfect-1/);
    assert.match(source, /data-smurdy-perfect-module|smurdyPerfectModule/);
});
