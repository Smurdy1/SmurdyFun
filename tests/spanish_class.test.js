const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const spanishClass = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/spanish_class.json"),
    "utf8"
));
const countryGroups = JSON.parse(fs.readFileSync(
    path.join(root, "src/data/country_groups.json"),
    "utf8"
));

test("Spanish Class contains exactly the requested 19 countries", () => {
    assert.equal(spanishClass.id, "spanish_class");
    assert.equal(spanishClass.label, "Spanish Class");
    assert.equal(spanishClass.countries.length, 19);

    const actual = new Set(spanishClass.countries);
    const expected = new Set([
        "Guatemala",
        "El Salvador",
        "Honduras",
        "Nicaragua",
        "Costa Rica",
        "Panama",
        "Colombia",
        "Venezuela",
        "Ecuador",
        "Peru",
        "Bolivia",
        "Chile",
        "Argentina",
        "Paraguay",
        "Uruguay",
        "Cuba",
        "Dominican Republic",
        "Spain",
        "Equatorial Guinea"
    ]);

    assert.deepEqual(actual, expected);

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
        assert.equal(actual.has(excluded), false, excluded + " should be excluded");
    }
});

test("Spanish Class is not part of the public country group catalog", () => {
    assert.equal(Object.hasOwn(countryGroups, "spanish_class"), false);
});

test("Spanish Class landing page is noindex and absent from public discovery surfaces", () => {
    const secret = fs.readFileSync(
        path.join(root, "quizzes/type-capital/spanish_class/index.html"),
        "utf8"
    );
    assert.match(secret, /data-quiz-id="type-capital"/);
    assert.match(secret, /data-quiz-group="spanish_class"/);
    assert.match(secret, /<h1>Spanish Class<\/h1>/);
    assert.match(secret, /19 countries/);
    assert.match(secret, /name="robots" content="noindex, nofollow, noarchive, nosnippet"/);
    assert.doesNotMatch(secret, /content="index, follow"/);

    for (const relativePath of [
        "index.html",
        "quizzes/index.html",
        "quizzes/type-capital/index.html",
        "sitemap.txt",
        "sitemap.xml"
    ]) {
        const source = fs.readFileSync(path.join(root, relativePath), "utf8");
        assert.doesNotMatch(
            source,
            /spanish_class|Spanish Class/,
            relativePath + " should not expose the hidden quiz"
        );
    }
});

test("capital controller only loads the hidden group on the secret route", async () => {
    const capitalQuiz = require(path.join(root, "src/js/capital_quiz.js"));
    const originalFetch = global.fetch;
    const hiddenGroup = spanishClass;
    const calls = [];

    global.fetch = async url => {
        calls.push(String(url));
        if (String(url).endsWith("/src/data/capitals.json")) {
            return {
                ok: true,
                json: async () => ({ capitals: { Guatemala: { capital: "Guatemala City" } } })
            };
        }
        if (String(url).endsWith("/src/data/spanish_class.json")) {
            return {
                ok: true,
                json: async () => hiddenGroup
            };
        }
        throw new Error("Unexpected fetch: " + url);
    };

    try {
        const secretRoot = {
            location: { pathname: "/quizzes/type-capital/spanish_class/" },
            SmurdyQuiz: {
                groups: {},
                currentGroupId: "spanish_class",
                currentShowBorders: true,
                getAllowedNamesForCurrentGroup() {
                    return new Set(["guatemala"]);
                },
                setAllowedList(allowed) {
                    this.allowed = [...allowed];
                },
                requestGroupOutline() {},
                setShowBorders() {}
            }
        };
        const secretController = capitalQuiz.createController(secretRoot);
        await secretController.load();

        assert.deepEqual(
            secretRoot.SmurdyQuiz.groups.spanish_class.countries,
            hiddenGroup.countries
        );
        assert.deepEqual(secretRoot.SmurdyQuiz.allowed, ["guatemala"]);
        assert.equal(
            calls.some(url => url.endsWith("/src/data/spanish_class.json")),
            true
        );

        calls.length = 0;
        const normalRoot = {
            location: { pathname: "/quizzes/type-capital/latin_america/" },
            SmurdyQuiz: { groups: {} }
        };
        const normalController = capitalQuiz.createController(normalRoot);
        await normalController.load();
        assert.equal(
            calls.some(url => url.endsWith("/src/data/spanish_class.json")),
            false
        );
    } finally {
        global.fetch = originalFetch;
    }
});
