from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Shared rendering primitive: the top CTA is intentionally launch-only, while
# renderLandingActions remains the full bottom action row.
replace_once(
    "tools/quiz_page_shell.js",
    'const ASSET_VERSION = "20260903-final-unity-1";',
    'const ASSET_VERSION = "20260903-landing-control-parity-1";'
)

replace_once(
    "tools/quiz_page_shell.js",
    '''function renderLandingActions({
    root = "",
    quizId,
    groupId,
    className = "",
    buttonClass = "",
    includeHome = false
} = {}) {''',
    '''function renderPrimaryLaunch({ className = "", buttonClass = "" } = {}) {
    const containerClass = classNames("quiz-actions", "quiz-primary-action", className);
    const primaryClass = classNames("quiz-button", buttonClass, "primary");

    return `<div class="${escapeHtml(containerClass)}" data-smurdy-quiz-primary-action>
      <button class="${escapeHtml(primaryClass)}" type="button" data-smurdy-quiz-launch>Open quiz</button>
    </div>`;
}

function renderLandingActions({
    root = "",
    quizId,
    groupId,
    className = "",
    buttonClass = "",
    includeHome = false
} = {}) {'''
)

replace_once(
    "tools/quiz_page_shell.js",
    '''    renderBrand,
    renderLandingActions,
    renderFooter,''',
    '''    renderBrand,
    renderPrimaryLaunch,
    renderLandingActions,
    renderFooter,'''
)

# Map landing pages: add a launch-only CTA directly after the lead while
# keeping the existing full action row beneath the included-items accordion.
replace_once(
    "tools/generate_quiz_pages.js",
    '''            const sharedStylesHtml = pageShell.renderSharedStyles(publicRoot);
            const brandHtml = pageShell.renderBrand({ root: publicRoot, className: "panel-brand" });
            const actionsHtml = pageShell.renderLandingActions({''',
    '''            const sharedStylesHtml = pageShell.renderSharedStyles(publicRoot);
            const brandHtml = pageShell.renderBrand({ root: publicRoot, className: "panel-brand" });
            const launchHtml = pageShell.renderPrimaryLaunch({
                className: "action-row",
                buttonClass: "qb-btn"
            });
            const actionsHtml = pageShell.renderLandingActions({'''
)

replace_once(
    "tools/generate_quiz_pages.js",
    '''    <p class="lead">${escapeHtml(lead)}</p>

    <section class="content-section">''',
    '''    <p class="lead">${escapeHtml(lead)}</p>
    ${launchHtml}

    <section class="content-section">'''
)

# Flag landing pages: replace the full top row with the same launch-only CTA,
# then put the full four-control row under the included-items accordion.
replace_once(
    "tools/generate_flag_pages.js",
    '''    const sharedStylesHtml = pageShell.renderSharedStyles();
    const brandHtml = pageShell.renderBrand({ className: "flag-brand" });
    const actionsHtml = pageShell.renderLandingActions({
        quizId: "type-flag",
        groupId,
        className: "flag-actions",
        buttonClass: "flag-button"
    });''',
    '''    const sharedStylesHtml = pageShell.renderSharedStyles();
    const brandHtml = pageShell.renderBrand({ className: "flag-brand" });
    const launchHtml = pageShell.renderPrimaryLaunch({
        className: "flag-actions",
        buttonClass: "flag-button"
    });
    const actionsHtml = pageShell.renderLandingActions({
        quizId: "type-flag",
        groupId,
        className: "flag-actions",
        buttonClass: "flag-button",
        includeHome: true
    });'''
)

replace_once(
    "tools/generate_flag_pages.js",
    '''        <p class="flag-lead">${escapeHtml(group.lead)}</p>
        ${actionsHtml}
      </header>''',
    '''        <p class="flag-lead">${escapeHtml(group.lead)}</p>
        ${launchHtml}
      </header>'''
)

replace_once(
    "tools/generate_flag_pages.js",
    '''      </details>
      <section class="flag-links" aria-labelledby="explore-more-heading">''',
    '''      </details>
      ${actionsHtml}
      <section class="flag-links" aria-labelledby="explore-more-heading">'''
)

# Both Open quiz buttons need to be live. The first remains the state/lock
# button used by the existing launch code, while both CTA instances trigger it.
replace_once(
    "src/js/quiz_landing.js",
    '''    const launchButton = document.querySelector(
        "[data-smurdy-quiz-launch], [data-flag-launch]"
    );''',
    '''    const launchButtons = Array.from(document.querySelectorAll(
        "[data-smurdy-quiz-launch], [data-flag-launch]"
    ));
    const launchButton = launchButtons[0] || null;'''
)

replace_once(
    "src/js/quiz_landing.js",
    '''    launchButton?.addEventListener("click", () => {
        void launchQuiz(null);
    });''',
    '''    launchButtons.forEach(button => {
        button.addEventListener("click", () => {
            void launchQuiz(null);
        });
    });'''
)

# Lock the intended two-launch/one-favorite contract into the generated-page
# tests so future landing-page work cannot silently drift again.
replace_once(
    "tests/quiz_definitions.test.js",
    '''test("shared landing shell exposes one launch and favorite contract", () => {
    const actions = shell.renderLandingActions({
        quizId: "click-country",
        groupId: "europe",
        buttonClass: "qb-btn"
    });
    assert.match(actions, /data-smurdy-quiz-launch/);
    assert.match(actions, /data-smurdy-quiz-favorite/);
    assert.match(actions, /☆ Add to favorites/);
    assert.doesNotMatch(shell.renderFooter(), /·/);
});''',
    '''test("shared landing shell separates the primary launch from the full action row", () => {
    const primary = shell.renderPrimaryLaunch({ buttonClass: "qb-btn" });
    const actions = shell.renderLandingActions({
        quizId: "click-country",
        groupId: "europe",
        buttonClass: "qb-btn",
        includeHome: true
    });

    assert.match(primary, /data-smurdy-quiz-primary-action/);
    assert.match(primary, /data-smurdy-quiz-launch/);
    assert.doesNotMatch(primary, /data-smurdy-quiz-favorite/);
    assert.match(actions, /data-smurdy-quiz-launch/);
    assert.match(actions, /data-smurdy-quiz-favorite/);
    assert.match(actions, /☆ Add to favorites/);
    assert.match(actions, /Back to home/);
    assert.doesNotMatch(shell.renderFooter(), /·/);
});'''
)

replace_once(
    "tests/quiz_definitions.test.js",
    '''    for (const html of [map, flags]) {
        assert.match(html, /styles\\/quiz_shared\\.css/);
        assert.match(html, /data-smurdy-quiz-page/);
        assert.match(html, /data-smurdy-quiz-favorite/);
        assert.match(html, /src\\/js\\/quiz_definitions\\.js/);
        assert.match(html, /src\\/js\\/quiz_landing\\.js/);
    }''',
    '''    for (const html of [map, flags]) {
        assert.match(html, /styles\\/quiz_shared\\.css/);
        assert.match(html, /data-smurdy-quiz-page/);
        assert.match(html, /data-smurdy-quiz-primary-action/);
        assert.equal((html.match(/data-smurdy-quiz-launch/g) || []).length, 2);
        assert.equal((html.match(/data-smurdy-quiz-favorite/g) || []).length, 1);
        assert.match(html, /Back to home/);
        assert.match(html, /src\\/js\\/quiz_definitions\\.js/);
        assert.match(html, /src\\/js\\/quiz_landing\\.js/);
    }'''
)

print("Applied landing control parity migration.")
