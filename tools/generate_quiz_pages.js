const fs = require("fs").promises;
const path = require("path");
const vm = require("vm");

(async function main() {
    const repoRoot = path.resolve(__dirname, "..");
    const manifestPath = path.join(repoRoot, "src", "js", "manifest.js");
    const groupsPath = path.join(repoRoot, "src", "data", "country_groups.json");
    const subdivisionGroupsPath = path.join(repoRoot, "src", "data", "subdivision_groups.json");
    const copyPath = path.join(repoRoot, "src", "data", "quiz_page_descriptions.json");
    const outDir = path.join(repoRoot, "quizzes");

    const baseUrl = (process.env.BASE_URL || "https://smurdy.fun").replace(/\/+$/, "");
    const publicRoot = (process.env.PUBLIC_ROOT && process.env.PUBLIC_ROOT.trim())
        ? process.env.PUBLIC_ROOT.replace(/\/+$/, "")
        : baseUrl.replace(/\/docs$/i, "");

    const groups = await readJson(groupsPath, "country_groups.json");
    const subdivisionGroups = await readJson(subdivisionGroupsPath, "subdivision_groups.json");
    const groupSets = {
        country_groups: groups,
        subdivision_groups: subdivisionGroups
    };
    const pageCopy = await readJson(copyPath, "quiz_page_descriptions.json");

    let manifest = [];
    try {
        const code = await fs.readFile(manifestPath, "utf8");
        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox, { filename: "manifest.js" });
        manifest = sandbox.window.SmurdyQuizManifest || [];
        if (!Array.isArray(manifest)) manifest = [];
    } catch (error) {
        console.error("Could not load manifest.js:", error.message);
        process.exit(1);
    }

    if (!manifest.length) {
        console.error("No manifest entries found; aborting.");
        process.exit(1);
    }

    const modeCopyMap = pageCopy.modes || {};
    const groupCopyMap = pageCopy.groups || {};

    validateCopyCoverage(groups, groupCopyMap);
    validateCopyCoverage(subdivisionGroups, groupCopyMap);

    await fs.mkdir(outDir, { recursive: true });

    // The mode folders are generated output. Removing only those folders clears
    // stale pages when a group's allowedTypes changes without touching unrelated files.
    for (const manifestEntry of manifest) {
        const manifestId = getManifestId(manifestEntry);
        await fs.rm(path.join(outDir, slug(manifestId)), { recursive: true, force: true });
    }

    const pages = [];
    const pageRecords = [];

    for (const manifestEntry of manifest) {
        const manifestId = getManifestId(manifestEntry);
        const modeKey = normalizeModeKey(manifestEntry);
        const modeCopy = modeCopyMap[manifestId] || modeCopyMap[modeKey] || {};
        const titleBase = manifestEntry.title || manifestEntry.name || manifestId;
        const activeGroupSetId = manifestEntry.groupSet || "country_groups";
        const groupsForEntry = groupSets[activeGroupSetId] || {};
        const groupKeys = getGroupKeysForManifest(manifestEntry, groupsForEntry);

        for (const groupId of groupKeys) {
            const group = groupId === "__all__" ? {} : (groupsForEntry[groupId] || {});
            const groupCopy = groupCopyMap[groupId] || {};
            const groupLabel = groupId === "__all__"
                ? "All regions"
                : (group.label || humanize(groupId));

            const unitName = String(group.unitName || "region").trim();
            const unitPlural = pluralizeUnit(unitName);
            const unitPluralTitle = capitalizeWords(unitPlural);
            const entries = Array.isArray(group.members)
                ? group.members.slice()
                : (Array.isArray(group.countries) ? group.countries.slice() : []);
            const entryCount = entries.length;
            const notable = Array.isArray(group.notable) && group.notable.length
                ? group.notable.slice(0, 5)
                : entries.slice(0, 5);

            const context = {
                group: groupLabel,
                label: group.label || groupLabel,
                adjective: group.adjective || "",
                borderset: group.borderset || "",
                unitName,
                unitPlural,
                unitPluralTitle,
                countryCount: entryCount,
                entryCount,
                countPhrase: entryCount ? `all ${entryCount} ${unitPlural}` : `the full set of ${unitPlural}`,
                examples: joinNatural(notable),
                title: titleBase,
                quizId: manifestId
            };

            const pageTitle = buildPageTitle({
                groupLabel,
                unitPluralTitle,
                manifestId,
                modeKey
            });

            const lead = renderTemplate(
                modeCopy.lead ||
                manifestEntry.shortDescription ||
                manifestEntry.descriptionTemplate ||
                `Practice the ${groupLabel} map.`,
                context
            );

            const overview = renderTemplate(
                groupCopy.overview ||
                `${groupLabel} is included as a focused geography practice group in Smurdy.`,
                context
            );

            const challenge = renderTemplate(
                groupCopy.challenge ||
                `This group tests both name recognition and accurate map placement.`,
                context
            );

            const studyTip = renderTemplate(
                groupCopy.studyTip ||
                `Review nearby places together, then return to the full group for mixed practice.`,
                context
            );

            const howToPlay = renderTemplate(
                modeCopy.howToPlay ||
                inferModeInstructions(manifestEntry, context),
                context
            );

            const gameplayTip = renderTemplate(
                modeCopy.tip || "Use the map context around each answer before making your choice.",
                context
            );

                        // smurdy-indexing-links-v1
            const defaultModeSections = getModeDistinctiveSections(manifestEntry);
            const modeSections = [
                {
                    heading: renderTemplate(modeCopy.skillsHeading || defaultModeSections.skillsHeading, context),
                    body: renderTemplate(modeCopy.skills || defaultModeSections.skills, context)
                },
                {
                    heading: renderTemplate(modeCopy.strategyHeading || defaultModeSections.strategyHeading, context),
                    body: renderTemplate(modeCopy.strategy || defaultModeSections.strategy, context)
                },
                {
                    heading: renderTemplate(modeCopy.bestForHeading || defaultModeSections.bestForHeading, context),
                    body: renderTemplate(modeCopy.bestFor || defaultModeSections.bestFor, context)
                },
                {
                    heading: renderTemplate(modeCopy.mistakesHeading || defaultModeSections.mistakesHeading, context),
                    body: renderTemplate(modeCopy.mistakes || defaultModeSections.mistakes, context)
                }
            ].filter(section => section.heading && section.body);

            const modeSectionsHtml = modeSections.map(section => `<section class="content-section mode-specific">
              <h2>${escapeHtml(section.heading)}</h2>
              <p>${escapeHtml(section.body)}</p>
            </section>`).join("\n");

const metaDescription = buildMetaDescription(
                `${lead} ${howToPlay} ${modeSections[0] ? modeSections[0].body : overview}`,
                pageTitle
            );

            const keywords = buildKeywords({
                manifestEntry,
                modeCopy,
                groupCopy,
                groupLabel,
                unitPlural,
                notable
            });

            const relPath = `${slug(manifestId)}/${slug(groupId)}`;
            const outPathDir = path.join(outDir, relPath);
            const outFile = path.join(outPathDir, "index.html");
            await fs.mkdir(outPathDir, { recursive: true });

            const pageUrlRaw = `${publicRoot}/quizzes/${relPath}/`;
            const pageUrl = encodeURI(pageUrlRaw);

            let linkMode = "countries";
            if (group.dataMode || group.mapMode) linkMode = String(group.dataMode || group.mapMode).trim();
            else if (group.borderset) linkMode = String(group.borderset).trim();
            else if (manifestEntry.mode) linkMode = String(manifestEntry.mode).trim();
            else if (manifestEntry.type) linkMode = String(manifestEntry.type).trim();

            const otherQuizzes = manifest
                .filter(other => getManifestId(other) !== manifestId)
                .filter(other => (other.groupSet || "country_groups") === activeGroupSetId)
                .filter(other => getGroupKeysForManifest(other, groupsForEntry).includes(groupId))
                .map(other => ({
                    id: getManifestId(other),
                    title: getModeDisplayName(other)
                }))
                .slice(0, 8);

                        const availableGroupIds = groupKeys.filter(id => id !== "__all__");
            const relatedGroups = getRelatedGroupIds({
                groupId,
                groups: groupsForEntry,
                availableGroupIds,
                limit: 8
            }).map(id => ({
                id,
                label: (groupsForEntry[id] && groupsForEntry[id].label) || humanize(id)
            }));

            const popularGroups = getPopularGroupIds({
                availableGroupIds,
                groupId,
                excludedIds: relatedGroups.map(region => region.id),
                limit: 6
            }).map(id => ({
                id,
                label: (groupsForEntry[id] && groupsForEntry[id].label) || humanize(id)
            }));

            const navigationHtml = buildPageNavigationHtml({
                publicRoot,
                manifestId,
                groupId,
                groupLabel,
                otherQuizzes,
                relatedGroups,
                popularGroups
            });

const entryListHtml = entries.length
                ? `<details class="included-list">
                    <summary>${escapeHtml(capitalizeWords(unitPlural))} included in this quiz (${entryCount})</summary>
                    <p>${entries.map(escapeHtml).join(", ")}.</p>
                  </details>`
                : "";

            const exampleListHtml = notable.length
                ? `<section class="examples" aria-labelledby="example-heading">
                    <h2 id="example-heading">Example ${escapeHtml(unitPlural)}</h2>
                    <ul>${notable.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>
                  </section>`
                : "";

            const pageHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}"/>
  <meta name="keywords" content="${escapeHtml(keywords.join(", "))}"/>
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="${escapeHtml(pageUrlRaw)}"/>
  <link rel="icon" type="image/png" sizes="48x48" href="${publicRoot}/assets/images/Smurdeye.png"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${escapeHtml(pageTitle)}"/>
  <meta property="og:description" content="${escapeHtml(metaDescription)}"/>
  <meta property="og:url" content="${escapeHtml(pageUrlRaw)}"/>
  <meta property="og:image" content="${publicRoot}/assets/images/SmurdeyeBig.png"/>
  <script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": pageTitle,
    "description": metaDescription,
    "url": pageUrlRaw,
    "about": {
        "@type": "Thing",
        "name": `${groupLabel} geography`
    },
    "educationalUse": "practice",
    "isPartOf": {
        "@type": "WebSite",
        "name": "Smurdy",
        "url": publicRoot
    }
}, null, 2)}
  </script>
  <style>
    :root{--brand:#0077cc;--muted:#666;--line:#e8e8e8;--soft:#f6f6f6}
    *{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111;margin:0;background:#fff}
    .panel-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;background:rgba(180,180,180,.12);padding:18px}
    .panel-brand img{width:56px;height:56px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.12)}
    .panel-brand .brand-text{font-weight:700;font-size:18px}
    main{max-width:980px;margin:24px auto;padding:10px 18px}
    header h1{font-size:clamp(24px,3vw,34px);line-height:1.2;margin:0 0 8px}
    .meta{color:var(--muted);font-size:14px;margin-bottom:18px}
    .lead{font-size:18px;margin:0 0 22px;color:#222}
    .content-section{margin:22px 0}
    .content-section h2,.examples h2{font-size:20px;margin:0 0 8px}
    .content-section p{margin:0}
    .tip{background:var(--soft);border-left:4px solid var(--brand);padding:12px 14px;border-radius:4px;margin-top:12px}
    .examples{margin:22px 0}
    .examples ul{padding-left:22px;margin:8px 0}
    .included-list{margin:22px 0;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff}
    .included-list summary{cursor:pointer;font-weight:700}
    .included-list p{margin:12px 0 2px}
    .action-row{display:flex;gap:12px;align-items:center;margin-top:22px;flex-wrap:wrap}
    .qb-btn{display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;border:1px solid transparent}
    .qb-btn.primary{background:var(--brand);color:#fff}
    .qb-btn.secondary{background:#f4f4f4;color:#111}
    .other-quizzes{margin-top:28px;border-top:1px solid var(--line);padding-top:16px}
    .chip-list{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
    .chip{display:inline-flex;align-items:center;padding:8px 14px;border-radius:999px;background:#f4f4f4;color:#111;text-decoration:none;border:1px solid rgba(0,0,0,.06);font-size:14px;transition:all .12s ease}
    .chip:hover{background:var(--brand);color:#fff;transform:translateY(-1px)}
    .chip:focus{outline:2px solid rgba(0,119,204,.22);outline-offset:2px}
    .breadcrumbs{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--muted);font-size:14px;margin:0 0 18px}
    .breadcrumbs a{color:#315f86;text-decoration:none}
    .breadcrumbs a:hover{text-decoration:underline}
    .mode-specific{padding:15px 16px;border:1px solid var(--line);border-radius:10px;background:#fbfbfb}
    .link-section{margin-top:30px;border-top:2px solid var(--line);padding-top:20px}
    .link-section>h2{font-size:22px;margin:0 0 14px}
    .link-block{margin:18px 0}
    .link-block h3{font-size:16px;margin:0 0 8px}
    .browse-all-line{margin:20px 0 0;font-weight:700}
    .browse-all-line a{color:#075f9e}
    footer{max-width:980px;margin:18px auto;color:var(--muted);font-size:13px;padding:0 28px 30px}
  </style>
</head>
<body>
  <a class="panel-brand" href="${publicRoot}/" title="Smurdy">
    <img src="/assets/images/SmurdeyeBig.png" alt="Smurdy logo"/>
    <div class="brand-text">Smurdy</div>
  </a>

  <main>
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="${publicRoot}/">Smurdy</a>
      <span aria-hidden="true">›</span>
      <a href="${publicRoot}/quizzes/">All quizzes</a>
      <span aria-hidden="true">›</span>
      <span>${escapeHtml(groupLabel)} · ${escapeHtml(getModeDisplayName(manifestEntry))}</span>
    </nav>
    <header>
      <h1>${escapeHtml(pageTitle)}</h1>
      <div class="meta">${escapeHtml(getModeDisplayName(manifestEntry))} · ${escapeHtml(groupLabel)} · ${entryCount ? `${entryCount} ${unitPlural}` : `Full ${unitName} set`}</div>
    </header>

    <p class="lead">${escapeHtml(lead)}</p>

    <section class="content-section">
      <h2>What this ${escapeHtml(groupLabel)} quiz covers</h2>
      <p>${escapeHtml(overview)}</p>
    </section>

    <section class="content-section">
      <h2>${escapeHtml(modeCopy.heading || "How this map quiz works")}</h2>
      <p>${escapeHtml(howToPlay)}</p>
      <p class="tip"><strong>Gameplay tip:</strong> ${escapeHtml(gameplayTip)}</p>
    </section>

    ${modeSectionsHtml}

    <section class="content-section">
      <h2>What makes this group challenging</h2>
      <p>${escapeHtml(challenge)}</p>
    </section>

    <section class="content-section">
      <h2>Study tip</h2>
      <p>${escapeHtml(studyTip)}</p>
    </section>

    ${exampleListHtml}
    ${entryListHtml}

    <div class="action-row">
      <a class="qb-btn primary" href="/?quiz=${encodeURIComponent(manifestEntry.file || manifestId)}&mode=${encodeURIComponent(linkMode)}&groupSet=${encodeURIComponent(activeGroupSetId)}${groupId !== "__all__" ? "&group=" + encodeURIComponent(groupId) : ""}">Open quiz</a>
      <a class="qb-btn secondary" href="${publicRoot}/quizzes/">Browse all quizzes</a>
      <a class="qb-btn secondary" href="${publicRoot}/">Back to home</a>
    </div>

    ${navigationHtml}
  </main>

  <footer>Smurdy geography quizzes. <a href="${publicRoot}/">Home</a> · <a href="https://forms.gle/XjJoHBNKSrHLWg1h9" target="_blank" rel="noopener">Feedback</a></footer>
</body>
</html>`;

            await fs.writeFile(outFile, pageHtml, "utf8");

            pages.push(pageUrl);
            pageRecords.push({
                url: pageUrl,
                path: `/quizzes/${relPath}/`,
                title: pageTitle,
                groupLabel,
                quizTitle: titleBase,
                manifestId,
                groupId,
                groupSet: activeGroupSetId
            });
        }
    }

    await writeLegacySubdivisionPages({ outDir, publicRoot });
    await writeQuizIndex({ outDir, pageRecords, publicRoot });
    await writeSitemap({ repoRoot, pages, publicRoot });

    console.log(`Wrote ${pages.length} quiz pages to quizzes/ and updated sitemap.xml + sitemap.txt.`);
    console.log(`Editable descriptions: ${path.relative(repoRoot, copyPath)}`);
    process.exit(0);

    function getGroupKeysForManifest(entry, groupCollection = {}) {
        if (!entry.groupSet) return ["__all__"];
        const mode = normalizeModeKey(entry);
        return Object.keys(groupCollection).filter(groupId => {
            const allowed = groupCollection[groupId] && groupCollection[groupId].allowedTypes;
            return !Array.isArray(allowed) || allowed.length === 0 || allowed.includes(mode);
        });
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});


async function writeLegacySubdivisionPages({ outDir, publicRoot }) {
    const mappings = {
        "click-country": "click-subdivision",
        "type-country": "type-subdivision",
        "find-country": "find-subdivision",
        "find-point": "find-point-subdivision"
    };

    for (const [oldMode, newMode] of Object.entries(mappings)) {
        const legacyDir = path.join(outDir, oldMode, "us_states");
        await fs.mkdir(legacyDir, { recursive: true });
        const destination = `${publicRoot}/quizzes/${newMode}/us_states/`;
        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>US States Quiz Moved | Smurdy</title>
  <meta name="robots" content="noindex, follow"/>
  <link rel="canonical" href="${destination}"/>
  <meta http-equiv="refresh" content="0;url=${destination}"/>
  <script>location.replace(${JSON.stringify(destination)});</script>
</head>
<body>
  <p>The US States quiz is now part of Smurdy's subdivision system.
     <a href="${destination}">Continue to the US States quiz</a>.</p>
</body>
</html>`;
        await fs.writeFile(path.join(legacyDir, "index.html"), html, "utf8");
    }
}

async function readJson(filePath, label) {
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
        console.error(`Could not load ${label}:`, error.message);
        process.exit(1);
    }
}

function validateCopyCoverage(groups, groupCopyMap) {
    const missing = Object.keys(groups).filter(groupId => !groupCopyMap[groupId]);
    if (missing.length) {
        console.warn(`Missing custom descriptions for: ${missing.join(", ")}. Fallback copy will be used.`);
    }
}

function getManifestId(entry) {
    return entry.id || slug(entry.title || entry.file || "quiz");
}

function normalizeModeKey(entry) {
    const raw = String(entry.id || entry.type || entry.mode || "").toLowerCase();
    if (raw.includes("find-point")) return "find-point";
    if (raw.includes("find")) return "find";
    if (raw.includes("type")) return "type";
    if (raw.includes("click")) return "click";
    return raw;
}

function getModeDisplayName(entry) {
    const id = getManifestId(entry);
    if (id === "click-country") return "Click the Countries";
    if (id === "type-country") return "Type the Countries";
    if (id === "find-country") return "Find the Countries";
    if (id === "find-point") return "Find the Country from a Point";
    if (id === "click-subdivision") return "Click the Subdivisions";
    if (id === "type-subdivision") return "Type the Subdivisions";
    if (id === "find-subdivision") return "Find the Subdivisions";
    if (id === "find-point-subdivision") return "Find the Subdivision from a Point";
    return entry.title || humanize(id);
}

function buildPageTitle({ groupLabel, unitPluralTitle, manifestId, modeKey }) {
    if (manifestId === "find-point" || modeKey === "find-point") {
        return `${groupLabel} Find the Point Map Quiz | Smurdy`;
    }
    if (manifestId === "find-country" || modeKey === "find") {
        return `${groupLabel} No-Borders Map Quiz – Find the ${unitPluralTitle} | Smurdy`;
    }
    if (manifestId === "type-country" || modeKey === "type") {
        return `${groupLabel} Map Quiz – Type the ${unitPluralTitle} | Smurdy`;
    }
    return `${groupLabel} Map Quiz – Click the ${unitPluralTitle} | Smurdy`;
}

function inferModeInstructions(entry, context) {
    const mode = normalizeModeKey(entry);
    if (mode === "type") {
        return `A ${context.unitName} is highlighted on the map. Type its name to answer.`;
    }
    if (mode === "find") {
        return `Find and click each ${context.unitName} while political borders are hidden.`;
    }
    if (mode === "find-point") {
        return `Type the ${context.unitName} that contains the point shown on the map.`;
    }
    return `Click the correct ${context.unitName} when its name appears.`;
}

const RELATED_GROUP_HINTS = {
    world: ["europe", "asia", "africa", "north_america", "south_america", "oceania", "us_states"],
    us_states: ["north_america", "americas", "world"],
    europe: ["european_union", "eastern_europe", "southern_europe", "northern_and_western_europe", "balkans", "eurasia", "former_soviet_union", "world"],
    asia: ["southeast_asia", "middle_east", "south_and_central_asia", "eurasia", "former_soviet_union", "mena", "world"],
    africa: ["west_africa", "east_africa", "central_and_southern_africa", "sub_saharan_africa", "mena", "world"],
    north_america: ["central_america_and_caribbean", "caribbean_islands", "latin_america", "americas", "us_states", "world"],
    south_america: ["latin_america", "americas", "north_america", "world"],
    oceania: ["pacific_islands", "small_island_countries", "asia", "world"],
    middle_east: ["mena", "asia", "south_and_central_asia", "former_soviet_union", "world"]
};

function getModeDistinctiveSections(entry) {
    const mode = normalizeModeKey(entry);
    const defaults = {
        click: {
            skillsHeading: "Skills this click quiz develops",
            skills: "This mode builds border recognition, relative-position memory, and fast matching between names and map outlines.",
            strategyHeading: "A reliable click-answering process",
            strategy: "Identify the broad region, find familiar anchors, and compare the target with the borders around those anchors before clicking.",
            bestForHeading: "Who should use the click mode",
            bestFor: "This version works best for first learning a map or rebuilding familiarity after time away.",
            mistakesHeading: "Common mistake in click mode",
            mistakes: "Do not click the first familiar neighbor you see; compare the target's actual borders first."
        },
        type: {
            skillsHeading: "Skills this typing quiz develops",
            skills: "This mode trains active name recall, spelling, and the connection between a highlighted shape and its written name.",
            strategyHeading: "A reliable typing-answer process",
            strategy: "Identify the subregion, recall nearby anchors, say the answer silently, and then type the complete name.",
            bestForHeading: "Who should use the typing mode",
            bestFor: "This version is useful when locations look familiar but their names do not come quickly.",
            mistakesHeading: "Common mistake in typing mode",
            mistakes: "Do not guess only from an initial letter; confirm the highlighted area's position and neighbors."
        },
        find: {
            skillsHeading: "Skills this no-borders quiz develops",
            skills: "This mode trains coastline recognition, proportional distance, and a mental map that does not depend on political outlines.",
            strategyHeading: "A reliable no-borders process",
            strategy: "Locate the subregion, choose a coastline or large anchor, and estimate the target relative to that anchor.",
            bestForHeading: "Who should use the no-borders mode",
            bestFor: "This version is intended for players who already feel comfortable with the normal bordered map.",
            mistakesHeading: "Common mistake without borders",
            mistakes: "A blank political map still has geographic structure; use coastlines, peninsulas, and familiar large countries."
        },
        "find-point": {
            skillsHeading: "Skills this point quiz develops",
            skills: "This mode tests territorial extent, interior geography, and precise awareness of which place contains a location.",
            strategyHeading: "A reliable point-answering process",
            strategy: "Decide whether the point is coastal, inland, or insular, and then compare it with nearby boundaries and shapes.",
            bestForHeading: "Who should use the point mode",
            bestFor: "This version is useful after you recognize the main outlines and want a more spatial challenge.",
            mistakesHeading: "Common mistake in point mode",
            mistakes: "Name the territory containing the point, not merely the closest familiar place."
        }
    };
    return defaults[mode] || defaults.click;
}

function getRelatedGroupIds({ groupId, groups, availableGroupIds, limit = 8 }) {
    const available = availableGroupIds.filter(id => id && id !== "__all__");
    const availableSet = new Set(available);
    const result = [];

    function add(id) {
        if (!id || id === groupId || !availableSet.has(id) || result.includes(id)) return;
        result.push(id);
    }

    for (const id of RELATED_GROUP_HINTS[groupId] || []) add(id);

    const current = groups[groupId] || {};
    const currentMembers = new Set(
        (Array.isArray(current.countries) ? current.countries : [])
            .map(value => String(value).trim().toLowerCase())
    );

    const scored = available
        .filter(id => id !== groupId && !result.includes(id))
        .map(id => {
            const candidate = groups[id] || {};
            const candidateMembers = new Set(
                (Array.isArray(candidate.countries) ? candidate.countries : [])
                    .map(value => String(value).trim().toLowerCase())
            );

            let intersection = 0;
            for (const member of currentMembers) {
                if (candidateMembers.has(member)) intersection++;
            }

            const smaller = Math.min(currentMembers.size, candidateMembers.size);
            const union = new Set([...currentMembers, ...candidateMembers]).size;
            const containment = smaller ? intersection / smaller : 0;
            const jaccard = union ? intersection / union : 0;
            const sameUnit = current.unitName && current.unitName === candidate.unitName ? 0.08 : 0;
            const sameBorders = current.borderset && current.borderset === candidate.borderset ? 0.04 : 0;

            return { id, score: containment * 3 + jaccard + sameUnit + sameBorders };
        })
        .sort((a, b) => b.score - a.score || available.indexOf(a.id) - available.indexOf(b.id));

    for (const item of scored) {
        if (item.score <= 0.12) continue;
        add(item.id);
        if (result.length >= limit) return result.slice(0, limit);
    }

    const position = available.indexOf(groupId);
    for (let offset = 1; result.length < limit && offset < available.length; offset++) {
        add(available[position - offset]);
        add(available[position + offset]);
    }

    add("world");
    return result.slice(0, limit);
}

function getPopularGroupIds({ availableGroupIds, groupId, excludedIds = [], limit = 6 }) {
    const availableSet = new Set(availableGroupIds);
    const excluded = new Set([groupId, ...excludedIds]);
    const preferred = [
        "world", "us_states", "europe", "asia", "africa", "south_america",
        "north_america", "middle_east", "european_union", "southeast_asia",
        "latin_america", "oceania"
    ];

    return preferred
        .filter(id => availableSet.has(id) && !excluded.has(id))
        .slice(0, limit);
}

function buildPageNavigationHtml({
    publicRoot,
    manifestId,
    groupId,
    groupLabel,
    otherQuizzes,
    relatedGroups,
    popularGroups
}) {
    const blocks = [];

    if (otherQuizzes.length) {
        blocks.push(`<div class="link-block">
          <h3>Try another mode for ${escapeHtml(groupLabel)}</h3>
          <div class="chip-list">${otherQuizzes.map(quiz =>
              `<a class="chip" href="${publicRoot}/quizzes/${slug(quiz.id)}/${slug(groupId)}/">${escapeHtml(quiz.title)}</a>`
          ).join("")}</div>
        </div>`);
    }

    if (relatedGroups.length) {
        blocks.push(`<div class="link-block">
          <h3>Related regions in this mode</h3>
          <div class="chip-list">${relatedGroups.map(region =>
              `<a class="chip" href="${publicRoot}/quizzes/${slug(manifestId)}/${slug(region.id)}/">${escapeHtml(region.label)} map quiz</a>`
          ).join("")}</div>
        </div>`);
    }

    if (popularGroups.length) {
        blocks.push(`<div class="link-block">
          <h3>Popular map sets</h3>
          <div class="chip-list">${popularGroups.map(region =>
              `<a class="chip" href="${publicRoot}/quizzes/${slug(manifestId)}/${slug(region.id)}/">${escapeHtml(region.label)}</a>`
          ).join("")}</div>
        </div>`);
    }

    return `<section class="link-section" aria-labelledby="explore-more-heading">
      <h2 id="explore-more-heading">Explore more geography quizzes</h2>
      ${blocks.join("\n")}
      <p class="browse-all-line"><a href="${publicRoot}/quizzes/">Browse the complete Smurdy quiz directory</a></p>
    </section>`;
}

function buildMetaDescription(text, pageTitle) {
    const cleaned = String(text || "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .trim();

    const fallback = `${pageTitle.replace(/\s*\|\s*Smurdy$/, "")}. Free interactive geography practice on Smurdy.`;
    const source = cleaned || fallback;

    if (source.length <= 158) return source;
    const shortened = source.slice(0, 155);
    const lastSpace = shortened.lastIndexOf(" ");
    return `${shortened.slice(0, lastSpace > 110 ? lastSpace : 155).replace(/[,:;.-]+$/, "")}...`;
}

function buildKeywords({ manifestEntry, modeCopy, groupCopy, groupLabel, unitPlural, notable }) {
    const values = [
        `${groupLabel} map quiz`,
        `${groupLabel} ${unitPlural} quiz`,
        `learn ${groupLabel} geography`,
        ...(manifestEntry.tags || []),
        ...(modeCopy.searchTerms || []),
        ...(groupCopy.searchTerms || []),
        ...notable.map(name => `${name} map`)
    ];

    const seen = new Set();
    return values
        .map(value => String(value || "").trim())
        .filter(Boolean)
        .filter(value => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 18);
}

async function writeQuizIndex({ outDir, pageRecords, publicRoot }) {
    if (!pageRecords.length) return;

    const byMode = new Map();
    for (const record of pageRecords) {
        if (!byMode.has(record.manifestId)) byMode.set(record.manifestId, []);
        byMode.get(record.manifestId).push(record);
    }

    const modeNames = {
        "click-country": "Click the Countries",
        "type-country": "Type the Countries",
        "find-country": "Find the Countries Without Borders",
        "find-point": "Find the Point"
    };

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>All Smurdy Geography Quizzes</title>
  <meta name="description" content="Browse Smurdy map quizzes by region and game mode, including country clicking, typing, no-borders challenges, and point identification."/>
  <link rel="canonical" href="${publicRoot}/quizzes/"/>
  <style>
    html,body{min-height:100%}
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f7f7f2;color:#111}
    main{max-width:1100px;margin:24px auto;padding:18px}
    a{color:#111}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:20px}
    section{background:#fff;border:1px solid #e8e8e0;border-radius:14px;padding:16px;box-shadow:0 6px 22px rgba(0,0,0,.06)}
    h1{margin:0 0 8px}
    h2{font-size:18px;margin:0 0 10px}
    ul{margin:0;padding-left:18px}
    li{margin:6px 0}
    .home{display:inline-block;margin-top:14px}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>All Smurdy Geography Quizzes</h1>
      <p>Choose a map region and game mode. Only combinations available in the main quiz browser are listed here.</p>
      <a class="home" href="${publicRoot}/">Back to Smurdy</a>
    </header>
    <div class="grid">
      ${Array.from(byMode.entries()).map(([modeId, records]) => `
      <section>
        <h2>${escapeHtml(modeNames[modeId] || humanize(modeId))}</h2>
        <ul>
          ${records.map(record =>
              `<li><a href="${record.path}">${escapeHtml(record.title.replace(" | Smurdy", ""))}</a></li>`
          ).join("\n          ")}
        </ul>
      </section>`).join("\n")}
    </div>
  </main>
</body>
</html>`;

    await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
}

async function writeSitemap({ repoRoot, pages, publicRoot }) {
    if (!pages.length) return;
    const lastmod = process.env.SITEMAP_LASTMOD || new Date().toISOString().slice(0, 10);

    // Generate both sitemap formats from one canonical, deduplicated URL list.
    const sitemapUrls = Array.from(new Set([
        `${publicRoot}/`,
        `${publicRoot}/quizzes/`,
        ...pages
    ]));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url, index) => `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${index < 2 ? "weekly" : "monthly"}</changefreq>
  </url>`).join("\n")}
</urlset>`;

    // Google-supported text sitemap: one absolute canonical URL per line.
    // The generated quiz URLs already include their trailing slash.
    const textSitemap = `${sitemapUrls.join("\n")}\n`;

    await Promise.all([
        fs.writeFile(path.join(repoRoot, "sitemap.xml"), sitemap, "utf8"),
        fs.writeFile(path.join(repoRoot, "sitemap.txt"), textSitemap, "utf8")
    ]);
}

function renderTemplate(value, context) {
    if (value === undefined || value === null) return "";
    return String(value).replace(/\{([^}]+)\}/g, (_, key) => {
        const replacement = context[key];
        return replacement === undefined || replacement === null ? "" : String(replacement);
    }).replace(/\s+/g, " ").trim();
}

function pluralizeUnit(unit) {
    const lower = String(unit || "").toLowerCase();
    if (lower === "country") return "countries";
    if (lower === "state") return "states";
    if (lower === "province") return "provinces";
    if (lower === "county") return "counties";
    if (lower.endsWith("y")) return `${lower.slice(0, -1)}ies`;
    return `${lower}s`;
}

function joinNatural(items) {
    const values = (items || []).map(String).filter(Boolean);
    if (values.length <= 1) return values[0] || "";
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function slug(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

function humanize(value) {
    return String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, character => character.toUpperCase());
}

function capitalizeWords(value) {
    return String(value || "").replace(/\b\w/g, character => character.toUpperCase());
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
