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

test("Perfect is integrated with map and flag completion status without a decorative separator", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/perfect.js"), "utf8");
    assert.match(source, /\.flag-result\.is-finished/);
    assert.match(source, /#quiz-target/);
    assert.match(source, /data-smurdy-perfect-wrap/);
    assert.match(source, /marginLeft = "0\.45em"/);
    assert.doesNotMatch(source, /separator\.textContent/);
    assert.doesNotMatch(source, /fillText\("·"/);
    assert.doesNotMatch(source, /data-smurdy-perfect-share/);
});

test("generated share images place Perfect beside the result identity without a separator glyph", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/perfect.js"), "utf8");
    assert.match(source, /addPerfectToShareImage/);
    assert.match(source, /measureText\(String\(result\.modeLabel/);
    assert.match(source, /fillText\("Perfect", perfectX, 310\)/);
    assert.doesNotMatch(source, /fillText\("Perfect", 72, 525\)/);
    assert.doesNotMatch(source, /fillText\("·"/);
});

test("quiz session loads the inline-status perfect module for both map and flag quizzes", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/js/quiz_session.js"), "utf8");
    assert.match(source, /\/src\/js\/perfect\.js\?v=20260914-perfect-3/);
    assert.match(source, /data-smurdy-perfect-module|smurdyPerfectModule/);
});
