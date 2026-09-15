const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const lore = require("../src/js/lore.js");
const read = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("lore release is a minor feature release and state schema is non-identifying", () => {
    assert.equal(lore.RELEASE_VERSION, "1.16.0");
    const state = lore.blankState("seed");
    assert.equal(state.lore_seed, "seed");
    assert.equal(state.seen_cat_box, false);
    assert.equal(state.turnover_count, 0);
    assert.equal(state.forbidden8_count, 0);
});

test("date and time gates use local calendar fields", () => {
    assert.equal(lore.isMarch17(new Date(2026, 2, 17, 12, 0)), true);
    assert.equal(lore.isMarch17(new Date(2026, 2, 16, 12, 0)), false);
    assert.equal(lore.isJan17(new Date(2026, 0, 17, 12, 0)), true);
    assert.equal(lore.is505(new Date(2026, 8, 14, 5, 5)), true);
    assert.equal(lore.is505(new Date(2026, 8, 14, 17, 5)), false);
    assert.equal(lore.is1313(new Date(2026, 8, 14, 13, 13)), true);
});

test("stable lore choices are deterministic per seed", () => {
    assert.equal(lore.stableUnit("same-seed", "8"), lore.stableUnit("same-seed", "8"));
    assert.notEqual(lore.hash32("1353"), lore.hash32("1313"));
});

test("lore loader is attached to the shared quiz launch module", () => {
    const source = read("src/js/quiz_launch_intent.js");
    assert.match(source, /data-smurdy-lore-module/);
    assert.match(source, /\/src\/js\/lore\.js\?v=20260914-lore-1/);
});

test("lore stays local and production URLs cannot force debug events", () => {
    const source = read("src/js/lore.js");
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon/);
    assert.match(source, /host === "localhost"/);
    assert.match(source, /params\.get\("loreTest"\) !== "1"/);
    assert.match(source, /params\.has\("smurdyTest"\)/);
});

test("core rare-event denominators and geography-safe West Virginia hook are present", () => {
    const source = read("src/js/lore.js");
    assert.match(source, /roll\("completion-ferfect", 1353\)/);
    assert.match(source, /roll\("completion-bttc", 4824\)/);
    assert.match(source, /roll\("completion-style", 5729\)/);
    assert.match(source, /roll\("uk-box", 8888\)/);
    assert.match(source, /roll\("home-reverse", reverseDenominator\)/);
    assert.match(source, /roll\("home-eye-missing", 80000\)/);
    assert.match(source, /cleanCountry === "west virginia"/);
    assert.match(source, /#aac1c1/);
});

test("secret pages are noindex and there is no public lore hub", () => {
    const pages = ["turnover", "jailtime", "8", "4824", "1313", "bouvet", "tps", "overlap", "archive", "fields"];
    for (const page of pages) {
        const html = read(`${page}/index.html`);
        assert.match(html, /noindex, nofollow, noarchive/);
        assert.match(html, /\/src\/js\/lore\.js/);
    }
    assert.equal(fs.existsSync(path.join(__dirname, "..", "lore", "index.html")), false);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "secrets", "index.html")), false);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "arg", "index.html")), false);
});

test("turnover poem text and inside-code vocabulary are preserved", () => {
    const source = read("src/js/lore.js");
    assert.match(source, /OLIM • INSVLAM • BOVVET • VINCAM/);
    assert.match(source, /COLVMBAM • MENDACEM • VICI/);
    assert.match(source, /III👁️XVII • IN • I👁️\+XVII • VERSVM • EST/);
    assert.match(source, /ININVESTIGABILEM • INVENI/);
    assert.match(source, /AETERNVM • AMBVLANS • ITERVM • EFFVGIAM/);
    assert.match(source, /DEPREHENSVM • PERFECI/);
    assert.match(source, /The long con never ends/);
    assert.match(source, /where the fields lie/);
    assert.match(source, /OCVLVS SMVRDII OMNIA VIDET/);
});
