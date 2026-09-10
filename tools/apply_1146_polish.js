"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
    fs.writeFileSync(path.join(root, relativePath), content, "utf8");
}

function replaceOnce(relativePath, before, after) {
    const source = read(relativePath);
    if (!source.includes(before)) {
        throw new Error(`${relativePath}: expected source fragment was not found`);
    }
    write(relativePath, source.replace(before, after));
}

function appendOnce(relativePath, marker, block) {
    const source = read(relativePath);
    if (source.includes(marker)) return;
    write(relativePath, source.replace(/\s*$/, "") + "\n\n" + block.trim() + "\n");
}

/* Keep the visible version and dynamic app bundle cache in sync. */
replaceOnce(
    "src/js/app_core.js",
    'const APP_VERSION = "1.14.2";',
    'const APP_VERSION = "1.14.6";'
);
replaceOnce(
    "src/js/app.js",
    'const ASSET_VERSION = "20260909-state-capitals-1";',
    'const ASSET_VERSION = "20260910-polish-1";'
);
replaceOnce(
    "tools/quiz_page_shell.js",
    'const ASSET_VERSION = "20260909-editorial-1";',
    'const ASSET_VERSION = "20260910-polish-1";'
);

/* Cache-bust only the files that change in this pass. */
let home = read("index.html")
    .replace('/styles/style.css?v=20260909-editorial-1', '/styles/style.css?v=20260910-polish-1')
    .replace('/styles/browser_hierarchy.css?v=20260910-browser-2', '/styles/browser_hierarchy.css?v=20260910-polish-1')
    .replace('/src/js/app.js?v=20260909-editorial-1', '/src/js/app.js?v=20260910-polish-1');
write("index.html", home);

for (const relativePath of ["about/index.html", "contact/index.html", "privacy/index.html"]) {
    const source = read(relativePath).replace(
        '/styles/info_pages.css?v=20260909-editorial-1',
        '/styles/info_pages.css?v=20260910-polish-1'
    );
    write(relativePath, source);
}

/* One small authored object on About, rather than another grid/card section. */
replaceOnce(
    "about/index.html",
    '    <p>I go by Smurdy online. I like geography and programming, and I spend a ridiculous amount of time staring at maps, planning trips, and thinking of geography challenges. A lot of features here started because I was playing the site myself and thought, "this would be better if it did this instead."</p>\n',
    '    <p>I go by Smurdy online. I like geography and programming, and I spend a ridiculous amount of time staring at maps, planning trips, and thinking of geography challenges. A lot of features here started because I was playing the site myself and thought, "this would be better if it did this instead."</p>\n\n    <aside class="maker-note"><strong>One rule I keep coming back to:</strong> if a feature makes the normal quiz slower to start, it needs a good reason.</aside>\n'
);

/* Give only structurally important floating surfaces a little more presence. */
appendOnce(
    "styles/style.css",
    "1.14.6 meaningful surfaces",
    `/* 1.14.6 meaningful surfaces: a little depth where floating actually means something. */
#quiz-panel {
    border-radius: 10px;
    box-shadow: 0 3px 12px rgba(0, 0, 0, .12);
}

#weak-spots-dialog {
    border-radius: 10px;
    box-shadow: 0 8px 26px rgba(0, 0, 0, .20);
}

/* Counts are one of the places where a badge has real semantic value. */
.weak-spots-count {
    min-width: 19px;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--smurdy-blue);
    color: #fff;
    font-size: 11px;
    line-height: 17px;
    text-align: center;
}

@media (max-width: 700px) {
    #quiz-panel,
    #quiz-bottom {
        border-radius: 9px;
        box-shadow: 0 3px 12px rgba(0, 0, 0, .11);
    }
}`
);

appendOnce(
    "styles/browser_hierarchy.css",
    "1.14.6 surface balance",
    `/* 1.14.6 surface balance: the browser is a floating map surface, its controls are not cards. */
html body #quiz-browser {
    border-radius: 10px !important;
    box-shadow: 0 3px 12px rgba(0, 0, 0, .12) !important;
}

html body #quiz-browser #qb-library-tabs {
    padding-bottom: 4px;
}

html body #quiz-browser #qb-category-tabs {
    margin-top: 12px !important;
}`
);

/* Directory hierarchy through type and spacing, never boxes around choices. */
appendOnce(
    "styles/quiz_directory.css",
    "1.14.6 directory hierarchy",
    `/* 1.14.6 directory hierarchy */
.directory-section { margin-top: 34px; }
.directory-section + .directory-section {
    margin-top: 38px;
    padding-top: 27px;
}
.directory-section h2 {
    font-size: 22px;
    line-height: 1.2;
}

/* The universal starting sets can be found a little faster without becoming cards. */
.directory-card[href$="/world/"] .directory-card-title,
.directory-card[href$="/europe/"] .directory-card-title,
.directory-card[href$="/asia/"] .directory-card-title {
    color: var(--directory-blue-dark);
    font-size: 17px;
}

.directory-card:hover .directory-card-title {
    text-decoration-thickness: 1px;
}`
);

appendOnce(
    "styles/quiz_landing.css",
    "1.14.6 authored landing rhythm",
    `/* 1.14.6 authored landing rhythm */
body.smurdy-quiz-landing .lead,
body.smurdy-quiz-landing .quiz-lead,
body.smurdy-quiz-landing .flag-lead {
    max-width: 68ch;
    font-size: 19px;
}

body.smurdy-quiz-landing .casual-example {
    max-width: 66ch;
    margin-top: 10px !important;
    color: #4a4a4a;
    font-style: italic;
}

body.smurdy-quiz-landing .page-specific {
    max-width: 74ch;
    margin-top: 31px;
    padding-top: 15px;
    border-top: 1px solid #d8d8d8;
}

body.smurdy-quiz-landing .page-specific h2 {
    margin-bottom: 6px;
    font-size: 19px;
}

body.smurdy-quiz-landing .link-section,
body.smurdy-quiz-landing .flag-links {
    margin-top: 38px;
}

@media (max-width: 700px) {
    body.smurdy-quiz-landing .lead,
    body.smurdy-quiz-landing .quiz-lead,
    body.smurdy-quiz-landing .flag-lead { font-size: 17px; }
}`
);

appendOnce(
    "styles/info_pages.css",
    "1.14.6 editorial structure",
    `/* 1.14.6 editorial structure: one authored note, no new card system. */
.maker-note {
  max-width: 68ch;
  margin: 22px 0 30px;
  padding: 8px 0 8px 14px;
  border-left: 3px solid #171717;
  color: #333;
  font-size: 15px;
}
.maker-note strong { color: #171717; }
main > h2 { margin-top: 36px; }
`
);

/* Map/capital generator: let geographic personality override generic headings/copy. */
replaceOnce(
    "tools/generate_quiz_pages.js",
    'const pageShell = require("./quiz_page_shell.js");\n',
    'const pageShell = require("./quiz_page_shell.js");\nconst { LANDING_PERSONALITY } = require("./landing_personality.js");\n'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '            const groupCopy = groupCopyMap[groupId] || {};\n            const pageKey = `${manifestId}/${groupId}`;',
    '            const groupCopy = groupCopyMap[groupId] || {};\n            const personality = LANDING_PERSONALITY[groupId] || {};\n            const pageKey = `${manifestId}/${groupId}`;'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '                    : `What this ${groupLabel} quiz covers`,',
    '                    : (personality.overviewHeading || `What this ${groupLabel} quiz covers`),'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '                pageOverride.challengeHeading || "What makes this group challenging",',
    '                pageOverride.challengeHeading || personality.challengeHeading || "What makes this group challenging",'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '                pageOverride.studyTipHeading || "Study tip",',
    '                pageOverride.studyTipHeading || personality.studyTipHeading || "Study tip",'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '            const pageSpecificHeading = renderTemplate(pageOverride.sectionHeading || "", context);\n            const pageSpecificBody = renderTemplate(pageOverride.sectionBody || "", context);',
    '            const pageSpecificHeading = renderTemplate(pageOverride.sectionHeading || personality.sectionHeading || "", context);\n            const pageSpecificBody = renderTemplate(pageOverride.sectionBody || personality.sectionBody || "", context);'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '                pageOverride.exampleSentence || "",',
    '                pageOverride.exampleSentence || personality.exampleSentence || "",'
);
replaceOnce(
    "tools/generate_quiz_pages.js",
    '            const showChallenge = Object.prototype.hasOwnProperty.call(pageOverride, "showChallenge")\n                ? Boolean(pageOverride.showChallenge)\n                : defaultSectionVisibility(pageKey, groupId, "challenge");\n            const showStudyTip = Object.prototype.hasOwnProperty.call(pageOverride, "showStudyTip")\n                ? Boolean(pageOverride.showStudyTip)\n                : defaultSectionVisibility(pageKey, groupId, "studyTip");',
    '            const showChallenge = Object.prototype.hasOwnProperty.call(pageOverride, "showChallenge")\n                ? Boolean(pageOverride.showChallenge)\n                : (Object.prototype.hasOwnProperty.call(personality, "showChallenge")\n                    ? Boolean(personality.showChallenge)\n                    : defaultSectionVisibility(pageKey, groupId, "challenge"));\n            const showStudyTip = Object.prototype.hasOwnProperty.call(pageOverride, "showStudyTip")\n                ? Boolean(pageOverride.showStudyTip)\n                : (Object.prototype.hasOwnProperty.call(personality, "showStudyTip")\n                    ? Boolean(personality.showStudyTip)\n                    : defaultSectionVisibility(pageKey, groupId, "studyTip"));'
);

/* Flag pages share the geographic voice, while flag-specific notes still win. */
replaceOnce(
    "tools/generate_flag_pages.js",
    'const pageShell = require(path.join(root, "tools/quiz_page_shell.js"));\n',
    'const pageShell = require(path.join(root, "tools/quiz_page_shell.js"));\nconst { LANDING_PERSONALITY } = require(path.join(root, "tools/landing_personality.js"));\n'
);
replaceOnce(
    "tools/generate_flag_pages.js",
    `function editorialForFlagGroup(groupId) {
    return FLAG_EDITORIAL[groupId] || {
        overviewHeading: "About this set",
        previewCount: 4,
        showChallenge: ["balkans", "caribbean_islands", "former_soviet_union", "eastern_europe"].includes(groupId),
        showStudyTip: ["middle_east", "southeast_asia", "latin_america", "small_island_countries"].includes(groupId)
    };
}`,
    `function editorialForFlagGroup(groupId) {
    const personality = LANDING_PERSONALITY[groupId] || {};
    const defaults = {
        overviewHeading: personality.overviewHeading || "About this set",
        exampleSentence: personality.exampleSentence || "",
        extraHeading: personality.sectionHeading || "",
        extraBody: personality.sectionBody || "",
        challengeHeading: personality.challengeHeading || "What gets difficult",
        studyTipHeading: personality.studyTipHeading || "One way to learn this set",
        previewCount: 4,
        showChallenge: ["balkans", "caribbean_islands", "former_soviet_union", "eastern_europe"].includes(groupId),
        showStudyTip: ["middle_east", "southeast_asia", "latin_america", "small_island_countries"].includes(groupId)
    };
    return { ...defaults, ...(FLAG_EDITORIAL[groupId] || {}) };
}`
);
replaceOnce(
    "tools/generate_flag_pages.js",
    '<h2>What gets difficult</h2>',
    '<h2>${escapeHtml(editorial.challengeHeading)}</h2>'
);
replaceOnce(
    "tools/generate_flag_pages.js",
    '<h2>One way to learn this set</h2>',
    '<h2>${escapeHtml(editorial.studyTipHeading)}</h2>'
);
replaceOnce(
    "tools/generate_flag_pages.js",
    '/styles/flag_quiz.css?v=20260909-editorial-1',
    '/styles/flag_quiz.css?v=20260910-polish-1'
);

console.log("Applied 1.14.6 visual/editorial polish.");
