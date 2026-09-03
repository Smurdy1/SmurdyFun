const fs = require("node:fs");
const path = require("node:path");

function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function indexFiles(directory) {
    if (!fs.existsSync(directory)) return [];

    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...indexFiles(fullPath));
        else if (entry.isFile() && entry.name === "index.html") files.push(fullPath);
    }
    return files;
}

function canonicalFromHtml(html) {
    if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) {
        return null;
    }

    const match =
        html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    return match ? match[1].trim() : null;
}

function rebuildSitemaps({
    repoRoot,
    publicRoot = "https://smurdy.fun",
    lastmod = null
}) {
    const base = String(publicRoot || "https://smurdy.fun").replace(/\/+$/, "");
    const fixed = [
        `${base}/`,
        `${base}/quizzes/`,
        `${base}/about/`,
        `${base}/contact/`,
        `${base}/privacy/`
    ];

    const discovered = indexFiles(path.join(repoRoot, "quizzes"))
        .map(file => canonicalFromHtml(fs.readFileSync(file, "utf8")))
        .filter(url => url && url.startsWith(`${base}/`));
    const fixedSet = new Set(fixed);
    const urls = [
        ...fixed,
        ...Array.from(new Set(discovered))
            .filter(url => !fixedSet.has(url))
            .sort((a, b) => a.localeCompare(b))
    ];

    const date =
        lastmod ||
        process.env.SITEMAP_LASTMOD ||
        new Date().toISOString().slice(0, 10);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url, index) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${index < fixed.length ? "weekly" : "monthly"}</changefreq>
  </url>`).join("\n")}
</urlset>`;

    fs.writeFileSync(path.join(repoRoot, "sitemap.xml"), xml);
    fs.writeFileSync(path.join(repoRoot, "sitemap.txt"), `${urls.join("\n")}\n`);
    return urls;
}

if (require.main === module) {
    rebuildSitemaps({
        repoRoot: path.resolve(__dirname, ".."),
        publicRoot: process.env.BASE_URL || "https://smurdy.fun"
    });
}

module.exports = {
    rebuildSitemaps,
    canonicalFromHtml
};
