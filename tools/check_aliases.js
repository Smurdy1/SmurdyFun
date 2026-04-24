const fs = require('fs');
const path = require('path');

function stripComments(src) {
    return src
        .replace(/\/\/.*$/mg, '')            // remove // comments
        .replace(/\/\*[\s\S]*?\*\//mg, '');  // remove /* ... */ comments
}

function loadJsonMaybeCommented(p) {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(stripComments(raw));
}

const repoRoot = path.resolve(__dirname, '..');
const groupsPath = path.join(repoRoot, 'src', 'data', 'country_groups.json');
const aliasesPath = path.join(repoRoot, 'src', 'data', 'aliases.json');

const groups = loadJsonMaybeCommented(groupsPath);
const aliases = loadJsonMaybeCommented(aliasesPath);

const groupNames = new Set();
for (const gid of Object.keys(groups)) {
    const g = groups[gid];
    if (Array.isArray(g.countries)) {
        for (const name of g.countries) groupNames.add(name);
    }
}

const aliasKeys = new Set(Object.keys(aliases));

const missing = [...groupNames].filter(n => !aliasKeys.has(n)).sort();

console.log('Total unique names in groups:', groupNames.size);
console.log('Total alias keys:', aliasKeys.size);
console.log('Missing names (present in groups but not in aliases):', missing.length);
if (missing.length) {
    console.log('--- Missing list ---');
    for (const m of missing) console.log(m);
}