const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.join(__dirname, "..");
const weakSpots = require(path.join(root, "src/js/weak_spots.js"));

test("Weak Spots keys keep quiz skills separate", () => {
    assert.notEqual(
        weakSpots.entryKey("France", "click-country"),
        weakSpots.entryKey("France", "type-country")
    );
    assert.notEqual(
        weakSpots.entryKey("France", "click-country"),
        weakSpots.entryKey("France", "type-flag")
    );
    assert.equal(
        weakSpots.entryKey("São Tomé", "type-flag"),
        weakSpots.entryKey("Sao Tome", "type-flag")
    );
});

test("Weak Spots practice stages preserve mode and group", () => {
    const stages = weakSpots.buildPracticeStagesFromEntries([
        { name: "France", mode: "click-country", group: "world" },
        { name: "France", mode: "type-flag", group: "europe" },
        { name: "Germany", mode: "type-flag", group: "europe" },
        { name: "Texas", mode: "type-subdivision", group: "us_states" }
    ]);

    assert.equal(stages.length, 3);

    const click = stages.find(stage => stage.mode === "click-country");
    assert.equal(click.quizId, "click-country");
    assert.equal(click.group, "world");
    assert.deepEqual(Array.from(click.names), ["France"]);

    const flags = stages.find(stage => stage.mode === "type-flag");
    assert.equal(flags.quizId, "type-flag");
    assert.equal(flags.group, "europe");
    assert.equal(flags.label, "Flags: Europe");
    assert.deepEqual(Array.from(flags.names), ["France", "Germany"]);

    const states = stages.find(stage => stage.mode === "type-subdivision");
    assert.equal(states.quizId, "type-subdivision");
    assert.equal(states.group, "us_states");
    assert.deepEqual(Array.from(states.names), ["Texas"]);
});

test("v3 Weak Spots migration splits one place into mode-specific entries", () => {
    const migrated = weakSpots.migrateStore({
        version: 3,
        entries: {
            "country:france": {
                name: "France",
                kind: "country",
                misses: 5,
                retrySuccesses: 0,
                modes: {
                    "click-country": 2,
                    "type-flag": 3
                },
                groups: { world: 2, europe: 3 },
                createdAt: 100,
                updatedAt: 200
            }
        }
    });

    assert.equal(migrated.version, 4);
    assert.equal(Object.keys(migrated.entries).length, 2);
    assert.equal(migrated.entries["click-country:france"].misses, 2);
    assert.equal(migrated.entries["type-flag:france"].misses, 3);
});

test("older subdivision Weak Spots fall back to Click States", () => {
    const migrated = weakSpots.migrateStore({
        version: 2,
        entries: {
            "subdivision:texas": {
                name: "Texas",
                kind: "subdivision",
                misses: 2,
                retrySuccesses: 1
            }
        }
    });

    const entry = migrated.entries["click-subdivision:texas"];
    assert.ok(entry);
    assert.equal(entry.mode, "click-subdivision");
    assert.equal(entry.group, "us_states");
    assert.equal(entry.misses, 1);
});
