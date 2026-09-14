const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const routes = require("../src/js/quiz_routes.js");
const { rebuildSitemaps } = require("./rebuild_sitemaps.js");

const root = path.resolve(__dirname, "..");
const quizzesRoot = path.join(root, "quizzes");
const baseUrl = (process.env.BASE_URL || "https://smurdy.fun").replace(/\/+$/, "");
const generatedCategories = new Set(["maps", "capitals", "flags"]);

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function loadManifest() {
    const code = fs.readFileSync(path.join(root, "src/js/manifest.js"), "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: "manifest.js" });
    return Array.isArray(sandbox.window.SmurdyQuizManifest)
        ? sandbox.window.SmurdyQuizManifest
        : [];
}

function isComingSoon(item) {
    return String(item?.status || "").toLowerCase() === "coming-soon" || Boolean(item?.config?.comingSoon);
}

function groupSetIds(item) {
    return [item?.groupSet, ...(item?.additionalGroupSets || [])].filter(Boolean);
}

function groupSetFor(item, groupId) {
    return item?.groupSetOverrides?.[groupId] || item?.groupSet || "country_groups";
}

function groupData(groupSets, item, groupId) {
    const set = groupSets[groupSetFor(item, groupId)] || {};
    return set[groupId] || {};
}

function groupLabel(groupSets, item, groupId) {
    const group = groupData(groupSets, item, groupId);
    return group.shortLabel || group.label || groupId.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function pageH1(html) {
    const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return match ? match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() : "Quiz";
}

function legacyLeafRecords(manifest, groupSets) {
    const records = [];
    for (const item of manifest) {
        if (isComingSoon(item)) continue;
        const quizId = routes.clean(item.id);
        if (!quizId) continue;
        const modeDir = path.join(quizzesRoot, quizId);
        if (!fs.existsSync(modeDir)) continue;
        for (const entry of fs.readdirSync(modeDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const groupId = routes.clean(entry.name);
            const file = path.join(modeDir, entry.name, "index.html");
            if (!fs.existsSync(file)) continue;
            const html = fs.readFileSync(file, "utf8");
            const route = routes.descriptorFor(quizId, groupId, manifest);
            if (!route) continue;
            records.push({
                ...route,
                item,
                oldPath: routes.legacyPath(quizId, groupId),
                oldDirectory: routes.legacyDirectoryPath(quizId),
                canonicalPath: routes.canonicalPath(quizId, groupId, manifest),
                familyPath: routes.familyPath(quizId, groupId, manifest),
                interactionPath: routes.interactionPath(quizId, groupId, manifest),
                categoryPath: routes.categoryPath(quizId, groupId, manifest),
                html,
                title: pageH1(html),
                groupLabel: groupLabel(groupSets, item, groupId)
            });
        }
    }
    return records;
}

function replaceRoutes(html, leafMap, directoryMap) {
    let out = html;
    const replacements = [...leafMap.entries(), ...directoryMap.entries()]
        .sort((a, b) => b[0].length - a[0].length);
    for (const [from, to] of replacements) {
        out = out.split(`${baseUrl}${from}`).join(`${baseUrl}${to}`);
        out = out.split(from).join(to);
    }
    return out;
}

function aliasPage(target, title = "Quiz moved") {
    const safeTarget = escapeHtml(target);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | Smurdy</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${baseUrl}${safeTarget}">
  <meta http-equiv="refresh" content="0; url=${safeTarget}">
  <script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head>
<body><p>This quiz moved. <a href="${safeTarget}">Continue</a>.</p></body>
</html>`;
}

function directoryShell({ title, lead, canonicalPath, breadcrumbs = [], sections = [] }) {
    const breadcrumbHtml = [
        `<a href="${baseUrl}/">Smurdy</a>`,
        ...breadcrumbs.map((item, index) => index === breadcrumbs.length - 1 && !item.href
            ? `<span>${escapeHtml(item.label)}</span>`
            : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    ].join('<span aria-hidden="true">›</span>');

    const sectionsHtml = sections.map(section => {
        const cards = section.cards.map(card => {
            if (card.disabled) {
                return `<div class="directory-card directory-mode-card directory-card-disabled" aria-disabled="true"><span class="directory-card-title">${escapeHtml(card.title)}</span>${card.description ? `<span class="directory-card-description">${escapeHtml(card.description)}</span>` : ""}${card.meta ? `<span class="directory-card-meta">${escapeHtml(card.meta)}</span>` : ""}</div>`;
            }
            return `<a class="directory-card ${card.mode ? "directory-mode-card" : "directory-group-card"}" href="${escapeHtml(card.href)}"><span class="directory-card-title">${escapeHtml(card.title)}</span>${card.description ? `<span class="directory-card-description">${escapeHtml(card.description)}</span>` : ""}${card.meta ? `<span class="directory-card-meta">${escapeHtml(card.meta)}</span>` : ""}</a>`;
        }).join("");
        return `<section class="directory-section"><h2>${escapeHtml(section.title)}</h2>${section.lead ? `<p class="directory-section-lead">${escapeHtml(section.lead)}</p>` : ""}<div class="${section.mode ? "directory-mode-grid" : "directory-grid"}">${cards}</div></section>`;
    }).join("\n    ");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | Smurdy</title>
  <meta name="description" content="${escapeHtml(lead)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}${escapeHtml(canonicalPath)}">
  <link rel="stylesheet" href="/styles/quiz_directory.css?v=20260909-editorial-1">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png?v=20260825-logo-1">
</head>
<body>
  <header class="directory-header"><a class="directory-brand" href="${baseUrl}/"><img src="/assets/images/smurdeye-transparent.png?v=20260825-logo-1" alt=""><span>Smurdy</span></a></header>
  <main class="directory-shell">
    <nav class="directory-breadcrumbs" aria-label="Breadcrumb">${breadcrumbHtml}</nav>
    <h1 class="directory-title">${escapeHtml(title)}</h1>
    <p class="directory-lead">${escapeHtml(lead)}</p>
    ${sectionsHtml}
  </main>
  <footer class="directory-footer"><a href="/">Home</a> / <a href="/about/">About</a> / <a href="/contact/">Contact</a> / <a href="/privacy/">Privacy</a></footer>
</body>
</html>`;
}

function writeHtml(routePath, html) {
    const relative = routePath.replace(/^\/+|\/+$/g, "");
    const directory = path.join(root, relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), html);
}

function interactionLabel(value) {
    return ({ click: "Click", type: "Type", find: "No Borders", "find-point": "Point", locate: "Locate" })[value] || value;
}

function interactionDescription(category, interaction) {
    const key = `${category}/${interaction}`;
    return ({
        "maps/click": "Choose each named place directly on the map.",
        "maps/type": "Type the name of each highlighted place.",
        "maps/find": "Locate places with their borders hidden.",
        "maps/find-point": "Identify the place containing each point.",
        "capitals/type": "Type the capital city of each highlighted place.",
        "capitals/locate": "See a capital city and locate it on the map.",
        "flags/type": "See a flag and type the place it represents.",
        "flags/locate": "See a flag and locate its place on the map."
    })[key] || "Practice this geography mode.";
}

function categoryTitle(category) {
    return ({ maps: "Map Quizzes", capitals: "Capital Quizzes", flags: "Flag Quizzes" })[category] || category;
}

function familyTitle(family) {
    return family === "subdivisions" ? "Subdivisions" : "Countries";
}

function renderDirectories(records, manifest) {
    const playableRecords = records;
    const categoryOrder = ["maps", "capitals", "flags"];
    const rootCards = categoryOrder.map(category => {
        const count = playableRecords.filter(record => record.category === category).length;
        return {
            title: categoryTitle(category).replace(/ Quizzes$/, ""),
            href: `/quizzes/${category}/`,
            description: category === "maps" ? "Names, locations, borders, and map recognition." : category === "capitals" ? "Country and subdivision capitals." : "Country, territory, and subdivision flags.",
            meta: `${count} quiz sets`,
            mode: true
        };
    });
    fs.writeFileSync(path.join(quizzesRoot, "index.html"), directoryShell({
        title: "All Geography Quizzes",
        lead: "Choose a category, then a mode, place type, and quiz set.",
        canonicalPath: "/quizzes/",
        breadcrumbs: [{ label: "All quizzes" }],
        sections: [{ title: "Categories", mode: true, cards: rootCards }]
    }));

    for (const category of categoryOrder) {
        const categoryItems = manifest.filter(item => routes.clean(item.category) === category);
        const interactions = [...new Set(categoryItems.map(item => routes.clean(item.interaction || item.type)).filter(Boolean))];
        const cards = interactions.map(interaction => {
            const item = categoryItems.find(entry => routes.clean(entry.interaction || entry.type) === interaction);
            const enabled = !isComingSoon(item);
            const count = playableRecords.filter(record => record.category === category && record.interaction === interaction).length;
            return {
                title: interactionLabel(interaction),
                href: `/quizzes/${category}/${interaction}/`,
                description: interactionDescription(category, interaction),
                meta: enabled ? `${count} quiz sets` : "Coming soon",
                disabled: !enabled,
                mode: true
            };
        });
        writeHtml(`/quizzes/${category}/`, directoryShell({
            title: categoryTitle(category),
            lead: "Choose a game mode.",
            canonicalPath: `/quizzes/${category}/`,
            breadcrumbs: [{ label: "All quizzes", href: "/quizzes/" }, { label: categoryTitle(category) }],
            sections: [{ title: "Modes", mode: true, cards }]
        }));

        for (const interaction of interactions) {
            const matchingManifest = categoryItems.filter(item => routes.clean(item.interaction || item.type) === interaction);
            if (matchingManifest.every(isComingSoon)) continue;
            const interactionRecords = playableRecords.filter(record => record.category === category && record.interaction === interaction);
            const availableFamilies = [...new Set(interactionRecords.map(record => record.family))];
            const declaredFamilies = [...new Set(matchingManifest.flatMap(item => item.families || []))].map(routes.clean).filter(Boolean);
            const families = [...new Set([...availableFamilies, ...declaredFamilies])].filter(family => ["countries", "subdivisions"].includes(family));
            const familyCards = families.map(family => {
                const count = interactionRecords.filter(record => record.family === family).length;
                return {
                    title: familyTitle(family),
                    href: `/quizzes/${category}/${interaction}/${family}/`,
                    description: family === "countries" ? "Countries and territories." : "States, provinces, and other first-level subdivisions.",
                    meta: `${count} quiz set${count === 1 ? "" : "s"}`,
                    mode: true
                };
            });
            writeHtml(`/quizzes/${category}/${interaction}/`, directoryShell({
                title: `${interactionLabel(interaction)} ${categoryTitle(category).replace(/ Quizzes$/, "")}`,
                lead: "Choose what kind of places to practice.",
                canonicalPath: `/quizzes/${category}/${interaction}/`,
                breadcrumbs: [
                    { label: "All quizzes", href: "/quizzes/" },
                    { label: categoryTitle(category), href: `/quizzes/${category}/` },
                    { label: interactionLabel(interaction) }
                ],
                sections: [{ title: "Place type", mode: true, cards: familyCards }]
            }));

            for (const family of families) {
                const familyRecords = interactionRecords
                    .filter(record => record.family === family)
                    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
                if (!familyRecords.length) continue;
                const cards = familyRecords.map(record => ({
                    title: record.groupLabel,
                    href: record.canonicalPath,
                    description: record.title,
                    meta: "Open quiz"
                }));
                writeHtml(`/quizzes/${category}/${interaction}/${family}/`, directoryShell({
                    title: `${interactionLabel(interaction)} ${familyTitle(family)}`,
                    lead: `Choose a ${family === "countries" ? "country" : "subdivision"} quiz set.`,
                    canonicalPath: `/quizzes/${category}/${interaction}/${family}/`,
                    breadcrumbs: [
                        { label: "All quizzes", href: "/quizzes/" },
                        { label: categoryTitle(category), href: `/quizzes/${category}/` },
                        { label: interactionLabel(interaction), href: `/quizzes/${category}/${interaction}/` },
                        { label: familyTitle(family) }
                    ],
                    sections: [{ title: "Quiz sets", cards }]
                }));
            }
        }
    }
}

function main() {
    const manifest = loadManifest();
    const groupSets = {
        country_groups: readJson("src/data/country_groups.json"),
        subdivision_groups: readJson("src/data/subdivision_groups.json"),
        flag_groups: readJson("src/data/flag_groups.json")
    };

    for (const category of generatedCategories) {
        fs.rmSync(path.join(quizzesRoot, category), { recursive: true, force: true });
    }

    const records = legacyLeafRecords(manifest, groupSets);
    const leafMap = new Map(records.map(record => [record.oldPath, record.canonicalPath]));
    const directoryMap = new Map();
    for (const record of records) {
        if (!directoryMap.has(record.oldDirectory)) {
            const sameLegacyMode = records.filter(other => other.quizId === record.quizId);
            const families = new Set(sameLegacyMode.map(other => other.family));
            directoryMap.set(record.oldDirectory, families.size > 1 ? record.interactionPath : record.familyPath);
        }
    }

    for (const record of records) {
        const canonicalHtml = replaceRoutes(record.html, leafMap, directoryMap)
            .replace(/<meta[^>]+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index, follow">');
        writeHtml(record.canonicalPath, canonicalHtml);
        const oldFile = path.join(root, record.oldPath.replace(/^\/+/, ""), "index.html");
        fs.writeFileSync(oldFile, aliasPage(record.canonicalPath, record.title));
    }

    for (const [legacyDirectory, target] of directoryMap) {
        const oldFile = path.join(root, legacyDirectory.replace(/^\/+/, ""), "index.html");
        fs.mkdirSync(path.dirname(oldFile), { recursive: true });
        fs.writeFileSync(oldFile, aliasPage(target, "Quiz directory moved"));
    }

    renderDirectories(records, manifest);
    rebuildSitemaps({ repoRoot: root, publicRoot: baseUrl });
    console.log(`Normalized ${records.length} quiz pages into category / mode / place-type routes.`);
}

main();
