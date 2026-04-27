const fs = require("fs").promises;
const path = require("path");
const vm = require("vm");

(async function main() {
    const repoRoot = path.resolve(__dirname, "..");
    const manifestPath = path.join(repoRoot, "src", "js", "manifest.js");
    const groupsPath = path.join(repoRoot, "src", "data", "country_groups.json");
    // write pages directly into the repo (quizzes/) instead of docs/
    const outDir = path.join(repoRoot, "quizzes");
    const baseUrl = (process.env.BASE_URL || "https://www.smurdy.fun").replace(/\/+$/, "");
    // PUBLIC_ROOT override: if set, use it verbatim. Default to baseUrl (no /docs).
    const publicRoot = (process.env.PUBLIC_ROOT && process.env.PUBLIC_ROOT.trim())
        ? process.env.PUBLIC_ROOT.replace(/\/+$/, "")
        : baseUrl.replace(/\/docs$/i, "");
  
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
            // determine the unit name for this group (singular)
            const unitName = (gid !== "__all__" && groups[gid] && groups[gid].unitName) ? String(groups[gid].unitName).trim() : "region";
            // simple pluralizer for common units (country/state/province/county), fallback to add 's'
            function pluralizeUnit(u) {
                const low = String(u || "").toLowerCase();
                if (low === "country") return "countries";
                if (low === "state") return "states";
                if (low === "province") return "provinces";
                if (low === "county") return "counties";
                if (low.endsWith("y")) return low.slice(0, -1) + "ies";
                return low + "s";
            }
            const unitPlural = pluralizeUnit(unitName);
            const groupLabel = gid === "__all__" ? "All regions" : (groups[gid] && groups[gid].label) ? groups[gid].label : gid;
            const pageTitle = `${titleBase} — ${groupLabel}`;
            const descTemplate = (typeof m.descriptionTemplate === "string") ? m.descriptionTemplate : (m.config && m.config.titleBuilder ? (m.config.titleBuilder("").toString()) : (m.description || ""));
            const description = (descTemplate || "").replace(/\{group\}/g, groupLabel).trim() || `${titleBase} (${groupLabel})`;
            const tags = (m.tags || []).slice(0,6).map(t => String(t));
            // use POSIX URL-friendly path for the public URL
            const relPath = `${slug(manifestId)}/${slug(gid)}`;
            // file-system path for where we write the files (docs/quizzes/...)
            const outPathDir = path.join(outDir, relPath);
            await fs.mkdir(outPathDir, { recursive: true });
            const outFile = path.join(outPathDir, "index.html");

            // Build minimal, unique HTML page (no redirect) with meta + JSON-LD + a short handcrafted paragraph
            // Allow manifest authors to provide small SEO/play copy so new quizzes don't require editing this script.
            // Priority:
            //  1) m.playHint or m.config.playHint (short instruction shown above the button)
            //  2) infer from m.type / m.config.mode as a fallback
            // derive a short action note from the quiz type/mode, prefer manifest playHint/config
            const explicitPlayHint = (m.playHint || (m.config && m.config.playHint) || "").toString().trim();
            let actionNote = explicitPlayHint;
            if (!actionNote) {
                const actionMode = String(m.type || (m.config && m.config.mode) || "").toLowerCase();
                if (actionMode.includes("type")) actionNote = `You will type ${unitPlural} names to answer.`;
                else if (actionMode.includes("click")) actionNote = `You will click the correct ${unitName} on the map.`;
                else actionNote = "";
            }

            // Lead text: prefer a short manifest-provided summary (shortDescription or seoIntro),
            // otherwise use the resolved description (from descriptionTemplate).
            const leadSource = (m.shortDescription || m.seoIntro || description).toString().trim();
            const leadText = `${escapeHtml(groupLabel)}: ${escapeHtml(leadSource)}`;

            // pick 5 example units: prefer group.notable, otherwise fall back to first 5 in the group's countries array
            const notableList = (gid !== "__all__" && groups[gid] && Array.isArray(groups[gid].notable) && groups[gid].notable.length)
                ? groups[gid].notable.slice(0, 5)
                : (gid !== "__all__" && groups[gid] && Array.isArray(groups[gid].countries) ? groups[gid].countries.slice(0, 5) : []);

            // determine which mode to open the quiz with:
            // For pages tied to a specific group prefer that group's borderset (e.g. "states" for US states).
            // Otherwise fall back to manifest m.mode or "countries".
            let linkMode = "countries";
            if (gid !== "__all__" && groups[gid] && groups[gid].borderset) {
                linkMode = String(groups[gid].borderset).trim();
            } else if (m.mode && String(m.mode).trim()) {
                linkMode = String(m.mode).trim();
            } else if (m.type && String(m.type).trim()) {
                // fallback: use manifest type if it maps sensibly
                linkMode = String(m.type).trim();
            }

             const pageHtml = `<!doctype html>
 <html lang="en">
 <head>
   <meta charset="utf-8"/>
   <meta name="viewport" content="width=device-width,initial-scale=1"/>
   <title>${escapeHtml(pageTitle)}</title>
   <meta name="description" content="${escapeHtml(description)}"/>
   <meta name="keywords" content="${escapeHtml(tags.join(", "))}"/>
   <link rel="canonical" href="${publicRoot}/quizzes/${relPath}/" />
   <meta name="robots" content="index, follow"/>
   <!-- use same site icon as the main page -->
   <link rel="icon" type="image/png" href="/assets/images/Smurdeye.png" />
   <meta property="og:image" content="${publicRoot}/assets/images/Smurdeye.png" />
   <script type="application/ld+json">
   ${JSON.stringify({
         "@context": "https://schema.org",
         "@type": "WebPage",
         "name": pageTitle,
         "description": description,
         "url": `${publicRoot}/quizzes/${relPath}/`
     }, null, 2)}
   </script>
   <style>
     body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;color:#111;padding:28px;max-width:760px;margin:0 auto}
     /* site brand in top-left */
     .site-brand { position: fixed; top: 16px; left: 16px; display:flex; flex-direction:column; align-items:center; text-decoration:none; color:#111; z-index:9999; }
     .site-brand .brand-text { font-weight:700; font-size:22px; margin-bottom:6px; color:#000; }
     .site-brand img { width:60px; height:60px; display:block; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.12); }
     header h1{font-size:20px;margin:0 0 8px}
     .meta{color:#666;font-size:13px;margin-bottom:12px}
     .lead{margin:14px 0}
     .examples{margin-top:14px}
     .examples ul{padding-left:20px}
     a.button{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:8px;background:#0077cc;color:#fff;text-decoration:none}
   </style>
 </head>
 <body>
  <a class="site-brand" href="${publicRoot}" title="Smurdy">
    <div class="brand-text">Smurdy</div>
    <img src="/assets/images/Smurdeye.png" alt="Smurdy logo">
  </a>
   <header>
     <h1>${escapeHtml(pageTitle)}</h1>
     <div class="meta">Quiz: ${escapeHtml(m.type || m.mode || "")} — Group: ${escapeHtml(groupLabel)}</div>
   </header>
 
   <main>
     <p class="lead">${leadText}</p>
 
     ${actionNote ? `<p>${escapeHtml(actionNote)} Click "Open quiz" to begin. Tip: zoom or pan the map to inspect small places and islands before answering.</p>` : `<p>Click "Open quiz" to begin. Tip: zoom or pan the map to inspect small places and islands before answering.</p>`}
 
     ${notableList.length ? `<section class="examples"><strong>Example ${escapeHtml(unitPlural)}:</strong><ul>${notableList.map(n => `<li>${escapeHtml(n)}</li>`).join("")}</ul></section>` : ""}
 
     <a class="button" href="/?quiz=${encodeURIComponent(m.file || manifestId)}&mode=${encodeURIComponent(linkMode)}${gid !== "__all__" ? "&group=" + encodeURIComponent(gid) : ""}">Open quiz</a>
   </main>
 </body>
 </html>`;
             await fs.writeFile(outFile, pageHtml, "utf8");
             // ensure sitemap uses the public root (without any /docs prefix)
             pages.push(encodeURI(`${publicRoot}/quizzes/${relPath}/`));
        }
    }

    // sitemap
    if (pages.length) {
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(u => `  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`).join("\n")}
</urlset>`;
        // write sitemap to repo root so it will be available at /sitemap.xml
        await fs.writeFile(path.join(repoRoot, "sitemap.xml"), sitemap, "utf8");
        console.log(`Wrote ${pages.length} quiz pages to quizzes/ and sitemap.xml to repo root`);
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