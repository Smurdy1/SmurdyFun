const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const SKIP_DIRECTORIES = new Set([".git", ".github", ".backups", "Old", "node_modules"]);

function collectHtml(directory = root, prefix = "") {
    const out = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
        const fullPath = path.join(directory, entry.name);
        const relative = path.join(prefix, entry.name);
        if (entry.isDirectory()) out.push(...collectHtml(fullPath, relative));
        else if (entry.isFile() && entry.name.endsWith(".html")) out.push(relative.replace(/\\/g, "/"));
    }
    return out;
}

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function metaContent(html, attributeName, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tag = html.match(new RegExp(`<meta\\b[^>]*${attributeName}=["']${escaped}["'][^>]*>`, "i"));
    if (!tag) return "";
    const content = tag[0].match(/content=["']([^"']*)["']/i);
    return content ? content[1] : "";
}

function pngDimensions(filePath) {
    const data = fs.readFileSync(filePath);
    assert.equal(data.toString("ascii", 1, 4), "PNG", `${filePath} is not a PNG`);
    return {
        width: data.readUInt32BE(16),
        height: data.readUInt32BE(20)
    };
}

test("every public HTML page has the persistent page-share controls and large-card metadata", () => {
    const pages = collectHtml();
    assert.ok(pages.length > 100, "expected the generated public site pages");

    for (const page of pages) {
        const html = read(page);
        assert.match(html, /\/styles\/share\.css\?v=/, `${page} is missing share.css`);
        assert.match(html, /\/src\/js\/share\.js\?v=/, `${page} is missing share.js`);
        assert.equal(metaContent(html, "name", "twitter:card"), "summary_large_image", `${page} lacks a large Twitter card`);
        assert.ok(metaContent(html, "property", "og:image"), `${page} lacks og:image`);
        assert.equal(metaContent(html, "property", "og:image:width"), "1200", `${page} has the wrong OG width`);
        assert.equal(metaContent(html, "property", "og:image:height"), "630", `${page} has the wrong OG height`);
        assert.ok(metaContent(html, "property", "og:image:alt"), `${page} lacks og:image:alt`);
        assert.ok(metaContent(html, "name", "twitter:image"), `${page} lacks twitter:image`);
    }
});

test("playable quiz pages use a mode-and-group-specific social preview image", () => {
    const pages = collectHtml().filter(page => /^quizzes\/[^/]+\/[^/]+\/index\.html$/.test(page));
    let playable = 0;

    for (const page of pages) {
        const html = read(page);
        if (!/data-smurdy-quiz-page/i.test(html)) continue;
        playable++;
        const match = page.match(/^quizzes\/([^/]+)\/([^/]+)\/index\.html$/);
        const [, quizId, groupId] = match;
        const image = metaContent(html, "property", "og:image");
        assert.match(
            image,
            new RegExp(`/assets/social/quizzes/${quizId}/${groupId}\\.png\\?v=`),
            `${page} does not use its own social image`
        );

        const imagePath = path.join(root, "assets", "social", "quizzes", quizId, `${groupId}.png`);
        assert.ok(fs.existsSync(imagePath), `${page} references a missing social image`);
        const dimensions = pngDimensions(imagePath);
        assert.deepEqual(dimensions, { width: 1200, height: 630 }, `${page} social image has wrong dimensions`);
    }

    assert.ok(playable > 100, "expected social previews for the full playable quiz catalog");
});

test("default Smurdy social preview is a 1200 by 630 PNG", () => {
    const imagePath = path.join(root, "assets", "social", "smurdy.png");
    assert.ok(fs.existsSync(imagePath), "default social preview is missing");
    assert.deepEqual(pngDimensions(imagePath), { width: 1200, height: 630 });
});

test("page sharing offers native sharing, copy link, and direct social destinations", () => {
    const source = read("src/js/share.js");
    assert.match(source, /navigator\.share/);
    assert.match(source, /Copy link/);
    assert.match(source, /twitter\.com\/intent\/tweet/);
    assert.match(source, /facebook\.com\/sharer\/sharer\.php/);
    assert.match(source, /reddit\.com\/submit/);
    assert.match(source, /mailto:/);
    assert.match(source, /data-smurdy-page-share-preview-title/);
});
