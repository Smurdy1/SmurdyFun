const fs = require("fs");
const path = require("path");
const countries = require("../src/js/i18n-iso-countries");

// Pick the languages you want to include.
// Keep this fairly small or you'll get a giant alias file.
const LANGS = [
    "en",
    "de",
    "es",
    "fr",
    "it",
    "pt",
    "nl",
    "sv",
    "pl",
    "tr"
];

// Optional manual aliases that are more quiz-style than official language names
const MANUAL_ALIASES = {
    "United States of America": [
        "usa",
        "us",
        "u.s.",
        "u.s.a.",
        "united states",
        "america"
    ],
    "United Kingdom": [
        "uk",
        "u.k.",
        "britain",
        "great britain"
    ],
    "The Gambia": [
        "gambia",
        "the gambia"
    ],
    "The Bahamas": [
        "bahamas",
        "the bahamas"
    ],
    "Czechia": [
        "czech republic"
    ],
    "Myanmar": [
        "burma"
    ],
    "Eswatini": [
        "swaziland"
    ],
    "Cabo Verde": [
        "cape verde"
    ],
    "Timor-Leste": [
        "east timor"
    ],
    "Türkiye": [
        "turkey",
        "turkiye"
    ],
    "Ivory Coast": [
        "cote divoire",
        "côte d'ivoire",
        "cote d ivoire"
    ]
};

function normalize(text) {
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function loadLocale(lang) {
    const file = require(`i18n-iso-countries/langs/${lang}.json`);
    countries.registerLocale(file);
}

for (const lang of LANGS) {
    loadLocale(lang);
}

const englishNames = countries.getNames("en");
const aliases = {};

for (const [code, englishName] of Object.entries(englishNames)) {
    const aliasSet = new Set();

    // Always allow the canonical English name
    aliasSet.add(englishName);

    for (const lang of LANGS) {
        try {
            const localized = countries.getName(code, lang);
            if (localized) aliasSet.add(localized);
        } catch {
            // ignore missing names
        }
    }

    // Add any manual aliases
    if (MANUAL_ALIASES[englishName]) {
        for (const alias of MANUAL_ALIASES[englishName]) {
            aliasSet.add(alias);
        }
    }

    // Remove duplicates by normalized form, but keep original spelling
    const seen = new Set();
    const finalAliases = [];

    for (const alias of aliasSet) {
        const norm = normalize(alias);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        finalAliases.push(alias);
    }

    aliases[englishName] = finalAliases.sort((a, b) => a.localeCompare(b));
}

fs.writeFileSync(
    path.join(__dirname, "aliases.json"),
    JSON.stringify(aliases, null, 2),
    "utf8"
);

console.log("Wrote aliases.json");