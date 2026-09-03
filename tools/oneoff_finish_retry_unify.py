from pathlib import Path
import re

runner_path = Path("src/js/quiz_runner.js")
runner = runner_path.read_text()
pattern = r'''    function startMissedRetry\(names\) \{.*?\n    \}\n\n    function buildCompletionResult'''
replacement = '''    function startMissedRetry(names) {
        names = (Array.isArray(names) ? names : [])
            .map(name => getCanonicalDisplayName(name))
            .filter(Boolean);
        if (!names.length || typeof window.runNameQuiz !== "function") return;

        hidePostQuizReview();
        window.runNameQuiz({
            ...config,
            includeNames: names,
            retryWeakSpots: true
        });
    }

    function buildCompletionResult'''
runner, count = re.subn(pattern, replacement, runner, count=1, flags=re.S)
if count != 1:
    raise SystemExit("map retry block not found exactly once")
runner_path.write_text(runner)

weak_path = Path("src/js/weak_spots.js")
weak = weak_path.read_text()
old_label = '            label: definition.label + " · " + humanizeGroup(group),'
new_label = '            label: definition.label + ": " + humanizeGroup(group),'
if weak.count(old_label) != 1:
    raise SystemExit("Weak Spots stage label anchor not found exactly once")
weak = weak.replace(old_label, new_label, 1)
pattern = r'''\n    function reviewNamesFromButton\(button\) \{.*?\n    \}\n\n    function installRetryInterception\(\) \{.*?\n    \}\n'''
weak, count = re.subn(pattern, "\n", weak, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Weak Spots retry interception block not found exactly once")
if weak.count("        installRetryInterception();") != 1:
    raise SystemExit("Weak Spots retry interception install call not found exactly once")
weak = weak.replace("        installRetryInterception();\n", "", 1)
weak_path.write_text(weak)

test_path = Path("tests/quiz_completion.test.js")
test = test_path.read_text()
test += r'''

test("Retry Missed has one owner and map retries preserve their current mode", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.join(__dirname, "..");
    const mapRunner = fs.readFileSync(path.join(root, "src/js/quiz_runner.js"), "utf8");
    const weakSpotsSource = fs.readFileSync(path.join(root, "src/js/weak_spots.js"), "utf8");

    assert.match(
        mapRunner,
        /window\.runNameQuiz\(\{[\s\S]*?\.\.\.config,[\s\S]*?includeNames: names,[\s\S]*?retryWeakSpots: true/
    );
    assert.doesNotMatch(mapRunner, /retryQuizId|history\.pushState\(\{\}, "", path\)/);
    assert.doesNotMatch(weakSpotsSource, /installRetryInterception|weakSpotsRetryDelegated/);
    assert.doesNotMatch(weakSpotsSource, /#quiz-review-retry, \[data-flag-retry\]/);
});
'''
test_path.write_text(test)

weak_test_path = Path("tests/weak_spots.test.js")
weak_test = weak_test_path.read_text()
old = '    assert.equal(flags.group, "europe");\n    assert.deepEqual(Array.from(flags.names), ["France", "Germany"]);'
new = '    assert.equal(flags.group, "europe");\n    assert.equal(flags.label, "Flags: Europe");\n    assert.deepEqual(Array.from(flags.names), ["France", "Germany"]);'
if weak_test.count(old) != 1:
    raise SystemExit("Weak Spots label test anchor not found exactly once")
weak_test_path.write_text(weak_test.replace(old, new, 1))

print("Final shared retry cleanup applied.")
