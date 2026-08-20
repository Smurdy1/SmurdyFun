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

MARKER = "smurdy-find-completed-click-wrong-v2"
MODE_VARIABLE = "smurdyCountCompletedLandClicksAsWrong"

GUARD_PATTERN = re.compile(
    r"""
    (?P<indent>^[ \t]*)
    if
    \s*\(
        \s*completed
        \s*\.\s*has
        \s*\(
            \s*clickedName\s*
        \)
        \s*
    \)
    \s*
    (?:
        return\s*;
        |
        \{
            \s*return\s*;
            \s*
        \}
    )
    """,
    re.MULTILINE | re.VERBOSE,
)


class PatchError(RuntimeError):
    pass


def candidate_score(text: str, start: int, end: int) -> int:
    before = text[max(0, start - 900):start]
    after = text[end:min(len(text), end + 1400)]
    combined = before + "\n" + after

    score = 0

    checks = (
        (r"\blocked\b", 2),
        (r"\bcurrentName\b", 2),
        (r"\bclickedName\b", 2),
        (r"\battempts\s*\+\+", 5),
        (r"\bfinishCorrect\s*\(", 4),
        (r"\bfinishWrong\s*\(", 4),
        (r"clickedName\s*===\s*currentName", 5),
        (r"Unknown", 1),
    )

    for pattern, points in checks:
        if re.search(pattern, combined):
            score += points

    # Strongly prefer a guard followed by attempt counting.
    if re.search(r"\battempts\s*\+\+", after):
        score += 8

    return score


def choose_guard(text: str) -> re.Match[str]:
    matches = list(GUARD_PATTERN.finditer(text))

    if not matches:
        # Give a more useful diagnosis when completed.has exists in
        # an unsupported structure.
        raw_count = len(
            re.findall(
                r"completed\s*\.\s*has\s*\(\s*clickedName\s*\)",
                text,
            )
        )

        if raw_count:
            raise PatchError(
                "Found completed.has(clickedName), but not as a simple "
                "early-return guard. Nothing was changed. "
                f"Raw occurrences found: {raw_count}."
            )

        raise PatchError(
            "Could not find the completed-country early-return guard "
            "in src/js/quiz_runner.js. Nothing was changed."
        )

    if len(matches) == 1:
        match = matches[0]

        if candidate_score(text, match.start(), match.end()) < 8:
            raise PatchError(
                "Found one completed-country guard, but its surrounding "
                "code does not look like the click-attempt block. "
                "Nothing was changed."
            )

        return match

    ranked = sorted(
        (
            (
                candidate_score(
                    text,
                    match.start(),
                    match.end(),
                ),
                index,
                match,
            )
            for index, match in enumerate(matches)
        ),
        key=lambda item: item[0],
        reverse=True,
    )

    best_score, _, best_match = ranked[0]
    second_score = ranked[1][0]

    if best_score < 8 or best_score == second_score:
        details = ", ".join(
            f"candidate {index + 1}: score {score}"
            for score, index, _ in ranked
        )
        raise PatchError(
            "Found multiple completed-country guards and could not "
            "identify the click-attempt guard uniquely. "
            f"{details}. Nothing was changed."
        )

    return best_match


def make_replacement(indent: str) -> str:
    lines = [
        f"{indent}// {MARKER}",
        (
            f"{indent}// Regular bordered click quizzes ignore "
            "already-completed places."
        ),
        (
            f"{indent}// In no-border Find mode, every wrong land "
            "click counts,"
        ),
        (
            f"{indent}// including a place completed earlier in "
            "the quiz."
        ),
        f"{indent}const {MODE_VARIABLE} =",
        f'{indent}    mode === "click" &&',
        f"{indent}    (",
        f"{indent}        borders === false ||",
        f"{indent}        borders === 0 ||",
        (
            f'{indent}        String(borders).trim().'
            'toLowerCase() === "false" ||'
        ),
        (
            f'{indent}        String(borders).trim() === "0"'
        ),
        f"{indent}    );",
        "",
        f"{indent}if (",
        f"{indent}    completed.has(clickedName) &&",
        f"{indent}    !{MODE_VARIABLE}",
        f"{indent}) {{",
        f"{indent}    return;",
        f"{indent}}}",
    ]

    return "\n".join(lines)


def patch_runner(text: str) -> str:
    if MARKER in text:
        return text

    if MODE_VARIABLE in text:
        raise PatchError(
            f"{MODE_VARIABLE} already exists without the expected "
            "installer marker. Nothing was changed."
        )

    # `borders` is passed into the runner config in current Smurdy.
    # Refuse to insert code that would reference an absent variable.
    if not re.search(r"\bborders\b", text):
        raise PatchError(
            "quiz_runner.js does not appear to have a borders config "
            "value. Nothing was changed."
        )

    guard = choose_guard(text)
    replacement = make_replacement(guard.group("indent"))

    updated = (
        text[:guard.start()]
        + replacement
        + text[guard.end():]
    )

    required = (
        MARKER,
        MODE_VARIABLE,
        "completed.has(clickedName)",
        f"!{MODE_VARIABLE}",
        "borders === false",
        "borders === 0",
        'toLowerCase() === "false"',
        'String(borders).trim() === "0"',
    )

    missing = [
        fragment
        for fragment in required
        if fragment not in updated
    ]

    if missing:
        raise PatchError(
            "Post-patch validation failed. Missing: "
            + ", ".join(missing)
        )

    remaining_unconditional = list(
        GUARD_PATTERN.finditer(updated)
    )

    if remaining_unconditional:
        raise PatchError(
            "An unconditional completed-country guard remains after "
            "patching. Nothing was changed."
        )

    return updated


def unique_backup_path(path: Path) -> Path:
    base = path.with_name(
        path.name
        + ".bak-before-find-completed-click-fix-v2"
    )

    if not base.exists():
        return base

    number = 2

    while True:
        candidate = path.with_name(
            path.name
            + f".bak-before-find-completed-click-fix-v2-{number}"
        )

        if not candidate.exists():
            return candidate

        number += 1


def node_check(path: Path) -> tuple[bool, str]:
    node = shutil.which("node")

    if not node:
        return (
            True,
            "Node is unavailable; JavaScript syntax checking was skipped.",
        )

    result = subprocess.run(
        [node, "--check", str(path)],
        text=True,
        capture_output=True,
    )

    return (
        result.returncode == 0,
        (result.stdout + result.stderr).strip(),
    )


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
        print(
            "The no-border completed-country click fix v2 "
            "is already installed."
        )
        return 0

    try:
        updated = patch_runner(original)
    except PatchError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    backup = unique_backup_path(RUNNER)
    diff_path = (
        ROOT
        / "smurdyfun-find-completed-click-wrong-v2.diff"
    )

    backup.write_text(original, encoding="utf-8")
    RUNNER.write_text(updated, encoding="utf-8")

    ok, output = node_check(RUNNER)

    if not ok:
        RUNNER.write_text(original, encoding="utf-8")
        print(
            "ERROR: JavaScript validation failed. The original "
            "quiz_runner.js was restored.",
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

    print(
        "Installed the no-border completed-country click fix v2."
    )
    print()
    print("Find / no borders:")
    print(
        "  - Clicking an already-completed wrong land country "
        "now registers as wrong."
    )
    print(
        "  - Attempts and accuracy update through the existing "
        "wrong-answer path."
    )
    print()
    print("Regular click:")
    print(
        "  - Clicking an already-completed country remains ignored."
    )
    print()
    print("Ocean:")
    print(
        "  - Ocean clicks remain ignored because no map feature "
        "is returned."
    )
    print()
    print(f"Backup: {backup}")
    print(f"Diff:   {diff_path}")
    print()
    print("Changed only src/js/quiz_runner.js.")
    print("No page or sitemap regeneration is required.")

    if output:
        print(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
