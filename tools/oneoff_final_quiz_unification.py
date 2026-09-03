from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20260903-final-unity-1"


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: pattern did not match exactly once: {pattern[:120]!r}")
    write(path, text)


# ---------------------------------------------------------------------------
# Manifest: make product taxonomy and renderer modality explicit.
# ---------------------------------------------------------------------------
manifest = read("src/js/manifest.js")
entries = {
    "click-country": ("maps", "click", "map", "countries"),
    "type-country": ("maps", "type", "map", "countries"),
    "find-country": ("maps", "find", "map", "countries"),
    "find-point": ("maps", "find-point", "map", "countries"),
    "click-subdivision": ("maps", "click", "map", "subdivisions"),
    "type-subdivision": ("maps", "type", "map", "subdivisions"),
    "find-subdivision": ("maps", "find", "map", "subdivisions"),
    "find-point-subdivision": ("maps", "find-point", "map", "subdivisions"),
}
for quiz_id, (category, interaction, modality, family) in entries.items():
    pattern = rf'(id: "{re.escape(quiz_id)}",[\s\S]*?\n\s+(?:type|interaction): "[^"]+",)(\n)'
    match = re.search(pattern, manifest)
    if not match:
        raise RuntimeError(f"manifest: could not find {quiz_id}")
    block_start = match.start()
    next_id = manifest.find('\n    {\n        id: "', match.end())
    block_end = next_id if next_id >= 0 else len(manifest)
    block = manifest[block_start:block_end]
    if 'modality:' in block:
        continue
    addition = (
        match.group(1) +
        f'\n        category: "{category}",' +
        f'\n        interaction: "{interaction}",' +
        f'\n        modality: "{modality}",' +
        f'\n        families: ["{family}"],' +
        match.group(2)
    )
    manifest = manifest[:match.start()] + addition + manifest[match.end():]

# Existing flag definitions already declare most taxonomy; add renderer modality.
manifest = manifest.replace(
    '        type: "type",\n        category: "flags",',
    '        type: "type",\n        interaction: "type",\n        modality: "flag",\n        category: "flags",',
    1
)
manifest = manifest.replace(
    '        interaction: "locate",\n        category: "flags",',
    '        interaction: "locate",\n        modality: "flag",\n        category: "flags",',
    1
)
if manifest.count('modality: "map"') != 8 or manifest.count('modality: "flag"') != 2:
    raise RuntimeError("manifest modality coverage is incomplete")
write("src/js/manifest.js", manifest)


# ---------------------------------------------------------------------------
# Homepage bootstrap: manifest -> normalized definitions -> runtime.
# ---------------------------------------------------------------------------
replace_once(
    "index.html",
    '''     <script src="/src/js/quiz_library.js?v=20260828-quiz-library-1" defer></script>\n  <script src="/src/js/app.js?v=20260828-quiz-library-1" defer></script>\n     <script src="/src/js/manifest.js?v=20260722-independent-menu-control-1" defer></script>\n     <script src="/src/js/browse.js?v=20260903-flag-parity-1" defer></script>''',
    f'''     <script src="/src/js/quiz_library.js?v={VERSION}" defer></script>\n     <script src="/src/js/manifest.js?v={VERSION}" defer></script>\n     <script src="/src/js/quiz_definitions.js?v={VERSION}" defer></script>\n     <script src="/src/js/app.js?v={VERSION}" defer></script>\n     <script src="/src/js/browse.js?v={VERSION}" defer></script>'''
)


# ---------------------------------------------------------------------------
# Bootstrap URL logic: use QuizDefinition registry, retain small fallback.
# ---------------------------------------------------------------------------
app = read("src/js/app.js")
app = app.replace('const ASSET_VERSION = "20260902-quiz-entities-1";', f'const ASSET_VERSION = "{VERSION}";')
old_block = '''    const supportedQuizIds = new Set([\n        "click-country",\n        "type-country",\n        "find-country",\n        "find-point",\n        "click-subdivision",\n        "type-subdivision",\n        "find-subdivision",\n        "find-point-subdivision"\n    ]);\n    const subdivisionAliases = {\n        "click-country": "click-subdivision",\n        "type-country": "type-subdivision",\n        "find-country": "find-subdivision",\n        "find-point": "find-point-subdivision"\n    };'''
new_block = '''    const quizDefinitions = window.SmurdyQuizDefinitions || null;\n    const supportedQuizIds = new Set(\n        quizDefinitions?.list?.()\n            .filter(definition => definition.playable && definition.modality === "map")\n            .map(definition => definition.id) ||\n        [\n            "click-country", "type-country", "find-country", "find-point",\n            "click-subdivision", "type-subdivision", "find-subdivision",\n            "find-point-subdivision"\n        ]\n    );'''
if old_block not in app:
    raise RuntimeError("app.js: legacy supported quiz block not found")
app = app.replace(old_block, new_block, 1)
old_legacy = '''        if (!supportedQuizIds.has(quizId)) return null;\n\n        const subdivisionRequest =\n            quizId.includes("subdivision") ||\n            urlParams.get("groupSet") === "subdivision_groups" ||\n            urlParams.get("mode") === "states";\n\n        if (subdivisionRequest && subdivisionAliases[quizId]) {\n            quizId = subdivisionAliases[quizId];\n        }\n\n        return quizId;'''
new_legacy = '''        const sharedId = quizDefinitions?.resolveLegacyQuizId?.(quizId, {\n            groupSet: urlParams.get("groupSet"),\n            mode: urlParams.get("mode")\n        });\n        if (sharedId) return sharedId;\n        return supportedQuizIds.has(quizId) ? quizId : null;'''
if old_legacy not in app:
    raise RuntimeError("app.js: legacy id resolver not found")
app = app.replace(old_legacy, new_legacy, 1)
old_sub = '''    const cleanUsesSubdivisions = Boolean(\n        cleanQuizId && cleanQuizId.includes("subdivision")\n    );'''
new_sub = '''    const cleanDefinition = cleanQuizId\n        ? quizDefinitions?.get?.(cleanQuizId)\n        : null;\n    const cleanUsesSubdivisions = Boolean(\n        cleanDefinition?.family === "subdivisions" ||\n        (cleanQuizId && cleanQuizId.includes("subdivision"))\n    );'''
if old_sub not in app:
    raise RuntimeError("app.js: subdivision inference anchor not found")
app = app.replace(old_sub, new_sub, 1)
write("src/js/app.js", app)


# ---------------------------------------------------------------------------
# Browser: make normalized definitions authoritative while retaining fallbacks.
# ---------------------------------------------------------------------------
browse = read("src/js/browse.js")
anchor = '    let baseManifest = window.SmurdyQuizManifest || [];\n'
if browse.count(anchor) != 1:
    raise RuntimeError("browse.js: manifest anchor missing")
browse = browse.replace(anchor, anchor + '''\n    function normalizedDefinition(item) {\n        return window.SmurdyQuizDefinitions?.normalize?.(item) || null;\n    }\n''', 1)

# landing path: shared registry first.
old_path_start = '''    function quizLandingPath(manifestItemOrId, groupId) {\n        const rawQuizId = typeof manifestItemOrId === "string"'''
new_path_start = '''    function quizLandingPath(manifestItemOrId, groupId) {\n        const sharedPath = window.SmurdyQuizDefinitions?.landingPath?.(\n            manifestItemOrId,\n            groupId\n        );\n        if (sharedPath) return sharedPath;\n\n        const rawQuizId = typeof manifestItemOrId === "string"'''
if old_path_start not in browse:
    raise RuntimeError("browse.js: landing path anchor missing")
browse = browse.replace(old_path_start, new_path_start, 1)

for function_name, field in [
    ("categoryKeyForManifest", "category"),
    ("interactionKeyForManifest", "interaction"),
    ("familyKeyForManifest", "family")
]:
    signature = f'    function {function_name}(item) {{\n'
    if browse.count(signature) != 1:
        raise RuntimeError(f"browse.js: {function_name} signature missing")
    browse = browse.replace(
        signature,
        signature + f'        const shared = normalizedDefinition(item);\n        if (shared?.{field}) return shared.{field};\n\n',
        1
    )

sig = '    function familyKeysForManifest(item) {\n'
if browse.count(sig) != 1:
    raise RuntimeError("browse.js: familyKeysForManifest signature missing")
browse = browse.replace(sig, sig + '''        const shared = normalizedDefinition(item);\n        if (shared?.families?.length) return Array.from(shared.families);\n\n''', 1)

sig = '    function manifestIsPlayable(item) {\n'
if browse.count(sig) != 1:
    raise RuntimeError("browse.js: manifestIsPlayable signature missing")
browse = browse.replace(sig, sig + '''        const shared = normalizedDefinition(item);\n        if (shared) return shared.playable;\n''', 1)

old_ready = '''            const isFlagQuiz = manifestItem &&\n                categoryKeyForManifest(manifestItem) === "flags";'''
new_ready = '''            const definition = normalizedDefinition(manifestItem);\n            const requiresMenuMap = definition\n                ? definition.adapter.requiresMenuMap\n                : categoryKeyForManifest(manifestItem) !== "flags";'''
if old_ready not in browse:
    raise RuntimeError("browse.js: launch-ready modality anchor missing")
browse = browse.replace(old_ready, new_ready, 1)
browse = browse.replace('            if (ready || isFlagQuiz) {', '            if (ready || !requiresMenuMap) {', 1)

old_click = '''                    // Flag quizzes use their own image-first game shell rather\n                    // than the MapLibre app, so open the crawlable flag page.\n                    if (categoryKeyForManifest(manifestItem) === "flags") {'''
new_click = '''                    const definition = normalizedDefinition(manifestItem);\n\n                    // Non-map modalities own their own game surface. The adapter\n                    // decides that here instead of the browser naming a specific mode.\n                    if (definition?.modality !== "map") {'''
if old_click not in browse:
    raise RuntimeError("browse.js: flag click special case anchor missing")
browse = browse.replace(old_click, new_click, 1)
write("src/js/browse.js", browse)


# ---------------------------------------------------------------------------
# Map app loader: guard the map runner with the modality adapter.
# ---------------------------------------------------------------------------
core = read("src/js/app_core.js")
core = re.sub(r'const APP_VERSION = "[^"]+";', 'const APP_VERSION = "1.13.8";', core, count=1)
old_manifest_lookup = '''                manifestDef = (window.SmurdyQuizManifest || []).find(m => m.id === id) || null;'''
new_manifest_lookup = '''                manifestDef =\n                    window.SmurdyQuizDefinitions?.getManifest?.(id) ||\n                    (window.SmurdyQuizManifest || []).find(m => m.id === id) ||\n                    null;\n                const definition = window.SmurdyQuizDefinitions?.get?.(id) || null;\n                if (definition && definition.modality !== "map") {\n                    const path = window.SmurdyQuizDefinitions?.landingPath?.(\n                        id,\n                        this.currentGroupId || quizGroupId\n                    );\n                    if (path) location.assign(path);\n                    return;\n                }'''
if core.count(old_manifest_lookup) < 1:
    raise RuntimeError("app_core.js: manifest lookup anchor missing")
core = core.replace(old_manifest_lookup, new_manifest_lookup, 1)
# Later lookup after runner load also uses the registry.
old_later = '                    let def = (window.SmurdyQuizManifest || []).find(m => m.id === id);'
new_later = '''                    let def =\n                        window.SmurdyQuizDefinitions?.getManifest?.(id) ||\n                        (window.SmurdyQuizManifest || []).find(m => m.id === id);'''
if old_later not in core:
    raise RuntimeError("app_core.js: later manifest lookup missing")
core = core.replace(old_later, new_later, 1)
write("src/js/app_core.js", core)


# ---------------------------------------------------------------------------
# Shared landing runtime: one favorite control and one launch-intent owner.
# ---------------------------------------------------------------------------
landing_runtime = r'''(() => {
    "use strict";

    const body = document.body;
    if (!body) return;
    body.classList.add("smurdy-quiz-landing");

    const route = String(location.pathname || "").match(
        /^\/quizzes\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i
    );
    const quizId = body.dataset.quizId || (route ? route[1] : "");
    const groupId = body.dataset.quizGroup || body.dataset.flagSet || (route ? route[2] : "world");
    const definition = window.SmurdyQuizDefinitions?.get?.(quizId) || null;
    const modality = body.dataset.quizModality || definition?.modality || "map";
    const launchButton = document.querySelector(
        "[data-smurdy-quiz-launch], [data-flag-launch]"
    );
    const favoriteButton = document.querySelector(
        "[data-smurdy-quiz-favorite], [data-flag-favorite]"
    );

    function ensureScript(attribute, source, ready) {
        return new Promise(resolve => {
            if (ready?.()) {
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
            script.addEventListener("load", resolve, { once: true });
            script.addEventListener("error", resolve, { once: true });
        });
    }

    async function ensureLibrary() {
        if (window.SmurdyQuizLibrary) return;
        await ensureScript(
            "data-smurdy-quiz-library",
            "/src/js/quiz_library.js?v=20260903-final-unity-1",
            () => Boolean(window.SmurdyQuizLibrary)
        );
    }

    function syncFavorite() {
        if (!favoriteButton || !quizId || !groupId) return;
        const saved = Boolean(
            window.SmurdyQuizLibrary?.isFavorite?.(quizId, groupId)
        );
        favoriteButton.setAttribute("aria-pressed", String(saved));
        favoriteButton.textContent = saved ? "★ Favorited" : "☆ Add to favorites";
    }

    async function prepareFavorite() {
        if (!favoriteButton) return;
        await ensureLibrary();
        syncFavorite();
        favoriteButton.addEventListener("click", () => {
            window.SmurdyQuizLibrary?.toggleFavorite?.(quizId, groupId);
            syncFavorite();
        });
        window.addEventListener("smurdy:quiz-library-change", syncFavorite);
    }

    async function prepareInitialLaunchIntent() {
        await ensureScript(
            "data-smurdy-launch-intent",
            "/src/js/quiz_launch_intent.js?v=20260903-final-unity-1",
            () => Boolean(window.SmurdyQuizLaunchIntent)
        );

        try {
            const params = new URLSearchParams(location.search);
            const legacyWeakSpots =
                params.get("weakSpotsPractice") === "1" &&
                Boolean(sessionStorage.getItem("smurdy-weak-spots-practice-v1"));

            if (legacyWeakSpots) {
                window.SmurdyQuizLaunchIntent?.store?.(
                    quizId,
                    groupId,
                    "weak_spots"
                );
                params.delete("weakSpotsPractice");
                const query = params.toString();
                history.replaceState(
                    {},
                    "",
                    location.pathname +
                        (query ? "?" + query : "") +
                        location.hash
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
            "/src/js/analytics.js?v=20260823-quiz-analytics-1",
            () => Boolean(window.SmurdyAnalytics)
        );
        window.SmurdyAnalytics?.trackLandingPageView?.({
            page_type: "quiz_landing",
            quiz_mode: quizId,
            quiz_group: groupId
        });
    }

    async function launchMapQuiz() {
        const originalText = launchButton?.textContent || "Open quiz";
        if (launchButton?.disabled) return;
        if (launchButton) {
            launchButton.disabled = true;
            launchButton.textContent = "Loading quiz...";
        }
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
            if (launchButton) {
                launchButton.disabled = false;
                launchButton.textContent = originalText;
            }
            window.alert("The quiz could not load. Please try again.");
        }
    }

    async function launchQuiz(intent = null) {
        if (!launchButton) return;
        if (modality === "flag") {
            const controller = window.SmurdyFlagQuizController;
            if (!controller?.launchQuiz) {
                console.error("Flag quiz controller is not ready.");
                return;
            }
            await controller.launchQuiz({ launchIntent: intent });
            return;
        }
        await launchMapQuiz();
    }

    launchButton?.addEventListener("click", () => {
        void launchQuiz(null);
    });
    void prepareFavorite();

    void prepareInitialLaunchIntent().then(intent => {
        if (intent) requestAnimationFrame(() => void launchQuiz(intent));
        else void trackLandingView();
    });
})();
'''
write("src/js/quiz_landing.js", landing_runtime)


# ---------------------------------------------------------------------------
# Flag runner: expose its controller; shared landing runtime owns launch/favorite.
# ---------------------------------------------------------------------------
flag = read("src/js/flag_quiz.js")
old_wrapper = '    const start = () => api.mount(root.document, root);'
new_wrapper = '    const start = () => { root.SmurdyFlagQuizController = api.mount(root.document, root); };'
if old_wrapper not in flag:
    raise RuntimeError("flag_quiz.js: mount wrapper anchor missing")
flag = flag.replace(old_wrapper, new_wrapper, 1)
flag = flag.replace(
    '        const launch = document.querySelector("[data-flag-launch]");',
    '        const launch = document.querySelector("[data-smurdy-quiz-launch], [data-flag-launch]");',
    1
)
flag = flag.replace('        const favorite = document.querySelector("[data-flag-favorite]");\n', '', 1)
regex = r'''\n        function updateFavoriteButton\(\) \{[\s\S]*?\n        \}\n'''
flag, count = re.subn(regex, '\n', flag, count=1)
if count != 1:
    raise RuntimeError("flag_quiz.js: favorite helper not found")
flag = flag.replace('        async function launchQuiz() {\n            if (launch.disabled) return;', '''        async function launchQuiz(options = {}) {\n            if (launch.disabled) return;\n            try {\n                const consumed = root.SmurdyQuizLaunchIntent?.consumeCurrent?.() || null;\n                initialLaunchIntent = options.launchIntent || consumed || null;\n            } catch (_) {\n                initialLaunchIntent = options.launchIntent || null;\n            }''', 1)
flag = flag.replace('        launch.addEventListener("click", launchQuiz);\n', '', 1)
regex = r'''\n        favorite\?\.addEventListener\("click", \(\) => \{[\s\S]*?\n        \}\);\n        updateFavoriteButton\(\);\n'''
flag, count = re.subn(regex, '\n', flag, count=1)
if count != 1:
    raise RuntimeError("flag_quiz.js: favorite listener not found")
# Remove old landing intent/analytics owner from the bottom of mount().
start_marker = '        try {\n            const params = new URLSearchParams(root.location?.search || "");'
end_marker = '\n\n        return { launchQuiz, restartQuiz: restartCurrentRun };'
start = flag.find(start_marker)
end = flag.find(end_marker, start)
if start < 0 or end < 0:
    raise RuntimeError("flag_quiz.js: old startup intent block not found")
flag = flag[:start] + flag[end:]
write("src/js/flag_quiz.js", flag)


# ---------------------------------------------------------------------------
# Shared shell is consumed by BOTH generators.
# ---------------------------------------------------------------------------
replace_once(
    "tools/generate_quiz_pages.js",
    'const { rebuildSitemaps } = require("./rebuild_sitemaps.js");',
    'const { rebuildSitemaps } = require("./rebuild_sitemaps.js");\nconst pageShell = require("./quiz_page_shell.js");'
)
mapgen = read("tools/generate_quiz_pages.js")
insert_anchor = '            const pageHtml = `<!doctype html>'
if mapgen.count(insert_anchor) != 1:
    raise RuntimeError("generate_quiz_pages.js: pageHtml anchor missing")
shared_vars = '''            const sharedStylesHtml = pageShell.renderSharedStyles(publicRoot);\n            const brandHtml = pageShell.renderBrand({ root: publicRoot, className: "panel-brand" });\n            const actionsHtml = pageShell.renderLandingActions({\n                root: publicRoot,\n                quizId: manifestId,\n                groupId,\n                className: "action-row",\n                buttonClass: "qb-btn",\n                includeHome: true\n            });\n            const footerHtml = pageShell.renderFooter({ root: publicRoot });\n            const landingScriptsHtml = pageShell.renderLandingScripts({ root: publicRoot });\n\n'''
mapgen = mapgen.replace(insert_anchor, shared_vars + insert_anchor, 1)
# Shared CSS replaces the generator's giant duplicate inline shell CSS.
pattern = r'''  <link rel="stylesheet" href="\$\{publicRoot\}/styles/quiz_landing\.css\?v=20260827-landing-width-1"/>\n  <style>\n[\s\S]*?\n  </style>'''
replacement = f'''  ${{sharedStylesHtml}}\n  <link rel="stylesheet" href="${{publicRoot}}/styles/quiz_landing.css?v={VERSION}"/>'''
mapgen, count = re.subn(pattern, replacement, mapgen, count=1)
if count != 1:
    raise RuntimeError("generate_quiz_pages.js: inline landing CSS block not found")
mapgen = mapgen.replace(
    '<body>\n  <a class="panel-brand" href="${publicRoot}/" title="Smurdy">\n    <img src="/assets/images/smurdeye-transparent.png?v=20260825-logo-1" alt="Smurdy logo"/>\n    <div class="brand-text">Smurdy</div>\n  </a>',
    '<body data-smurdy-quiz-page data-quiz-id="${escapeHtml(manifestId)}" data-quiz-group="${escapeHtml(groupId)}" data-quiz-modality="map">\n  ${brandHtml}',
    1
)
old_actions = '''    <div class="action-row">\n      <button class="qb-btn primary" type="button" data-smurdy-quiz-launch>Open quiz</button>\n      <a class="qb-btn secondary" href="${publicRoot}/quizzes/">Browse all quizzes</a>\n      <a class="qb-btn secondary" href="${publicRoot}/">Back to home</a>\n    </div>'''
if old_actions not in mapgen:
    raise RuntimeError("generate_quiz_pages.js: action row not found")
mapgen = mapgen.replace(old_actions, '    ${actionsHtml}', 1)
old_footer = '''  <footer>Smurdy geography quizzes. <a href="${publicRoot}/">Home</a> · <a href="${publicRoot}/about/">About</a> · <a href="${publicRoot}/contact/">Contact</a> · <a href="${publicRoot}/privacy/">Privacy</a></footer>\n  <script src="/src/js/quiz_landing.js?v=20260827-landing-width-1" defer></script>'''
if old_footer not in mapgen:
    raise RuntimeError("generate_quiz_pages.js: footer/scripts anchor not found")
mapgen = mapgen.replace(old_footer, '  ${footerHtml}\n  ${landingScriptsHtml}', 1)
write("tools/generate_quiz_pages.js", mapgen)

replace_once(
    "tools/generate_flag_pages.js",
    'const { rebuildSitemaps } = require(path.join(root, "tools/rebuild_sitemaps.js"));',
    'const { rebuildSitemaps } = require(path.join(root, "tools/rebuild_sitemaps.js"));\nconst pageShell = require(path.join(root, "tools/quiz_page_shell.js"));'
)
flaggen = read("tools/generate_flag_pages.js")
anchor = '    const heading = `${group.shortLabel} Flag Quiz`;\n\n    return `<!doctype html>'
if flaggen.count(anchor) != 1:
    raise RuntimeError("generate_flag_pages.js: quizPage return anchor missing")
vars_block = '''    const heading = `${group.shortLabel} Flag Quiz`;\n    const sharedStylesHtml = pageShell.renderSharedStyles();\n    const brandHtml = pageShell.renderBrand({ className: "flag-brand" });\n    const actionsHtml = pageShell.renderLandingActions({\n        quizId: "type-flag",\n        groupId,\n        className: "flag-actions",\n        buttonClass: "flag-button"\n    });\n    const footerHtml = pageShell.renderFooter({ className: "flag-footer" });\n    const landingScriptsHtml = pageShell.renderLandingScripts();\n\n    return `<!doctype html>'''
flaggen = flaggen.replace(anchor, vars_block, 1)
flaggen = flaggen.replace(
    '  <link rel="stylesheet" href="/styles/flag_quiz.css?v=20260902-flag-quiz-4">',
    f'  ${{sharedStylesHtml}}\n  <link rel="stylesheet" href="/styles/flag_quiz.css?v={VERSION}">',
    1
)
flaggen = flaggen.replace(
    '<body data-flag-set="${escapeHtml(groupId)}">\n  <a class="flag-brand" href="/" aria-label="Smurdy home">\n    <img src="/assets/images/smurdeye-transparent.png?v=20260825-logo-1" alt=""><span>Smurdy</span>\n  </a>',
    '<body data-smurdy-quiz-page data-quiz-id="type-flag" data-quiz-group="${escapeHtml(groupId)}" data-quiz-modality="flag" data-flag-set="${escapeHtml(groupId)}">\n  ${brandHtml}',
    1
)
old_flag_actions = '''        <div class="flag-actions">\n          <button class="flag-button primary" type="button" data-flag-launch>Open quiz</button>\n          <button class="flag-button favorite" type="button" data-flag-favorite aria-pressed="false">☆ Add to favorites</button>\n          <a class="flag-button" href="/quizzes/">Browse all quizzes</a>\n        </div>'''
if old_flag_actions not in flaggen:
    raise RuntimeError("generate_flag_pages.js: landing actions not found")
flaggen = flaggen.replace(old_flag_actions, '        ${actionsHtml}', 1)
old_flag_footer = '''  <footer class="flag-footer">Smurdy geography quizzes. <a href="/">Home</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a> · <a href="/privacy/">Privacy</a></footer>'''
if old_flag_footer not in flaggen:
    raise RuntimeError("generate_flag_pages.js: footer not found")
flaggen = flaggen.replace(old_flag_footer, '  ${footerHtml}', 1)
flaggen = flaggen.replace(
    '  <script src="/src/js/flag_quiz.js?v=20260903-completion-1" defer></script>\n</body>',
    f'  <script src="/src/js/flag_quiz.js?v={VERSION}" defer></script>\n  ${{landingScriptsHtml}}\n</body>',
    1
)
write("tools/generate_flag_pages.js", flaggen)


# ---------------------------------------------------------------------------
# Landing CSS now contains only map-page-specific details; shared shell owns base.
# ---------------------------------------------------------------------------
landing_css = '''body.smurdy-quiz-landing .content-section + .content-section {\n    padding-top: 2px;\n}\n\nbody.smurdy-quiz-landing .examples ul {\n    margin: 8px 0;\n    padding-left: 22px;\n}\n\nbody.smurdy-quiz-landing .mode-specific {\n    padding: 0;\n    background: transparent;\n}\n\nbody.smurdy-quiz-landing .link-block {\n    margin: 20px 0;\n}\n\nbody.smurdy-quiz-landing .link-block h3 {\n    margin: 0 0 8px;\n    font-size: 17px;\n}\n'''
write("styles/quiz_landing.css", landing_css)


# ---------------------------------------------------------------------------
# Tests for definition adapters, shared shell, and landing Favorites parity.
# ---------------------------------------------------------------------------
definition_test = r'''const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const definitions = require(path.join(root, "src/js/quiz_definitions.js"));
const shell = require(path.join(root, "tools/quiz_page_shell.js"));

function loadManifest() {
    const source = fs.readFileSync(path.join(root, "src/js/manifest.js"), "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.SmurdyQuizManifest;
}

const manifest = loadManifest();
const registry = definitions.createRegistry(() => manifest);

test("quiz definitions expose explicit modality adapters", () => {
    const click = registry.get("click-country");
    assert.equal(click.category, "maps");
    assert.equal(click.interaction, "click");
    assert.equal(click.family, "countries");
    assert.equal(click.modality, "map");
    assert.equal(click.adapter.requiresMenuMap, true);

    const states = registry.get("type-subdivision");
    assert.equal(states.family, "subdivisions");
    assert.deepEqual(Array.from(states.families), ["subdivisions"]);

    const flags = registry.get("type-flag");
    assert.equal(flags.category, "flags");
    assert.equal(flags.interaction, "type");
    assert.equal(flags.modality, "flag");
    assert.equal(flags.adapter.requiresMenuMap, false);
    assert.deepEqual(Array.from(flags.families), ["countries", "subdivisions"]);
});

test("definition registry owns canonical paths and legacy subdivision aliases", () => {
    assert.equal(
        registry.landingPath("type-flag", "south_america"),
        "/quizzes/type-flag/south_america/"
    );
    assert.equal(
        registry.resolveLegacyQuizId("click-country", { groupSet: "subdivision_groups" }),
        "click-subdivision"
    );
});

test("shared landing shell exposes one launch and favorite contract", () => {
    const actions = shell.renderLandingActions({
        quizId: "click-country",
        groupId: "europe",
        buttonClass: "qb-btn"
    });
    assert.match(actions, /data-smurdy-quiz-launch/);
    assert.match(actions, /data-smurdy-quiz-favorite/);
    assert.match(actions, /☆ Add to favorites/);
    assert.doesNotMatch(shell.renderFooter(), /·/);
});

test("map and flag landing pages use the shared shell and Favorite control", () => {
    const map = fs.readFileSync(
        path.join(root, "quizzes/click-country/europe/index.html"),
        "utf8"
    );
    const flags = fs.readFileSync(
        path.join(root, "quizzes/type-flag/europe/index.html"),
        "utf8"
    );

    for (const html of [map, flags]) {
        assert.match(html, /styles\/quiz_shared\.css/);
        assert.match(html, /data-smurdy-quiz-page/);
        assert.match(html, /data-smurdy-quiz-favorite/);
        assert.match(html, /src\/js\/quiz_definitions\.js/);
        assert.match(html, /src\/js\/quiz_landing\.js/);
    }
    assert.match(map, /data-quiz-modality="map"/);
    assert.match(flags, /data-quiz-modality="flag"/);
});
'''
write("tests/quiz_definitions.test.js", definition_test)

# Existing generated-page assertions should follow the shared contract/cache version.
flag_test = read("tests/flag_quiz.test.js")
flag_test = flag_test.replace(
    'assert.match(html, /flag_quiz\\.js\\?v=20260903-completion-1/);',
    'assert.match(html, /flag_quiz\\.js\\?v=20260903-final-unity-1/);'
)
flag_test = flag_test.replace(
    'assert.match(html, /data-flag-favorite/);',
    'assert.match(html, /data-smurdy-quiz-favorite/);'
)
write("tests/flag_quiz.test.js", flag_test)

# Browser regression now asserts adapter use rather than a flag-specific readiness branch.
library_test = read("tests/quiz_library.test.js")
library_test = library_test.replace(
    '    assert.match(browse, /ready \\|\\| isFlagQuiz/);',
    '    assert.match(browse, /definition\\.adapter\\.requiresMenuMap/);'
)
write("tests/quiz_library.test.js", library_test)

print("Final quiz unification migration applied.")
