#!/usr/bin/env python3
from __future__ import annotations

import difflib
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "src" / "js" / "quiz_runner.js"
MARKER = "Smurdy subdivision canonicalization fix"

HELPER = '''    /* --- Smurdy subdivision canonicalization fix --- */
    function isSubdivisionMapMode() {
        try {
            const runtimeMode = String(
                SQ.currentMode ||
                SQ.mode ||
                ""
            ).toLowerCase();

            const group = (typeof SQ.getCurrentGroup === "function")
                ? SQ.getCurrentGroup()
                : (SQ.groups && SQ.currentGroupId ? SQ.groups[SQ.currentGroupId] : null);

            const borderSet = String(group?.borderset || "").toLowerCase();
            const groupId = String(SQ.currentGroupId || "").toLowerCase();

            return (
                runtimeMode === "states" ||
                borderSet === "states" ||
                groupId === "us_states"
            );
        } catch (_) {
            return false;
        }
    }

'''

OLD_ANCHOR = '''    // Build a canonical index that maps each sovereign -> best feature (prefer mainland).
    // This avoids counting overseas territories separately and ensures zoom targets the largest/mainland part.
'''

NEW_ANCHOR = '''    // Build a canonical index that maps each country sovereign, or each
    // individual subdivision in state/province mode, to its best feature.
'''

OLD_LOOP = '''        for (const f of SQ.mainData.features) {
            const p = f.properties || {};
            const featureName = (p.name || p.NAME || p.admin || p.ADMIN || "").trim();
            // Use sovereign as canonical grouping if present; fallback to admin/name.
            const sovereign = (p.sovereignt || p.SOVEREIGNT || p.sovereignty || p.ADMIN || p.admin || featureName || "").trim();
'''

NEW_LOOP = '''        const subdivisionMode = isSubdivisionMapMode();

        for (const f of SQ.mainData.features) {
            const p = f.properties || {};

            // In country mode, SQ.getFeatureName() may still return a sovereign
            // name by design. In subdivision mode it returns the state name.
            const featureName = String(
                (typeof SQ.getFeatureName === "function"
                    ? SQ.getFeatureName(f)
                    : (p.name || p.NAME || p.name_en || p.NAME_EN || p.postal || p.POSTAL || p.admin || p.ADMIN || "")
                ) || ""
            ).trim();

            // Country maps intentionally merge overseas pieces by sovereign.
            // State/province maps must instead keep every subdivision separate.
            const sovereign = String(
                subdivisionMode
                    ? featureName
                    : (p.sovereignt || p.SOVEREIGNT || p.sovereignty || p.ADMIN || p.admin || featureName || "")
            ).trim();
'''

OLD_DISPLAY = '''                    displayName: (p.sovereignt || p.admin || p.name || featureName),
'''

NEW_DISPLAY = '''                    displayName: subdivisionMode
                        ? featureName
                        : (p.sovereignt || p.SOVEREIGNT || p.admin || p.ADMIN || p.name || p.NAME || featureName),
'''

OLD_CANONICAL = '''    // Return canonical display name for a feature object (prefer sovereign/admin/full name)
    function canonicalNameForFeature(feature) {
        try {
            if (!feature || !feature.properties) return "";
            const p = feature.properties;
            // prefer full sovereign/admin fields so we avoid abbreviated labels (e.g. "S. Sudan")
            return String(p.sovereignt || p.SOVEREIGNT || p.admin || p.ADMIN || p.name || p.NAME || p.NAME_EN || p.name_en || "");
        } catch (e) { return ""; }
    }
'''

NEW_CANONICAL = '''    // Return the answer label represented by a feature.
    // Countries prefer sovereign/admin names; subdivision maps must use the
    // individual state/province name instead of collapsing to its country.
    function canonicalNameForFeature(feature) {
        try {
            if (!feature || !feature.properties) return "";
            const p = feature.properties;

            if (isSubdivisionMapMode()) {
                return String(
                    (typeof SQ.getFeatureName === "function"
                        ? SQ.getFeatureName(feature)
                        : (p.name || p.NAME || p.name_en || p.NAME_EN || p.postal || p.POSTAL || "")
                    ) || ""
                );
            }

            // Prefer full sovereign/admin fields so abbreviated map labels
            // such as "S. Sudan" do not become quiz answers.
            return String(
                p.sovereignt ||
                p.SOVEREIGNT ||
                p.admin ||
                p.ADMIN ||
                p.name ||
                p.NAME ||
                p.NAME_EN ||
                p.name_en ||
                ""
            );
        } catch (e) {
            return "";
        }
    }
'''


def replace_exactly_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: expected exactly one matching block, found {count}. "
            "No files were changed."
        )
    return text.replace(old, new, 1)


def node_check(path: Path) -> tuple[bool, str]:
    node = shutil.which("node")
    if not node:
        return True, "Node is not installed, so JavaScript syntax checking was skipped."

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
            "Expected src/js/quiz_runner.js.",
            file=sys.stderr,
        )
        return 1

    original = TARGET.read_text(encoding="utf-8")

    if MARKER in original:
        print("The US-states canonicalization fix is already installed.")
        return 0

    try:
        updated = replace_exactly_once(
            original,
            OLD_ANCHOR,
            HELPER + NEW_ANCHOR,
            "canonical-index anchor",
        )
        updated = replace_exactly_once(
            updated,
            OLD_LOOP,
            NEW_LOOP,
            "canonical feature loop",
        )
        updated = replace_exactly_once(
            updated,
            OLD_DISPLAY,
            NEW_DISPLAY,
            "canonical display name",
        )
        updated = replace_exactly_once(
            updated,
            OLD_CANONICAL,
            NEW_CANONICAL,
            "canonicalNameForFeature function",
        )
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    backup = TARGET.with_suffix(".js.bak-before-us-states-fix")
    backup.write_text(original, encoding="utf-8")
    TARGET.write_text(updated, encoding="utf-8")

    ok, output = node_check(TARGET)
    if not ok:
        TARGET.write_text(original, encoding="utf-8")
        print(
            "JavaScript syntax validation failed. The original file was restored.",
            file=sys.stderr,
        )
        if output:
            print(output, file=sys.stderr)
        return 1

    required_fragments = [
        "function isSubdivisionMapMode()",
        "const subdivisionMode = isSubdivisionMapMode();",
        "subdivisionMode\n                    ? featureName",
        "if (isSubdivisionMapMode())",
    ]
    missing = [fragment for fragment in required_fragments if fragment not in updated]
    if missing:
        TARGET.write_text(original, encoding="utf-8")
        print(
            "Post-patch validation failed. The original file was restored.",
            file=sys.stderr,
        )
        print("Missing fragments: " + ", ".join(missing), file=sys.stderr)
        return 1

    diff_path = ROOT / "smurdyfun-us-states-canonicalization-fix.diff"
    diff_path.write_text(
        "".join(
            difflib.unified_diff(
                original.splitlines(keepends=True),
                updated.splitlines(keepends=True),
                fromfile="a/src/js/quiz_runner.js",
                tofile="b/src/js/quiz_runner.js",
            )
        ),
        encoding="utf-8",
    )

    print("Fixed US states being collapsed into Alaska.")
    print(f"Backup: {backup}")
    print(f"Review diff: {diff_path}")
    print()
    print("No page regeneration is needed.")
    print("Commit and deploy src/js/quiz_runner.js, then hard-refresh the site.")
    if output:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
