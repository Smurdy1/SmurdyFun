const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("visible version bypasses stale bundle caches", () => {
    const core = read("src/js/app_core.js");
    const version = JSON.parse(read("src/data/app_version.json")).version;
    const bundled = core.match(/const APP_VERSION = "([^"]+)";/)?.[1];
    assert.equal(version, "1.16.25");
    assert.equal(bundled, version);
    assert.match(core, /app_version\.json\?t=" \+ Date\.now\(\)/);
    assert.match(core, /cache: "no-store"/);
    assert.match(core, /dataset\.appVersion/);
});

test("lore does not replace the normal app version", () => {
    const lore = read("src/js/lore.js");
    assert.match(lore, /dataset\.versionOverride = "505"/);
    assert.match(lore, /badge\.dataset\.appVersion \|\| root\.__SmurdyAppVersion/);
    assert.doesNotMatch(lore, /const wanted = active505/);
});

test("version fix scripts are cache-busted", () => {
    const home = read("index.html");
    const app = read("src/js/app.js");
    const session = read("src/js/quiz_session.js");
    assert.match(home, /app\.js\?v=20260916-version-1/);
    assert.match(home, /lore\.js\?v=20260916-version-1/);
    assert.match(app, /const ASSET_VERSION = "20260916-version-1"/);
    assert.match(app, /loadScript\("\/src\/js\/app_core\.js"/);
    assert.doesNotMatch(app, /app_core\.js\?v=/);
    assert.match(session, /lore\.js\?v=20260916-version-1/);
});
