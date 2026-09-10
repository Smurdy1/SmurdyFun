const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const definitions = require(path.join(root, "src/js/quiz_definitions.js"));
const shell = require(path.join(root, "tools/quiz_page_shell.js"));

function loadManifest(unitName = null) {
    const source = fs.readFileSync(path.join(root, "src/js/manifest.js"), "utf8");
    const sandbox = { window: {} };
    if (unitName) {
        sandbox.window.SmurdyQuiz = {
            getCurrentGroup: () => ({ unitName })
        };
    }
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.SmurdyQuizManifest;
}

const manifest = loadManifest();
const registry = definitions.createRegistry(() => manifest);

test("subdivision prompts use the active group's unit name", () => {
    const states = loadManifest("state");
    const provinces = loadManifest("province");
    const stateType = states.find(entry => entry.id === "type-subdivision");
    const statePoint = states.find(entry => entry.id === "find-point-subdivision");
    const provinceType = provinces.find(entry => entry.id === "type-subdivision");
    const provincePoint = provinces.find(entry => entry.id === "find-point-subdivision");

    assert.equal(stateType.config.titleBuilder(), "Name the highlighted state");
    assert.equal(stateType.config.inputPlaceholder(), "Enter the state name...");
    assert.equal(statePoint.config.titleBuilder(), "Name the state containing the point");
    assert.equal(statePoint.config.inputPlaceholder(), "Enter the state name...");
    assert.equal(provinceType.config.titleBuilder(), "Name the highlighted province");
    assert.equal(provincePoint.config.titleBuilder(), "Name the province containing the point");
});

test("quiz definitions expose explicit modality adapters", () => {
    const click = registry.get("click-country");
    assert.equal(click.category, "maps");
    assert.equal(click.interaction, "click");
    assert.equal(click.family, "countries");
    assert.equal(click.modality, "map");
    assert.equal(click.adapter.requiresMenuMap, true);

    const states = registry.get("type-subdivision");
    assert.equal(states.family, "subdivisions");
    assert.deepEqual(Array.from(states.families), ["subdivisions"]);

    const capitals = registry.get("type-capital");
    assert.equal(capitals.category, "capitals");
    assert.equal(capitals.interaction, "type");
    assert.equal(capitals.family, "countries");
    assert.deepEqual(Array.from(capitals.families), ["countries", "subdivisions"]);
    assert.equal(capitals.manifest.groupSetOverrides.us_states, "subdivision_groups");
    assert.equal(capitals.modality, "map");
    assert.equal(capitals.adapter.requiresMenuMap, true);

    const locateCapitals = registry.get("locate-capital");
    assert.equal(locateCapitals.category, "capitals");
    assert.equal(locateCapitals.interaction, "locate");
    assert.equal(locateCapitals.modality, "map");
    assert.equal(locateCapitals.playable, false);
    assert.deepEqual(
        Array.from(locateCapitals.families),
        ["countries", "subdivisions"]
    );

    const flags = registry.get("type-flag");
    assert.equal(flags.category, "flags");
    assert.equal(flags.interaction, "type");
    assert.equal(flags.modality, "flag");
    assert.equal(flags.adapter.requiresMenuMap, false);
    assert.deepEqual(Array.from(flags.families), ["countries", "subdivisions"]);
});

test("definition registry owns canonical paths and legacy subdivision aliases", () => {
    assert.equal(
        registry.landingPath("type-flag", "south_america"),
        "/quizzes/type-flag/south_america/"
    );
    assert.equal(
        registry.resolveLegacyQuizId("click-country", { groupSet: "subdivision_groups" }),
        "click-subdivision"
    );
});

test("shared landing shell keeps one compact action row", () => {
    const primary = shell.renderPrimaryLaunch({ buttonClass: "qb-btn" });
    const actions = shell.renderLandingActions({
        quizId: "click-country",
        groupId: "europe",
        buttonClass: "qb-btn",
        includeHome: true
    });

    assert.equal(primary, "");
    assert.match(actions, /data-smurdy-quiz-launch/);
    assert.match(actions, /data-smurdy-quiz-favorite/);
    assert.match(actions, /☆ Add to favorites/);
    assert.match(actions, />Home</);
    assert.doesNotMatch(actions, />All quizzes</);
    assert.doesNotMatch(shell.renderFooter(), /·/);
});

test("map and flag landing pages use one shared Play action", () => {
    const map = fs.readFileSync(
        path.join(root, "quizzes/click-country/europe/index.html"),
        "utf8"
    );
    const capitals = fs.readFileSync(
        path.join(root, "quizzes/type-capital/latin_america/index.html"),
        "utf8"
    );
    const flags = fs.readFileSync(
        path.join(root, "quizzes/type-flag/europe/index.html"),
        "utf8"
    );

    for (const html of [map, capitals, flags]) {
        assert.match(html, /styles\/quiz_shared\.css/);
        assert.match(html, /data-smurdy-quiz-page/);
        assert.doesNotMatch(html, /data-smurdy-quiz-primary-action/);
        assert.equal((html.match(/data-smurdy-quiz-launch/g) || []).length, 1);
        assert.equal((html.match(/data-smurdy-quiz-favorite/g) || []).length, 1);
        assert.match(html, />Home</);
        assert.doesNotMatch(
            html,
            /data-smurdy-quiz-actions[\s\S]*?>All quizzes<\/a>/
        );
        assert.match(html, /src\/js\/quiz_definitions\.js/);
        assert.match(html, /src\/js\/quiz_landing\.js/);
    }
    assert.match(map, /data-quiz-modality="map"/);
    assert.match(capitals, /data-quiz-modality="map"/);
    assert.match(capitals, /Type the Capitals: Latin America Quiz/);
    assert.match(capitals, /Type the Capitals/);
    assert.match(flags, /data-quiz-modality="flag"/);
});


test("US state capitals landing page uses the shared capitals mode", () => {
    const html = fs.readFileSync(
        path.join(root, "quizzes/type-capital/us_states/index.html"),
        "utf8"
    );

    assert.match(html, /Type the US State Capitals Quiz/);
    assert.match(html, /50 states/);
    assert.match(html, /data-quiz-id="type-capital"/);
    assert.match(html, /data-quiz-group="us_states"/);
    assert.match(html, />Type the Capitals<\/a>/);
    assert.match(html, /aria-current="page">US States<\/span>/);
});
