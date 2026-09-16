const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("map quiz runs dispose the previous runtime", () => {
    const source = read("src/js/quiz_runner.js");
    assert.match(source, /if \(typeof RUN\._disposeActiveRun === "function"\)[\s\S]{0,180}RUN\._disposeActiveRun\(\)/);
    assert.match(source, /RUN\._disposeActiveRun = disposeRun/);
    assert.match(source, /pendingTimeouts\.clear\(\)/);
    assert.match(source, /SQ\.map\.off\("click", RUN\._clickHandler\)/);
});

test("map timer uses one second-resolution interval and suppresses duplicate DOM writes", () => {
    const source = read("src/js/quiz_runner.js");
    assert.match(source, /timerInterval = window\.setInterval\([\s\S]{0,220}, 1000\);/);
    assert.match(source, /if \(txt === lastTimerDisplay\) return;/);
    assert.ok((source.match(/scheduleRunTimeout\(\(\) =>/g) || []).length >= 3);
});

test("flag timer uses second-resolution updates", () => {
    const source = read("src/js/flag_quiz.js");
    assert.match(source, /timerInterval = root\.setInterval\(updateStats, 1000\);/);
    assert.doesNotMatch(source, /setInterval\(updateStats, 250\)/);
});

test("MapLibre tile retention is capped and stale tiny data is released", () => {
    const source = read("src/js/app_core.js");
    assert.ok((source.match(/maxTileCacheZoomLevels: 2/g) || []).length >= 2);
    assert.match(source, /if \(!MODE\.usesTinyPoints\)[\s\S]{0,420}this\.tinyData = null;/);
    const hotSwapStart = source.indexOf("async hotSwapMode");
    const tinyLoad = source.indexOf("const tresp = await fetch(MODE.tinyFile)", hotSwapStart);
    const layerRemoval = source.indexOf('removeLayer("quiz-tiny-circle")', tinyLoad);
    const sourceRemoval = source.indexOf('removeSource("quiz-tiny-source")', tinyLoad);
    assert.ok(tinyLoad >= 0 && layerRemoval > tinyLoad && sourceRemoval > layerRemoval);
});

test("memory fix is versioned and cache-busted", () => {
    assert.match(read("src/js/app.js"), /20260916-memory-2/);
    assert.match(read("tools/quiz_page_shell.js"), /20260915-bugfix-1/);
    assert.match(read("src/js/app_core.js"), /const APP_VERSION = "1\.16\.6";/);
    assert.match(read("src/js/app_core.js"), /quiz_runner\.js\?v=20260910-memory-1/);
});


test("share remount observer cannot self-sustain through its own class mutation", () => {
    const source = read("src/js/share.js");
    assert.match(source, /if \(trigger\.className !== desiredClassName\) trigger\.className = desiredClassName/);
    assert.doesNotMatch(source, /observe\(document\.body, \{ childList: true, subtree: true, attributes: true/);
    assert.match(source, /state\.observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
    assert.match(source, /observeVisibilityHosts\(\)/);
});

test("both MapLibre maps cap retained tiles and background homepage releases its temporary map", () => {
    const source = read("src/js/app_core.js");
    assert.ok((source.match(/maxTileCacheSize: 64/g) || []).length >= 2);
    assert.match(source, /document\.addEventListener\("visibilitychange"/);
    assert.match(source, /SmurdyQuiz\.hideMainMenuMap\(\)/);
    assert.match(source, /menuMapSuspendedForVisibility/);
});
