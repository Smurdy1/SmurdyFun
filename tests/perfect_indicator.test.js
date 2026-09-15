const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const perfect = require("../src/js/perfect.js");

test("perfect means the quiz was completed with no mistakes", () => {
    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 10,
        accuracyPercent: 100,
        hasMisses: false
    }), true);

    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 10,
        accuracyPercent: 100,
        hasMisses: true
    }), false);

    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 10,
        accuracyPercent: 90,
        hasMisses: true
    }), false);

    assert.equal(perfect.isPerfectResult({
        total: 10,
        completedCount: 9,
        accuracyPercent: 100,
        hasMisses: false
    }), false);
});

test("perfect feature stays indicator-only", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/perfect.js"), "utf8");
    assert.match(source, /data-smurdy-perfect/);
    assert.match(source, /data-smurdy-perfect-share/);
    assert.doesNotMatch(source, /buildShareImageBlob|sharePerfectResult|RELEASE_VERSION/);
});

test("quiz session loads the perfect indicator for both map and flag quizzes", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/quiz_session.js"), "utf8");
    assert.match(source, /\/src\/js\/perfect\.js\?v=20260914-perfect-1/);
    assert.match(source, /data-smurdy-perfect-module|smurdyPerfectModule/);
});
