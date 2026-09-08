const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function allLandingPages() {
    const quizzesRoot = path.join(root, "quizzes");
    const pages = [];

    for (const modeEntry of fs.readdirSync(quizzesRoot, { withFileTypes: true })) {
        if (!modeEntry.isDirectory()) continue;
        const modeDir = path.join(quizzesRoot, modeEntry.name);

        for (const groupEntry of fs.readdirSync(modeDir, { withFileTypes: true })) {
            if (!groupEntry.isDirectory()) continue;
            const filename = path.join(modeDir, groupEntry.name, "index.html");
            if (!fs.existsSync(filename)) continue;

            const html = fs.readFileSync(filename, "utf8");
            if (!html.includes("data-smurdy-quiz-page")) continue;

            pages.push({
                modeId: modeEntry.name,
                groupId: groupEntry.name,
                filename,
                html
            });
        }
    }

    return pages;
}

test("shared landing breadcrumbs make every parent level clickable", () => {
    const shell = require(path.join(root, "tools/quiz_page_shell.js"));
    const html = shell.renderLandingBreadcrumbs({
        root: "https://smurdy.fun",
        modeHref: "/quizzes/click-country/",
        modeLabel: "Click the Countries",
        groupLabel: "World"
    });

    assert.match(
        html,
        /<a href="https:\/\/smurdy\.fun\/">Smurdy<\/a>[\s\S]*?<a href="https:\/\/smurdy\.fun\/quizzes\/">All quizzes<\/a>[\s\S]*?<a href="https:\/\/smurdy\.fun\/quizzes\/click-country\/">Click the Countries<\/a>[\s\S]*?<span aria-current="page">World<\/span>/
    );
});

test("all quiz landing pages use Smurdy > All quizzes > mode > current group", () => {
    const pages = allLandingPages();
    assert.ok(pages.length > 100, "Expected the generated landing page catalog");

    for (const { modeId, filename, html } of pages) {
        const relative = path.relative(root, filename);
        const nav = html.match(/<nav class="breadcrumbs" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/)?.[0];

        assert.ok(nav, relative + " is missing landing breadcrumbs");

        const links = [...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)]
            .map(match => ({ href: match[1], label: match[2] }));

        assert.equal(links.length, 3, relative + " should have exactly three clickable breadcrumb parents");
        assert.equal(links[0].label, "Smurdy", relative);
        assert.equal(links[1].label, "All quizzes", relative);
        assert.match(links[0].href, /\/$/, relative);
        assert.match(links[1].href, /\/quizzes\/$/, relative);
        assert.match(
            links[2].href,
            new RegExp("/quizzes/" + escapeRegex(modeId) + "/$"),
            relative + " mode breadcrumb should link to its quiz directory"
        );

        assert.match(
            nav,
            /<span aria-current="page">[^<]+<\/span>\s*<\/nav>$/,
            relative + " final breadcrumb should be the non-clickable current group"
        );

        const currentLabel = nav.match(/<span aria-current="page">([^<]+)<\/span>/)?.[1];
        assert.ok(currentLabel, relative + " should name its current group");
        assert.doesNotMatch(
            nav,
            new RegExp("<a[^>]*>" + escapeRegex(currentLabel) + "<\\/a>"),
            relative + " current group must not be clickable"
        );
    }
});

test("representative landing breadcrumbs use the public mode names", () => {
    const click = fs.readFileSync(
        path.join(root, "quizzes/click-country/world/index.html"),
        "utf8"
    );
    const capitals = fs.readFileSync(
        path.join(root, "quizzes/type-capital/world/index.html"),
        "utf8"
    );
    const flags = fs.readFileSync(
        path.join(root, "quizzes/type-flag/world/index.html"),
        "utf8"
    );

    assert.match(
        click,
        />Smurdy<\/a>[\s\S]*?>All quizzes<\/a>[\s\S]*?>Click the Countries<\/a>[\s\S]*?aria-current="page">World<\/span>/
    );
    assert.match(
        capitals,
        />Smurdy<\/a>[\s\S]*?>All quizzes<\/a>[\s\S]*?>Type the Capitals<\/a>[\s\S]*?aria-current="page">World<\/span>/
    );
    assert.match(
        flags,
        />Smurdy<\/a>[\s\S]*?>All quizzes<\/a>[\s\S]*?>Type the Flags<\/a>[\s\S]*?aria-current="page">World<\/span>/
    );
});
