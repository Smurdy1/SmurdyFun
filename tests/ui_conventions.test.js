const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const BLOCKED_UI_CHARS = ["·", "—", "–", "…", "×"];
const EMOJI_RANGE = /[\u{1F300}-\u{1FAFF}]/u;

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function collectHtml(relativePath) {
    const absolute = path.join(root, relativePath);
    if (!fs.existsSync(absolute)) return [];
    const stat = fs.statSync(absolute);
    if (stat.isFile()) return relativePath.endsWith(".html") ? [relativePath] : [];

    const out = [];
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        const child = path.join(relativePath, entry.name);
        if (entry.isDirectory()) out.push(...collectHtml(child));
        else if (entry.isFile() && entry.name.endsWith(".html")) out.push(child);
    }
    return out;
}

test("public UI avoids decorative generated-looking characters and emoji", () => {
    const pages = [
        "index.html",
        "404.html",
        "about/index.html",
        "contact/index.html",
        "privacy/index.html",
        ...collectHtml("quizzes")
    ];

    for (const relativePath of pages) {
        const html = read(relativePath);
        for (const character of BLOCKED_UI_CHARS) {
            assert.equal(
                html.includes(character),
                false,
                relativePath + " contains blocked UI character " + JSON.stringify(character)
            );
        }
        assert.equal(
            EMOJI_RANGE.test(html),
            false,
            relativePath + " contains emoji UI"
        );
    }
});

test("runtime UI source keeps punctuation and decoration plain", () => {
    const files = [
        "src/js/browse.js",
        "src/js/quiz_completion.js",
        "src/js/weak_spots.js",
        "src/js/manifest.js",
        "src/js/quiz_landing.js",
        "tools/quiz_page_shell.js",
        "tools/generate_quiz_pages.js",
        "tools/generate_flag_pages.js"
    ];

    for (const relativePath of files) {
        const source = read(relativePath);
        for (const character of BLOCKED_UI_CHARS) {
            assert.equal(
                source.includes(character),
                false,
                relativePath + " contains blocked UI character " + JSON.stringify(character)
            );
        }
        assert.equal(
            EMOJI_RANGE.test(source),
            false,
            relativePath + " contains emoji UI"
        );
    }

    assert.doesNotMatch(read("src/js/browse.js"), /linear-gradient/i);
    assert.doesNotMatch(read("src/js/quiz_completion.js"), /linear-gradient/i);
});

test("generated quiz pages keep the simplified editorial conventions", () => {
    const pages = collectHtml("quizzes").filter(relativePath =>
        /\/[^/]+\/index\.html$/.test(relativePath) &&
        !/\/locate-(?:flag|capital)\//.test(relativePath)
    );

    for (const relativePath of pages) {
        const html = read(relativePath);
        assert.doesNotMatch(html, /<meta\s+name=["']keywords["']/i, relativePath);
        assert.doesNotMatch(html, />Open quiz</i, relativePath);
        assert.doesNotMatch(html, /Coming soon!/i, relativePath);
        assert.doesNotMatch(html, /<h2[^>]*>Example (?:countries|states|subdivisions)<\/h2>/i, relativePath);

        for (const match of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
            assert.doesNotMatch(match[1], /\|\s*Smurdy/i, relativePath + " leaks the browser title into its H1");
        }
    }
});

test("disabled planned modes stay visible without promotional labels", () => {
    const allQuizzes = read("quizzes/index.html");
    const capitals = read("quizzes/type-capital/index.html");
    const flags = read("quizzes/type-flag/index.html");

    for (const html of [allQuizzes, capitals, flags]) {
        assert.match(html, /directory-card-disabled/);
        assert.match(html, />Locate</);
        assert.doesNotMatch(html, /Coming soon!/i);
        assert.doesNotMatch(html, /Available now/i);
    }
});
