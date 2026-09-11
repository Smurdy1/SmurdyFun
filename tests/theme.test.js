const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("theme is persisted with a single main-menu toggle", () => {
    const index = read("index.html");
    const theme = read("src/js/theme.js");
    assert.match(index, /data-smurdy-theme-toggle/);
    assert.equal((index.match(/data-smurdy-theme-toggle/g) || []).length, 1);
    assert.match(index, /<\/nav>\s*<div class="home-theme-setting">/);
    assert.match(index, /home-theme-setting-label">Theme<\/span>/);
    assert.match(theme, /localStorage\.getItem\(STORAGE_KEY\)/);
    assert.match(theme, /localStorage\.setItem\(STORAGE_KEY, next\)/);
    assert.match(theme, /dataset\.smurdyTheme = next/);
    assert.match(theme, /Light mode/);
    assert.match(theme, /Dark mode/);
});

test("dark theme assets are installed globally", () => {
    const index = read("index.html");
    const about = read("about/index.html");
    const quiz = read("quizzes/click-country/world/index.html");
    for (const source of [index, about, quiz]) {
        assert.match(source, /data-smurdy-theme-bootstrap/);
        assert.match(source, /\/styles\/theme\.css\?v=20260911-dark-mode-1/);
        assert.match(source, /\/src\/js\/theme\.js\?v=20260911-dark-mode-1/);
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
