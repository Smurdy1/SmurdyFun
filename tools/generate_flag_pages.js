const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const flagOverrides = readJson("src/data/flag_groups.json");
const countryGroups = readJson("src/data/country_groups.json");
const sources = readJson("src/data/flag_sources.json");
const aliases = readJson("src/data/aliases.json");
const flagApi = require(path.join(root, "src/js/flag_quiz.js"));
const { expandFlagGroups } = require(path.join(root, "src/js/flag_catalog.js"));
const { rebuildSitemaps } = require(path.join(root, "tools/rebuild_sitemaps.js"));
const pageShell = require(path.join(root, "tools/quiz_page_shell.js"));
const groups = expandFlagGroups(flagOverrides, countryGroups);
const baseUrl = (process.env.BASE_URL || "https://smurdy.fun").replace(/\/+$/, "");
const outputRoot = path.join(root, "quizzes/type-flag");

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function pluralUnit(group) {
    if (group.unitName === "state") return "states";
    if (group.unitName === "country") return "countries";
    return "countries and territories";
}

function pageTitle(group) {
    return `${group.shortLabel} Flag Quiz - Type the ${group.unitName === "state" ? "States" : "Countries"} | Smurdy`;
}

function flagList(groupId) {
    return flagApi.selectFlags(sources, groupId, groups, countryGroups, aliases);
}

function previewHtml(flags, notable) {
    const selected = notable
        .map(name => flags.find(flag => flagApi.acceptedAnswers(name, aliases).has(flagApi.normalizeAnswer(flag.name))))
        .filter(Boolean);
    return `<ul class="flag-preview-list">${selected.map(flag => `
        <li><img src="${escapeHtml(flag.src)}" alt="Flag of ${escapeHtml(flag.name)}" loading="lazy"><span>${escapeHtml(flag.name)}</span></li>`).join("")}
    </ul>`;
}

function relatedMapLinks(groupId, group) {
    if (groupId === "us_states") {
        return [
            ["Type the US States", "/quizzes/type-subdivision/us_states/"],
            ["Click the US States", "/quizzes/click-subdivision/us_states/"],
            ["Find US States Without Borders", "/quizzes/find-subdivision/us_states/"]
        ];
    }
    const mapGroup = group.sourceGroup || "world";
    return [
        ["Type the Countries", `/quizzes/type-country/${mapGroup}/`],
        ["Click the Countries", `/quizzes/click-country/${mapGroup}/`],
        ["Find Countries Without Borders", `/quizzes/find-country/${mapGroup}/`]
    ];
}

function chips(items) {
    return `<div class="chip-list">${items.map(([label, href]) =>
        `<a class="chip" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
    ).join("")}</div>`;
}

function quizPage(groupId, group) {
    const flags = flagList(groupId);
    if (flags.length !== group.memberCount) {
        throw new Error(`${groupId}: expected ${group.memberCount} flags, found ${flags.length}`);
    }
    const units = pluralUnit(group);
    const title = pageTitle(group);
    const canonical = `${baseUrl}/quizzes/type-flag/${groupId}/`;
    const description = `${group.description} Type each answer in a free interactive flag quiz.`;
    const relatedFlags = Object.entries(groups)
        .filter(([id]) => id !== groupId)
        .map(([id, item]) => [item.label, `/quizzes/type-flag/${id}/`]);
    const mapLinks = relatedMapLinks(groupId, group);
    const answerLabel = group.unitName === "state" ? "State name" : "Country or territory name";
    const placeholder = group.unitName === "state" ? "Enter the state name..." : "Enter the country or territory...";
    const heading = `${group.shortLabel} Flag Quiz`;
    const sharedStylesHtml = pageShell.renderSharedStyles();
    const brandHtml = pageShell.renderBrand({ className: "flag-brand" });
    const actionsHtml = pageShell.renderLandingActions({
        quizId: "type-flag",
        groupId,
        className: "flag-actions",
        buttonClass: "flag-button"
    });
    const footerHtml = pageShell.renderFooter({ className: "flag-footer" });
    const landingScriptsHtml = pageShell.renderLandingScripts();

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(`${group.shortLabel} flag quiz, type the flags, learn ${group.shortLabel} flags, geography quiz`)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${baseUrl}/assets/images/apple-touch-icon.png?v=20260825-logo-1">
  <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Quiz",
        name: heading,
        description,
        url: canonical,
        educationalUse: "practice",
        about: { "@type": "Thing", name: `${group.shortLabel} flags` },
        isPartOf: { "@type": "WebSite", name: "Smurdy", url: baseUrl }
    })}</script>
  ${sharedStylesHtml}
  <link rel="stylesheet" href="/styles/flag_quiz.css?v=20260903-review-pagination-1">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16.png?v=20260825-logo-1">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png?v=20260825-logo-1">
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/images/favicon-48.png?v=20260825-logo-1">
  <link rel="shortcut icon" href="/favicon.ico?v=20260825-logo-1">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png?v=20260825-logo-1">
</head>
<body data-smurdy-quiz-page data-quiz-id="type-flag" data-quiz-group="${escapeHtml(groupId)}" data-quiz-modality="flag" data-flag-set="${escapeHtml(groupId)}">
  ${brandHtml}

  <main class="flag-page">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Smurdy</a><span aria-hidden="true">›</span>
      <a href="/quizzes/">All quizzes</a><span aria-hidden="true">›</span>
      <a href="/quizzes/type-flag/">Flag quizzes</a><span aria-hidden="true">›</span>
      <span>${escapeHtml(group.shortLabel)}</span>
    </nav>

    <article data-flag-landing>
      <header>
        <h1>${escapeHtml(heading)}</h1>
        <div class="flag-meta">Type the Flags / ${escapeHtml(group.shortLabel)} / ${flags.length} flags</div>
        <p class="flag-lead">${escapeHtml(group.lead)}</p>
        ${actionsHtml}
      </header>

      <section class="flag-info content-section">
        <h2>What this ${escapeHtml(group.shortLabel)} quiz covers</h2>
        <p>${escapeHtml(group.overview)}</p>
      </section>
      <section class="flag-info content-section">
        <h2>How the flag quiz works</h2>
        <p>One flag appears at a time. Type the ${escapeHtml(group.unitName)} it represents, or choose Give Up to reveal the answer. The round continues through all ${flags.length} ${escapeHtml(units)}.</p>
        <p class="flag-tip"><strong>Gameplay tip:</strong> Check the stripe direction, color order, symbols, and proportions before answering.</p>
      </section>
      <section class="flag-info content-section">
        <h2>What you'll practice</h2>
        <p>This mode builds visual recognition and name recall together. You have to produce the full place name instead of choosing it from a list.</p>
      </section>
      <section class="flag-info content-section">
        <h2>A good way to start</h2>
        <p>Identify the broad design family first, then use the smallest distinctive feature to separate it from similar flags.</p>
      </section>
      <section class="flag-info content-section">
        <h2>What makes this set challenging</h2>
        <p>${escapeHtml(group.challenge)}</p>
      </section>
      <section class="flag-info content-section">
        <h2>Study tip</h2>
        <p>${escapeHtml(group.studyTip)}</p>
      </section>
      <section class="flag-info flag-examples" aria-labelledby="flag-examples-heading">
        <h2 id="flag-examples-heading">Example flags in this quiz</h2>
        ${previewHtml(flags, group.notable || [])}
      </section>
      <details class="included-list">
        <summary>${escapeHtml(units[0].toUpperCase() + units.slice(1))} included in this quiz (${flags.length})</summary>
        <p>${flags.map(flag => escapeHtml(flag.name)).join(", ")}.</p>
      </details>
      <section class="flag-links" aria-labelledby="explore-more-heading">
        <h2 id="explore-more-heading">Explore more geography quizzes</h2>
        <h3>Practice the same region on a map</h3>
        ${chips(mapLinks)}
        <h3>Try another flag set</h3>
        ${chips(relatedFlags)}
        <p class="browse-all-line"><a href="/quizzes/">Browse the complete Smurdy quiz directory</a></p>
      </section>
    </article>

    <section class="flag-game" data-flag-game hidden aria-label="${escapeHtml(heading)}">
      <div class="flag-game-title-row"><h1>Name this flag</h1></div>
      <div class="flag-game-header">
        <span data-flag-progress>0 / ${flags.length} completed</span>
        <span data-flag-time>00:00</span>
        <span data-flag-accuracy>100% correct</span>
      </div>
      <div class="flag-progress-track" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${flags.length}" aria-valuenow="0"><span data-flag-progress-bar></span></div>
      <div class="flag-stage"><img data-flag-image alt=""></div>
      <form class="flag-form" data-flag-form autocomplete="off">
        <label for="flag-answer" class="visually-hidden">${escapeHtml(answerLabel)}</label>
        <input id="flag-answer" data-flag-input type="text" placeholder="${escapeHtml(placeholder)}" autocapitalize="words" spellcheck="false" required>
        <button class="flag-button primary" type="submit">Submit</button>
      </form>
      <p class="flag-result" data-flag-result aria-live="polite"></p>
      <div class="flag-game-actions">
        <a class="flag-button" href="/">Back</a>
        <button class="flag-button" type="button" data-flag-giveup>Give Up</button>
        <button class="flag-button" type="button" data-flag-restart>Restart</button>
        <button class="flag-button" type="button" data-flag-retry hidden>Retry Missed</button>
      </div>
      <section class="flag-summary" data-flag-summary hidden></section>
      <section class="flag-review" data-flag-review hidden></section>
      <div class="flag-after-actions" data-flag-after-actions hidden><a class="flag-button" href="/quizzes/type-flag/">More flag quizzes</a><a class="flag-button" href="/quizzes/">All quizzes</a></div>
    </section>
  </main>

  ${footerHtml}
  <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>
  <script src="/src/js/quiz_session.js?v=20260903-session-1" defer></script>
  <script src="/src/js/quiz_completion.js?v=20260903-review-pagination-1" defer></script>
  <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>
  <script src="/src/js/flag_catalog.js?v=20260903-flag-parity-1" defer></script>
  <script src="/src/js/weak_spots.js?v=20260903-flag-parity-1" defer></script>
  <script src="/src/js/quiz_library.js?v=20260828-quiz-library-1" defer></script>
  <script src="/src/js/flag_quiz.js?v=20260903-review-pagination-1" defer></script>
  ${landingScriptsHtml}
</body>
</html>`;
}

function directoryPage() {
    const mainIds = new Set(["world", "europe", "asia", "africa", "north_america", "south_america", "oceania"]);
    const specialtyIds = new Set(["european_union", "former_soviet_union", "tiny_countries", "small_island_countries", "pacific_islands"]);
    const countryEntries = Object.entries(groups).filter(([, group]) => group.family === "countries");
    const subdivisionEntries = Object.entries(groups).filter(([, group]) => group.family === "subdivisions");
    const main = countryEntries.filter(([id]) => mainIds.has(id));
    const specialty = countryEntries.filter(([id]) => specialtyIds.has(id));
    const regional = countryEntries.filter(([id]) => !mainIds.has(id) && !specialtyIds.has(id));

    const cards = entries => entries.map(([id, group]) => `
          <a class="directory-card" href="/quizzes/type-flag/${id}/">
            <span class="directory-card-title">${escapeHtml(group.label)}</span>
            <span class="directory-card-description">${escapeHtml(group.description)}</span>
            <span class="directory-card-meta">${group.memberCount} flags</span>
          </a>`).join("");
    const section = (heading, lead, entries) => entries.length
        ? `<section class="directory-section"><h2>${heading}</h2><p class="directory-section-lead">${lead}</p><div class="directory-card-grid">${cards(entries)}</div></section>`
        : "";
    const total = Object.keys(groups).length;

    return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Flag Quizzes - World, Regions, and US States | Smurdy</title>
  <meta name="description" content="Choose from ${total} free flag quizzes covering the world, regions, specialty country sets, and US states.">
  <meta name="robots" content="index, follow"><link rel="canonical" href="${baseUrl}/quizzes/type-flag/">
  <link rel="stylesheet" href="/styles/quiz_directory.css?v=20260901-directory-1">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png?v=20260825-logo-1">
</head><body>
  <header class="directory-header"><a class="directory-brand" href="/" aria-label="Smurdy home"><img src="/assets/images/smurdeye-transparent.png?v=20260825-logo-1" alt=""><span>Smurdy</span></a></header>
  <main class="directory-shell">
    <nav class="directory-breadcrumbs" aria-label="Breadcrumb"><a href="/">Smurdy</a><span aria-hidden="true">›</span><a href="/quizzes/">All quizzes</a><span aria-hidden="true">›</span><span>Flags</span></nav>
    <h1 class="directory-title">Flag Quizzes</h1>
    <p class="directory-lead">Choose a flag set, then type the country, territory, or subdivision it represents.</p>
    ${section("Main sets", "Start with the world or one continent.", main)}
    ${section("Regional sets", "Focus on the same regional groups available in the map quizzes.", regional)}
    ${section("Specialty sets", "Practice political, historical, island, and size-based country groups.", specialty)}
    ${section("Subdivisions", "Practice flags for states, provinces, and other first-level subdivisions.", subdivisionEntries)}
    <section class="directory-section"><h2>Flag modes</h2><div class="directory-mode-grid">
      <div class="directory-card directory-mode-card"><span class="directory-card-title">Type</span><span class="directory-card-description">See a flag and type the place it represents.</span><span class="directory-card-meta">Available now</span></div>
      <div class="directory-card directory-mode-card directory-card-disabled" aria-disabled="true"><span class="directory-card-title">Locate</span><span class="directory-card-description">See a flag, then locate its place on the map.</span><span class="directory-coming-soon">Coming soon!</span></div>
    </div></section>
    <section class="directory-section"><h2>How to learn flags with Smurdy</h2><p class="directory-section-lead">Start with a smaller regional set, retry the flags you miss, and move to the world set once you can switch between regions comfortably.</p><div class="directory-related"><a class="directory-chip" href="/quizzes/">Browse all geography quizzes</a><a class="directory-chip" href="/">Back to home</a></div></section>
  </main>
  <footer class="directory-footer">Smurdy geography quizzes. <a href="/">Home</a> / <a href="/about/">About</a> / <a href="/contact/">Contact</a> / <a href="/privacy/">Privacy</a></footer>
</body></html>`;
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, "index.html"), directoryPage());
for (const [groupId, group] of Object.entries(groups)) {
    const directory = path.join(outputRoot, groupId);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), quizPage(groupId, group));
}
rebuildSitemaps({ repoRoot: root, publicRoot: baseUrl });
console.log(`Generated ${Object.keys(groups).length} flag quiz pages, the flag directory, and refreshed both sitemaps.`);
