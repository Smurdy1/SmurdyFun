const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
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
    let pathname = "/quizzes/flags/type/countries/europe/";
    const client = createClient({ storage, now: () => now, pathname: () => pathname });

    assert.equal(client.store("type-flag", "europe", "browser"), true);
    assert.equal(client.peekCurrent().reason, "browser");
    pathname = "/quizzes/flags/type/countries/asia/";
    assert.equal(client.peekCurrent(), null);
    pathname = "/quizzes/flags/type/countries/europe/";
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
        pathname: () => "/quizzes/maps/type/countries/world/"
    });
    client.store("TYPE-COUNTRY", "WORLD", "weak_spots");
    now += 6 * 60 * 1000;
    assert.equal(client.peekCurrent(), null);
    assert.deepEqual(parseQuizPath("/quizzes/flags/type/subdivisions/us_states/"), {
        quizId: "type-flag",
        groupId: "us_states"
    });
});


test("canonical flag launch intents survive quiz_routes loading after the intent module", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "src/js/quiz_launch_intent.js"), "utf8");
    const storage = memoryStorage();
    const window = {
        location: { pathname: "/quizzes/flags/type/countries/world/" },
        sessionStorage: storage
    };
    const context = vm.createContext({ window });
    vm.runInContext(source, context);

    window.SmurdyQuizRoutes = {
        parsePath(pathname) {
            return pathname === "/quizzes/flags/type/countries/world/"
                ? { quizId: "type-flag", groupId: "world" }
                : null;
        }
    };

    assert.equal(window.SmurdyQuizLaunchIntent.store("type-flag", "world", "browser"), true);
    assert.equal(window.SmurdyQuizLaunchIntent.peekCurrent().reason, "browser");
});

test("flag landing autostart waits for the flag controller", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "src/js/quiz_landing.js"), "utf8");
    assert.match(source, /function waitForFlagController/);
    assert.match(source, /await waitForFlagController\(\)/);
});
