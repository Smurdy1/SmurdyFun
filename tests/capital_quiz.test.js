const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const capitalQuiz = require(path.join(root, "src/js/capital_quiz.js"));
const dataset = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/capitals.json"),
    "utf8"
));
const groups = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/country_groups.json"),
    "utf8"
));

test("capital quiz resolves every named country group member", () => {
    const names = new Set(
        Object.values(groups).flatMap(group =>
            Array.isArray(group.countries)
                ? group.countries
                : (Array.isArray(group.members) ? group.members : [])
        )
    );

    for (const name of names) {
        const record = capitalQuiz.resolveRecord(dataset, name);
        assert.ok(record, "Missing capital lookup for " + name);
        assert.ok(record.capital, "Missing playable capital for " + name);
    }
});

test("capital answers normalize accents and punctuation", () => {
    const brazil = capitalQuiz.resolveRecord(dataset, "Brazil");
    const costaRica = capitalQuiz.resolveRecord(dataset, "Costa Rica");
    const yemen = capitalQuiz.resolveRecord(dataset, "Yemen");

    assert.equal(capitalQuiz.isAccepted(brazil, "Brasilia"), true);
    assert.equal(capitalQuiz.isAccepted(costaRica, "San Jose"), true);
    assert.equal(capitalQuiz.isAccepted(yemen, "Sana'a"), true);
});

test("country-label overrides map to canonical capital records", () => {
    const examples = {
        Czechia: "Prague",
        "Republic of Serbia": "Belgrade",
        Vatican: "Vatican City",
        Brunei: "Bandar Seri Begawan",
        "East Timor": "Dili",
        Turkey: "Ankara",
        "Ivory Coast": "Yamoussoukro",
        "United Republic of Tanzania": "Dodoma",
        "The Bahamas": "Nassau"
    };

    for (const [country, capital] of Object.entries(examples)) {
        assert.equal(
            capitalQuiz.resolveRecord(dataset, country)?.capital,
            capital
        );
    }
});

test("capital answer marker uses the primary capital coordinates", () => {
    const southAfrica = capitalQuiz.resolveRecord(dataset, "South Africa");
    const location = capitalQuiz.primaryLocation(southAfrica);

    assert.equal(southAfrica.capital, "Pretoria");
    assert.equal(location.name, "Pretoria");
    assert.ok(Number.isFinite(location.lat));
    assert.ok(Number.isFinite(location.lng));

    const featureCollection = capitalQuiz.markerFeatureCollection(location);
    assert.equal(featureCollection.features.length, 1);
    assert.deepEqual(
        featureCollection.features[0].geometry.coordinates,
        [location.lng, location.lat]
    );
});


test("capital answer matching supports multilingual Unicode aliases", () => {
    const japan = capitalQuiz.resolveRecord(dataset, "Japan");
    const russia = capitalQuiz.resolveRecord(dataset, "Russia");
    const greece = capitalQuiz.resolveRecord(dataset, "Greece");

    assert.equal(capitalQuiz.isAccepted(japan, "東京"), true);
    assert.equal(capitalQuiz.isAccepted(russia, "Москва"), true);
    assert.equal(capitalQuiz.isAccepted(greece, "Αθήνα"), true);
});
