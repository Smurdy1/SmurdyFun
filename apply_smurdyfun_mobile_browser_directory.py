#!/usr/bin/env python3
from __future__ import annotations

import difflib
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
BROWSE = ROOT / "src" / "js" / "browse.js"
INDEX = ROOT / "index.html"
MARKER = "smurdy-browser-directory-v1"

DIRECTORY_HTML = r'''
    <div id="quiz-browser" data-smurdy-directory="smurdy-browser-directory-v1" aria-label="Quiz browser">
        <nav id="qb-directory-fallback" aria-label="Browse geography quizzes" style="font-family:Arial,sans-serif;background:rgba(255,255,255,.96);padding:16px;border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,.18);">
            <strong style="display:block;font-size:18px;margin-bottom:8px;">Explore geography quizzes</strong>
            <a href="/quizzes/" style="display:inline-block;background:#0077cc;color:#fff;text-decoration:none;font-weight:800;padding:10px 14px;border-radius:9px;margin:0 6px 8px 0;">Browse All Quizzes</a>
            <div style="display:flex;gap:7px;flex-wrap:wrap;">
                <a href="/quizzes/click-country/world/">World</a>
                <a href="/quizzes/click-country/europe/">Europe</a>
                <a href="/quizzes/click-country/asia/">Asia</a>
                <a href="/quizzes/click-country/africa/">Africa</a>
                <a href="/quizzes/click-country/us_states/">US States</a>
            </div>
        </nav>
    </div>

'''.lstrip("\n")

HELPER_JS = r'''
    function renderDirectoryLinks() {
        return `
            <nav id="qb-directory-links" aria-label="Browse geography quizzes">
                <a class="qb-directory-primary" href="/quizzes/">Browse All Quizzes</a>
                <div class="qb-directory-popular" aria-label="Popular quiz pages">
                    <a href="/quizzes/click-country/world/">World</a>
                    <a href="/quizzes/click-country/europe/">Europe</a>
                    <a href="/quizzes/click-country/asia/">Asia</a>
                    <a href="/quizzes/click-country/africa/">Africa</a>
                    <a href="/quizzes/click-country/us_states/">US States</a>
                </div>
            </nav>
        `;
    }

'''.lstrip("\n")

CSS_JS = r'''
        /* Always-visible directory links at the bottom of the browser panel. */
        #qb-list {
            flex: 1 1 auto;
            min-height: 0;
        }
        #qb-directory-links {
            flex: 0 0 auto;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(0,0,0,0.10);
            background: rgba(255,255,255,0.98);
        }
        .qb-directory-primary {
            display: block;
            width: 100%;
            padding: 11px 12px;
            border-radius: 9px;
            background: #0077cc;
            color: #fff;
            text-decoration: none;
            text-align: center;
            font-size: 15px;
            font-weight: 800;
        }
        .qb-directory-primary:hover,
        .qb-directory-primary:focus {
            background: #005fa3;
        }
        .qb-directory-popular {
            display: flex;
            justify-content: center;
            gap: 5px 10px;
            flex-wrap: wrap;
            margin-top: 9px;
            font-size: 12px;
        }
        .qb-directory-popular a {
            color: #174f76;
            text-decoration: none;
            font-weight: 700;
        }
        .qb-directory-popular a:hover,
        .qb-directory-popular a:focus {
            text-decoration: underline;
        }

'''.lstrip("\n")


def require_file(path: Path) -> None:
    if not path.is_file():
        raise RuntimeError(f"Missing {path.relative_to(ROOT)}")


def node_check(path: Path) -> tuple[bool, str]:
    node = shutil.which("node")
    if not node:
        return True, "Node is unavailable; JavaScript syntax check skipped."
    result = subprocess.run(
        [node, "--check", str(path)],
        text=True,
        capture_output=True,
    )
    return result.returncode == 0, (result.stdout + result.stderr).strip()


def remove_old_static_navigation(html: str) -> str:
    # Remove the navigation panel installed inside #quiz-desc by the previous script.
    html = re.sub(
        r'\s*<footer\b[^>]*data-smurdy-nav="smurdy-indexing-links-v1"[^>]*>'
        r'[\s\S]*?</footer>\s*',
        "\n",
        html,
        count=1,
        flags=re.IGNORECASE,
    )

    # Remove the original floating SEO footer and its tiny mobile-hiding style.
    html = re.sub(
        r'\s*<footer\s+id="seo-footer"[\s\S]*?</footer>\s*'
        r'(?:<style>\s*@media\s*\(max-width:\s*700px\)\s*\{'
        r'\s*#seo-footer\s*\{\s*display:\s*none;\s*\}\s*\}\s*</style>\s*)?',
        "\n",
        html,
        count=1,
        flags=re.IGNORECASE,
    )
    return html


def modify_index(html: str) -> str:
    html = remove_old_static_navigation(html)

    if f'data-smurdy-directory="{MARKER}"' in html:
        return html

    map_anchor = '<div id="map"></div>'
    count = html.count(map_anchor)
    if count != 1:
        raise RuntimeError(
            f"index.html: expected one {map_anchor!r}, found {count}"
        )

    return html.replace(map_anchor, DIRECTORY_HTML + "     " + map_anchor, 1)


def inject_into_template(segment: str, label: str) -> str:
    assignment = segment.find("panel.innerHTML = `")
    if assignment == -1:
        raise RuntimeError(f"browse.js: could not find panel template in {label}")

    template_start = assignment + len("panel.innerHTML = `")
    template_end = segment.find("`;", template_start)
    if template_end == -1:
        raise RuntimeError(f"browse.js: could not find template end in {label}")

    template = segment[template_start:template_end]
    if "${renderDirectoryLinks()}" in template:
        return segment

    last_close = template.rfind("</div>")
    if last_close == -1:
        raise RuntimeError(f"browse.js: could not find final div in {label}")

    insertion_point = last_close + len("</div>")
    template = (
        template[:insertion_point]
        + "\n            ${renderDirectoryLinks()}"
        + template[insertion_point:]
    )

    return segment[:template_start] + template + segment[template_end:]


def modify_browse(js: str) -> str:
    if f"/* {MARKER} */" in js:
        return js

    # Existing HTML panel must still receive the browser CSS.
    old_existing = '''        let panel = document.getElementById("quiz-browser");
        if (panel) return panel;
'''
    new_existing = '''        let panel = document.getElementById("quiz-browser");
        if (panel) {
            injectBrowserStyles();
            return panel;
        }
'''
    count = js.count(old_existing)
    if count != 1:
        raise RuntimeError(
            f"browse.js: expected one existing-panel block, found {count}"
        )
    js = js.replace(old_existing, new_existing, 1)

    css_anchor = "        /* Mobile / narrow-screen adjustments:"
    css_pos = js.find(css_anchor)
    if css_pos == -1:
        raise RuntimeError("browse.js: could not locate the mobile CSS comment")
    js = js[:css_pos] + CSS_JS + js[css_pos:]

    # Give the mobile panel enough vertical space for the fixed directory footer.
    js = js.replace(
        "max-height: calc( (3 * 76px) + 140px );",
        "max-height: calc(100vh - 36px);\n"
        "                max-height: calc(100dvh - 36px);",
        1,
    )

    views_anchor = "    /* Views "
    views_pos = js.find(views_anchor)
    if views_pos == -1:
        raise RuntimeError("browse.js: could not locate the Views section")
    js = (
        js[:views_pos]
        + f"    /* {MARKER} */\n"
        + HELPER_JS
        + js[views_pos:]
    )

    manifest_start = js.find("    function renderManifestView(")
    groups_start = js.find("    function renderGroupsView(", manifest_start)
    if manifest_start == -1 or groups_start == -1:
        raise RuntimeError("browse.js: could not locate both render functions")

    manifest_segment = js[manifest_start:groups_start]
    manifest_segment = inject_into_template(
        manifest_segment, "renderManifestView"
    )
    js = js[:manifest_start] + manifest_segment + js[groups_start:]

    # Recalculate after modifying the first segment.
    groups_start = js.find("    function renderGroupsView(")
    groups_end_match = re.search(
        r"(?m)^    (?:async\s+)?function\s+\w+\s*\(",
        js[groups_start + 1:],
    )
    if groups_end_match:
        groups_end = groups_start + 1 + groups_end_match.start()
    else:
        groups_end = len(js)

    groups_segment = js[groups_start:groups_end]
    groups_segment = inject_into_template(groups_segment, "renderGroupsView")
    js = js[:groups_start] + groups_segment + js[groups_end:]

    return js


def write_diff(
    path: Path, original: str, updated: str, relative_path: str
) -> None:
    path.write_text(
        "".join(
            difflib.unified_diff(
                original.splitlines(keepends=True),
                updated.splitlines(keepends=True),
                fromfile=f"a/{relative_path}",
                tofile=f"b/{relative_path}",
            )
        ),
        encoding="utf-8",
    )


def main() -> int:
    try:
        require_file(BROWSE)
        require_file(INDEX)

        original_browse = BROWSE.read_text(encoding="utf-8")
        original_index = INDEX.read_text(encoding="utf-8")

        updated_browse = modify_browse(original_browse)
        updated_index = modify_index(original_index)

        if (
            updated_browse == original_browse
            and updated_index == original_index
        ):
            print("The mobile browser directory is already installed.")
            return 0

        backup_dir = ROOT / "smurdy-mobile-directory-backup"
        diff_dir = ROOT / "smurdy-mobile-directory-diffs"
        backup_dir.mkdir(exist_ok=True)
        diff_dir.mkdir(exist_ok=True)

        (backup_dir / "browse.js").write_text(
            original_browse, encoding="utf-8"
        )
        (backup_dir / "index.html").write_text(
            original_index, encoding="utf-8"
        )

        BROWSE.write_text(updated_browse, encoding="utf-8")
        INDEX.write_text(updated_index, encoding="utf-8")

        ok, output = node_check(BROWSE)
        if not ok:
            BROWSE.write_text(original_browse, encoding="utf-8")
            INDEX.write_text(original_index, encoding="utf-8")
            print(
                "JavaScript syntax check failed. Original files restored.",
                file=sys.stderr,
            )
            if output:
                print(output, file=sys.stderr)
            return 1

        write_diff(
            diff_dir / "browse.diff",
            original_browse,
            updated_browse,
            "src/js/browse.js",
        )
        write_diff(
            diff_dir / "index.diff",
            original_index,
            updated_index,
            "index.html",
        )

        print("Installed the always-visible quiz-browser directory.")
        print()
        print("Changed:")
        print("  index.html")
        print("  src/js/browse.js")
        print()
        print("The links now exist in the original HTML and remain pinned")
        print("to the bottom of the rendered quiz browser on mobile.")
        print()
        print(f"Backups: {backup_dir}")
        print(f"Diffs:   {diff_dir}")
        if output:
            print(output)
        return 0

    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
