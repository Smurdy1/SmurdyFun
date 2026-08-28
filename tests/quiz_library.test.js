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
    assert.match(browse, /SmurdyQuizLibrary\?\.recordPlayed/);
    assert.match(home, /src\/js\/quiz_library\.js/);
    assert.match(
        privacy,
        /favorite quizzes, recently played quizzes/
    );
});
