const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const api = require(path.join(root, "src/js/flag_quiz.js"));
const sources = JSON.parse(fs.readFileSync(path.join(root, "src/data/flag_sources.json"), "utf8"));
const flagGroups = JSON.parse(fs.readFileSync(path.join(root, "src/data/flag_groups.json"), "utf8"));
const countryGroups = JSON.parse(fs.readFileSync(path.join(root, "src/data/country_groups.json"), "utf8"));
const countryAliases = JSON.parse(fs.readFileSync(path.join(root, "src/data/aliases.json"), "utf8"));

test("flag quiz selects all world and US state flags", () => {
    const world = api.selectFlags(sources, "world");
    const states = api.selectFlags(sources, "us_states");

    assert.equal(world.length, 200);
    assert.equal(states.length, 50);
    assert.ok(world.some(flag => flag.name === "Oman"));
    assert.ok(states.some(flag => flag.name === "Mississippi"));
});

test("every quiz flag has a unique id and an existing SVG", () => {
    const flags = [
        ...api.selectFlags(sources, "world"),
        ...api.selectFlags(sources, "us_states")
    ];
    assert.equal(new Set(flags.map(flag => flag.id)).size, 250);

    for (const flag of flags) {
        assert.equal(path.extname(flag.src), ".svg");
        assert.ok(fs.existsSync(path.join(root, flag.src)), flag.src);
    }
});

test("answer matching normalizes punctuation and existing aliases", () => {
    const aliases = {
        "United States of America": ["United States", "USA"]
    };
    const answers = api.acceptedAnswers("United States of America", aliases);

    assert.ok(answers.has(api.normalizeAnswer("United States")));
    assert.ok(answers.has(api.normalizeAnswer("U.S.A.")));
    assert.equal(api.normalizeAnswer("São Tomé & Príncipe"), "sao tome and principe");
    assert.equal(api.canonicalFlagName("Türkiye", countryAliases), "Turkey");
    assert.equal(api.canonicalFlagName("Holy See", countryAliases), "Vatican");
});

test("curated regional flag sets match their advertised counts", () => {
    const expected = {
        europe: 44,
        asia: 50,
        africa: 56,
        north_america: 23,
        south_america: 12,
        oceania: 14
    };

    for (const [setId, count] of Object.entries(expected)) {
        const flags = api.selectFlags(
            sources,
            setId,
            flagGroups,
            countryGroups,
            countryAliases
        );
        assert.equal(flags.length, count, setId);
        assert.equal(new Set(flags.map(flag => flag.id)).size, count, setId);
    }
});

test("flag routes load the shared runner and declare the correct set", () => {
    const routes = {
        world: "quizzes/type-flag/world/index.html",
        us_states: "quizzes/type-flag/us_states/index.html"
    };

    for (const [setId, relativePath] of Object.entries(routes)) {
        const html = fs.readFileSync(path.join(root, relativePath), "utf8");
        assert.match(html, new RegExp(`data-flag-set=["']${setId}["']`));
        assert.match(html, /src\/js\/flag_quiz\.js/);
    }
});

test("flag pages include the full landing and results experience", () => {
    const html = fs.readFileSync(
        path.join(root, "quizzes/type-flag/europe/index.html"),
        "utf8"
    );
    const directory = fs.readFileSync(
        path.join(root, "quizzes/type-flag/index.html"),
        "utf8"
    );
    const sitemap = fs.readFileSync(path.join(root, "sitemap.txt"), "utf8");

    assert.match(html, /What this Europe quiz covers/);
    assert.match(html, /Flags to review|data-flag-review/);
    assert.match(html, /data-flag-progress-bar/);
    assert.match(html, /data-flag-time/);
    assert.match(html, /data-flag-favorite/);
    assert.match(html, /data-flag-retry/);
    assert.match(html, /Countries included in this quiz \(44\)/);
    assert.match(directory, /Countries and territories/);
    assert.match(directory, /<h2>Subdivisions<\/h2>/);
    assert.match(directory, /directory-card-title">North America/);
    assert.match(directory, /directory-card-title">US States/);
    assert.match(directory, /directory-card-title">Locate/);
    assert.match(directory, /Coming soon!/);
    assert.match(html, /class="flag-button" href="\/">Back<\/a>/);
    assert.match(html, /data-flag-restart>Restart/);
    assert.match(html, /data-flag-after-actions hidden/);
    assert.doesNotMatch(html, /flag-eyebrow|class="flag-exit"/);
    assert.match(sitemap, /quizzes\/type-flag\/oceania\//);
});
