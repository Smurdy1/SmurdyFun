const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Weak Spots count uses the badge itself instead of parenthesized text", () => {
    const weakSpots = read("src/js/weak_spots.js");
    const style = read("styles/style.css");

    assert.match(weakSpots, /badge\.textContent = count \? String\(count\) : "";/);
    assert.doesNotMatch(weakSpots, /badge\.textContent = count \? "\("/);
    assert.match(style, /\.weak-spots-count \{[\s\S]*?border-radius: 999px;/);
});

test("page-specific divider spacing is not overridden by adjacent section rule", () => {
    const landing = read("styles/quiz_landing.css");

    assert.match(landing, /\.content-section \+ \.content-section:not\(\.page-specific\)/);
    assert.match(
        landing,
        /\.page-specific \{[\s\S]*?margin-top: 26px;[\s\S]*?padding-top: 18px;[\s\S]*?border-top:/
    );
});

test("changed UI assets are cache-busted", () => {
    const index = read("index.html");
    const generator = read("tools/generate_quiz_pages.js");

    assert.match(index, /style\.css\?v=20260910-ui-detail-1/);
    assert.match(index, /weak_spots\.js\?v=20260910-ui-detail-1/);
    assert.match(generator, /quiz_landing\.css\?v=20260910-ui-detail-1/);
});
