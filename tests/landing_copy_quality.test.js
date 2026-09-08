const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function htmlFilesUnder(relativeDir) {
    const start = path.join(root, relativeDir);
    const files = [];

    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && entry.name === "index.html") files.push(full);
        }
    }

    walk(start);
    return files;
}

test("generic landing-page mode copy never interpolates raw group labels", () => {
    const descriptions = JSON.parse(read("src/data/quiz_page_descriptions.json"));

    for (const [modeId, mode] of Object.entries(descriptions.modes || {})) {
        for (const [field, value] of Object.entries(mode || {})) {
            if (typeof value !== "string") continue;
            assert.doesNotMatch(
                value,
                /\{group\}/,
                modeId + "." + field + " should use neutral wording such as 'this set'"
            );
        }
    }
});

test("generated quiz landing pages avoid obvious template artifacts", () => {
    const files = htmlFilesUnder("quizzes");

    for (const filename of files) {
        const html = fs.readFileSync(filename, "utf8");
        const relative = path.relative(root, filename);

        const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] || "";
        assert.doesNotMatch(
            h1,
            /\|\s*Smurdy/,
            relative + " should not put the site-name suffix in the visible H1"
        );

        assert.doesNotMatch(
            html,
            /What this [^<]+ quiz covers/,
            relative + " should use the natural generic overview heading"
        );
        assert.doesNotMatch(
            html,
            /Related regions in this mode/,
            relative + " should not assume every quiz set is a geographic region"
        );
        assert.doesNotMatch(
            html,
            /Try another mode for [^<]+/,
            relative + " should not splice a raw group label into navigation prose"
        );
        assert.doesNotMatch(
            html,
            /\{(?:group|unitName|unitPlural|countPhrase)\}/,
            relative + " contains an unresolved landing-page template token"
        );
    }
});

test("known awkward group-label combinations stay fixed", () => {
    const spanishCapital = read(
        "quizzes/type-capital/spanish_speaking/index.html"
    );
    assert.match(
        spanishCapital,
        /Use this when you know the countries in this set/
    );
    assert.doesNotMatch(
        spanishCapital,
        /countries in Spanish-Speaking Countries/
    );

    const worldType = read("quizzes/type-country/world/index.html");
    assert.doesNotMatch(worldType, /locations of World/);
    assert.doesNotMatch(worldType, /shapes in World/);

    const euType = read("quizzes/type-country/european_union/index.html");
    assert.doesNotMatch(euType, /shapes in European Union/);
});

test("language-based groups are presented as specialty sets, not regions", () => {
    for (const modeId of ["click-country", "type-country", "type-capital", "find-country", "find-point"]) {
        const html = read("quizzes/" + modeId + "/index.html");
        const specialtyStart = html.indexOf("<h2>Specialty sets</h2>");
        assert.ok(specialtyStart >= 0, modeId + " should have a Specialty sets section");
        const afterSpecialty = html.slice(specialtyStart);
        assert.match(afterSpecialty, /Spanish-Speaking Countries/);

        const regionalStart = html.indexOf("<h2>Regional sets</h2>");
        if (regionalStart >= 0 && regionalStart < specialtyStart) {
            const regionalHtml = html.slice(regionalStart, specialtyStart);
            assert.doesNotMatch(regionalHtml, /Spanish-Speaking Countries/);
        }
    }

    const flags = read("quizzes/type-flag/index.html");
    const flagSpecialty = flags.indexOf("<h2>Specialty sets</h2>");
    assert.ok(flagSpecialty >= 0);
    assert.match(flags.slice(flagSpecialty), /Spanish-Speaking Countries/);
});
