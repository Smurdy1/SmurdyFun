from pathlib import Path


theme = Path("styles/theme.css")
text = theme.read_text()
old = '''html[data-smurdy-theme="dark"] .smurdy-page-share-actions button,
html[data-smurdy-theme="dark"] .smurdy-page-share-close,
html[data-smurdy-theme="dark"] .smurdy-quiz-suggestion-close {
    color: #dfe4e7;
}
'''
new = '''html[data-smurdy-theme="dark"] .smurdy-page-share-actions button {
    border-color: #4a555d;
    background: #30383e;
    color: #dfe4e7;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-actions button:hover {
    border-color: #58656f;
    background: #343e45;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-actions button[data-share-action="native"] {
    border-color: #2489c9;
    background: #2489c9;
    color: #fff;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-actions button[data-share-action="native"]:hover {
    background: #3298d8;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-close,
html[data-smurdy-theme="dark"] .smurdy-quiz-suggestion-close {
    color: #dfe4e7;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-status {
    color: #aab3b9;
}
'''
if old not in text:
    raise SystemExit("share dialog dark rule not found")
theme.write_text(text.replace(old, new, 1))

apply = Path("tools/apply_sharing.js")
text = apply.read_text().replace(
    'const THEME_ASSET_VERSION = "20260914-dark-mode-4";',
    'const THEME_ASSET_VERSION = "20260914-dark-mode-5";',
)
apply.write_text(text)

test = Path("tests/theme.test.js")
text = test.read_text().replace("20260914-dark-mode-4", "20260914-dark-mode-5")
if "share dialog action buttons use dark surfaces" not in text:
    text += r'''

test("share dialog action buttons use dark surfaces", () => {
    const css = read("styles/theme.css");
    assert.match(css, /smurdy-page-share-actions button\s*\{[\s\S]*background:\s*#30383e/);
    assert.match(css, /smurdy-page-share-actions button:hover\s*\{[\s\S]*background:\s*#343e45/);
    assert.match(css, /data-share-action="native"\]\s*\{[\s\S]*background:\s*#2489c9/);
    assert.match(css, /smurdy-page-share-status\s*\{[\s\S]*color:\s*#aab3b9/);
});
'''
test.write_text(text)
