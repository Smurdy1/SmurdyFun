const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
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
        "quizzes/capitals/type/countries/spanish_speaking/index.html"
    );
    assert.match(
        spanishCapital,
        /Practice the capitals of Spanish-speaking countries/
    );
    assert.match(
        spanishCapital,
        /Use this once the countries or states themselves are familiar and you want to add the capitals\./
    );
    assert.doesNotMatch(spanishCapital, /<h2>When this mode helps<\/h2>/);
    assert.doesNotMatch(
        spanishCapital,
        /countries in Spanish-Speaking Countries/
    );

    const worldType = read("quizzes/maps/type/countries/world/index.html");
    assert.match(worldType, /names and locations of the world/);
    assert.doesNotMatch(worldType, /locations of World/);

    const euType = read("quizzes/maps/type/countries/european_union/index.html");
    assert.match(euType, /names and locations of the European Union/);
    assert.doesNotMatch(euType, /locations of European Union/);

    const balkans = read("quizzes/maps/find/countries/balkans/index.html");
    assert.match(balkans, /knowledge of the Balkans/);

    const americas = read("quizzes/maps/find/countries/americas/index.html");
    assert.match(americas, /knowledge of the Americas/);
});

test("subdivision prose stays grammatically natural", () => {
    const clickStates = read("quizzes/maps/click/subdivisions/us_states/index.html");
    assert.match(clickStates, /50 US states/);
    assert.doesNotMatch(clickStates, /inside US States/);

    const findStates = read("quizzes/maps/find/subdivisions/us_states/index.html");
    assert.match(findStates, /outer shape of the United States/);
    assert.doesNotMatch(findStates, /inside US States/);
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
