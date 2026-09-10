"use strict";

const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");

const WIDTH = 1200;
const HEIGHT = 630;
const MODE_LABELS = {
    "click-country": "Click the Countries",
    "type-country": "Type the Countries",
    "find-country": "No Borders",
    "find-point": "Find from a Point",
    "click-subdivision": "Click the States",
    "type-subdivision": "Type the States",
    "find-subdivision": "No Borders States",
    "find-point-subdivision": "Find State from a Point",
    "type-flag": "Type the Flags",
    "type-capital": "Type the Capitals"
};
const ACCENTS = {
    "click-country": "#0878bd",
    "type-country": "#276f9a",
    "find-country": "#416d61",
    "find-point": "#6c5d82",
    "click-subdivision": "#0878bd",
    "type-subdivision": "#276f9a",
    "find-subdivision": "#416d61",
    "find-point-subdivision": "#6c5d82",
    "type-flag": "#9a4d5e",
    "type-capital": "#8a6d32"
};

function escapeXml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function decodeHtml(value) {
    return String(value || "")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function stripTags(value) {
    return decodeHtml(String(value || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function wrapWords(text, maxCharacters = 25, maxLines = 2) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || candidate.length <= maxCharacters) line = candidate;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`;
    return kept;
}

function parsePage(html, relativePath) {
    if (!/data-smurdy-quiz-page/i.test(html)) return null;
    const route = relativePath.replace(/\\/g, "/").match(/^([^/]+)\/([^/]+)\/index\.html$/);
    if (!route) return null;
    const quizId = route[1];
    const groupId = route[2];
    const currentLabel = html.match(/<span[^>]+aria-current=["']page["'][^>]*>([\s\S]*?)<\/span>/i);
    const groupLabel = stripTags(currentLabel?.[1] || groupId.replace(/[_-]+/g, " "));
    const modeLabel = MODE_LABELS[quizId] || quizId.replace(/[_-]+/g, " ");
    const meta = html.match(/<div[^>]+class=["'][^"']*(?:flag-meta|\bmeta\b)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const metaText = stripTags(meta?.[1] || "");
    const detail = metaText.includes(" / ") ? metaText.split(" / ").pop().trim() : "Free geography quiz";
    return { quizId, groupId, groupLabel, modeLabel, detail };
}

async function walkHtml(directory, prefix = "") {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const relative = path.join(prefix, entry.name);
        if (entry.isDirectory()) files.push(...await walkHtml(fullPath, relative));
        else if (entry.isFile() && entry.name === "index.html") files.push({ fullPath, relative });
    }
    return files;
}

function decorativeLines(accent) {
    return `
      <circle cx="1030" cy="315" r="285" fill="${accent}" opacity="0.075"/>
      <circle cx="1030" cy="315" r="205" fill="none" stroke="${accent}" stroke-width="3" opacity="0.14"/>
      <ellipse cx="1030" cy="315" rx="92" ry="205" fill="none" stroke="${accent}" stroke-width="3" opacity="0.14"/>
      <path d="M825 260 C930 215 1130 215 1235 260" fill="none" stroke="${accent}" stroke-width="3" opacity="0.14"/>
      <path d="M825 370 C930 415 1130 415 1235 370" fill="none" stroke="${accent}" stroke-width="3" opacity="0.14"/>
      <circle cx="1030" cy="315" r="10" fill="${accent}" opacity="0.45"/>`;
}

function buildQuizSvg(page, logoDataUri) {
    const accent = ACCENTS[page.quizId] || "#0878bd";
    const groupLines = wrapWords(page.groupLabel, 24, 2);
    const groupFont = groupLines.some(line => line.length > 22) ? 54 : 64;
    const groupLineHeight = groupFont + 8;
    const firstY = groupLines.length === 1 ? 262 : 224;
    const modeY = firstY + groupLines.length * groupLineHeight + 30;
    const groupText = groupLines.map((line, index) =>
        `<text x="74" y="${firstY + index * groupLineHeight}" font-size="${groupFont}" font-weight="700" fill="#171717">${escapeXml(line)}</text>`
    ).join("\n");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="1200" height="630" fill="#fbfcfd"/>
  <rect width="14" height="630" fill="${accent}"/>
  ${decorativeLines(accent)}
  <image href="${logoDataUri}" x="72" y="54" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>
  <text x="166" y="103" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#171717">Smurdy</text>
  <g font-family="Arial, Helvetica, sans-serif">
    ${groupText}
    <text x="76" y="${modeY}" font-size="31" font-weight="600" fill="${accent}">${escapeXml(page.modeLabel)}</text>
    <line x1="76" y1="${modeY + 39}" x2="690" y2="${modeY + 39}" stroke="#d8dde0" stroke-width="2"/>
    <text x="76" y="${modeY + 91}" font-size="24" font-weight="400" fill="#666">${escapeXml(page.detail)}</text>
    <text x="76" y="566" font-size="23" font-weight="600" fill="#444">Free geography quiz</text>
    <text x="76" y="598" font-size="21" font-weight="400" fill="#777">smurdy.fun</text>
  </g>
</svg>`;
}

function buildDefaultSvg(logoDataUri) {
    const accent = "#0878bd";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fbfcfd"/>
  <rect width="14" height="630" fill="${accent}"/>
  ${decorativeLines(accent)}
  <image href="${logoDataUri}" x="72" y="56" width="82" height="82" preserveAspectRatio="xMidYMid meet"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="176" y="110" font-size="38" font-weight="700" fill="#171717">Smurdy</text>
    <text x="74" y="275" font-size="66" font-weight="700" fill="#171717">Geography quizzes</text>
    <text x="76" y="338" font-size="30" font-weight="400" fill="#555">Countries, flags, capitals, states, and maps.</text>
    <line x1="76" y1="390" x2="690" y2="390" stroke="#d8dde0" stroke-width="2"/>
    <text x="76" y="450" font-size="26" font-weight="600" fill="${accent}">Pick a quiz and start playing.</text>
    <text x="76" y="598" font-size="21" font-weight="400" fill="#777">smurdy.fun</text>
  </g>
</svg>`;
}

async function writePng(svg, destination) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9, palette: true, colours: 128 })
        .toFile(destination);
}

(async function main() {
    const repoRoot = path.resolve(__dirname, "..");
    const quizzesDir = path.join(repoRoot, "quizzes");
    const socialDir = path.join(repoRoot, "assets", "social");
    const logoPath = path.join(repoRoot, "assets", "images", "smurdeye-transparent.png");
    const logoBase64 = (await fs.readFile(logoPath)).toString("base64");
    const logoDataUri = `data:image/png;base64,${logoBase64}`;

    await fs.rm(path.join(socialDir, "quizzes"), { recursive: true, force: true });
    await fs.mkdir(socialDir, { recursive: true });
    await writePng(buildDefaultSvg(logoDataUri), path.join(socialDir, "smurdy.png"));

    const files = await walkHtml(quizzesDir);
    let generated = 0;
    for (const file of files) {
        const html = await fs.readFile(file.fullPath, "utf8");
        const page = parsePage(html, file.relative);
        if (!page) continue;
        const destination = path.join(socialDir, "quizzes", page.quizId, `${page.groupId}.png`);
        await writePng(buildQuizSvg(page, logoDataUri), destination);
        generated++;
    }

    console.log(`Generated ${generated} quiz social preview images plus the default Smurdy preview.`);
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
