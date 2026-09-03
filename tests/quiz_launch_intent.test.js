const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createClient,
    parseQuizPath,
    STORAGE_KEY
} = require("../src/js/quiz_launch_intent.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
        has(key) { return values.has(key); }
    };
}

test("launch intents match an exact clean quiz route and are one-time", () => {
    const storage = memoryStorage();
    let now = 1000;
    let pathname = "/quizzes/type-flag/europe/";
    const client = createClient({ storage, now: () => now, pathname: () => pathname });

    assert.equal(client.store("type-flag", "europe", "browser"), true);
    assert.equal(client.peekCurrent().reason, "browser");
    pathname = "/quizzes/type-flag/asia/";
    assert.equal(client.peekCurrent(), null);
    pathname = "/quizzes/type-flag/europe/";
    assert.equal(client.consumeCurrent().groupId, "europe");
    assert.equal(client.consumeCurrent(), null);
    assert.equal(storage.has(STORAGE_KEY), false);
});

test("launch intents expire and parse canonical paths", () => {
    const storage = memoryStorage();
    let now = 1000;
    const client = createClient({
        storage,
        now: () => now,
        pathname: () => "/quizzes/type-country/world/"
    });
    client.store("TYPE-COUNTRY", "WORLD", "weak_spots");
    now += 6 * 60 * 1000;
    assert.equal(client.peekCurrent(), null);
    assert.deepEqual(parseQuizPath("/quizzes/type-flag/us_states/"), {
        quizId: "type-flag",
        groupId: "us_states"
    });
});
