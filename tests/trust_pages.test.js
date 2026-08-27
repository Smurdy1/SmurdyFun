const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("About and Contact pages have unique canonical metadata", () => {
    const about = read("about/index.html");
    const contact = read("contact/index.html");

    assert.match(about, /<title>About Smurdy \| Geography Quiz Project<\/title>/);
    assert.match(about, /rel="canonical" href="https:\/\/smurdy\.fun\/about\/"/);
    assert.match(about, /flag quizzes, capital quizzes, and Smurdy Daily/);

    assert.match(contact, /<title>Contact and Feedback \| Smurdy<\/title>/);
    assert.match(contact, /rel="canonical" href="https:\/\/smurdy\.fun\/contact\/"/);
    assert.match(contact, /https:\/\/forms\.gle\/XjJoHBNKSrHLWg1h9/);
});

test("trust-page navigation is available from core site pages", () => {
    for (const relativePath of [
        "index.html",
        "quizzes/index.html",
        "quizzes/click-country/world/index.html",
        "privacy/index.html"
    ]) {
        const html = read(relativePath);
        assert.match(html, /href="(?:https:\/\/smurdy\.fun)?\/about\/"/, `${relativePath} lacks About`);
        assert.match(html, /href="(?:https:\/\/smurdy\.fun)?\/contact\/"/, `${relativePath} lacks Contact`);
        assert.match(html, /href="(?:https:\/\/smurdy\.fun)?\/privacy\/"/, `${relativePath} lacks Privacy`);
    }
});

test("sitemaps include every trust page", () => {
    const xml = read("sitemap.xml");
    const text = read("sitemap.txt");

    for (const url of [
        "https://smurdy.fun/about/",
        "https://smurdy.fun/contact/",
        "https://smurdy.fun/privacy/"
    ]) {
        assert.match(xml, new RegExp(`<loc>${url.replaceAll(".", "\\.")}</loc>`));
        assert.ok(text.split("\n").includes(url));
    }
});
