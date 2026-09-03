const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appCore = fs.readFileSync(path.join(root, "src/js/app_core.js"), "utf8");
const runner = fs.readFileSync(path.join(root, "src/js/quiz_runner.js"), "utf8");

function extractMethod(source, signature) {
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, `Missing method: ${signature}`);

    const brace = source.indexOf("{", start);
    let depth = 0;
    for (let i = brace; i < source.length; i++) {
        if (source[i] === "{") depth++;
        if (source[i] === "}") depth--;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`Unclosed method: ${signature}`);
}

test("setProgressText preserves the runner's canonical denominator", () => {
    const element = { textContent: "" };
    const methodSource = extractMethod(appCore, "setProgressText(text)");
    const context = {
        ensureSinglePanelNode: () => element,
        SmurdyQuiz: {
            getQuizFeatures: () => Array(71),
            playableCount: 71
        }
    };
    const setter = vm.runInNewContext(`({${methodSource}}).setProgressText`, context);

    setter("44 / 44 completed");
    assert.equal(element.textContent, "44 / 44 completed");
});

test("completion refreshes counters through the canonical runner snapshot", () => {
    const completionStart = runner.indexOf("if (remaining.length === 0)");
    const completionEnd = runner.indexOf("const candidates =", completionStart);
    assert.notEqual(completionStart, -1);
    assert.notEqual(completionEnd, -1);

    const completionBlock = runner.slice(completionStart, completionEnd);
    assert.match(completionBlock, /updateCounter\(\)/);
    assert.doesNotMatch(completionBlock, /SQ\.setProgressText/);
});

test("last-answer test mode is analytics-free and opt-in", () => {
    assert.match(runner, /get\("smurdyTest"\)/);
    assert.match(runner, /smurdyTestMode === "last-answer"/);
    assert.match(runner, /const anyTestMode = Boolean\(smurdyTestMode\)/);
    assert.match(
        runner,
        /createAnalyticsReporter\([\s\S]*?disabled:\s*\(\)\s*=>\s*anyTestMode/
    );
    assert.match(runner, /function beginAnalyticsRun[\s\S]*?analyticsReporter\.begin\(startReason\)/);
    assert.match(runner, /function recordAnalyticsAnswer[\s\S]*?analyticsReporter\.answer\(correct\)/);
    assert.match(runner, /function completeAnalyticsRun[\s\S]*?analyticsReporter\.complete\(completionResult\)/);
    assert.match(runner, /Test mode: answer this final place\./);
});
