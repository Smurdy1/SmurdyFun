const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { expandFlagGroups } = require("../src/js/flag_catalog.js");

const root = path.resolve(__dirname, "..");
const overrides = JSON.parse(fs.readFileSync(path.join(root, "src/data/flag_groups.json"), "utf8"));
const countryGroups = JSON.parse(fs.readFileSync(path.join(root, "src/data/country_groups.json"), "utf8"));

test("flag country groups inherit every compatible map typing group", () => {
    const expanded = expandFlagGroups(overrides, countryGroups);
    const mapTypeGroups = Object.entries(countryGroups)
        .filter(([, group]) => !Array.isArray(group.allowedTypes) || group.allowedTypes.includes("type"))
        .map(([id]) => id);

    for (const id of mapTypeGroups) assert.ok(expanded[id], id);
    assert.equal(expanded.world.memberCount, countryGroups.world.memberCount);
    assert.equal(expanded.asia.memberCount, countryGroups.asia.countries.length);
    assert.equal(expanded.balkans.sourceGroup, "balkans");
    assert.equal(expanded.us_states.family, "subdivisions");
});
