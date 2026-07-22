#!/usr/bin/env python3
from __future__ import annotations

import difflib
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "src" / "js" / "browse.js"
MARKER = "smurdy-menu-map-launch-gate-v1"

HELPER = r'''
    /* smurdy-menu-map-launch-gate-v1 */
    let menuMapReadyPromise = null;
    let menuMapReadyConfirmed = false;

    function isHomepageLaunchContext() {
        try {
            const params = new URLSearchParams(location.search);
            return (
                !params.has("quiz") &&
                !/^\/quizzes\//i.test(location.pathname || "")
            );
        } catch (_) {
            return true;
        }
    }

    function getMenuMap() {
        return window.SmurdyQuiz?._menuMap || null;
    }

    function menuMapIsReady(menuMap) {
        if (!menuMap) return false;

        try {
            if (
                typeof menuMap.loaded === "function" &&
                menuMap.loaded()
            ) {
                return true;
            }
        } catch (_) {}

        try {
            if (
                typeof menuMap.isStyleLoaded === "function" &&
                menuMap.isStyleLoaded()
            ) {
                return true;
            }
        } catch (_) {}

        return false;
    }

    function waitForMainMenuMapReady() {
        if (!isHomepageLaunchContext()) {
            return Promise.resolve();
        }

        if (
            menuMapReadyConfirmed ||
            menuMapIsReady(getMenuMap())
        ) {
            menuMapReadyConfirmed = true;
            return Promise.resolve();
        }

        if (menuMapReadyPromise) {
            return menuMapReadyPromise;
        }

        menuMapReadyPromise = new Promise(resolve => {
            let watchedMap = null;
            let timer = null;
            let finished = false;

            const cleanUp = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }

                if (
                    watchedMap &&
                    typeof watchedMap.off === "function"
                ) {
                    try {
                        watchedMap.off("load", finish);
                    } catch (_) {}
                }
            };

            const finish = () => {
                if (finished) return;
                finished = true;
                cleanUp();
                menuMapReadyConfirmed = true;
                resolve();
            };

            const inspect = () => {
                timer = null;
                if (finished) return;

                if (!isHomepageLaunchContext()) {
                    finish();
                    return;
                }

                const menuMap = getMenuMap();

                if (menuMap !== watchedMap) {
                    if (
                        watchedMap &&
                        typeof watchedMap.off === "function"
                    ) {
                        try {
                            watchedMap.off("load", finish);
                        } catch (_) {}
                    }

                    watchedMap = menuMap;

                    if (
                        watchedMap &&
                        typeof watchedMap.on === "function"
                    ) {
                        watchedMap.on("load", finish);
                    }
                }

                /*
                 * Register the load listener first, then check readiness,
                 * so the event cannot slip through between those steps.
                 */
                if (menuMapIsReady(menuMap)) {
                    finish();
                    return;
                }

                timer = setTimeout(inspect, 30);
            };

            inspect();
        }).finally(() => {
            menuMapReadyPromise = null;
        });

        return menuMapReadyPromise;
    }

    function setQuizLaunchLinksReady(panel, ready) {
        const links = panel.querySelectorAll(
            ".qb-play[data-group][data-manifest-id]"
        );

        for (const link of links) {
            if (!link.dataset.readyText) {
                link.dataset.readyText =
                    link.textContent.trim() || "Play";
            }

            if (ready) {
                link.removeAttribute("aria-disabled");
                link.removeAttribute("tabindex");
                link.style.removeProperty("pointer-events");
                link.style.removeProperty("opacity");
                link.style.removeProperty("cursor");
                link.textContent = link.dataset.readyText;
            } else {
                link.setAttribute("aria-disabled", "true");
                link.setAttribute("tabindex", "-1");
                link.style.setProperty(
                    "pointer-events",
                    "none",
                    "important"
                );
                link.style.opacity = ".58";
                link.style.cursor = "wait";
                link.textContent = "Loading map…";
            }
        }
    }

    async function synchronizeQuizLaunchAvailability(panel) {
        if (
            !isHomepageLaunchContext() ||
            menuMapReadyConfirmed ||
            menuMapIsReady(getMenuMap())
        ) {
            menuMapReadyConfirmed = true;
            setQuizLaunchLinksReady(panel, true);
            return;
        }

        setQuizLaunchLinksReady(panel, false);
        await waitForMainMenuMapReady();
        setQuizLaunchLinksReady(panel, true);
    }

'''


def insert_before(text: str, anchor: str, addition: str, label: str) -> str:
    pos = text.find(anchor)
    if pos < 0:
        raise RuntimeError(f"{label}: anchor not found")
    return text[:pos] + addition + text[pos:]


def patch_attach_events(text: str) -> str:
    pattern = re.compile(
        r"(?m)^(\s*)function attachCardEvents\(panel\) \{\n"
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise RuntimeError(
            "attachCardEvents: expected one function, "
            f"found {len(matches)}"
        )
    m = matches[0]
    indent = m.group(1)
    replacement = (
        m.group(0)
        + f"{indent}    void synchronizeQuizLaunchAvailability(panel);\n\n"
    )
    return text[:m.start()] + replacement + text[m.end():]


def patch_click_guard(text: str) -> str:
    needle = '''                    event.preventDefault();\n'''
    positions = [m.start() for m in re.finditer(re.escape(needle), text)]

    # Prefer the occurrence inside attachCardEvents.
    attach_pos = text.find("function attachCardEvents(panel)")
    start_pos = text.find("async function startQuizForManifest", attach_pos)
    candidates = [p for p in positions if attach_pos < p < start_pos]

    if len(candidates) != 1:
        raise RuntimeError(
            "Play click guard: expected one event.preventDefault() "
            f"inside attachCardEvents, found {len(candidates)}"
        )

    pos = candidates[0]
    guard = '''                    event.preventDefault();\n\n                    if (\n                        link.getAttribute("aria-disabled") === "true"\n                    ) {\n                        return;\n                    }\n\n                    await waitForMainMenuMapReady();\n'''
    return text[:pos] + guard + text[pos + len(needle):]


def patch_start_function(text: str) -> str:
    pattern = re.compile(
        r"(?m)^(\s*)(async\s+)?function startQuizForManifest"
        r"\(manifestItem, groupId\) \{\n"
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise RuntimeError(
            "startQuizForManifest: expected one function, "
            f"found {len(matches)}"
        )

    m = matches[0]
    indent = m.group(1)
    signature = (
        f"{indent}async function startQuizForManifest"
        "(manifestItem, groupId) {\n"
    )
    gate = (
        f"{indent}    await waitForMainMenuMapReady();\n\n"
    )
    return text[:m.start()] + signature + gate + text[m.end():]


def node_check(path: Path) -> tuple[bool, str]:
    node = shutil.which("node")
    if not node:
        return True, "Node unavailable; syntax check skipped."

    result = subprocess.run(
        [node, "--check", str(path)],
        text=True,
        capture_output=True,
    )
    return result.returncode == 0, (result.stdout + result.stderr).strip()


def main() -> int:
    if not TARGET.is_file():
        print(
            "Run this from the SmurdyFun repository root. "
            "Expected src/js/browse.js.",
            file=sys.stderr,
        )
        return 1

    original = TARGET.read_text(encoding="utf-8")

    if MARKER in original:
        print("The menu-map launch gate is already installed.")
        return 0

    try:
        updated = insert_before(
            original,
            "    function attachCardEvents(panel) {\n",
            HELPER,
            "readiness helper",
        )
        updated = patch_attach_events(updated)
        updated = patch_click_guard(updated)
        updated = patch_start_function(updated)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        print("No files were changed.", file=sys.stderr)
        return 1

    required = [
        MARKER,
        "window.SmurdyQuiz?._menuMap",
        "Loading map…",
        "void synchronizeQuizLaunchAvailability(panel);",
        "await waitForMainMenuMapReady();",
    ]
    missing = [item for item in required if item not in updated]
    if missing:
        print(
            "ERROR: Post-patch validation failed: " + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    backup = TARGET.with_suffix(".js.bak-before-menu-map-launch-gate")
    diff_path = ROOT / "smurdyfun-menu-map-launch-gate.diff"

    backup.write_text(original, encoding="utf-8")
    TARGET.write_text(updated, encoding="utf-8")

    ok, output = node_check(TARGET)
    if not ok:
        TARGET.write_text(original, encoding="utf-8")
        print(
            "JavaScript syntax validation failed. Original browse.js restored.",
            file=sys.stderr,
        )
        if output:
            print(output, file=sys.stderr)
        return 1

    diff_path.write_text(
        "".join(
            difflib.unified_diff(
                original.splitlines(keepends=True),
                updated.splitlines(keepends=True),
                fromfile="a/src/js/browse.js",
                tofile="b/src/js/browse.js",
            )
        ),
        encoding="utf-8",
    )

    print("Installed the main-menu map launch gate.")
    print()
    print("Until the independent menu map loads:")
    print("  - Play buttons say Loading map…")
    print("  - Play buttons are disabled")
    print()
    print("After its MapLibre load event:")
    print("  - Play buttons return to normal")
    print("  - quizzes can be launched safely")
    print()
    print("The internal launch function also waits, so other launch paths")
    print("cannot bypass the gate.")
    print()
    print(f"Backup: {backup}")
    print(f"Diff:   {diff_path}")
    print()
    print("Only src/js/browse.js changed.")
    print("No page or sitemap generation is needed.")

    if output:
        print(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
