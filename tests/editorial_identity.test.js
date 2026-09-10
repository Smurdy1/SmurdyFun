const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { LANDING_PERSONALITY } = require("../tools/landing_personality.js");

function read(relativePath) {
    return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

test("landing personality covers the main geography sets with authored copy", () => {
    const entries = Object.entries(LANDING_PERSONALITY);
    assert.ok(entries.length >= 25);

    for (const [id, personality] of entries) {
        assert.ok(personality.overviewHeading, `${id} needs an overview heading`);
        assert.ok(personality.exampleSentence, `${id} needs a concrete example`);
        assert.doesNotMatch(personality.overviewHeading, /^What this .* quiz covers$/i);
    }

    assert.match(LANDING_PERSONALITY.world.sectionBody, /mental map/i);
    assert.match(LANDING_PERSONALITY.balkans.sectionBody, /neighbor/i);
    assert.match(LANDING_PERSONALITY.tiny_countries.sectionBody, /world-map scale/i);
});

test("generated landing pages expose region-specific editorial fingerprints", () => {
    const world = read("quizzes/click-country/world/index.html");
    const europe = read("quizzes/click-country/europe/index.html");
    const balkans = read("quizzes/click-country/balkans/index.html");
    const tiny = read("quizzes/click-country/tiny_countries/index.html");
    const worldFlags = read("quizzes/type-flag/world/index.html");

    /* World intentionally keeps its headingless intro, then gets a unique authored aside. */
    assert.match(world, /One round can jump from Argentina to Kyrgyzstan to Fiji/);
    assert.match(world, /Why World feels different/);
    assert.match(europe, /Lots of countries in very little space/);
    assert.match(europe, /Where the map gets crowded/);
    assert.match(balkans, /Names are only half the problem/);
    assert.match(tiny, /Zoom is part of the challenge/);
    assert.match(worldFlags, /Why World feels different/);
    assert.doesNotMatch(world, /What this World quiz covers/);
});

test("polish keeps hierarchy without bringing back component-heavy cards", () => {
    const style = read("styles/style.css");
    const browser = read("styles/browser_hierarchy.css");
    const directory = read("styles/quiz_directory.css");
    const landing = read("styles/quiz_landing.css");
    const info = read("styles/info_pages.css");
    const about = read("about/index.html");

    assert.match(style, /1\.14\.6 meaningful surfaces/);
    assert.match(style, /\.weak-spots-count[\s\S]*?background:/);
    assert.match(browser, /1\.14\.6 surface balance/);
    assert.match(directory, /1\.14\.6 directory hierarchy/);
    assert.match(directory, /href\$=["']\\?\/world\//);
    assert.match(landing, /1\.14\.6 authored landing rhythm/);
    assert.match(info, /\.maker-note/);
    assert.match(about, /class="maker-note"/);
    assert.doesNotMatch(directory, /\.directory-card\s*\{[^}]*box-shadow/s);
});

test("visible app version is current for this polish release", () => {
    assert.match(read("src/js/app_core.js"), /const APP_VERSION = "1\.14\.6"/);
});
