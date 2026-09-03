from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# Shared completion review: six-item pages, miss-count sorting, collapse behavior.
path = "src/js/quiz_completion.js"
text = read(path)
text = text.replace(
    '    const SHARE_SELECTOR = "[data-smurdy-share]";\n',
    '    const SHARE_SELECTOR = "[data-smurdy-share]";\n    const DEFAULT_REVIEW_PAGE_SIZE = 6;\n',
    1
)

pattern = re.compile(
    r'    function renderReview\(container, result, options = \{\}\) \{.*?\n    \}\n\n    function renderSummary',
    re.S
)
replacement = '''    function sortMissesForReview(misses) {
        return (Array.isArray(misses) ? misses : [])
            .slice()
            .sort((a, b) =>
                Math.max(0, Number(b?.count) || 0) - Math.max(0, Number(a?.count) || 0) ||
                String(a?.name || "").localeCompare(String(b?.name || ""))
            );
    }

    function renderReview(container, result, options = {}) {
        if (!container) return null;
        const rawMisses = Array.isArray(result?.misses) ? result.misses : [];
        const misses = options.sortMisses === false
            ? rawMisses.slice()
            : sortMissesForReview(rawMisses);
        container.replaceChildren();
        container.hidden = misses.length === 0;
        if (!misses.length) return container;

        const document = container.ownerDocument || root?.document;
        if (!document) return container;
        injectShareStyles(document);

        if (options.ariaLabelledBy) {
            container.setAttribute("aria-labelledby", options.ariaLabelledBy);
        }

        const header = document.createElement("div");
        if (options.headerClass) header.className = options.headerClass;
        const titleWrap = document.createElement("div");
        const title = document.createElement(options.titleTag || "strong");
        if (options.titleId) title.id = options.titleId;
        if (options.titleClass) title.className = options.titleClass;
        title.textContent = options.title || "Review your misses";
        titleWrap.appendChild(title);

        const summaryText = typeof options.summary === "function"
            ? options.summary(result)
            : options.summary;
        if (summaryText) {
            const summary = document.createElement("span");
            if (options.summaryClass) summary.className = options.summaryClass;
            summary.textContent = summaryText;
            titleWrap.appendChild(summary);
        }
        header.appendChild(titleWrap);

        if (options.showRetry !== false) {
            const retry = document.createElement("button");
            retry.type = "button";
            retry.textContent = options.retryLabel || "Retry Missed";
            if (options.retryId) retry.id = options.retryId;
            if (options.retryClass) retry.className = options.retryClass;
            retry.addEventListener("click", () => {
                retryMissed(result, options.onRetry, { eventTarget: options.eventTarget || root });
            });
            header.appendChild(retry);
        }
        container.appendChild(header);

        const list = document.createElement(options.listTag || "ol");
        if (options.listClass) list.className = options.listClass;
        container.appendChild(list);

        const pageSize = Math.max(1, Number(options.pageSize) || DEFAULT_REVIEW_PAGE_SIZE);
        const collapsedCount = Math.min(
            misses.length,
            Math.max(1, Number(options.initialVisible) || pageSize)
        );
        let visibleCount = collapsedCount;

        function renderRows() {
            list.replaceChildren();
            misses.slice(0, visibleCount).forEach((item, index) => {
                const row = document.createElement("li");
                if (typeof options.renderItem === "function") {
                    options.renderItem(item, row, document, index);
                } else {
                    const name = document.createElement("span");
                    name.textContent = item.name;
                    row.appendChild(name);
                }
                list.appendChild(row);
            });
        }

        renderRows();

        if (misses.length > collapsedCount) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = ["smurdy-review-toggle", options.toggleClass || ""]
                .filter(Boolean)
                .join(" ");
            if (options.toggleId) toggle.id = options.toggleId;

            function updateToggle() {
                const allVisible = visibleCount >= misses.length;
                toggle.textContent = allVisible
                    ? (options.collapseLabel || "Collapse")
                    : (options.showMoreLabel || "Show more");
                toggle.setAttribute("aria-expanded", allVisible ? "true" : "false");
            }

            toggle.addEventListener("click", () => {
                if (visibleCount >= misses.length) {
                    visibleCount = collapsedCount;
                } else {
                    visibleCount = Math.min(misses.length, visibleCount + pageSize);
                }
                renderRows();
                updateToggle();
            });

            updateToggle();
            container.appendChild(toggle);
        }
        return container;
    }

    function renderSummary'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError("Could not replace renderReview")

text = text.replace(
    '        style.textContent = `\n            [data-smurdy-share] {',
    '''        style.textContent = `
            .smurdy-review-toggle {
                display: block;
                margin: 12px auto 0;
                padding: 9px 14px;
                border: 1px solid rgba(0,0,0,.18);
                border-radius: 9px;
                background: rgba(255,255,255,.92);
                color: #111;
                font: inherit;
                font-size: .9rem;
                font-weight: 750;
                line-height: 1.2;
                cursor: pointer;
            }
            .smurdy-review-toggle:hover { background: rgba(0,0,0,.045); }
            .smurdy-review-toggle:focus-visible {
                outline: 3px solid rgba(0,119,204,.28);
                outline-offset: 2px;
            }
            [data-smurdy-share] {''',
    1
)
text = text.replace(
    '        describeMiss,\n        retryMissed,',
    '        describeMiss,\n        sortMissesForReview,\n        retryMissed,',
    1
)
text = text.replace(
    '        formatElapsed,\n        humanizeSlug,',
    '        DEFAULT_REVIEW_PAGE_SIZE,\n        formatElapsed,\n        humanizeSlug,',
    1
)
write(path, text)

# Flag review cards: display the miss count beneath the flag name.
replace_once(
    "src/js/flag_quiz.js",
    '''                    const name = document.createElement("span");
                    name.textContent = item.name;
                    row.append(image, name);''',
    '''                    const copy = document.createElement("div");
                    copy.className = "flag-review-copy";
                    const name = document.createElement("span");
                    name.className = "flag-review-name";
                    name.textContent = item.name;
                    const missCount = document.createElement("span");
                    missCount.className = "flag-review-miss-count";
                    const count = Math.max(0, Number(item.count) || 0);
                    missCount.textContent = `${count} ${count === 1 ? "miss" : "misses"}`;
                    copy.append(name, missCount);
                    row.append(image, copy);'''
)

replace_once(
    "styles/flag_quiz.css",
    '.flag-review-grid img { width: 48px; height: 34px; flex: 0 0 auto; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .18)); }\n.flag-review-grid span { overflow-wrap: anywhere; }',
    '.flag-review-grid img { width: 48px; height: 34px; flex: 0 0 auto; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .18)); }\n.flag-review-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }\n.flag-review-grid span { overflow-wrap: anywhere; }\n.flag-review-miss-count { color: var(--muted); font-size: 11px; font-weight: 600; }'
)

# Cache-bust the changed completion/flag assets and bump the user-visible version.
replace_once(
    "src/js/app_core.js",
    'const APP_VERSION = "1.13.8";',
    'const APP_VERSION = "1.13.9";'
)
replace_once(
    "src/js/app_core.js",
    '/src/js/quiz_completion.js?v=20260903-completion-1',
    '/src/js/quiz_completion.js?v=20260903-review-pagination-1'
)

for old, new in [
    ('quiz_completion.js?v=20260903-completion-1', 'quiz_completion.js?v=20260903-review-pagination-1'),
    ('flag_quiz.js?v=20260903-final-unity-1', 'flag_quiz.js?v=20260903-review-pagination-1'),
    ('flag_quiz.css?v=20260903-final-unity-1', 'flag_quiz.css?v=20260903-review-pagination-1'),
]:
    text = read("tools/generate_flag_pages.js")
    if old not in text:
        raise RuntimeError(f"Expected version string not found: {old}")
    write("tools/generate_flag_pages.js", text.replace(old, new))

# Keep generated-page regression checks on the new cache versions.
flag_test = read("tests/flag_quiz.test.js")
flag_test = flag_test.replace(
    'flag_quiz\\.js\\?v=20260903-final-unity-1',
    'flag_quiz\\.js\\?v=20260903-review-pagination-1'
)
flag_test = flag_test.replace(
    'quiz_completion\\.js\\?v=20260903-completion-1',
    'quiz_completion\\.js\\?v=20260903-review-pagination-1'
)
write("tests/flag_quiz.test.js", flag_test)

# Completion tests: deterministic sorting and six-at-a-time review contract.
completion_test = read("tests/quiz_completion.test.js")
completion_test = completion_test.replace(
    '    assert.match(appCore, /quiz_completion\\.js\\?v=20260903-completion-1/);',
    '    assert.match(appCore, /quiz_completion\\.js\\?v=20260903-review-pagination-1/);'
)
append = r'''

test("post-game review sorts by miss count and pages six items at a time", () => {
    const sorted = completion.sortMissesForReview([
        { name: "Alpha", count: 1 },
        { name: "Charlie", count: 4 },
        { name: "Bravo", count: 4 },
        { name: "Delta", count: 2 }
    ]);

    assert.equal(completion.DEFAULT_REVIEW_PAGE_SIZE, 6);
    assert.deepEqual(
        sorted.map(item => [item.name, item.count]),
        [["Bravo", 4], ["Charlie", 4], ["Delta", 2], ["Alpha", 1]]
    );

    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.join(__dirname, "..");
    const source = fs.readFileSync(path.join(root, "src/js/quiz_completion.js"), "utf8");
    const flagRunner = fs.readFileSync(path.join(root, "src/js/flag_quiz.js"), "utf8");

    assert.match(source, /visibleCount = Math\.min\(misses\.length, visibleCount \+ pageSize\)/);
    assert.match(source, /options\.showMoreLabel \|\| "Show more"/);
    assert.match(source, /options\.collapseLabel \|\| "Collapse"/);
    assert.match(flagRunner, /flag-review-miss-count/);
    assert.match(flagRunner, /count === 1 \? "miss" : "misses"/);
});
'''
if 'post-game review sorts by miss count and pages six items at a time' not in completion_test:
    completion_test += append
write("tests/quiz_completion.test.js", completion_test)

print("Post-game review migration applied.")
