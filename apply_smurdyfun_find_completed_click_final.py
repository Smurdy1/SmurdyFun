#!/usr/bin/env python3
from __future__ import annotations

import difflib
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
RUNNER = ROOT / "src" / "js" / "quiz_runner.js"

MARKER = "smurdy-find-completed-click-final-v1"

OLD_SIMPLE = re.compile(
    r'(?P<indent>^[ \t]*)if\s*\(\s*completed\.has\s*\(\s*clickedName\s*\)\s*\)\s*return\s*;',
    re.MULTILINE,
)

OLD_BRACED = re.compile(
    r'''(?P<indent>^[ \t]*)
        if\s*\(\s*completed\.has\s*\(\s*clickedName\s*\)\s*\)\s*\{
        \s*return\s*;\s*
        \}''',
    re.MULTILINE | re.VERBOSE,
)

OLD_BORDER_PATCH = re.compile(
    r'''(?P<indent>^[ \t]*)
        (?:
            //[^\n]*\n
        )*
        [ \t]*const\s+isNoBordersClickMode\s*=
        [\s\S]{0,900}?
        [ \t]*if\s*\(
        [\s\S]{0,300}?
        completed\.has\s*\(\s*clickedName\s*\)
        [\s\S]{0,300}?
        \)\s*\{
        \s*return\s*;\s*
        \}''',
    re.MULTILINE | re.VERBOSE,
)

NEW_GUARD_TEMPLATE = '''{indent}// smurdy-find-completed-click-final-v1
{indent}// Normal click quizzes keep completed areas inert. Find/no-border
{indent}// quizzes use persistCompletedHighlights=false, so completed land
{indent}// clicks continue into the normal wrong-answer path.
{indent}if (
{indent}    completed.has(clickedName) &&
{indent}    persistCompletedHighlights
{indent}) {{
{indent}    return;
{indent}}}'''


class PatchError(RuntimeError):
    pass


def find_target_region(text: str) -> tuple[int, int, str]:
    # Prefer a prior v1/v2 borders-based patch if present. Otherwise locate
    # the simple completed.has(clickedName) guard tied to attempts++.
    border_matches = list(OLD_BORDER_PATCH.finditer(text))
    if len(border_matches) == 1:
        match = border_matches[0]
        return match.start(), match.end(), match.group("indent")

    candidates = []

    for pattern in (OLD_SIMPLE, OLD_BRACED):
        for match in pattern.finditer(text):
            before = text[max(0, match.start() - 450):match.start()]
            after = text[match.end():min(len(text), match.end() + 500)]

            score = 0
            if "clickedName" in before:
                score += 2
            if "Unknown" in before:
                score += 5
            if re.search(r'\blocked\s*=\s*true\s*;', after):
                score += 6
            if re.search(r'\battempts\s*\+\+\s*;', after):
                score += 6
            if "finishWrong(clickedName)" in after:
                score += 4
            if "finishCorrect()" in after:
                score += 3

            candidates.append((score, match))

    if not candidates:
        semantic = re.compile(
            r'''(?P<indent>^[ \t]*)
                if\s*\(
                \s*completed\.has\s*\(\s*clickedName\s*\)
                \s*&&
                \s*persistCompletedHighlights
                \s*\)\s*\{
                \s*return\s*;\s*
                \}''',
            re.MULTILINE | re.VERBOSE,
        )
        semantic_matches = list(semantic.finditer(text))
        if len(semantic_matches) == 1:
            match = semantic_matches[0]
            return match.start(), match.end(), match.group("indent")

        raise PatchError(
            "Could not find the completed-country guard used by the click flow."
        )

    candidates.sort(key=lambda item: item[0], reverse=True)
    best_score, best_match = candidates[0]
    second_score = candidates[1][0] if len(candidates) > 1 else -1

    if best_score < 15:
        raise PatchError(
            "Found completed-country checks, but none were safely tied to "
            "the normal click-attempt flow."
        )

    if second_score == best_score:
        raise PatchError(
            "Found multiple equally likely completed-country click guards."
        )

    return best_match.start(), best_match.end(), best_match.group("indent")


def patch_runner(text: str) -> str:
    if MARKER in text:
        return text

    if "persistCompletedHighlights" not in text:
        raise PatchError(
            "quiz_runner.js does not contain persistCompletedHighlights."
        )

    start, end, indent = find_target_region(text)

    replacement = NEW_GUARD_TEMPLATE.format(indent=indent)
    updated = text[:start] + replacement + text[end:]

    required = [
        MARKER,
        "completed.has(clickedName)",
        "persistCompletedHighlights",
        "locked = true",
        "attempts++",
        "finishWrong(clickedName)",
    ]

    missing = [fragment for fragment in required if fragment not in updated]
    if missing:
        raise PatchError(
            "Post-patch validation failed; missing: "
            + ", ".join(missing)
        )

    nearby_start = max(0, updated.find(MARKER) - 700)
    nearby_end = min(len(updated), updated.find(MARKER) + 1400)
    nearby = updated[nearby_start:nearby_end]

    if re.search(
        r'if\s*\(\s*completed\.has\s*\(\s*clickedName\s*\)\s*\)\s*return\s*;',
        nearby,
    ):
        raise PatchError(
            "An unconditional completed-country guard still remains nearby."
        )

    if "const isNoBordersClickMode" in nearby:
        raise PatchError(
            "The old borders-based no-border patch still remains nearby."
        )

    return updated


def node_check(path: Path) -> tuple[bool, str]:
    node = shutil.which("node")
    if not node:
        return True, "Node is unavailable; JavaScript syntax checking was skipped."

    result = subprocess.run(
        [node, "--check", str(path)],
        text=True,
        capture_output=True,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def unique_backup(path: Path) -> Path:
    base = path.with_name(
        path.name + ".bak-before-find-completed-click-final"
    )
    if not base.exists():
        return base

    number = 2
    while True:
        candidate = path.with_name(
            path.name
            + f".bak-before-find-completed-click-final-{number}"
        )
        if not candidate.exists():
            return candidate
        number += 1


def main() -> int:
    if not RUNNER.is_file():
        print(
            "ERROR: Run this from the SmurdyFun repository root. "
            "Expected src/js/quiz_runner.js.",
            file=sys.stderr,
        )
        return 1

    original = RUNNER.read_text(encoding="utf-8")

    if MARKER in original:
        print("The final no-border completed-click fix is already installed.")
        return 0

    try:
        updated = patch_runner(original)
    except PatchError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        print("Nothing was changed.", file=sys.stderr)
        return 1

    backup = unique_backup(RUNNER)
    diff_path = ROOT / "smurdyfun-find-completed-click-final.diff"

    backup.write_text(original, encoding="utf-8")
    RUNNER.write_text(updated, encoding="utf-8")

    ok, output = node_check(RUNNER)
    if not ok:
        RUNNER.write_text(original, encoding="utf-8")
        print(
            "ERROR: node --check failed. The original quiz_runner.js "
            "was restored.",
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
                fromfile="a/src/js/quiz_runner.js",
                tofile="b/src/js/quiz_runner.js",
            )
        ),
        encoding="utf-8",
    )

    print("Installed the final no-border completed-country click fix.")
    print()
    print("Changed behavior:")
    print("  Regular Click:")
    print("    - completed countries are still ignored")
    print("  Find / No Borders:")
    print("    - completed countries now count as wrong when clicked")
    print("    - attempts and accuracy update through the normal wrong flow")
    print("  Ocean:")
    print("    - still ignored before handleClick() is called")
    print()
    print(f"Backup: {backup}")
    print(f"Diff:   {diff_path}")
    print("Changed only src/js/quiz_runner.js.")

    if output:
        print(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
