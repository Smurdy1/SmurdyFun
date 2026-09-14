const fs = require('fs');

function replaceOrThrow(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing expected ${label}`);
  return source.replace(from, to);
}

let css = fs.readFileSync('styles/share.css', 'utf8');
if (!css.includes('/* smurdy-share-icon-button-v1 */')) {
  css += `\n/* smurdy-share-icon-button-v1 */\n.smurdy-page-share-trigger,\n#qb-header > .smurdy-page-share-trigger,\n.smurdy-page-share-trigger--quiz-topline,\n.smurdy-page-share-trigger--flag-title,\n.smurdy-page-share-trigger--landing-topline,\n.smurdy-page-share-trigger--directory-topline,\n.smurdy-page-share-trigger--site-header,\n.smurdy-page-share-trigger--panel-footer,\n.smurdy-page-share-trigger--inline {\n    width: 38px;\n    height: 38px;\n    min-width: 38px;\n    min-height: 38px;\n    padding: 0;\n    border-radius: 7px;\n    background: #f3f3f3;\n    color: #343a3f;\n    font-size: 0;\n    line-height: 1;\n}\n\n.smurdy-page-share-trigger::before {\n    content: \"\";\n    width: 19px;\n    height: 19px;\n    display: block;\n    flex: 0 0 auto;\n    background: currentColor;\n    -webkit-mask-image: url('/assets/icons/share.png');\n    mask-image: url('/assets/icons/share.png');\n    -webkit-mask-position: center;\n    mask-position: center;\n    -webkit-mask-repeat: no-repeat;\n    mask-repeat: no-repeat;\n    -webkit-mask-size: contain;\n    mask-size: contain;\n}\n\n.smurdy-page-share-trigger:hover {\n    border-color: #a7a7a7;\n    background: #e9e9e9;\n    color: #111;\n}\n\n.smurdy-page-share-trigger--quiz-topline {\n    margin-top: 2px;\n}\n\nhtml[data-smurdy-theme=\"dark\"] body .smurdy-page-share-trigger {\n    border-color: #46515a !important;\n    background: #2a3238 !important;\n    color: #cdd3d7 !important;\n}\n\nhtml[data-smurdy-theme=\"dark\"] body .smurdy-page-share-trigger:hover {\n    border-color: #58656f !important;\n    background: #343e45 !important;\n    color: #e0e4e7 !important;\n}\n\n@media (max-width: 700px) {\n    .smurdy-page-share-trigger,\n    #qb-header > .smurdy-page-share-trigger,\n    .smurdy-page-share-trigger--quiz-topline,\n    .smurdy-page-share-trigger--flag-title,\n    .smurdy-page-share-trigger--landing-topline,\n    .smurdy-page-share-trigger--directory-topline,\n    .smurdy-page-share-trigger--site-header,\n    .smurdy-page-share-trigger--panel-footer,\n    .smurdy-page-share-trigger--inline {\n        width: 36px;\n        height: 36px;\n        min-width: 36px;\n        min-height: 36px;\n    }\n\n    .smurdy-page-share-trigger::before {\n        width: 18px;\n        height: 18px;\n    }\n}\n`;
}
fs.writeFileSync('styles/share.css', css);

let apply = fs.readFileSync('tools/apply_sharing.js', 'utf8');
apply = replaceOrThrow(apply,
  'const ASSET_VERSION = "20260911-sharing-4";',
  'const ASSET_VERSION = "20260914-sharing-5";',
  'sharing asset version');
fs.writeFileSync('tools/apply_sharing.js', apply);

let tests = fs.readFileSync('tests/sharing.test.js', 'utf8');
if (!tests.includes('share trigger uses the custom compact share icon')) {
  tests += `\n\ntest(\"share trigger uses the custom compact share icon\", () => {\n    const styles = read(\"styles/share.css\");\n    assert.ok(fs.existsSync(path.join(root, \"assets/icons/share.png\")));\n    assert.match(styles, /smurdy-share-icon-button-v1/);\n    assert.match(styles, /mask-image:\\s*url\\('\\/assets\\/icons\\/share\\.png'\\)/);\n    assert.match(styles, /\\.smurdy-page-share-trigger,[\\s\\S]*width:\\s*38px/);\n    assert.match(styles, /font-size:\\s*0/);\n    assert.match(styles, /html\\[data-smurdy-theme=\"dark\"\\] body \\.smurdy-page-share-trigger/);\n});\n`;
}
fs.writeFileSync('tests/sharing.test.js', tests);
