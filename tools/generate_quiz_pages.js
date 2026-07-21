const fs = require("fs").promises;
const path = require("path");
const vm = require("vm");

(async function main() {
    const repoRoot = path.resolve(__dirname, "..");
    const manifestPath = path.join(repoRoot, "src", "js", "manifest.js");
    const groupsPath = path.join(repoRoot, "src", "data", "country_groups.json");
    const copyPath = path.join(repoRoot, "src", "data", "quiz_page_descriptions.json");
    const outDir = path.join(repoRoot, "quizzes");

    const baseUrl = (process.env.BASE_URL || "https://smurdy.fun").replace(/\/+$/, "");
    const publicRoot = (process.env.PUBLIC_ROOT && process.env.PUBLIC_ROOT.trim())
        ? process.env.PUBLIC_ROOT.replace(/\/+$/, "")
        : baseUrl.replace(/\/docs$/i, "");

    const groups = await readJson(groupsPath, "country_groups.json");
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
        const groupKeys = getGroupKeysForManifest(manifestEntry);

        for (const groupId of groupKeys) {
            const group = groupId === "__all__" ? {} : (groups[groupId] || {});
            const groupCopy = groupCopyMap[groupId] || {};
            const groupLabel = groupId === "__all__"
                ? "All regions"
                : (group.label || humanize(groupId));

            const unitName = String(group.unitName || "region").trim();
            const unitPlural = pluralizeUnit(unitName);
            const unitPluralTitle = capitalizeWords(unitPlural);
            const entries = Array.isArray(group.countries) ? group.countries.slice() : [];
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

            const metaDescription = buildMetaDescription(
                `${lead} ${overview}`,
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
            if (group.borderset) linkMode = String(group.borderset).trim();
            else if (manifestEntry.mode) linkMode = String(manifestEntry.mode).trim();
            else if (manifestEntry.type) linkMode = String(manifestEntry.type).trim();

            const otherQuizzes = manifest
                .filter(other => getManifestId(other) !== manifestId)
                .filter(other => getGroupKeysForManifest(other).includes(groupId))
                .map(other => ({
                    id: getManifestId(other),
                    title: getModeDisplayName(other)
                }))
                .slice(0, 8);

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
    footer{max-width:980px;margin:18px auto;color:var(--muted);font-size:13px;padding:0 28px 30px}
  </style>
</head>
<body>
  <a class="panel-brand" href="${publicRoot}/" title="Smurdy">
    <img src="/assets/images/SmurdeyeBig.png" alt="Smurdy logo"/>
    <div class="brand-text">Smurdy</div>
  </a>

  <main>
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
      <a class="qb-btn primary" href="/?quiz=${encodeURIComponent(manifestEntry.file || manifestId)}&mode=${encodeURIComponent(linkMode)}${groupId !== "__all__" ? "&group=" + encodeURIComponent(groupId) : ""}">Open quiz</a>
      <a class="qb-btn secondary" href="${publicRoot}/">Back to home</a>
    </div>

    ${otherQuizzes.length
        ? `<aside class="other-quizzes">
            <strong>Other quizzes for ${escapeHtml(groupLabel)}</strong>
            <div class="chip-list">${otherQuizzes.map(quiz =>
                `<a class="chip" href="${publicRoot}/quizzes/${slug(quiz.id)}/${slug(groupId)}/">${escapeHtml(quiz.title)}</a>`
            ).join("")}</div>
          </aside>`
        : ""}
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
                groupId
            });
        }
    }

    await writeQuizIndex({ outDir, pageRecords, publicRoot });
    await writeSitemap({ repoRoot, pages });

    console.log(`Wrote ${pages.length} quiz pages to quizzes/ and updated sitemap.xml.`);
    console.log(`Editable descriptions: ${path.relative(repoRoot, copyPath)}`);
    process.exit(0);

    function getGroupKeysForManifest(entry) {
        if (!entry.groupSet) return ["__all__"];
        const mode = normalizeModeKey(entry);
        return Object.keys(groups).filter(groupId => {
            const allowed = groups[groupId] && groups[groupId].allowedTypes;
            return !Array.isArray(allowed) || allowed.length === 0 || allowed.includes(mode);
        });
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});

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
    if (id === "find-point") return "Find the Point";
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

async function writeSitemap({ repoRoot, pages }) {
    if (!pages.length) return;
    const lastmod = process.env.SITEMAP_LASTMOD || new Date().toISOString().slice(0, 10);

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://smurdy.fun/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://smurdy.fun/quizzes/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>
${pages.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
  </url>`).join("\n")}
</urlset>`;

    await fs.writeFile(path.join(repoRoot, "sitemap.xml"), sitemap, "utf8");
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
