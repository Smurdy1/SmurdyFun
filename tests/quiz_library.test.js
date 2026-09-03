const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createQuizLibrary } = require(
    "../src/js/quiz_library.js"
);

function createMemoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        }
    };
}

test("favorites persist locally and can be removed", () => {
    const storage = createMemoryStorage();
    let timestamp = 100;
    const library = createQuizLibrary({
        storage,
        now: () => ++timestamp
    });

    assert.equal(
        library.toggleFavorite("click-country", "world"),
        true
    );
    assert.equal(
        library.isFavorite("click-country", "world"),
        true
    );

    const reloaded = createQuizLibrary({ storage });
    assert.deepEqual(reloaded.getSnapshot().favorites, [
        {
            key: "click-country:world",
            manifestId: "click-country",
            groupId: "world",
            savedAt: 101
        }
    ]);

    assert.equal(
        reloaded.toggleFavorite("click-country", "world"),
        false
    );
    assert.equal(reloaded.getSnapshot().favorites.length, 0);
});

test("recent quizzes are unique, newest first, and capped", () => {
    const storage = createMemoryStorage();
    let timestamp = 1000;
    const library = createQuizLibrary({
        storage,
        now: () => ++timestamp
    });

    for (let index = 0; index < 14; index += 1) {
        library.recordPlayed("click-country", `group_${index}`);
    }

    library.recordPlayed("click-country", "group_5");
    const recent = library.getSnapshot().recent;

    assert.equal(recent.length, 12);
    assert.equal(recent[0].groupId, "group_5");
    assert.equal(
        recent.filter(entry => entry.groupId === "group_5").length,
        1
    );
    assert.ok(
        recent.every((entry, index) =>
            index === 0 ||
            recent[index - 1].playedAt >= entry.playedAt
        )
    );
});

test("invalid quiz identifiers are not stored", () => {
    const library = createQuizLibrary({
        storage: createMemoryStorage()
    });

    library.setFavorite("../../bad", "world", true);
    library.recordPlayed("click-country", "bad/group");

    assert.deepEqual(library.getSnapshot(), {
        favorites: [],
        recent: []
    });
});

test("quiz browser exposes library views and search filters", () => {
    const browse = fs.readFileSync(
        path.resolve(__dirname, "../src/js/browse.js"),
        "utf8"
    );
    const home = fs.readFileSync(
        path.resolve(__dirname, "../index.html"),
        "utf8"
    );
    const privacy = fs.readFileSync(
        path.resolve(__dirname, "../privacy/index.html"),
        "utf8"
    );

    assert.match(browse, /key: "favorites"/);
    assert.match(browse, /key: "recent"/);
    assert.match(browse, /data-library-view=/);
    assert.match(browse, /id="qb-size-filter"/);
    assert.match(browse, /class="qb-favorite"/);
    assert.match(browse, /function memberCountForGroup/);
    assert.match(browse, /memberCount >= 30/);
    assert.match(browse, /memberCount > 0 && memberCount < 30/);
    assert.match(browse, /Array\.from\(new Set\(tags\)\)\.slice\(0, 2\)/);
    assert.doesNotMatch(browse, /All Modes/);
    assert.doesNotMatch(browse, /All Types/);
    assert.match(
        browse,
        /showSuggested && card\.featured/
    );
    assert.match(browse, /SmurdyQuizLibrary\?\.recordPlayed/);
    assert.match(home, /src\/js\/quiz_library\.js/);
    assert.match(
        privacy,
        /favorite quizzes, recently played quizzes/
    );
});

test("saved flag cards are distinct and browser play links launch them directly", () => {
    const browse = fs.readFileSync(
        path.resolve(__dirname, "../src/js/browse.js"),
        "utf8"
    );
    const flagRunner = fs.readFileSync(
        path.resolve(__dirname, "../src/js/flag_quiz.js"),
        "utf8"
    );
    const countryGroups = JSON.parse(fs.readFileSync(
        path.resolve(__dirname, "../src/data/country_groups.json"),
        "utf8"
    ));
    const flagGroups = JSON.parse(fs.readFileSync(
        path.resolve(__dirname, "../src/data/flag_groups.json"),
        "utf8"
    ));

    assert.match(browse, /category === "flags"\s*\? "Flags"/);
    assert.match(browse, /`\$\{card\.label\} Flags`/);
    assert.doesNotMatch(browse, /\?play=1/);
    assert.match(browse, /ready \|\| isFlagQuiz/);
    assert.doesNotMatch(flagRunner, /get\("play"\)/);
    assert.equal(countryGroups.world.memberCount, 201);
    assert.ok(Object.values(flagGroups).every(group => !("tags" in group)));
});

test("quiz directories share one design and flags expose the planned taxonomy", () => {
    const manifest = fs.readFileSync(
        path.resolve(__dirname, "../src/js/manifest.js"),
        "utf8"
    );
    const allQuizzes = fs.readFileSync(
        path.resolve(__dirname, "../quizzes/index.html"),
        "utf8"
    );
    const modeHub = fs.readFileSync(
        path.resolve(__dirname, "../quizzes/click-country/index.html"),
        "utf8"
    );

    assert.match(manifest, /id: "locate-flag"/);
    assert.match(manifest, /status: "coming-soon"/);
    assert.match(manifest, /families: \["countries", "subdivisions"\]/);
    assert.match(allQuizzes, /styles\/quiz_directory\.css/);
    assert.match(allQuizzes, /<h2>Country maps<\/h2>/);
    assert.match(allQuizzes, /<h2>Subdivision maps<\/h2>/);
    assert.match(allQuizzes, /<h2>Flags<\/h2>/);
    assert.match(modeHub, /styles\/quiz_directory\.css/);
    assert.match(modeHub, /<h2>Main sets<\/h2>/);
    assert.match(modeHub, /<h2>Regional sets<\/h2>/);
    assert.doesNotMatch(allQuizzes, /<ul>/);
});
