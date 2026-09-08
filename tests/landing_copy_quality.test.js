const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function modeParagraph(html, heading) {
    const match = html.match(
        new RegExp("<h2>" + heading + "<\\/h2>\\s*<p>(.*?)<\\/p>", "s")
    );
    return match ? match[1] : "";
}

test("grammar-sensitive templates do not splice raw group labels into prose", () => {
    const descriptions = JSON.parse(read("src/data/quiz_page_descriptions.json"));

    assert.match(descriptions.modes["type-country"].lead, /\{groupTopic\}/);
    assert.doesNotMatch(descriptions.modes["type-country"].lead, /\{group\}/);
    assert.doesNotMatch(descriptions.modes["type-country"].bestFor, /\{group\}/);

    assert.match(descriptions.modes["find-country"].lead, /\{groupTopic\}/);
    assert.doesNotMatch(descriptions.modes["find-country"].lead, /\{group\}/);

    assert.doesNotMatch(descriptions.modes["find-point"].lead, /\{group\}/);

    assert.match(descriptions.modes["type-capital"].lead, /\{groupTopic\}/);
    assert.doesNotMatch(descriptions.modes["type-capital"].bestFor, /\{group\}/);

    for (const modeId of [
        "click-subdivision",
        "type-subdivision",
        "find-subdivision",
        "find-point-subdivision"
    ]) {
        for (const value of Object.values(descriptions.modes[modeId] || {})) {
            if (typeof value !== "string") continue;
            assert.doesNotMatch(
                value,
                /\b(?:inside|of|part of|edge of) \{group\}/,
                modeId + " should use groupTopic for sentence grammar"
            );
        }
    }
});

test("known awkward group names render naturally", () => {
    const spanishCapital = read(
        "quizzes/type-capital/spanish_speaking/index.html"
    );
    assert.match(
        spanishCapital,
        /Practice the capitals of Spanish-speaking countries/
    );
    assert.equal(
        modeParagraph(spanishCapital, "When this mode helps"),
        "Use this when you know the countries in this set and want to add capital-city recall without losing the geographic context of the map."
    );
    assert.doesNotMatch(
        spanishCapital,
        /countries in Spanish-Speaking Countries/
    );

    const worldType = read("quizzes/type-country/world/index.html");
    assert.match(worldType, /names and locations of the world/);
    assert.doesNotMatch(worldType, /locations of World/);

    const euType = read("quizzes/type-country/european_union/index.html");
    assert.match(euType, /names and locations of the European Union/);
    assert.doesNotMatch(euType, /locations of European Union/);

    const balkans = read("quizzes/find-country/balkans/index.html");
    assert.match(balkans, /knowledge of the Balkans/);

    const americas = read("quizzes/find-country/americas/index.html");
    assert.match(americas, /knowledge of the Americas/);
});

test("subdivision prose refers to the parent geography, not the group title", () => {
    const clickStates = read("quizzes/click-subdivision/us_states/index.html");
    assert.match(clickStates, /inside the United States/);
    assert.match(clickStates, /right part of the United States/);
    assert.doesNotMatch(clickStates, /inside US States/);

    const findStates = read("quizzes/find-subdivision/us_states/index.html");
    assert.match(findStates, /knowledge of the United States/);
    assert.match(findStates, /outer shape of the United States/);
});

test("generated landing pages do not leak unresolved prose placeholders", () => {
    const modes = [
        "click-country",
        "type-country",
        "type-capital",
        "find-country",
        "find-point",
        "click-subdivision",
        "type-subdivision",
        "find-subdivision",
        "find-point-subdivision"
    ];

    for (const mode of modes) {
        const directory = path.join(root, "quizzes", mode);
        if (!fs.existsSync(directory)) continue;

        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const filename = path.join(directory, entry.name, "index.html");
            if (!fs.existsSync(filename)) continue;
            const html = fs.readFileSync(filename, "utf8");
            assert.doesNotMatch(
                html,
                /\{(?:group|groupTopic|unitName|unitPlural|countPhrase)\}/,
                path.relative(root, filename) + " contains an unresolved template token"
            );
        }
    }
});
