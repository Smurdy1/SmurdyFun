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

    // helper: return the group keys that will be generated for a given manifest entry
    function getGroupKeysForManifest(mm) {
        return mm.groupSet ? Object.keys(groups || {}) : ["__all__"];
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
            // produce more searchable titles like:
            // "Africa Map Quiz – Click the Countries | Smurdy"
            const actionType = (m.type || m.mode || "").toString().toLowerCase();
            let actionVerb = "Play the";
            if (actionType.includes("click")) actionVerb = "Click the";
            else if (actionType.includes("type")) actionVerb = "Type the";
            else if (actionType.includes("find")) actionVerb = "Find the";
            // special-case find-point id to be clearer
            if ((m.id || "").toString().toLowerCase().includes("find-point")) {
                actionVerb = "Find the point in the";
            }
            function capitalizeWords(s) {
                return String(s || "").replace(/\b\w/g, c => c.toUpperCase());
            }
            const unitPluralTitle = capitalizeWords(unitPlural);
            const siteName = "Smurdy";
            const pageTitle = `${groupLabel} Map Quiz – ${actionVerb} ${unitPluralTitle} | ${siteName}`;
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

            // find other quizzes that also include this group (for the "Other quizzes" list)
            const otherQuizzes = manifest
                .map(mm => {
                    const mmId = mm.id || slug(mm.title || mm.file || "quiz");
                    const mmTitle = mm.title || mm.name || mmId;
                    const mmGroupKeys = getGroupKeysForManifest(mm);
                    return { id: mmId, title: mmTitle, groups: mmGroupKeys };
                })
                .filter(mm => mm.id !== manifestId && mm.groups && mm.groups.includes(gid))
                .slice(0, 8); // cap list to 8 items

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
     /* simplified style aligned with the main page */
     :root{--brand:#0077cc;--muted:#666}
     body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;color:#111;margin:0}
     /* left floating brand / similar to main page */
     .panel-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;background-color:rgba(180, 180, 180, 0.12);padding:18px}
     .panel-brand img{width:56px;height:56px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.12)}
     .panel-brand .brand-text{font-weight:700;font-size:18px}
     main{max-width:980px;margin:24px auto;padding:10px}
     header h1{font-size:22px;margin:0 0 8px}
     .meta{color:var(--muted);font-size:13px;margin-bottom:12px}
     .lead{margin:14px 0;color:#222}
     .examples{margin-top:14px}
     .examples ul{padding-left:20px}
     .action-row{display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap}
     .qb-btn{display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;border:1px solid.transparent}
     .qb-btn.primary{background:var(--brand);color:#fff}
     .qb-btn.secondary{background:#f4f4f4;color:#111}
     .other-quizzes{margin-top:20px;border-top:1px solid #eee;padding-top:14px}
    /* pill/button list for other quizzes */
    .other-quizzes .chip-list{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;padding:0;list-style:none}
    .other-quizzes .chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 14px;
      border-radius:999px;
      background:#f4f4f4;
      color:#111;
      text-decoration:none;
      border:1px solid rgba(0,0,0,0.04);
      font-size:14px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 14px;
      border-radius:999px;
      background:#f4f4f4;
      color:#111;
      text-decoration:none;
      border:1px solid rgba(0,0,0,0.06);
      font-size:14px;
      box-shadow:0 1px 0 rgba(0,0,0,0.02);
      transition:all .12s ease;
      cursor:pointer;
    }
    .other-quizzes .chip:focus{outline:2px solid rgba(0,119,204,0.18);outline-offset:2px}
    .other-quizzes .chip:hover{
      background:#0077cc;
      color:#fff;
      transform:translateY(-1px);
      border-color:rgba(0,119,204,0.22);
    }
     footer{max-width:980px;margin:18px auto;color:var(--muted);font-size:13px;padding:0 20px 30px}
   </style>
 </head>
 <body>
  <a class="panel-brand" href="${publicRoot}" title="Smurdy">
    <img src="/assets/images/Smurdeye.png" alt="Smurdy logo">
    <div class="brand-text">Smurdy</div>
  </a>

   <main>
     <header>
       <h1>${escapeHtml(pageTitle)}</h1>
       <div class="meta">Quiz: ${escapeHtml(m.type || m.mode || "")} — Group: ${escapeHtml(groupLabel)}</div>
     </header>

     <section>
       <p class="lead">${leadText}</p>

       ${actionNote ? `<p>${escapeHtml(actionNote)} Click "Open quiz" to begin. Tip: zoom or pan the map to inspect small places and islands before answering.</p>` : `<p>Click "Open quiz" to begin. Tip: zoom or pan the map to inspect small places and islands before answering.</p>`}

       ${notableList.length ? `<section class="examples"><strong>Example ${escapeHtml(unitPlural)}:</strong><ul>${notableList.map(n => `<li>${escapeHtml(n)}</li>`).join("")}</ul></section>` : ""}

       <div class="action-row">
         <a class="qb-btn primary" href="/?quiz=${encodeURIComponent(m.file || manifestId)}&mode=${encodeURIComponent(linkMode)}${gid !== "__all__" ? "&group=" + encodeURIComponent(gid) : ""}">Open quiz</a>
         <a class="qb-btn secondary" href="${publicRoot}/">Back to home</a>
       </div>
     </section>

     ${otherQuizzes.length ? `<aside class="other-quizzes"><strong>Other quizzes in ${escapeHtml(groupLabel)}:</strong><div class="chip-list">${otherQuizzes.map(q => `<a class="chip" href="${publicRoot}/quizzes/${slug(q.id)}/${slug(gid)}/">${escapeHtml(q.title)}</a>`).join("")}</div></aside>` : ""}
   </main>

    <footer>Smurdy — geography quizzes. <a href="${publicRoot}/">Home</a> · <a href="https://forms.gle/XjJoHBNKSrHLWg1h9" target="_blank" rel="noopener">Feedback</a></footer>
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