const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const countryGroups = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/country_groups.json"),
    "utf8"
));
const flagOverrides = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/flag_groups.json"),
    "utf8"
));
const { expandFlagGroups } = require(path.join(root, "src/js/flag_catalog.js"));

const expectedCountries = [
    "Mexico",
    "Guatemala",
    "El Salvador",
    "Honduras",
    "Nicaragua",
    "Costa Rica",
    "Panama",
    "Cuba",
    "Dominican Republic",
    "Colombia",
    "Venezuela",
    "Ecuador",
    "Peru",
    "Bolivia",
    "Chile",
    "Argentina",
    "Paraguay",
    "Uruguay",
    "Spain",
    "Equatorial Guinea"
];

test("Spanish-Speaking Countries is a public 20-country group", () => {
    const group = countryGroups.spanish_speaking;
    assert.ok(group);
    assert.equal(group.label, "Spanish-Speaking Countries");
    assert.deepEqual(group.allowedTypes, ["click", "type", "find", "find-point"]);
    assert.deepEqual(group.countries, expectedCountries);
    assert.equal(group.countries.length, 20);

    for (const excluded of [
        "Belize",
        "Guyana",
        "Suriname",
        "Brazil",
        "Puerto Rico",
        "France",
        "French Guiana",
        "Falkland Islands"
    ]) {
        assert.equal(group.countries.includes(excluded), false);
    }
});

test("Spanish-Speaking Countries is available to flags as well as map modes", () => {
    const expanded = expandFlagGroups(flagOverrides, countryGroups);
    const group = expanded.spanish_speaking;
    assert.ok(group);
    assert.equal(group.memberCount, 20);
    assert.equal(group.sourceGroup, "spanish_speaking");
    assert.match(group.description, /20 Spanish-speaking sovereign countries/);
});

test("all public country quiz modes generate Spanish-speaking landing pages", () => {
    const modes = [
        "click-country",
        "type-country",
        "type-capital",
        "find-country",
        "find-point",
        "type-flag"
    ];

    for (const mode of modes) {
        const filename = path.join(
            root,
            "quizzes",
            mode,
            "spanish_speaking",
            "index.html"
        );
        assert.equal(fs.existsSync(filename), true, "Missing " + mode + " page");
        const html = fs.readFileSync(filename, "utf8");

        assert.match(html, /Spanish-Speaking Countries/);
        assert.match(html, /content="index, follow"/);
        assert.doesNotMatch(html, /noindex/);
    }

    const click = fs.readFileSync(
        path.join(root, "quizzes/click-country/spanish_speaking/index.html"),
        "utf8"
    );
    assert.match(
        click,
        /20 sovereign countries where Spanish is a national official or dominant language/
    );

    const flags = fs.readFileSync(
        path.join(root, "quizzes/type-flag/spanish_speaking/index.html"),
        "utf8"
    );
    assert.match(flags, /same 20-country Spanish-speaking group/);
});

test("Spanish-speaking group appears on public discovery pages and sitemaps", () => {
    for (const relativePath of [
        "quizzes/click-country/index.html",
        "quizzes/type-country/index.html",
        "quizzes/type-capital/index.html",
        "quizzes/find-country/index.html",
        "quizzes/find-point/index.html",
        "quizzes/type-flag/index.html"
    ]) {
        const html = fs.readFileSync(path.join(root, relativePath), "utf8");
        assert.match(
            html,
            /Spanish-Speaking Countries/,
            relativePath + " should list the public group"
        );
    }

    const allQuizzes = fs.readFileSync(
        path.join(root, "quizzes/index.html"),
        "utf8"
    );
    assert.match(allQuizzes, /30 quiz sets/);
    assert.match(allQuizzes, /31 quiz sets/);

    const sitemap = fs.readFileSync(path.join(root, "sitemap.txt"), "utf8");
    for (const mode of [
        "click-country",
        "type-country",
        "type-capital",
        "find-country",
        "find-point",
        "type-flag"
    ]) {
        assert.match(
            sitemap,
            new RegExp(
                "https://smurdy\\.fun/quizzes/" +
                mode +
                "/spanish_speaking/"
            )
        );
    }
});
