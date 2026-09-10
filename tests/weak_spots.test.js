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
    assert.notEqual(
        weakSpots.entryKey("France", "click-country"),
        weakSpots.entryKey("France", "type-capital")
    );
    assert.equal(
        weakSpots.modeDefinition("type-capital").label,
        "Type Capitals"
    );
    assert.notEqual(
        weakSpots.entryKey("Georgia", "type-capital"),
        weakSpots.entryKey("Georgia", "type-capital-subdivision")
    );
    assert.equal(
        weakSpots.modeDefinition("type-capital-subdivision").label,
        "State Capitals"
    );
    assert.equal(
        weakSpots.entryKey("São Tomé", "type-flag"),
        weakSpots.entryKey("Sao Tome", "type-flag")
    );
});

test("Weak Spots practice merges regional misses into one round per mode", () => {
    const stages = weakSpots.buildPracticeStagesFromEntries([
        { name: "France", mode: "click-country", group: "europe" },
        { name: "Japan", mode: "click-country", group: "asia" },
        { name: "France", mode: "type-flag", group: "europe" },
        { name: "Germany", mode: "type-flag", group: "europe" },
        { name: "Japan", mode: "type-flag", group: "asia" },
        { name: "Brazil", mode: "type-capital", group: "latin_america" },
        { name: "France", mode: "type-capital", group: "europe" },
        { name: "California", mode: "type-capital-subdivision", group: "us_states" },
        { name: "Texas", mode: "type-subdivision", group: "us_states" }
    ]);

    assert.equal(stages.length, 5);

    const click = stages.find(stage => stage.mode === "click-country");
    assert.equal(click.quizId, "click-country");
    assert.equal(click.group, "world");
    assert.equal(click.label, "Click Countries");
    assert.deepEqual(Array.from(click.names), ["France", "Japan"]);

    const flags = stages.find(stage => stage.mode === "type-flag");
    assert.equal(flags.quizId, "type-flag");
    assert.equal(flags.group, "world");
    assert.equal(flags.label, "Flags");
    assert.deepEqual(Array.from(flags.names), ["France", "Germany", "Japan"]);

    const capitals = stages.find(stage => stage.mode === "type-capital");
    assert.equal(capitals.quizId, "type-capital");
    assert.equal(capitals.group, "world");
    assert.equal(capitals.label, "Type Capitals");
    assert.deepEqual(Array.from(capitals.names), ["Brazil", "France"]);

    const states = stages.find(stage => stage.mode === "type-subdivision");
    assert.equal(states.quizId, "type-subdivision");
    assert.equal(states.group, "us_states");
    assert.deepEqual(Array.from(states.names), ["Texas"]);

    const stateCapitals = stages.find(stage => stage.mode === "type-capital-subdivision");
    assert.equal(stateCapitals.quizId, "type-capital");
    assert.equal(stateCapitals.group, "us_states");
    assert.deepEqual(Array.from(stateCapitals.names), ["California"]);
});

test("Weak Spots practice uses a stable mode order", () => {
    const stages = weakSpots.buildPracticeStagesFromEntries([
        { name: "Texas", mode: "type-subdivision", group: "us_states" },
        { name: "France", mode: "type-capital", group: "europe" },
        { name: "Germany", mode: "type-flag", group: "europe" },
        { name: "Japan", mode: "find-country", group: "asia" },
        { name: "Brazil", mode: "click-country", group: "south_america" }
    ]);

    assert.deepEqual(
        stages.map(stage => stage.mode),
        ["click-country", "find-country", "type-flag", "type-capital", "type-subdivision"]
    );
});

test("Weak Spots practice retries only mistakes before advancing", () => {
    const plan = {
        version: weakSpots.practicePlanVersion,
        index: 0,
        stages: [
            {
                mode: "click-country",
                kind: "country",
                label: "Click Countries",
                quizId: "click-country",
                group: "world",
                names: ["France", "Germany", "Japan"]
            },
            {
                mode: "type-flag",
                kind: "country",
                label: "Flags",
                quizId: "type-flag",
                group: "world",
                names: ["Brazil"]
            }
        ]
    };

    const progress = weakSpots.progressPracticePlan(plan, [
        { name: "Germany", mode: "click-country" },
        { name: "Japan", mode: "click-country" },
        { name: "Brazil", mode: "type-flag" }
    ]);

    assert.equal(progress.status, "retry");
    assert.equal(progress.plan.index, 0);
    assert.equal(progress.stage.label, "Retry missed");
    assert.equal(progress.stage.group, "world");
    assert.deepEqual(Array.from(progress.stage.names), ["Germany", "Japan"]);
});

test("Weak Spots practice advances after a clean round", () => {
    const plan = {
        version: weakSpots.practicePlanVersion,
        index: 0,
        stages: [
            {
                mode: "click-country",
                kind: "country",
                label: "Click Countries",
                quizId: "click-country",
                group: "world",
                names: ["France", "Germany"]
            },
            {
                mode: "type-flag",
                kind: "country",
                label: "Flags",
                quizId: "type-flag",
                group: "world",
                names: ["Brazil", "Argentina"]
            }
        ]
    };

    const progress = weakSpots.progressPracticePlan(plan, [
        { name: "Brazil", mode: "type-flag" },
        { name: "Argentina", mode: "type-flag" }
    ]);

    assert.equal(progress.status, "next");
    assert.equal(progress.plan.index, 1);
    assert.equal(progress.stage.label, "Flags");
    assert.deepEqual(Array.from(progress.stage.names), ["Brazil", "Argentina"]);
});

test("Weak Spots practice finishes when the final round is clean", () => {
    const plan = {
        version: weakSpots.practicePlanVersion,
        index: 0,
        stages: [
            {
                mode: "click-country",
                kind: "country",
                label: "Click Countries",
                quizId: "click-country",
                group: "world",
                names: ["France"]
            }
        ]
    };

    const progress = weakSpots.progressPracticePlan(plan, []);
    assert.equal(progress.status, "complete");
    assert.equal(progress.plan, null);
    assert.equal(progress.stage, null);
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
