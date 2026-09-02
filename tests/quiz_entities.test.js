const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const countries = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/countries.json"),
    "utf8"
));
const aliases = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/aliases.json"),
    "utf8"
));
const {
    ADMIN_OVERRIDES,
    getCanonicalCountryName
} = require("../src/js/quiz_entities.js");

function featureByAdmin(admin) {
    return countries.features.find(feature =>
        feature?.properties?.ADMIN === admin
    );
}

test("Palestine is a separate documented quiz entity", () => {
    assert.equal(
        ADMIN_OVERRIDES.Palestine.criterion,
        "UN non-member observer state"
    );
    assert.equal(
        getCanonicalCountryName(featureByAdmin("Palestine")),
        "Palestine"
    );
    assert.ok(Array.isArray(aliases.Palestine));
});

test("ordinary dependencies remain grouped with their sovereign state", () => {
    assert.equal(
        getCanonicalCountryName(featureByAdmin("Falkland Islands")),
        "United Kingdom"
    );
});

test("world quiz contains 201 canonical entities", () => {
    const canonicalNames = new Set(
        countries.features
            .map(getCanonicalCountryName)
    );

    assert.equal(canonicalNames.size, 201);
    assert.ok(canonicalNames.has("Israel"));
    assert.ok(canonicalNames.has("Palestine"));
});
