const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("theme is persisted with a compact icon toggle beside Weak Spots", () => {
    const index = read("index.html");
    const theme = read("src/js/theme.js");
    const css = read("styles/theme.css");
    assert.match(index, /class="home-quick-actions"/);
    assert.match(index, /data-weak-spots-open[\s\S]*data-smurdy-theme-toggle/);
    assert.equal((index.match(/data-smurdy-theme-toggle/g) || []).length, 1);
    assert.doesNotMatch(index, /home-theme-setting/);
    assert.match(index, /smurdy-theme-icon--moon/);
    assert.match(index, /smurdy-theme-icon--sun/);
    assert.ok(fs.existsSync(path.join(root, "assets/icons/moon.png")));
    assert.ok(fs.existsSync(path.join(root, "assets/icons/sun.png")));
    assert.ok(css.includes("mask-image: url('/assets/icons/moon.png')"));
    assert.ok(css.includes("mask-image: url('/assets/icons/sun.png')"));
    assert.match(css, /\.smurdy-theme-toggle[\s\S]*width:\s*38px/);
    assert.match(theme, /localStorage\.getItem\(STORAGE_KEY\)/);
    assert.match(theme, /localStorage\.setItem\(STORAGE_KEY, next\)/);
    assert.match(theme, /dataset\.smurdyTheme = next/);
    assert.match(theme, /Switch to light mode/);
    assert.match(theme, /Switch to dark mode/);
});
test("dark theme assets are installed globally", () => {
    const index = read("index.html");
    const about = read("about/index.html");
    const quiz = read("quizzes/click-country/world/index.html");
    for (const source of [index, about, quiz]) {
        assert.match(source, /data-smurdy-theme-bootstrap/);
        assert.match(source, /\/styles\/theme\.css\?v=20260911-dark-mode-3/);
        assert.match(source, /\/src\/js\/theme\.js\?v=20260911-dark-mode-3/);
    }
});

test("theme stylesheet covers the major Smurdy surfaces", () => {
    const css = read("styles/theme.css");
    assert.match(css, /html\[data-smurdy-theme="dark"\]/);
    assert.match(css, /#quiz-panel/);
    assert.match(css, /#quiz-browser/);
    assert.match(css, /body\[data-smurdy-quiz-page\]/);
    assert.match(css, /\.site-header/);
    assert.match(css, /\.directory-header/);
    assert.match(css, /\.flag-stage/);
    assert.match(css, /#weak-spots-dialog/);
});

test("dark theme has a dedicated polish pass", () => {
    const theme = read("src/js/theme.js");
    const css = read("styles/theme.css");
    assert.match(theme, /#quiz-timer/);
    assert.match(theme, /\.qb-card:last-child/);
    assert.match(theme, /background:\s*transparent\s*!important/);
    assert.match(theme, /\.smurdy-page-share-trigger:hover/);
    assert.match(theme, /#quiz-browser :is\(\.qb-library-tab, \.qb-category-tab, \.qb-mode-tab, \.qb-family-tab\)/);
    assert.match(css, /dark-theme-polish-v3/);
    assert.match(css, /body\[data-smurdy-quiz-page\][\s\S]*background:\s*#171c20/);
    assert.match(css, /main,[\s\S]*background:\s*#22282d\s*!important/);
});


test("dark mode keeps timer readable and directory link unhighlighted", () => {
    const theme = read("src/js/theme.js");
    assert.match(theme, /#quiz-panel #quiz-timer/);
    assert.match(theme, /-webkit-text-fill-color:\s*#b8c0c5\s*!important/);
    assert.match(theme, /#quiz-browser \.qb-directory-primary \{[\s\S]*background:\s*transparent\s*!important/);
    assert.doesNotMatch(theme, /\.qb-play,\s*\nhtml\[data-smurdy-theme="dark"\] #quiz-browser \.qb-directory-primary/);
});
