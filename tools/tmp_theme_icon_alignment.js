const fs = require('fs');

let css = fs.readFileSync('styles/theme.css', 'utf8');
css = css.replace(
`.home-quick-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
}

.smurdy-theme-toggle {
    width: 38px;
    height: 38px;
    min-width: 38px;
    min-height: 38px;`,
`.home-quick-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
}

.home-quick-actions .weak-spots-menu-button {
    margin-top: 0;
}

.smurdy-theme-toggle {
    width: 42px;
    height: 42px;
    min-width: 42px;
    min-height: 42px;`
);
css = css.replace(
`.smurdy-theme-icon {
    width: 19px;
    height: 19px;`,
`.smurdy-theme-icon {
    width: 20px;
    height: 20px;`
);
if (!css.includes('.home-quick-actions .weak-spots-menu-button')) throw new Error('alignment rule was not installed');
if (!css.includes('width: 42px;')) throw new Error('theme toggle was not resized');
fs.writeFileSync('styles/theme.css', css);

let tests = fs.readFileSync('tests/theme.test.js', 'utf8');
tests = tests.replace(/width:\\s\*38px/, 'width:\\s*42px');
if (!tests.includes('width:\\s*42px')) throw new Error('theme toggle size test was not updated');
if (!tests.includes('home-quick-actions')) throw new Error('theme toggle placement test missing');
fs.writeFileSync('tests/theme.test.js', tests);
