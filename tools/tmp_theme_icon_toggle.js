const fs = require('fs');

function replaceOrThrow(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing expected ${label}`);
  return source.replace(from, to);
}

let index = fs.readFileSync('index.html', 'utf8');
index = replaceOrThrow(index,
`             <div class="home-theme-setting">
                 <span class="home-theme-setting-label">Theme</span>
                 <button type="button" class="smurdy-theme-toggle" data-smurdy-theme-toggle aria-pressed="false">Dark mode</button>
             </div>
             <button class="weak-spots-menu-button" type="button" data-weak-spots-open>Weak Spots <span class="weak-spots-count" data-weak-spots-count hidden></span></button>`,
`             <div class="home-quick-actions">
                 <button class="weak-spots-menu-button" type="button" data-weak-spots-open>Weak Spots <span class="weak-spots-count" data-weak-spots-count hidden></span></button>
                 <button type="button" class="smurdy-theme-toggle smurdy-theme-icon-toggle" data-smurdy-theme-toggle aria-pressed="false" aria-label="Switch to dark mode" title="Dark mode">
                     <span class="smurdy-theme-icon smurdy-theme-icon--moon" aria-hidden="true"></span>
                     <span class="smurdy-theme-icon smurdy-theme-icon--sun" aria-hidden="true"></span>
                 </button>
             </div>`,
'homepage theme row');
fs.writeFileSync('index.html', index);

let theme = fs.readFileSync('src/js/theme.js', 'utf8');
theme = replaceOrThrow(theme,
`        const toggle = document.querySelector("[data-smurdy-theme-toggle]");
        if (toggle) {
            const isDark = next === DARK;
            toggle.setAttribute("aria-pressed", String(isDark));
            toggle.textContent = isDark ? "Light mode" : "Dark mode";
        }`,
`        const toggle = document.querySelector("[data-smurdy-theme-toggle]");
        if (toggle) {
            const isDark = next === DARK;
            toggle.setAttribute("aria-pressed", String(isDark));
            toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
            toggle.setAttribute("title", isDark ? "Light mode" : "Dark mode");
        }`,
'theme toggle state');
fs.writeFileSync('src/js/theme.js', theme);

let css = fs.readFileSync('styles/theme.css', 'utf8');
const start = css.indexOf('.home-theme-setting {');
const endMarker = 'html.smurdy-quiz-active .home-theme-setting {\n    display: none !important;\n}\n';
const endStart = css.indexOf(endMarker, start);
if (start < 0 || endStart < 0) throw new Error('Could not locate old homepage theme setting CSS');
const end = endStart + endMarker.length;
const replacement = `.home-quick-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
}

.smurdy-theme-toggle {
    width: 38px;
    height: 38px;
    min-width: 38px;
    min-height: 38px;
    padding: 0;
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid rgba(0, 0, 0, .18);
    border-radius: 6px;
    background: #f3f3f3;
    color: #30363a;
    cursor: pointer;
    line-height: 1;
}

.smurdy-theme-toggle:hover {
    border-color: rgba(0, 0, 0, .28);
    background: #e9e9e9;
    color: #111;
}

.smurdy-theme-toggle:focus-visible {
    outline: 3px solid rgba(0, 119, 204, .28);
    outline-offset: 2px;
}

.smurdy-theme-icon {
    width: 19px;
    height: 19px;
    display: block;
    background: currentColor;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: contain;
}

.smurdy-theme-icon--moon {
    -webkit-mask-image: url('/assets/icons/moon.png');
    mask-image: url('/assets/icons/moon.png');
}

.smurdy-theme-icon--sun {
    display: none;
    -webkit-mask-image: url('/assets/icons/sun.png');
    mask-image: url('/assets/icons/sun.png');
}

html[data-smurdy-theme="dark"] .smurdy-theme-icon--moon {
    display: none;
}

html[data-smurdy-theme="dark"] .smurdy-theme-icon--sun {
    display: block;
}

html[data-smurdy-theme="dark"] .smurdy-theme-toggle {
    border-color: #46515a;
    background: #2a3238;
    color: #cdd3d7;
}

html[data-smurdy-theme="dark"] .smurdy-theme-toggle:hover {
    border-color: #58656f;
    background: #343e45;
    color: #e0e4e7;
}

html.smurdy-quiz-active .home-quick-actions {
    display: none !important;
}
`;
css = css.slice(0, start) + replacement + css.slice(end);

// Remove the old later polish override for the text-based theme button.
css = css.replace(/\nhtml\[data-smurdy-theme="dark"\] \.smurdy-theme-toggle \{\n    min-height: 30px;[\s\S]*?\nhtml\[data-smurdy-theme="dark"\] \.smurdy-theme-toggle:hover \{\n    border-color: #58656f;\n    background: #343e45;\n    color: #fff;\n\}\n?$/, '\n');
fs.writeFileSync('styles/theme.css', css);

let apply = fs.readFileSync('tools/apply_sharing.js', 'utf8');
apply = replaceOrThrow(apply,
'const THEME_ASSET_VERSION = "20260911-dark-mode-2";',
'const THEME_ASSET_VERSION = "20260911-dark-mode-3";',
'theme asset version');
fs.writeFileSync('tools/apply_sharing.js', apply);

let tests = fs.readFileSync('tests/theme.test.js', 'utf8');
tests = tests.replace(/20260911-dark-mode-2/g, '20260911-dark-mode-3');
const firstTestStart = tests.indexOf('test("theme is persisted with a single main-menu toggle"');
const secondTestStart = tests.indexOf('\ntest("dark theme assets are installed globally"', firstTestStart);
if (firstTestStart < 0 || secondTestStart < 0) throw new Error('Could not locate theme toggle test');
const firstTest = `test("theme is persisted with a compact icon toggle beside Weak Spots", () => {
    const index = read("index.html");
    const theme = read("src/js/theme.js");
    const css = read("styles/theme.css");
    assert.match(index, /class="home-quick-actions"/);
    assert.match(index, /data-weak-spots-open[\\s\\S]*data-smurdy-theme-toggle/);
    assert.equal((index.match(/data-smurdy-theme-toggle/g) || []).length, 1);
    assert.doesNotMatch(index, /home-theme-setting/);
    assert.match(index, /smurdy-theme-icon--moon/);
    assert.match(index, /smurdy-theme-icon--sun/);
    assert.ok(fs.existsSync(path.join(root, "assets/icons/moon.png")));
    assert.ok(fs.existsSync(path.join(root, "assets/icons/sun.png")));
    assert.match(css, /mask-image:\\s*url\\('\/assets\/icons\/moon\\.png'\\)/);
    assert.match(css, /mask-image:\\s*url\\('\/assets\/icons\/sun\\.png'\\)/);
    assert.match(css, /\.smurdy-theme-toggle[\\s\\S]*width:\\s*38px/);
    assert.match(theme, /localStorage\\.getItem\\(STORAGE_KEY\\)/);
    assert.match(theme, /localStorage\\.setItem\\(STORAGE_KEY, next\\)/);
    assert.match(theme, /dataset\\.smurdyTheme = next/);
    assert.match(theme, /Switch to light mode/);
    assert.match(theme, /Switch to dark mode/);
});
`;
tests = tests.slice(0, firstTestStart) + firstTest + tests.slice(secondTestStart + 1);
fs.writeFileSync('tests/theme.test.js', tests);
