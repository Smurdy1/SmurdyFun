const fs = require('fs');

function replaceAll(source, pairs) {
  for (const [from, to] of pairs) source = source.split(from).join(to);
  return source;
}

let theme = fs.readFileSync('src/js/theme.js', 'utf8');
theme = replaceAll(theme, [
  ['#f3f5f7', '#dfe4e7'],
  ['#181e23', '#20262b'],
  ['#3c4750', '#465159'],
  ['#bcc4ca', '#b7c0c6'],
  ['#9da7ae', '#b1bac0'],
  ['#354049', '#424c54'],
  ['#aeb7bd', '#aab3b9'],
  ['#e3e7ea', '#d7dde1'],
  ['#87929a', '#8f999f'],
  ['#12171b', '#191e22'],
  ['#c5ccd1', '#bbc3c8'],
  ['#c4cbd0', '#b9c1c6'],
  ['#eef1f3', '#dce1e4'],
  ['#c7ced3', '#bac2c7'],
  ['#f0f3f5', '#e0e4e7'],
  ['#222a30', '#2a3238'],
  ['#293239', '#313a41'],
  ['#dce1e4', '#cdd3d7'],
  ['#ccd2d6', '#c1c8cd']
]);

theme = theme.replace(
  'html[data-smurdy-theme="dark"] #quiz-timer {\n    color: #b1bac0 !important;\n}',
  'html[data-smurdy-theme="dark"] #quiz-panel #quiz-timer {\n    color: #b8c0c5 !important;\n    -webkit-text-fill-color: #b8c0c5 !important;\n}'
);

theme = theme.replace(
`html[data-smurdy-theme="dark"] #quiz-browser .qb-play,
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary {
    border-color: #2386c5 !important;
    background: #2386c5 !important;
    color: #fff !important;
    box-shadow: none !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-play:hover,
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary:hover {
    border-color: #3298d8 !important;
    background: #3298d8 !important;
}`,
`html[data-smurdy-theme="dark"] #quiz-browser .qb-play {
    border-color: #2386c5 !important;
    background: #2386c5 !important;
    color: #f5f7f8 !important;
    box-shadow: none !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-play:hover {
    border-color: #3298d8 !important;
    background: #3298d8 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary {
    border: 0 !important;
    background: transparent !important;
    color: #74b5e1 !important;
    box-shadow: none !important;
    text-decoration: underline;
    text-underline-offset: 3px;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary:hover {
    background: transparent !important;
    color: #98c9ea !important;
}`
);
fs.writeFileSync('src/js/theme.js', theme);

let css = fs.readFileSync('styles/theme.css', 'utf8');
css = replaceAll(css, [
  ['#f1f3f5', '#dfe4e7'],
  ['#a9b0b6', '#aab3b9'],
  ['rgba(24, 30, 35, 0.97)', 'rgba(32, 38, 43, 0.97)'],
  ['#22292f', '#293137'],
  ['#3b444b', '#465159'],
  ['#c5cbd0', '#bbc3c8'],
  ['#252c32', '#2a3238'],
  ['#303941', '#343e45'],
  ['#1b2227', '#242b30'],
  ['#414b53', '#4a555d'],
  ['#2b3339', '#30383e'],
  ['#2a3238', '#30383e'],
  ['#b8bec3', '#b2bbc1'],
  ['#929aa1', '#919ba1'],
  ['#0f1418', '#171c20'],
  ['#1a2025', '#22282d'],
  ['#404b54', '#4a555d'],
  ['#c6cdd2', '#bbc3c8'],
  ['#171d22', '#20262b'],
  ['#aeb7bd', '#aab3b9'],
  ['#20282e', '#2a3238'],
  ['#dce1e4', '#cdd3d7'],
  ['#293239', '#343e45']
]);
css = css.replace('background: #12171b;\n    color: #dfe4e7;', 'background: #171c20;\n    color: #dfe4e7;');
fs.writeFileSync('styles/theme.css', css);

let apply = fs.readFileSync('tools/apply_sharing.js', 'utf8');
apply = apply.replace('const THEME_ASSET_VERSION = "20260911-dark-mode-1";', 'const THEME_ASSET_VERSION = "20260911-dark-mode-2";');
fs.writeFileSync('tools/apply_sharing.js', apply);

let tests = fs.readFileSync('tests/theme.test.js', 'utf8');
tests = tests.replace(/20260911-dark-mode-1/g, '20260911-dark-mode-2');
if (!tests.includes('dark mode keeps timer readable and directory link unhighlighted')) {
  tests += `\n\ntest("dark mode keeps timer readable and directory link unhighlighted", () => {\n    const theme = read("src/js/theme.js");\n    assert.match(theme, /#quiz-panel #quiz-timer/);\n    assert.match(theme, /-webkit-text-fill-color:\\s*#b8c0c5\\s*!important/);\n    assert.match(theme, /#quiz-browser \\.qb-directory-primary \\{[\\s\\S]*background:\\s*transparent\\s*!important/);\n    assert.doesNotMatch(theme, /\\.qb-play,\\s*\\nhtml\\[data-smurdy-theme="dark"\\] #quiz-browser \\.qb-directory-primary/);\n});\n`;
}
fs.writeFileSync('tests/theme.test.js', tests);
