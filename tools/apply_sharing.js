"use strict";

const fs = require("fs").promises;
const path = require("path");

const SITE_ORIGIN = "https://smurdy.fun";
const ASSET_VERSION = "20260910-sharing-2";
const SKIP_DIRECTORIES = new Set([".git", ".github", ".backups", "Old", "node_modules"]);

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractAttribute(html, selectorPattern, attribute) {
    const match = html.match(selectorPattern);
    if (!match) return "";
    const attr = match[0].match(new RegExp(`${attribute}=["']([^"']*)["']`, "i"));
    return attr ? attr[1] : "";
}

function titleFromHtml(html) {
    const ogTitle = extractAttribute(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i, "content");
    if (ogTitle) return ogTitle;
    const title = html.match(/<title>([\s\S]*?)<\/title>/i);
    return title ? title[1].replace(/<[^>]+>/g, "").trim() : "Smurdy";
}

function descriptionFromHtml(html) {
    const ogDescription = extractAttribute(html, /<meta\b[^>]*property=["']og:description["'][^>]*>/i, "content");
    if (ogDescription) return ogDescription;
    return extractAttribute(html, /<meta\b[^>]*name=["']description["'][^>]*>/i, "content") ||
        "Free geography quizzes on Smurdy.";
}

function canonicalFromHtml(html, relativePath) {
    const canonicalTag = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
    const canonical = canonicalTag
        ? extractAttribute(canonicalTag[0], /<link\b[^>]*>/i, "href")
        : "";
    if (canonical) return canonical;

    const slashPath = relativePath.replace(/\\/g, "/");
    if (slashPath === "index.html") return `${SITE_ORIGIN}/`;
    if (slashPath.endsWith("/index.html")) return `${SITE_ORIGIN}/${slashPath.slice(0, -"index.html".length)}`;
    return `${SITE_ORIGIN}/${slashPath}`;
}

function quizRoute(relativePath, html) {
    if (!/data-smurdy-quiz-page/i.test(html)) return null;
    const slashPath = relativePath.replace(/\\/g, "/");
    const match = slashPath.match(/^quizzes\/([^/]+)\/([^/]+)\/index\.html$/i);
    if (!match) return null;
    return { quizId: match[1], groupId: match[2] };
}

function replaceOrInsertMeta(html, attributeName, key, content) {
    const keyPattern = escapeRegExp(key);
    const tagPattern = new RegExp(`<meta\\b[^>]*${attributeName}=["']${keyPattern}["'][^>]*>`, "i");
    const tag = `  <meta ${attributeName}="${escapeHtml(key)}" content="${escapeHtml(content)}">`;
    if (tagPattern.test(html)) return html.replace(tagPattern, tag.trimStart());
    return html.replace(/\s*<\/head>/i, `\n${tag}\n</head>`);
}

function upsertShareAssets(html) {
    const styleTag = `  <link rel="stylesheet" href="/styles/share.css?v=${ASSET_VERSION}" data-smurdy-share-asset>`;
    const scriptTag = `  <script src="/src/js/share.js?v=${ASSET_VERSION}" defer data-smurdy-share-asset></script>`;
    const stylePattern = /\s*<link\b[^>]*data-smurdy-share-asset[^>]*>/i;
    const scriptPattern = /\s*<script\b[^>]*data-smurdy-share-asset[^>]*><\/script>/i;

    if (stylePattern.test(html)) html = html.replace(stylePattern, `\n${styleTag}`);
    else html = html.replace(/\s*<\/head>/i, `\n${styleTag}\n</head>`);

    if (scriptPattern.test(html)) html = html.replace(scriptPattern, `\n${scriptTag}`);
    else html = html.replace(/\s*<\/body>/i, `\n${scriptTag}\n</body>`);
    return html;
}

function applyMetadata(html, relativePath) {
    const title = titleFromHtml(html);
    const description = descriptionFromHtml(html);
    const canonical = canonicalFromHtml(html, relativePath);
    const quiz = quizRoute(relativePath, html);
    const image = quiz
        ? `${SITE_ORIGIN}/assets/social/quizzes/${quiz.quizId}/${quiz.groupId}.png?v=${ASSET_VERSION}`
        : `${SITE_ORIGIN}/assets/social/smurdy.png?v=${ASSET_VERSION}`;
    const imageAlt = quiz
        ? `${title.replace(/\s*\|\s*Smurdy\s*$/i, "")} on Smurdy`
        : "Smurdy geography quizzes";

    html = replaceOrInsertMeta(html, "property", "og:type", "website");
    html = replaceOrInsertMeta(html, "property", "og:site_name", "Smurdy");
    html = replaceOrInsertMeta(html, "property", "og:title", title);
    html = replaceOrInsertMeta(html, "property", "og:description", description);
    html = replaceOrInsertMeta(html, "property", "og:url", canonical);
    html = replaceOrInsertMeta(html, "property", "og:image", image);
    html = replaceOrInsertMeta(html, "property", "og:image:width", "1200");
    html = replaceOrInsertMeta(html, "property", "og:image:height", "630");
    html = replaceOrInsertMeta(html, "property", "og:image:alt", imageAlt);
    html = replaceOrInsertMeta(html, "name", "twitter:card", "summary_large_image");
    html = replaceOrInsertMeta(html, "name", "twitter:title", title);
    html = replaceOrInsertMeta(html, "name", "twitter:description", description);
    html = replaceOrInsertMeta(html, "name", "twitter:image", image);
    html = replaceOrInsertMeta(html, "name", "twitter:image:alt", imageAlt);
    return upsertShareAssets(html);
}

async function walk(directory, prefix = "") {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
        const fullPath = path.join(directory, entry.name);
        const relativePath = path.join(prefix, entry.name);
        if (entry.isDirectory()) files.push(...await walk(fullPath, relativePath));
        else if (entry.isFile() && entry.name.endsWith(".html")) files.push({ fullPath, relativePath });
    }
    return files;
}

(async function main() {
    const repoRoot = path.resolve(__dirname, "..");
    const files = await walk(repoRoot);
    let changed = 0;
    for (const file of files) {
        const source = await fs.readFile(file.fullPath, "utf8");
        const updated = applyMetadata(source, file.relativePath);
        if (updated !== source) {
            await fs.writeFile(file.fullPath, updated, "utf8");
            changed++;
        }
    }
    console.log(`Applied sharing metadata and controls to ${files.length} public HTML files (${changed} changed).`);
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
