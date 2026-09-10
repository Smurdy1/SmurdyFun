from pathlib import Path


def replace_once(path, old, new):
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/js/weak_spots.js",
    '            badge.textContent = count ? "(" + String(count) + ")" : "";',
    '            badge.textContent = count ? String(count) : "";'
)

replace_once(
    "styles/style.css",
    """/* Counts are one of the places where a badge has real semantic value. */
.weak-spots-count {
    min-width: 19px;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--smurdy-blue);
    color: #fff;
    font-size: 11px;
    line-height: 17px;
    text-align: center;
}""",
    """/* Counts are one of the places where a badge has real semantic value. */
.weak-spots-count {
    min-width: 22px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--smurdy-blue);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
    text-align: center;
}"""
)

replace_once(
    "styles/quiz_landing.css",
    "body.smurdy-quiz-landing .content-section + .content-section {\n    padding-top: 2px;\n}",
    "body.smurdy-quiz-landing .content-section + .content-section:not(.page-specific) {\n    padding-top: 2px;\n}"
)
replace_once(
    "styles/quiz_landing.css",
    """body.smurdy-quiz-landing .page-specific {
    max-width: 74ch;
    margin-top: 31px;
    padding-top: 15px;
    border-top: 1px solid #d8d8d8;
}""",
    """body.smurdy-quiz-landing .page-specific {
    max-width: 74ch;
    margin-top: 26px;
    padding-top: 18px;
    border-top: 1px solid #d8d8d8;
}"""
)

replace_once(
    "index.html",
    '/styles/style.css?v=20260910-memory-1',
    '/styles/style.css?v=20260910-ui-detail-1'
)
replace_once(
    "index.html",
    '/src/js/weak_spots.js?v=20260909-editorial-1',
    '/src/js/weak_spots.js?v=20260910-ui-detail-1'
)
replace_once(
    "tools/generate_quiz_pages.js",
    'styles/quiz_landing.css?v=20260910-polish-1',
    'styles/quiz_landing.css?v=20260910-ui-detail-1'
)
replace_once(
    "tools/generate_flag_pages.js",
    '/src/js/weak_spots.js?v=20260909-editorial-1',
    '/src/js/weak_spots.js?v=20260910-ui-detail-1'
)

Path("tests/ui_detail_regressions.test.js").write_text(r'''const fs = require("node:fs");
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
''')
