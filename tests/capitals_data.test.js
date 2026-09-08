const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const dataset = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/capitals.json"),
    "utf8"
));
const flagSources = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/flag_sources.json"),
    "utf8"
));
const countryGroups = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/country_groups.json"),
    "utf8"
));

const capitals = dataset.capitals;
const countrySources = flagSources.flags.filter(entry => entry.kind === "country");

test("capital dataset covers every country flag source", () => {
    assert.equal(Object.keys(capitals).length, countrySources.length);
    for (const source of countrySources) {
        assert.ok(capitals[source.name], "Missing capital record for " + source.name);
    }
});

test("every playable capital has accepted answers and coordinates", () => {
    for (const [country, entry] of Object.entries(capitals)) {
        if (entry.capital === null) {
            assert.equal(country, "Antarctica");
            assert.deepEqual(entry.accepted, []);
            assert.deepEqual(entry.locations, []);
            continue;
        }

        assert.equal(typeof entry.capital, "string");
        assert.ok(entry.capital.length > 0);
        assert.ok(Array.isArray(entry.accepted) && entry.accepted.length > 0);
        assert.ok(entry.accepted.includes(entry.capital));
        assert.ok(Array.isArray(entry.locations) && entry.locations.length > 0);

        for (const location of entry.locations) {
            assert.equal(typeof location.name, "string");
            assert.match(location.wikidataId, /^Q\d+$/);
            assert.ok(Number.isFinite(location.lat) && location.lat >= -90 && location.lat <= 90);
            assert.ok(Number.isFinite(location.lng) && location.lng >= -180 && location.lng <= 180);
        }
    }
});

test("Latin America is complete and ready for a capitals quiz", () => {
    const latinAmerica = countryGroups.latin_america.countries;
    assert.equal(latinAmerica.length, 21);

    for (const country of latinAmerica) {
        const entry = capitals[country];
        assert.ok(entry, "Latin America is missing " + country);
        assert.ok(entry.capital, country + " has no capital");
        assert.ok(entry.locations.length > 0, country + " has no capital coordinates");
    }
});

test("known multi-capital edge cases stay explicit", () => {
    assert.ok(capitals["South Africa"].accepted.includes("Pretoria"));
    assert.ok(capitals["South Africa"].accepted.includes("Cape Town"));
    assert.ok(capitals["South Africa"].accepted.includes("Bloemfontein"));

    assert.ok(capitals.Eswatini.accepted.includes("Mbabane"));
    assert.ok(capitals.Eswatini.accepted.includes("Lobamba"));

    assert.ok(capitals.Nauru.accepted.includes("Yaren"));
    assert.equal(capitals["Sri Lanka"].capital, "Sri Jayawardenepura Kotte");
});
