const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const definitions = require(path.join(root, "src/js/quiz_definitions.js"));
const shell = require(path.join(root, "tools/quiz_page_shell.js"));

function loadManifest() {
    const source = fs.readFileSync(path.join(root, "src/js/manifest.js"), "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.SmurdyQuizManifest;
}

const manifest = loadManifest();
const registry = definitions.createRegistry(() => manifest);

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

test("shared landing shell exposes one launch and favorite contract", () => {
    const actions = shell.renderLandingActions({
        quizId: "click-country",
        groupId: "europe",
        buttonClass: "qb-btn"
    });
    assert.match(actions, /data-smurdy-quiz-launch/);
    assert.match(actions, /data-smurdy-quiz-favorite/);
    assert.match(actions, /☆ Add to favorites/);
    assert.doesNotMatch(shell.renderFooter(), /·/);
});

test("map and flag landing pages use the shared shell and Favorite control", () => {
    const map = fs.readFileSync(
        path.join(root, "quizzes/click-country/europe/index.html"),
        "utf8"
    );
    const flags = fs.readFileSync(
        path.join(root, "quizzes/type-flag/europe/index.html"),
        "utf8"
    );

    for (const html of [map, flags]) {
        assert.match(html, /styles\/quiz_shared\.css/);
        assert.match(html, /data-smurdy-quiz-page/);
        assert.match(html, /data-smurdy-quiz-favorite/);
        assert.match(html, /src\/js\/quiz_definitions\.js/);
        assert.match(html, /src\/js\/quiz_landing\.js/);
    }
    assert.match(map, /data-quiz-modality="map"/);
    assert.match(flags, /data-quiz-modality="flag"/);
});
