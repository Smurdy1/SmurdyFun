const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const api = require(path.join(root, "src/js/flag_quiz.js"));
const sources = JSON.parse(fs.readFileSync(path.join(root, "src/data/flag_sources.json"), "utf8"));

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
