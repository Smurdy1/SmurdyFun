const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("authored landing copy avoids the strongest recurring AI tells", () => {
    const source = [
        read("src/data/quiz_page_descriptions.json"),
        read("tools/landing_personality.js"),
        read("about/index.html"),
        read("contact/index.html")
    ].join("\n");
    assert.doesNotMatch(source, /—/);
    assert.doesNotMatch(source, /\bnot just\b/i);
    assert.doesNotMatch(source, /\bdelve\b|\btapestry\b|\bpivotal\b|\bseamless(?:ly)?\b|\brobust\b/i);
    assert.doesNotMatch(source, /\banchor(?:s|ed|ing)?\b/i);
});

test("homepage summary does not imply the quiz browser is below or use the old three-action list", () => {
    const homepage = read("index.html");
    assert.match(homepage, /The quiz browser has the full list\./);
    assert.doesNotMatch(homepage, /Pick a quiz below, save favorites, or use Weak Spots/);
});

test("anti-AI copy pass is versioned", () => {
    assert.match(read("src/js/app_core.js"), /const APP_VERSION = "1\.16\.24";/);
});
