const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("map landing counts match the current playable sovereign pool", () => {
    const expected = { world: 200, europe: 44, asia: 50, middle_east: 16, mena: 20, eurasia: 94 };
    for (const [group, count] of Object.entries(expected)) {
        const html = read(`quizzes/maps/click/countries/${group}/index.html`);
        assert.match(html, new RegExp(`Click the Countries / [^<]+ / ${count} countries`), group);
        assert.match(html, new RegExp(`Countries included in this quiz \\(${count}\\)`), group);
    }
    assert.doesNotMatch(read("quizzes/maps/click/countries/world/index.html"), /<li>Palestine<\/li>/);
    assert.match(read("quizzes/flags/type/countries/world/index.html"), /201 flags/);
});

test("browser map counts apply the same Palestine sovereign merge without changing other categories", () => {
    const browse = read("src/js/browse.js");
    assert.match(browse, /categoryKeyForManifest\(manifestItem\) === "maps"/);
    assert.match(browse, /toLowerCase\(\) === "palestine"/);
    assert.match(browse, /groupId\) === "world"[\s\S]*count === 201/);
    assert.match(browse, /memberCountForGroup\(group, manifestItem, id\)/);
});
