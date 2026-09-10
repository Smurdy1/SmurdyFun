from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:90]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once("src/js/app.js", 'const ASSET_VERSION = "20260910-polish-1";', 'const ASSET_VERSION = "20260910-memory-1";')
replace_once("tools/quiz_page_shell.js", 'const ASSET_VERSION = "20260910-polish-1";', 'const ASSET_VERSION = "20260910-memory-1";')
index = Path("index.html")
text = index.read_text()
if "20260910-polish-1" not in text:
    raise SystemExit("index.html: expected current asset version")
index.write_text(text.replace("20260910-polish-1", "20260910-memory-1"))

replace_once("src/js/app_core.js", 'const APP_VERSION = "1.14.6";', 'const APP_VERSION = "1.14.7";')
replace_once(
    "src/js/app_core.js",
    "    maxZoom: MODE.maxZoom,\n    // Match the working menu map: use MapLibre's complete native gesture system.",
    "    maxZoom: MODE.maxZoom,\n    // Retain only two viewport zoom levels of tiles per source instead of MapLibre's default five.\n    maxTileCacheZoomLevels: 2,\n    // Match the working menu map: use MapLibre's complete native gesture system."
)
replace_once(
    "src/js/app_core.js",
    "                zoom: Math.max( Math.min(MODE.mapZoom || 3, 6), 2 ),\n                interactive: true,",
    "                zoom: Math.max( Math.min(MODE.mapZoom || 3, 6), 2 ),\n                // The menu map is temporary, so keep its retained tile window small.\n                maxTileCacheZoomLevels: 2,\n                interactive: true,"
)
replace_once(
    "src/js/app_core.js",
    "        MODE = cfg;\n\n        try {",
    "        MODE = cfg;\n\n        // Release country-only tiny-point data when the new mode does not use it.\n        if (!MODE.usesTinyPoints) {\n            try { if (this.map.getLayer(\"quiz-tiny-circle\")) this.map.removeLayer(\"quiz-tiny-circle\"); } catch (_) {}\n            try { if (this.map.getSource(\"quiz-tiny-source\")) this.map.removeSource(\"quiz-tiny-source\"); } catch (_) {}\n            this.tinyData = null;\n        }\n\n        try {"
)
replace_once(
    "src/js/app_core.js",
    '                    try { if (this.map.getSource("quiz-tiny-source")) this.map.removeSource("quiz-tiny-source"); } catch(_) {}\n                    this.map.addSource("quiz-tiny-source", { type: "geojson", data: this.tinyData });',
    '                    // Remove the dependent layer before its source so MapLibre can release the old GeoJSON.\n                    try { if (this.map.getLayer("quiz-tiny-circle")) this.map.removeLayer("quiz-tiny-circle"); } catch(_) {}\n                    try { if (this.map.getSource("quiz-tiny-source")) this.map.removeSource("quiz-tiny-source"); } catch(_) {}\n                    this.map.addSource("quiz-tiny-source", { type: "geojson", data: this.tinyData });'
)
replace_once("src/js/app_core.js", 'runner.src = "/src/js/quiz_runner.js?v=20260909-state-capitals-1";', 'runner.src = "/src/js/quiz_runner.js?v=20260910-memory-1";')

replace_once(
    "src/js/quiz_runner.js",
    "    const RUN = window._smurdyQuizRunner;\n\n    // Declare shared UI references before setQuizPanelMode() is first called.",
    """    const RUN = window._smurdyQuizRunner;

    // Replacing a script tag does not destroy timers or listeners created by the old run.
    // Dispose the previous in-page run before creating another one.
    if (typeof RUN._disposeActiveRun === \"function\") {
        try { RUN._disposeActiveRun(); } catch (_) {}
    }

    const runId = (Number(RUN._runId) || 0) + 1;
    RUN._runId = runId;
    RUN._activeRunId = runId;
    let disposed = false;
    const pendingTimeouts = new Set();

    function scheduleRunTimeout(callback, delay) {
        const timeoutId = window.setTimeout(() => {
            pendingTimeouts.delete(timeoutId);
            if (disposed || RUN._activeRunId !== runId) return;
            callback();
        }, delay);
        pendingTimeouts.add(timeoutId);
        return timeoutId;
    }

    // Declare shared UI references before setQuizPanelMode() is first called."""
)
replace_once("src/js/quiz_runner.js", "        RUN.giveUpCurrentQuestion = () => {", "        RUN._giveUpRunId = runId;\n        RUN.giveUpCurrentQuestion = () => {")
replace_once(
    "src/js/quiz_runner.js",
    "    let timerInterval = null;\n\n    function getAnalyticsContext() {",
    """    let timerInterval = null;
    let lastTimerDisplay = \"\";

    function disposeRun() {
        if (disposed) return;
        disposed = true;

        if (timerInterval !== null) {
            window.clearInterval(timerInterval);
            timerInterval = null;
        }
        for (const timeoutId of pendingTimeouts) window.clearTimeout(timeoutId);
        pendingTimeouts.clear();
        try { quizSession.stopClock(); } catch (_) {}
        try { removeTypingUI(); } catch (_) {}

        try {
            if (RUN._clickHandler && SQ.map && typeof SQ.map.off === \"function\") {
                SQ.map.off(\"click\", RUN._clickHandler);
                RUN._clickHandler = null;
            }
        } catch (_) {}

        if (RUN._giveUpRunId === runId) {
            RUN.giveUpCurrentQuestion = null;
            RUN._giveUpRunId = null;
        }
        if (RUN._activeRunId === runId) RUN._activeRunId = null;
    }

    RUN._disposeActiveRun = disposeRun;

    function getAnalyticsContext() {"""
)
replace_once(
    "src/js/quiz_runner.js",
    """    function setTimerText(ms) {
        const el = document.getElementById(\"quiz-timer\");
        const txt = formatElapsed(ms);
        if (el) el.textContent = txt;
        const s = document.getElementById(\"stats-timer\");
        if (s) s.textContent = txt;
    }""",
    """    function setTimerText(ms) {
        const txt = formatElapsed(ms);
        if (txt === lastTimerDisplay) return;
        lastTimerDisplay = txt;
        const el = document.getElementById(\"quiz-timer\");
        if (el && el.textContent !== txt) el.textContent = txt;
        const s = document.getElementById(\"stats-timer\");
        if (s && s.textContent !== txt) s.textContent = txt;
    }"""
)
replace_once(
    "src/js/quiz_runner.js",
    "        timerInterval = setInterval(() => {\n            setTimerText(quizSession.getElapsedMs());\n        }, 100);",
    "        timerInterval = window.setInterval(() => {\n            if (disposed || RUN._activeRunId !== runId) return;\n            setTimerText(quizSession.getElapsedMs());\n        }, 1000);"
)
replace_once("src/js/quiz_runner.js", "    async function nextQuestion() {\n        const remaining = getRemaining();", "    async function nextQuestion() {\n        if (disposed || RUN._activeRunId !== runId) return;\n        const remaining = getRemaining();")
replace_once("src/js/quiz_runner.js", "            const picked = await pickRandomLandPoint(candidates);\n            if (picked) {", "            const picked = await pickRandomLandPoint(candidates);\n            if (disposed || RUN._activeRunId !== runId) return;\n            if (picked) {")
replace_once("src/js/quiz_runner.js", "            setTimeout(() => {\n                try { if (typeof SQ.setTargetByName === \"function\") SQ.setTargetByName(null); } catch (_) {}\n            }, 8);", "            scheduleRunTimeout(() => {\n                try { if (typeof SQ.setTargetByName === \"function\") SQ.setTargetByName(null); } catch (_) {}\n            }, 8);")
replace_once("src/js/quiz_runner.js", "        setTimeout(() => {\n            if (!persistCompletedHighlights) {\n                clearStates();\n            }\n            nextQuestion();\n        }, 700);", "        scheduleRunTimeout(() => {\n            if (!persistCompletedHighlights) {\n                clearStates();\n            }\n            nextQuestion();\n        }, 700);")
replace_once("src/js/quiz_runner.js", "        setTimeout(() => {\n            clearStates();\n            repaintCompleted();\n            nextQuestion();\n        }, 900);", "        scheduleRunTimeout(() => {\n            clearStates();\n            repaintCompleted();\n            nextQuestion();\n        }, 900);")
replace_once("src/js/flag_quiz.js", "            timerInterval = root.setInterval(updateStats, 250);", "            timerInterval = root.setInterval(updateStats, 1000);")

Path("tests/runtime_memory.test.js").write_text(r'''const fs = require("node:fs");
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
    assert.match(read("src/js/app.js"), /20260910-memory-1/);
    assert.match(read("tools/quiz_page_shell.js"), /20260910-memory-1/);
    assert.match(read("src/js/app_core.js"), /const APP_VERSION = "1\.14\.7";/);
    assert.match(read("src/js/app_core.js"), /quiz_runner\.js\?v=20260910-memory-1/);
});
''')
