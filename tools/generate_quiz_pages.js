const fs = require("fs").promises;
const path = require("path");
const vm = require("vm");

(async function main() {
    const repoRoot = path.resolve(__dirname, "..");
    const manifestPath = path.join(repoRoot, "src", "js", "manifest.js");
    const groupsPath = path.join(repoRoot, "src", "data", "country_groups.json");
    const outDir = path.join(repoRoot, "docs", "quizzes");
    const baseUrl = process.env.BASE_URL || "https://www.smurdy.fun";

    // load groups JSON
    let groups = {};
    try {
        const gtext = await fs.readFile(groupsPath, "utf8");
        groups = JSON.parse(gtext);
    } catch (e) {
        console.warn("Could not load country_groups.json:", e.message);
    }

    // load manifest.js by evaluating in VM to capture window.SmurdyQuizManifest
    let manifest = [];
    try {
        const code = await fs.readFile(manifestPath, "utf8");
        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox, { filename: "manifest.js" });
        manifest = sandbox.window.SmurdyQuizManifest || [];
        if (!Array.isArray(manifest)) manifest = [];
    } catch (e) {
        console.warn("Could not load manifest.js:", e.message);
    }

    if (!manifest.length) {
        console.error("No manifest entries found; aborting.");
        process.exit(1);
    }

    // ensure output folder
    await fs.mkdir(outDir, { recursive: true });

    function slug(s) {
        return String(s || "")
            .toLowerCase()
            .replace(/[^\w\- ]+/g, "")
            .trim()
            .replace(/\s+/g, "-");
    }

    const pages = [];

    for (const m of manifest) {
        const manifestId = m.id || slug(m.title || m.file || "quiz");
        const titleBase = m.title || m.name || manifestId;
        // choose groups to enumerate: if manifest has groupSet, use all groups; else create single global page
        const groupSet = m.groupSet;
        const groupKeys = groupSet ? Object.keys(groups || {}) : ["__all__"];
        for (const gid of groupKeys) {
            const groupLabel = gid === "__all__" ? "All regions" : (groups[gid] && groups[gid].label) ? groups[gid].label : gid;
            const pageTitle = `${titleBase} — ${groupLabel}`;
            const descTemplate = (typeof m.descriptionTemplate === "string") ? m.descriptionTemplate : (m.config && m.config.titleBuilder ? (m.config.titleBuilder("").toString()) : (m.description || ""));
            const description = (descTemplate || "").replace(/\{group\}/g, groupLabel).trim() || `${titleBase} (${groupLabel})`;
            const tags = (m.tags || []).slice(0,6).map(t => String(t));
            const relPath = path.join(slug(manifestId), slug(gid));
            const outPathDir = path.join(outDir, relPath);
            await fs.mkdir(outPathDir, { recursive: true });
            const outFile = path.join(outPathDir, "index.html");

            // Build minimal, unique HTML page (no redirect) with meta + JSON-LD + a short handcrafted paragraph
            // Allow manifest authors to provide small SEO/play copy so new quizzes don't require editing this script.
            // Priority:
            //  1) m.playHint or m.config.playHint (short instruction shown above the button)
            //  2) infer from m.type / m.config.mode as a fallback
            const explicitPlayHint = (m.playHint || (m.config && m.config.playHint) || "").toString().trim();
            let actionNote = explicitPlayHint;
            if (!actionNote) {
                const actionMode = String(m.type || (m.config && m.config.mode) || "").toLowerCase();
                if (actionMode.includes("type")) actionNote = "You will type region names to answer.";
                else if (actionMode.includes("click")) actionNote = "You will click the correct region on the map.";
                else actionNote = "";
            }

            // Lead text: prefer a short manifest-provided summary (shortDescription or seoIntro),
            // otherwise use the resolved description (from descriptionTemplate).
            const leadSource = (m.shortDescription || m.seoIntro || description).toString().trim();
            const leadText = `${escapeHtml(groupLabel)}: ${escapeHtml(leadSource)}`;

            const pageHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <meta name="keywords" content="${escapeHtml(tags.join(", "))}"/>
  <link rel="canonical" href="${baseUrl}/quizzes/${relPath}/" />
  <meta name="robots" content="index, follow"/>
  <!-- use same site icon as the main page -->
  <link rel="icon" type="image/png" href="/assets/images/Smurdeye.png" />
  <meta property="og:image" content="${baseUrl}/assets/images/Smurdeye.png" />
  <script type="application/ld+json">
  ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": pageTitle,
        "description": description,
        "url": `${baseUrl}/quizzes/${relPath}/`
    }, null, 2)}
  </script>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;color:#111;padding:28px;max-width:760px;margin:0 auto}
    header h1{font-size:20px;margin:0 0 8px}
    .meta{color:#666;font-size:13px;margin-bottom:12px}
    .lead{margin:14px 0}
    a.button{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:8px;background:#0077cc;color:#fff;text-decoration:none}
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(pageTitle)}</h1>
    <div class="meta">Quiz: ${escapeHtml(m.type || m.mode || "")} — Group: ${escapeHtml(groupLabel)}</div>
  </header>

  <main>
    <p class="lead">${leadText}</p>

    ${actionNote ? `<p>${escapeHtml(actionNote)} Click "Open quiz" to begin. Tip: zoom or pan the map to inspect small places and islands before answering.</p>` : `<p>Click "Open quiz" to begin. Tip: zoom or pan the map to inspect small places and islands before answering.</p>`}

    <a class="button" href="/?quiz=${encodeURIComponent(m.file || manifestId)}&mode=${encodeURIComponent(m.mode || m.type || "")}${gid !== "__all__" ? "&group=" + encodeURIComponent(gid) : ""}">Open quiz</a>
  </main>
</body>
</html>`;
             await fs.writeFile(outFile, pageHtml, "utf8");
             pages.push(`${baseUrl}/quizzes/${relPath}/`);
        }
    }

    // sitemap
    if (pages.length) {
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(u => `  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`).join("\n")}
</urlset>`;
        await fs.writeFile(path.join(repoRoot, "docs", "sitemap.xml"), sitemap, "utf8");
        console.log(`Wrote ${pages.length} quiz pages + sitemap.xml to docs/`);
    } else {
        console.log("No pages generated.");
    }

    process.exit(0);

    // util
    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
})();