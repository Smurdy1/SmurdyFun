from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, replacement):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern!r}")
    write(path, updated)


# 1. Canonical entity policy feeds the flag synchronization target list.
replace_once(
    "tools/sync_wikimedia_flags.js",
    'const SOURCES_PATH = path.join(ROOT, "src/data/flag_sources.json");\n',
    'const SOURCES_PATH = path.join(ROOT, "src/data/flag_sources.json");\n'
    'const { ADMIN_OVERRIDES, getCanonicalCountryName } = require("../src/js/quiz_entities.js");\n',
)
replace_once(
    "tools/sync_wikimedia_flags.js",
    "function buildTargets(countryFlags, countries, states) {\n  const targets = countryFlags.map((entry) => ({\n",
    """function explicitQuizEntityTargets(countryFlags, countryFeatures) {
  const existing = new Set(countryFlags.map((entry) => entry.name));
  const targets = [];

  for (const feature of countryFeatures || []) {
    const properties = feature?.properties || {};
    const overrideKey = [
      properties.ADMIN,
      properties.admin,
      properties.GEOUNIT,
      properties.geounit,
    ].find((value) => value && ADMIN_OVERRIDES[String(value).trim()]);
    if (!overrideKey) continue;

    const name = getCanonicalCountryName(feature);
    if (!name || existing.has(name)) continue;
    const code = String(properties.ISO_A2 || properties.iso_a2 || "").toLowerCase();
    const qid = properties.WIKIDATAID || properties.wikidataid || null;
    if (!code || code === "-99") {
      throw new Error(`${name} has no usable ISO_A2 code for its flag filename`);
    }
    targets.push({ kind: "country", name, code, qid, filename: `${code}.svg` });
    existing.add(name);
  }

  return targets;
}

function buildTargets(countryFlags, countries, states) {
  const targets = countryFlags.map((entry) => ({
""",
)
replace_once(
    "tools/sync_wikimedia_flags.js",
    "    filename: countryDestination(entry),\n  }));\n\n  for (const feature of states.features) {\n",
    "    filename: countryDestination(entry),\n  }));\n\n"
    "  targets.push(...explicitQuizEntityTargets(countryFlags, countries.features));\n\n"
    "  for (const feature of states.features) {\n",
)
replace_once(
    "tools/sync_wikimedia_flags.js",
    "  buildTargets,\n  countryDestination,\n",
    "  buildTargets,\n  explicitQuizEntityTargets,\n  countryDestination,\n",
)

# Seed the existing ps.svg into the source manifest. Future syncs now derive it from quiz_entities.js.
sources_path = ROOT / "src/data/flag_sources.json"
sources = json.loads(sources_path.read_text())
if not any(flag.get("name") == "Palestine" and flag.get("kind") == "country" for flag in sources.get("flags", [])):
    sources["flags"].append({
        "code": "ps",
        "name": "Palestine",
        "kind": "country",
        "filename": "ps.svg",
        "wikidataId": "Q219060",
        "commonsFile": "Flag of Palestine.svg",
        "commonsPage": "https://commons.wikimedia.org/wiki/File:Flag_of_Palestine.svg",
        "license": "Public domain",
        "attributionRequired": False,
    })
sources["flags"].sort(key=lambda item: (str(item.get("code", "")), str(item.get("name", ""))))
sources_path.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")

flag_groups_path = ROOT / "src/data/flag_groups.json"
flag_groups = json.loads(flag_groups_path.read_text())
flag_groups["world"]["memberCount"] = 201
flag_groups["world"]["description"] = "Identify all 201 country and territory flags by name."
flag_groups["asia"]["memberCount"] = 51
flag_groups["asia"]["description"] = "Practice all 51 flags in Smurdy's Asia set."
flag_groups["asia"]["lead"] = "Type the place represented by each of the 51 Asian flags."
flag_groups_path.write_text(json.dumps(flag_groups, indent=2, ensure_ascii=False) + "\n")


# 2. Load shared launch/group helpers in the app shell.
replace_once(
    "index.html",
    '     <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>\n'
    '     <script src="/src/js/weak_spots.js?v=20260826-ui-polish-1" defer></script>\n'
    '     <script src="/src/js/quiz_library.js?v=20260828-quiz-library-1" defer></script>\n'
    '  <script src="/src/js/app.js?v=20260828-quiz-library-1" defer></script>\n'
    '     <script src="/src/js/manifest.js?v=20260722-independent-menu-control-1" defer></script>\n'
    '     <script src="/src/js/browse.js?v=20260902-quiz-browser-1" defer></script>',
    '     <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>\n'
    '     <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>\n'
    '     <script src="/src/js/flag_catalog.js?v=20260903-flag-parity-1" defer></script>\n'
    '     <script src="/src/js/weak_spots.js?v=20260903-flag-parity-1" defer></script>\n'
    '     <script src="/src/js/quiz_library.js?v=20260828-quiz-library-1" defer></script>\n'
    '  <script src="/src/js/app.js?v=20260828-quiz-library-1" defer></script>\n'
    '     <script src="/src/js/manifest.js?v=20260722-independent-menu-control-1" defer></script>\n'
    '     <script src="/src/js/browse.js?v=20260903-flag-parity-1" defer></script>',
)


# 3. Browser derives flag groups from the map catalog and stores a one-time launch intent.
replace_once(
    "src/js/browse.js",
    "        groupSets[safeId] = data;\n        return data;\n",
    """        let resolvedData = data;
        if (
            safeId === "flag_groups" &&
            window.SmurdyFlagCatalog?.expandFlagGroups
        ) {
            const countryGroups = groupSets.country_groups ||
                await loadGroupSet("country_groups");
            resolvedData = window.SmurdyFlagCatalog.expandFlagGroups(
                data,
                countryGroups
            );
        }

        groupSets[safeId] = resolvedData;
        return resolvedData;
""",
)
replace_once(
    "src/js/browse.js",
    """                    if (categoryKeyForManifest(manifestItem) === "flags") {
                        window.location.assign(link.href);
                        return;
                    }
""",
    """                    if (categoryKeyForManifest(manifestItem) === "flags") {
                        window.SmurdyQuizLaunchIntent?.store?.(
                            manifestItem.id,
                            link.dataset.group || "world",
                            "browser"
                        );
                        window.location.assign(link.href);
                        return;
                    }
""",
)


# 4. Weak Spots keeps canonical URLs clean and communicates practice state through session intent.
replace_once(
    "src/js/weak_spots.js",
    """    function practiceUrl(stage) {
        return "/quizzes/" + stage.quizId + "/" + encodeURIComponent(stage.group) + "/?weakSpotsPractice=1";
    }

    function openPracticeStage(stage) {
        if (!stage || !root?.location) return;
        root.location.assign(practiceUrl(stage));
    }
""",
    """    function practiceUrl(stage) {
        return "/quizzes/" + stage.quizId + "/" + encodeURIComponent(stage.group) + "/";
    }

    function openPracticeStage(stage) {
        if (!stage || !root?.location) return;
        let stored = false;
        try {
            stored = Boolean(root.SmurdyQuizLaunchIntent?.store?.(
                stage.quizId,
                stage.group,
                "weak_spots"
            ));
        } catch (_) {}

        if (!stored) {
            try {
                session()?.setItem("smurdy-quiz-launch-v1", JSON.stringify({
                    version: 1,
                    quizId: stage.quizId,
                    groupId: stage.group,
                    reason: "weak_spots",
                    createdAt: Date.now()
                }));
            } catch (_) {}
        }
        root.location.assign(practiceUrl(stage));
    }
""",
)


# 5. Map runner consumes the launch intent after the landing page rebuilds the app shell.
replace_once(
    "src/js/quiz_runner.js",
    """    const weakSpotsPracticeStage = (() => {
        try {
            const requested = new URLSearchParams(window.location.search)
                .get("weakSpotsPractice") === "1";
            if (!requested) return null;
            return window.SmurdyWeakSpots?.getActivePracticeStage?.() || null;
        } catch (_) {
            return null;
        }
    })();
""",
    """    const quizLaunchIntent = (() => {
        try {
            return window.SmurdyQuizLaunchIntent?.consumeCurrent?.() || null;
        } catch (_) {
            return null;
        }
    })();

    const legacyWeakSpotsRequested = (() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const requested = params.get("weakSpotsPractice") === "1";
            if (requested) {
                params.delete("weakSpotsPractice");
                const query = params.toString();
                history.replaceState(
                    {},
                    "",
                    window.location.pathname + (query ? "?" + query : "") + window.location.hash
                );
            }
            return requested;
        } catch (_) {
            return false;
        }
    })();

    const weakSpotsPracticeStage = (() => {
        try {
            const requested = quizLaunchIntent?.reason === "weak_spots" || legacyWeakSpotsRequested;
            if (!requested) return null;
            const stage = window.SmurdyWeakSpots?.getActivePracticeStage?.() || null;
            if (!stage) return null;
            const route = String(window.location.pathname || "")
                .match(/^\/quizzes\/([^/]+)\/([^/]+)\/?$/);
            if (route) {
                if (stage.quizId && decodeURIComponent(route[1]) !== String(stage.quizId)) return null;
                if (stage.group && decodeURIComponent(route[2]) !== String(stage.group)) return null;
            }
            return stage;
        } catch (_) {
            return null;
        }
    })();
""",
)
replace_once(
    "src/js/quiz_runner.js",
    '    beginAnalyticsRun("initial");\n',
    '    beginAnalyticsRun(weakSpotsPracticeStage ? "weak_spots" : "initial");\n',
)


# 6. Map landing controller preserves the clean URL and only auto-launches for a matching intent.
quiz_landing = r'''(() => {
    "use strict";

    document.body.classList.add("smurdy-quiz-landing");

    if (!document.querySelector("link[data-smurdy-landing-polish]")) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "/styles/quiz_landing.css?v=20260827-landing-width-1";
        stylesheet.setAttribute("data-smurdy-landing-polish", "true");
        document.head.appendChild(stylesheet);
    }

    const launchButton = document.querySelector("[data-smurdy-quiz-launch]");
    if (!launchButton) return;

    function ensureScript(attribute, source) {
        return new Promise(resolve => {
            if (attribute === "data-smurdy-launch-intent" && window.SmurdyQuizLaunchIntent) {
                resolve();
                return;
            }
            if (attribute === "data-smurdy-analytics" && window.SmurdyAnalytics) {
                resolve();
                return;
            }

            let script = document.querySelector(`script[${attribute}]`);
            if (!script) {
                script = document.createElement("script");
                script.src = source;
                script.defer = true;
                script.setAttribute(attribute, "true");
                document.head.appendChild(script);
            }
            const finish = () => resolve();
            script.addEventListener("load", finish, { once: true });
            script.addEventListener("error", finish, { once: true });
        });
    }

    async function prepareInitialLaunchIntent() {
        await ensureScript(
            "data-smurdy-launch-intent",
            "/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1"
        );

        try {
            const params = new URLSearchParams(window.location.search);
            const legacyWeakSpots =
                params.get("weakSpotsPractice") === "1" &&
                Boolean(sessionStorage.getItem("smurdy-weak-spots-practice-v1"));

            if (legacyWeakSpots) {
                const route = window.SmurdyQuizLaunchIntent?.parseQuizPath?.(
                    window.location.pathname
                );
                if (route) {
                    window.SmurdyQuizLaunchIntent?.store?.(
                        route.quizId,
                        route.groupId,
                        "weak_spots"
                    );
                }
                params.delete("weakSpotsPractice");
                const query = params.toString();
                history.replaceState(
                    {},
                    "",
                    window.location.pathname +
                        (query ? "?" + query : "") +
                        window.location.hash
                );
            }
            return window.SmurdyQuizLaunchIntent?.peekCurrent?.() || null;
        } catch (_) {
            return null;
        }
    }

    async function trackLandingView() {
        await ensureScript(
            "data-smurdy-analytics",
            "/src/js/analytics.js?v=20260823-quiz-analytics-1"
        );
        window.SmurdyAnalytics?.trackLandingPageView?.({
            page_type: "quiz_landing"
        });
    }

    async function launchQuiz() {
        if (launchButton.disabled) return;

        const originalText = launchButton.textContent;
        launchButton.disabled = true;
        launchButton.textContent = "Loading quiz...";
        document.documentElement.setAttribute("aria-busy", "true");

        try {
            const response = await fetch("/", {
                credentials: "same-origin",
                headers: { "X-Smurdy-Quiz-Launch": "in-place" }
            });
            if (!response.ok) {
                throw new Error(`Could not load the quiz app (HTTP ${response.status}).`);
            }

            const appHtml = await response.text();
            if (!appHtml.includes('id="map"') || !appHtml.includes('/src/js/app.js')) {
                throw new Error("The quiz app shell was not found.");
            }

            document.open();
            document.write(appHtml);
            document.close();
        } catch (error) {
            console.error("Smurdy in-place quiz launch failed:", error);
            document.documentElement.removeAttribute("aria-busy");
            launchButton.disabled = false;
            launchButton.textContent = originalText;
            window.alert("The quiz could not load. Please try again.");
        }
    }

    launchButton.addEventListener("click", launchQuiz);

    void prepareInitialLaunchIntent().then(intent => {
        if (intent) requestAnimationFrame(launchQuiz);
        else void trackLandingView();
    });
})();

// smurdy-privacy-footer-link-v1
(() => {
    function addPrivacyLink() {
        const footer = document.querySelector("footer");
        if (!footer || footer.querySelector('a[href="/privacy/"], a[href$="/privacy/"]')) return;

        const separator = document.createTextNode(" · ");
        const link = document.createElement("a");
        link.href = "/privacy/";
        link.textContent = "Privacy";
        footer.append(separator, link);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", addPrivacyLink, { once: true });
    } else {
        addPrivacyLink();
    }
})();
'''
write("src/js/quiz_landing.js", quiz_landing)


# 7. Flag runner expands shared groups and only auto-starts for browser/Weak Spots intent.
replace_once(
    "src/js/flag_quiz.js",
    "        let retryWeakSpots = false;\n        let weakSpotsPracticeStage = null;\n",
    "        let retryWeakSpots = false;\n        let weakSpotsPracticeStage = null;\n        let initialLaunchIntent = null;\n",
)
replace_once(
    "src/js/flag_quiz.js",
    """        function getWeakSpotsPracticeStage() {
            try {
                const requested = new URLSearchParams(root.location?.search || "")
                    .get("weakSpotsPractice") === "1";
                if (!requested) return null;
                const stage = root.SmurdyWeakSpots?.getActivePracticeStage?.() || null;
                if (!stage || stage.quizId !== "type-flag") return null;
                if (String(stage.group || "") !== String(setId)) return null;
                return stage;
            } catch (_) {
                return null;
            }
        }
""",
    """        function getWeakSpotsPracticeStage() {
            try {
                if (initialLaunchIntent?.reason !== "weak_spots") return null;
                const stage = root.SmurdyWeakSpots?.getActivePracticeStage?.() || null;
                if (!stage || stage.quizId !== "type-flag") return null;
                if (String(stage.group || "") !== String(setId)) return null;
                return stage;
            } catch (_) {
                return null;
            }
        }
""",
)
replace_once(
    "src/js/flag_quiz.js",
    "                flagGroups = loadedFlagGroups || {};\n                allFlags = selectFlags(source, setId, flagGroups, countryGroups, aliases);\n",
    "                flagGroups = root.SmurdyFlagCatalog?.expandFlagGroups?.(loadedFlagGroups || {}, countryGroups) || loadedFlagGroups || {};\n"
    "                allFlags = selectFlags(source, setId, flagGroups, countryGroups, aliases);\n",
)
replace_once(
    "src/js/flag_quiz.js",
    """                startRun(
                    runFlags,
                    weakSpotsPracticeStage ? "weak_spots" : "start",
                    Boolean(weakSpotsPracticeStage)
                );
""",
    """                const startReason = weakSpotsPracticeStage
                    ? "weak_spots"
                    : (initialLaunchIntent?.reason === "browser" ? "browser" : "start");
                startRun(
                    runFlags,
                    startReason,
                    Boolean(weakSpotsPracticeStage)
                );
                initialLaunchIntent = null;
""",
)
replace_once(
    "src/js/flag_quiz.js",
    """        try {
            const path = String(root.location?.pathname || "");
            const params = new URLSearchParams(root.location?.search || "");
            if (/^\/quizzes\/type-flag\/[^/]+\/?$/.test(path) || params.get("weakSpotsPractice") === "1") {
                void launchQuiz();
            }
        } catch (_) {}
""",
    """        try {
            const params = new URLSearchParams(root.location?.search || "");
            const legacyWeakSpots =
                params.get("weakSpotsPractice") === "1" &&
                Boolean(root.sessionStorage?.getItem?.("smurdy-weak-spots-practice-v1"));

            if (legacyWeakSpots) {
                root.SmurdyQuizLaunchIntent?.store?.("type-flag", setId, "weak_spots");
                params.delete("weakSpotsPractice");
                const query = params.toString();
                root.history?.replaceState?.(
                    {},
                    "",
                    (root.location?.pathname || "") +
                        (query ? "?" + query : "") +
                        (root.location?.hash || "")
                );
            }

            initialLaunchIntent =
                root.SmurdyQuizLaunchIntent?.consumeCurrent?.() ||
                (legacyWeakSpots ? { reason: "weak_spots" } : null);

            if (initialLaunchIntent) {
                void launchQuiz();
            } else {
                root.SmurdyAnalytics?.trackLandingPageView?.({
                    page_type: "quiz_landing"
                });
            }
        } catch (_) {
            root.SmurdyAnalytics?.trackLandingPageView?.({
                page_type: "quiz_landing"
            });
        }
""",
)


# 8. Flag generator expands the shared catalog, clears stale flag routes, and refreshes sitemaps.
replace_once(
    "tools/generate_flag_pages.js",
    """const root = path.resolve(__dirname, "..");
const groups = readJson("src/data/flag_groups.json");
const countryGroups = readJson("src/data/country_groups.json");
const sources = readJson("src/data/flag_sources.json");
const aliases = readJson("src/data/aliases.json");
const flagApi = require(path.join(root, "src/js/flag_quiz.js"));
""",
    """const root = path.resolve(__dirname, "..");
const flagOverrides = readJson("src/data/flag_groups.json");
const countryGroups = readJson("src/data/country_groups.json");
const sources = readJson("src/data/flag_sources.json");
const aliases = readJson("src/data/aliases.json");
const flagApi = require(path.join(root, "src/js/flag_quiz.js"));
const { expandFlagGroups } = require(path.join(root, "src/js/flag_catalog.js"));
const { rebuildSitemaps } = require(path.join(root, "tools/rebuild_sitemaps.js"));
const groups = expandFlagGroups(flagOverrides, countryGroups);
""",
)
replace_once(
    "tools/generate_flag_pages.js",
    '  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png?v=20260825-logo-1">\n'
    '  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png?v=20260825-logo-1">',
    '  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png?v=20260825-logo-1">\n'
    '  <link rel="icon" type="image/png" sizes="48x48" href="/assets/images/favicon-48.png?v=20260825-logo-1">\n'
    '  <link rel="shortcut icon" href="/favicon.ico?v=20260825-logo-1">\n'
    '  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png?v=20260825-logo-1">',
)
replace_once(
    "tools/generate_flag_pages.js",
    """  <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>
  <script src="/src/js/weak_spots.js?v=20260826-ui-polish-1" defer></script>
  <script src="/src/js/quiz_library.js?v=20260828-quiz-library-1" defer></script>
  <script src="/src/js/flag_quiz.js?v=20260902-flag-quiz-5" defer></script>
""",
    """  <script src="/src/js/analytics.js?v=20260823-quiz-analytics-1" defer></script>
  <script src="/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1" defer></script>
  <script src="/src/js/flag_catalog.js?v=20260903-flag-parity-1" defer></script>
  <script src="/src/js/weak_spots.js?v=20260903-flag-parity-1" defer></script>
  <script src="/src/js/quiz_library.js?v=20260828-quiz-library-1" defer></script>
  <script src="/src/js/flag_quiz.js?v=20260903-flag-parity-1" defer></script>
""",
)

# Replace only the directory renderer, keeping the quiz-page template intact.
start = read("tools/generate_flag_pages.js").index("function directoryPage() {")
end = read("tools/generate_flag_pages.js").index("\nfs.mkdirSync(outputRoot", start)
new_directory = r'''function directoryPage() {
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
  <footer class="directory-footer">Smurdy geography quizzes. <a href="/">Home</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a> · <a href="/privacy/">Privacy</a></footer>
</body></html>`;
}
'''
text = read("tools/generate_flag_pages.js")
write("tools/generate_flag_pages.js", text[:start] + new_directory + text[end:])
replace_once(
    "tools/generate_flag_pages.js",
    'fs.mkdirSync(outputRoot, { recursive: true });\n',
    'fs.rmSync(outputRoot, { recursive: true, force: true });\nfs.mkdirSync(outputRoot, { recursive: true });\n',
)
replace_once(
    "tools/generate_flag_pages.js",
    'console.log(`Generated ${Object.keys(groups).length} flag quiz pages and the flag directory.`);',
    'rebuildSitemaps({ repoRoot: root, publicRoot: baseUrl });\n'
    'console.log(`Generated ${Object.keys(groups).length} flag quiz pages, the flag directory, and refreshed both sitemaps.`);',
)


# 9. Map generator uses the same expanded flag catalog for all-quizzes counts and the shared sitemap scanner.
replace_once(
    "tools/generate_quiz_pages.js",
    'const { getCanonicalCountryName } = require("../src/js/quiz_entities.js");\n',
    'const { getCanonicalCountryName } = require("../src/js/quiz_entities.js");\n'
    'const { expandFlagGroups } = require("../src/js/flag_catalog.js");\n'
    'const { rebuildSitemaps } = require("./rebuild_sitemaps.js");\n',
)
replace_once(
    "tools/generate_quiz_pages.js",
    '    const flagGroups = await readJson(flagGroupsPath, "flag_groups.json");\n',
    '    const flagGroupOverrides = await readJson(flagGroupsPath, "flag_groups.json");\n'
    '    const flagGroups = expandFlagGroups(flagGroupOverrides, groups);\n',
)
regex_once(
    "tools/generate_quiz_pages.js",
    r'async function writeSitemap\(\{ repoRoot, pages, publicRoot \}\) \{.*?\n\}',
    '''async function writeSitemap({ repoRoot, pages, publicRoot }) {
    void pages;
    rebuildSitemaps({ repoRoot, publicRoot });
}''',
)


# 10. Regression tests for the new shared contracts.
write(
    "tests/quiz_launch_intent.test.js",
    r'''const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createClient,
    parseQuizPath,
    STORAGE_KEY
} = require("../src/js/quiz_launch_intent.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
        has(key) { return values.has(key); }
    };
}

test("launch intents match an exact clean quiz route and are one-time", () => {
    const storage = memoryStorage();
    let now = 1000;
    let pathname = "/quizzes/type-flag/europe/";
    const client = createClient({ storage, now: () => now, pathname: () => pathname });

    assert.equal(client.store("type-flag", "europe", "browser"), true);
    assert.equal(client.peekCurrent().reason, "browser");
    pathname = "/quizzes/type-flag/asia/";
    assert.equal(client.peekCurrent(), null);
    pathname = "/quizzes/type-flag/europe/";
    assert.equal(client.consumeCurrent().groupId, "europe");
    assert.equal(client.consumeCurrent(), null);
    assert.equal(storage.has(STORAGE_KEY), false);
});

test("launch intents expire and parse canonical paths", () => {
    const storage = memoryStorage();
    let now = 1000;
    const client = createClient({
        storage,
        now: () => now,
        pathname: () => "/quizzes/type-country/world/"
    });
    client.store("TYPE-COUNTRY", "WORLD", "weak_spots");
    now += 6 * 60 * 1000;
    assert.equal(client.peekCurrent(), null);
    assert.deepEqual(parseQuizPath("/quizzes/type-flag/us_states/"), {
        quizId: "type-flag",
        groupId: "us_states"
    });
});
''',
)
write(
    "tests/flag_catalog.test.js",
    r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { expandFlagGroups } = require("../src/js/flag_catalog.js");

const root = path.resolve(__dirname, "..");
const overrides = JSON.parse(fs.readFileSync(path.join(root, "src/data/flag_groups.json"), "utf8"));
const countryGroups = JSON.parse(fs.readFileSync(path.join(root, "src/data/country_groups.json"), "utf8"));

test("flag country groups inherit every compatible map typing group", () => {
    const expanded = expandFlagGroups(overrides, countryGroups);
    const mapTypeGroups = Object.entries(countryGroups)
        .filter(([, group]) => !Array.isArray(group.allowedTypes) || group.allowedTypes.includes("type"))
        .map(([id]) => id);

    for (const id of mapTypeGroups) assert.ok(expanded[id], id);
    assert.equal(expanded.world.memberCount, countryGroups.world.memberCount);
    assert.equal(expanded.asia.memberCount, countryGroups.asia.countries.length);
    assert.equal(expanded.balkans.sourceGroup, "balkans");
    assert.equal(expanded.us_states.family, "subdivisions");
});
''',
)

replace_once(
    "tests/flag_quiz.test.js",
    'const countryAliases = JSON.parse(fs.readFileSync(path.join(root, "src/data/aliases.json"), "utf8"));\n',
    'const countryAliases = JSON.parse(fs.readFileSync(path.join(root, "src/data/aliases.json"), "utf8"));\n'
    'const { expandFlagGroups } = require(path.join(root, "src/js/flag_catalog.js"));\n'
    'const expandedFlagGroups = expandFlagGroups(flagGroups, countryGroups);\n',
)
replace_once("tests/flag_quiz.test.js", "    assert.equal(world.length, 200);\n", "    assert.equal(world.length, 201);\n")
replace_once(
    "tests/flag_quiz.test.js",
    '    assert.ok(world.some(flag => flag.name === "Oman"));\n',
    '    assert.ok(world.some(flag => flag.name === "Oman"));\n'
    '    assert.ok(world.some(flag => flag.name === "Palestine"));\n',
)
replace_once("tests/flag_quiz.test.js", "    assert.equal(new Set(flags.map(flag => flag.id)).size, 250);\n", "    assert.equal(new Set(flags.map(flag => flag.id)).size, 251);\n")
replace_once("tests/flag_quiz.test.js", "        asia: 50,\n", "        asia: 51,\n")
replace_once(
    "tests/flag_quiz.test.js",
    "            flagGroups,\n            countryGroups,\n",
    "            expandedFlagGroups,\n            countryGroups,\n",
)
replace_once(
    "tests/flag_quiz.test.js",
    '    const world = api.selectFlags(sources, "world", flagGroups, countryGroups, countryAliases);\n',
    '    const world = api.selectFlags(sources, "world", expandedFlagGroups, countryGroups, countryAliases);\n',
)
replace_once(
    "tests/flag_quiz.test.js",
    '        assert.match(html, /flag_quiz\\.js\\?v=20260902-flag-quiz-5/);\n',
    '        assert.match(html, /flag_quiz\\.js\\?v=20260903-flag-parity-1/);\n'
    '        assert.match(html, /quiz_launch_intent\\.js/);\n'
    '        assert.match(html, /flag_catalog\\.js/);\n',
)
replace_once(
    "tests/flag_quiz.test.js",
    '    assert.match(directory, /<h2>Subdivisions<\\/h2>/);\n',
    '    assert.match(directory, /<h2>Regional sets<\\/h2>/);\n'
    '    assert.match(directory, /directory-card-title">Middle East/);\n'
    '    assert.match(directory, /<h2>Subdivisions<\\/h2>/);\n',
)

replace_once(
    "tests/sync_wikimedia_flags.test.js",
    '  const countries = {\n    features: [{ properties: { NAME: "Example", ISO_A2: "EX", WIKIDATAID: "Q1" } }],\n  };\n',
    '  const countries = {\n'
    '    features: [\n'
    '      { properties: { NAME: "Example", ISO_A2: "EX", WIKIDATAID: "Q1" } },\n'
    '      { properties: { NAME: "Palestine", ADMIN: "Palestine", ISO_A2: "PS", WIKIDATAID: "Q219060" } },\n'
    '    ],\n'
    '  };\n',
)
replace_once(
    "tests/sync_wikimedia_flags.test.js",
    '    { kind: "country", name: "Example", code: "ex", qid: "Q1", filename: "ex.svg" },\n    {\n      kind: "us-state",\n',
    '    { kind: "country", name: "Example", code: "ex", qid: "Q1", filename: "ex.svg" },\n'
    '    { kind: "country", name: "Palestine", code: "ps", qid: "Q219060", filename: "ps.svg" },\n'
    '    {\n      kind: "us-state",\n',
)

replace_once(
    "tests/quiz_library.test.js",
    '    assert.doesNotMatch(browse, /\\?play=1/);\n',
    '    assert.doesNotMatch(browse, /\\?play=1/);\n'
    '    assert.match(browse, /SmurdyQuizLaunchIntent\\?\\.store/);\n',
)
replace_once(
    "tests/quiz_library.test.js",
    '    assert.equal(countryGroups.world.memberCount, 201);\n',
    '    assert.equal(countryGroups.world.memberCount, 201);\n'
    '    assert.equal(flagGroups.world.memberCount, 201);\n',
)

print("Flag parity source migration applied.")
