(() => {
    // manifest will be populated at init (try global first, then fetch JSON)
    let baseManifest = window.SmurdyQuizManifest || [];

    async function loadManifest() {
        // 1) prefer an inlined global manifest if present
        if (window.SmurdyQuizManifest && Array.isArray(window.SmurdyQuizManifest) && window.SmurdyQuizManifest.length) {
            return window.SmurdyQuizManifest;
        }

        // 2) try to load the JS manifest by injecting a script tag (manifest.js)
        try {
            await new Promise((resolve, reject) => {
                // avoid injecting twice
                if (document.querySelector('script[data-manifest="true"]')) return resolve();
                const s = document.createElement("script");
                s.src = "/src/js/manifest.js";
                s.async = true;
                s.setAttribute("data-manifest", "true");
                s.onload = () => resolve();
                s.onerror = (e) => reject(new Error("failed to load manifest.js"));
                document.head.appendChild(s);
            });
            if (window.SmurdyQuizManifest && Array.isArray(window.SmurdyQuizManifest) && window.SmurdyQuizManifest.length) {
                return window.SmurdyQuizManifest;
            }
        } catch (e) {
            // swallow and fallback
        }

        // 3) final fallback: try fetching JSON (if you ever keep manifest.json)
        try {
            const res = await fetch("/src/data/manifest.json", { cache: "no-cache" });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length) return json;
            }
        } catch (e) { /* ignore */ }

        // 4) empty fallback
        return [];
    }

    let groups = {};

    // Wait until SmurdyQuiz.groups is populated (or timeout). Returns a Promise<boolean>.
    async function waitForGroups(timeout = 800) {
        const start = Date.now();
        if (window.SmurdyQuiz && Object.keys(window.SmurdyQuiz.groups || {}).length > 0) return true;
        return new Promise(resolve => {
            const iv = setInterval(() => {
                if (window.SmurdyQuiz && Object.keys(window.SmurdyQuiz.groups || {}).length > 0) {
                    clearInterval(iv);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(iv);
                    resolve(false);
                }
            }, 40);
        });
    }

    // Mobile run-state helpers
    // Deterministically show/hide the two panels on narrow viewports based on URL (no body-class juggling).
    function updateMobileRunState() {
        const isMobile = (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
        const quizPanel = document.getElementById("quiz-panel");
        const browserPanel = document.getElementById("quiz-browser");

        // Reset to default (desktop) when not mobile
        if (!isMobile) {
            if (quizPanel) quizPanel.style.display = "";
            if (browserPanel) browserPanel.style.display = "";
            return;
        }

        // On mobile: show quiz panel only when URL indicates a running quiz (path OR query)
        const params = new URLSearchParams(location.search);
        const hasQuizParam = !!params.get("quiz");
        const isQuizPath = /^\/quizzes\/[^\/]+\/[^\/]+\/?$/.test(location.pathname);
        if (isQuizPath || hasQuizParam) {
            if (quizPanel) quizPanel.style.display = "flex";
            if (browserPanel) browserPanel.style.display = "none";
        } else {
            // homepage state on mobile: hide left quiz panel, show browser
            if (quizPanel) quizPanel.style.display = "none";
            if (browserPanel) {
                browserPanel.style.display = "flex";
                // keep browser panel constrained by its CSS
            }
        }
    }

    // update on back/forward and resize
    window.addEventListener("popstate", updateMobileRunState);
    window.addEventListener("resize", updateMobileRunState);

    /* Utility ------------------------------------------------------------- */
    function escapeHtml(text) {
        return String(text || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function tokenize(q) {
        return (q || "").toString().trim().toLowerCase().split(/\s+/).filter(Boolean);
    }

    function slug(s) {
        return String(s || "")
            .toLowerCase()
            .replace(/[^\w\- ]+/g, "")
            .trim()
            .replace(/\s+/g, "-");
    }

    function quizLandingPath(manifestItem, groupId) {
        const quizId = manifestItem?.id || manifestItem?.file || manifestItem?.title || "quiz";
        return `/quizzes/${slug(quizId)}/${slug(groupId || "world")}/`;
    }

    function isPlainLeftClick(e) {
        return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    }

    // Return a user-visible label for a manifest "type"
    function getFriendlyTypeLabel(type) {
        if (!type) return "Quiz";
        const t = String(type).toLowerCase();
        if (t === "countries") return "Countries";
        if (t === "states") return "States";
        if (t === "find") return "Find";
        if (t === "quiz") return "Quiz";
        // fallback: split on common separators and title-case
        return t.replace(/[_\-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
    
    /* Build data views ---------------------------------------------------- */
    function buildTypeCards() {
        // gather types and aggregate tags/title metadata
        const types = {};
        for (const q of baseManifest) {
            const t = q.type || "quiz";
            if (!types[t]) types[t] = { type: t, title: t, tags: new Set(), examples: [] };
            (q.tags || []).forEach(tag => types[t].tags.add(tag.toLowerCase()));
            types[t].examples.push(q);
        }
        return Object.values(types).map(t => {
            return { ...t, tags: Array.from(t.tags) };
        });
    }

    function buildGroupCardsForType(type) {
        // groups is an object loaded from JSON
        const out = [];
        for (const [id, g] of Object.entries(groups || {})) {
            // skip if group doesn't support this type
            if (g.allowedTypes && !g.allowedTypes.includes(type)) continue;
            const tagSet = new Set((g.tags || []).map(s => s.toLowerCase()));
            if (g.borderset) tagSet.add(String(g.borderset).toLowerCase());
            // heuristics for derived tags
            if ((g.countries || []).length && (g.countries || []).length < 30) tagSet.add("small");
            if (id.match(/island|pacific|caribbean|tiny/)) tagSet.add("island");
            out.push({
                id,
                label: g.label || id,
                tags: Array.from(tagSet),
                meta: g
            });
        }
        return out;
    }

    /* UI creation -------------------------------------------------------- */
    function ensureBrowserUI() {
        let panel = document.getElementById("quiz-browser");
        if (panel) {
            injectBrowserStyles();
            return panel;
        }

        panel = document.createElement("div");
        panel.id = "quiz-browser";
        document.body.appendChild(panel);
        injectBrowserStyles();
        return panel;
    }

    function injectBrowserStyles() {
        if (document.getElementById("quiz-browser-styles")) return;
        const style = document.createElement("style");
        style.id = "quiz-browser-styles";
        style.textContent = `
        /* desktop: anchored top-right, fixed size so layout remains unchanged on PC */
        #quiz-browser {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 380px;
            max-width: 380px;
            max-height: calc(100vh - 32px);
            overflow: hidden;
            z-index: 2000;
            background: rgba(255,255,255,0.96);
            border-radius:12px;
            box-shadow:0 10px 28px rgba(0,0,0,0.18);
            display:flex;
            flex-direction:column;
            font-family: Arial, sans-serif;
            padding:12px 16px;
            box-sizing: border-box;
            margin: 0;
        }

        /* make sure all children respect container box sizing */
        #quiz-browser, #quiz-browser * { box-sizing: border-box; }

        /* inner blocks */
        #qb-header { padding:14px 0 8px 0; border-bottom:1px solid rgba(0,0,0,0.06); display:flex; align-items:center; gap:8px; }
        #qb-title { font-weight:700; font-size:18px; color:#111; flex:1; }
        #qb-search { padding:10px 0 12px 0; border-bottom:1px solid rgba(0,0,0,0.06); }
        #qb-search input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #e0e0e0; }
        #qb-list { overflow:auto; padding:0; display:flex; flex-direction:column; gap:10px; }
        .qb-card { background:#fbfbfb; border:1px solid #eee; border-radius:12px; padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
        .qb-row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .qb-title { font-weight:700; color:#111; margin:0 0 6px 0; font-size:15px; }
        .qb-sub { color:#666; font-size:13px; margin:0; }
        .qb-tags { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
        .qb-tag { font-size:11px; padding:5px 8px; background:#eee; border-radius:999px; color:#444; }
        .qb-play { margin-left:8px; padding:8px 10px; background:#222; color:#fff; border-radius:8px; border:0; cursor:pointer; font-weight:700; text-decoration:none; display:inline-block; }
        .qb-empty { padding:18px; text-align:center; color:#777; }
        .qb-back { margin-right:8px; padding:6px 10px; border-radius:8px; background:#f3f3f3; border:1px solid #e0e0e0; cursor:pointer; font-weight:600; }

        /* Always-visible directory links at the bottom of the browser panel. */
        #qb-list {
            flex: 1 1 auto;
            min-height: 0;
        }
        #qb-directory-links {
            flex: 0 0 auto;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(0,0,0,0.10);
            background: rgba(255,255,255,0.98);
        }
        .qb-directory-primary {
            display: block;
            width: 100%;
            padding: 11px 12px;
            border-radius: 9px;
            background: #0077cc;
            color: #fff;
            text-decoration: none;
            text-align: center;
            font-size: 15px;
            font-weight: 800;
        }
        .qb-directory-primary:hover,
        .qb-directory-primary:focus {
            background: #005fa3;
        }
        .qb-directory-popular {
            display: flex;
            justify-content: center;
            gap: 5px 10px;
            flex-wrap: wrap;
            margin-top: 9px;
            font-size: 12px;
        }
        .qb-directory-popular a {
            color: #174f76;
            text-decoration: none;
            font-weight: 700;
        }
        .qb-directory-popular a:hover,
        .qb-directory-popular a:focus {
            text-decoration: underline;
        }

        /* Mobile / narrow-screen adjustments: centered and inset with safe-area padding + extra margin */
        @media (max-width: 700px) {
            /* add an extra 12px margin inside safe-area so panel always appears floating */
            #quiz-browser {
                position: fixed !important;
                left: calc(env(safe-area-inset-left, 12px) + 12px) !important;
                right: calc(env(safe-area-inset-right, 12px) + 12px) !important;
                top: calc(env(safe-area-inset-top, 12px) + 6px) !important;
                width: auto !important;
                /* ensure there's extra horizontal breathing room beyond safe-area */
                max-width: calc(100% - (env(safe-area-inset-left, 12px) + env(safe-area-inset-right, 12px) + 48px));
                max-height: calc(100vh - 36px);
                max-height: calc(100dvh - 36px);
                overflow: auto !important;
                margin: 0 auto;
                border-radius: 10px;
                padding: 10px !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.12);
            }

            /* limit list height and make touch targets larger */
            #qb-list { max-height: calc(3 * 76px); overflow: auto; }
            .qb-card { padding:14px 14px; }
            .qb-play { padding:10px 12px; font-size:15px; }
        }

        /* improve filter input touch behavior */
        input#qb-filter { -webkit-tap-highlight-color: rgba(0,0,0,0.05); touch-action: manipulation; }
        `;
        document.head.appendChild(style);
    }

    /* smurdy-browser-directory-v1 */
    function renderDirectoryLinks() {
        return `
            <nav id="qb-directory-links" aria-label="Browse geography quizzes">
                <a class="qb-directory-primary" href="/quizzes/">Browse All Quizzes</a>
                <div class="qb-directory-popular" aria-label="Popular quiz pages">
                    <a href="/quizzes/click-country/world/">World</a>
                    <a href="/quizzes/click-country/europe/">Europe</a>
                    <a href="/quizzes/click-country/asia/">Asia</a>
                    <a href="/quizzes/click-country/africa/">Africa</a>
                    <a href="/quizzes/click-country/us_states/">US States</a>
                </div>
            </nav>
        `;
    }

    /* Views --------------------------------------------------------------- */
    let currentView = "types"; // "types" or "groups"
    let activeType = null;
    let pendingManifestToLaunch = null; // when non-null, renderGroupsView will launch this manifest item

    function renderTypesView(filter = "") {
        // Simplified: show the manifest list as the single browse UI.
        // Keep the same filter semantics by delegating to renderManifestView.
        renderManifestView(filter);
     }

    // Render the raw manifest list (individual quiz entries)
    function renderManifestView(filter = "") {
        const panel = ensureBrowserUI();

        // preserve caret/focus so typing isn't interrupted by re-rendering the panel
        const oldInput = panel.querySelector && panel.querySelector("#qb-filter");
        const oldCaret = oldInput ? oldInput.selectionStart : null;

        const tokens = tokenize(filter);
        const q = (baseManifest || []).map(m => {
            const title = m.title || m.file || m.id;
            let desc = "";
            if (typeof m.descriptionTemplate === "string") desc = m.descriptionTemplate.replace(/\{group\}/g, "").trim();
            else if (m.file) desc = m.file;
            return { id: m.id, title, desc, tags: m.tags || [], raw: m };
        }).filter(t => {
            if (!tokens.length) return true;
            const hay = [t.id, t.title, t.desc, ...(t.tags || [])].join(" ").toLowerCase();
            return tokens.every(tok => hay.includes(tok));
        });

        const headerTitle = activeType ? `Select Group` : "Quizzes";

        panel.innerHTML = `
            <div id="qb-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div id="qb-title">${headerTitle}</div>
                </div>
            </div>
            <div id="qb-search"><input id="qb-filter" placeholder="Search quizzes or tags" value="${escapeHtml(filter)}"/></div>
            <div id="qb-list">
                ${q.length ? q.map(t => `
                    <div class="qb-card" data-manifest-id="${escapeHtml(t.id)}">
                        <div class="qb-row">
                            <div>
                                <div class="qb-title">${escapeHtml(t.title)}</div>
                                <div class="qb-sub">${escapeHtml(t.desc||"")}</div>
                            </div>
                            <div>
                                <button class="qb-play" data-manifest-id="${escapeHtml(t.id)}">Choose</button>
                            </div>
                        </div>
                        <div class="qb-tags">
                            ${(t.tags||[]).map(tag => `<span class="qb-tag">${escapeHtml(tag)}</span>`).join("")}
                        </div>
                    </div>
                `).join("") : `<div class="qb-empty">No quizzes match your search.</div>`}
            </div>
            ${renderDirectoryLinks()}
        `;

        // restore focus/selection to the recreated input so typing continues smoothly
        try {
            const newInput = panel.querySelector("#qb-filter");
            // On mobile, avoid auto-focusing (this opens the keyboard and can shift the viewport).
            const isMobile = (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
            if (newInput && oldCaret !== null && !isMobile) {
                newInput.focus();
                newInput.setSelectionRange(oldCaret, oldCaret);
            }
        } catch (e) { /* ignore focus restore errors */ }

        // no Back button here (gamemode/manifest selector)

        panel.querySelector("#qb-filter").addEventListener("input", (e) => renderManifestView(e.target.value));

        panel.querySelectorAll(".qb-play").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.manifestId;
                const manifestItem = (baseManifest || []).find(m => m.id === id);
                if (!manifestItem) return;
 
                if (manifestItem.groupSet && Object.keys(groups || {}).length) {
                    pendingManifestToLaunch = manifestItem;
                    renderGroupsView(manifestItem.type || manifestItem.type || "type", "");
                    return;
                }
 
                // Ensure groups are loaded before inferring run options (avoids wrong mode inference).
                await waitForGroups(800);
                const run = (window.AppModes && typeof window.AppModes.inferRunOptions === "function")
                    ? window.AppModes.inferRunOptions({ manifestItem, groupId: "", groups: window.SmurdyQuiz?.groups || groups })
                    : { mode: "countries", bordersFlag: (manifestItem.borders ? 1 : 0) };

                if (typeof window.launchQuiz === "function") {
                    const extra = { group: "", borders: String(run.bordersFlag) };
                    window.launchQuiz(manifestItem.file, run.mode, extra);
                } else {
                    const params = new URLSearchParams();
                    params.set("mode", run.mode);
                    params.set("quiz", manifestItem.file);
                    params.set("borders", String(run.bordersFlag));
                    window.location.search = params.toString();
                }
            });
        });
    }

    function renderGroupsView(type, filter = "") {
        currentView = "groups";
        activeType = type;
        const panel = ensureBrowserUI();
        // preserve caret/focus for the search input
        const oldInput = panel.querySelector && panel.querySelector("#qb-filter");
        const oldCaret = oldInput ? oldInput.selectionStart : null;
        const groupsList = buildGroupCardsForType(type);
        const tokens = tokenize(filter);

        const filtered = groupsList.filter(g => {
            if (!tokens.length) return true;
            const hay = [g.label, g.id, ...(g.tags||[])].join(" ").toLowerCase();
            return tokens.every(tok => hay.includes(tok));
        });

        panel.innerHTML = `
            <div id="qb-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <div id="qb-title">Select Group</div>
                <button id="qb-back" class="qb-back">Back</button>
            </div>
        </div>
            <div id="qb-search"><input id="qb-filter" placeholder="Search groups or tags (e.g. africa, island, states)" value="${escapeHtml(filter)}"/></div>
            <div id="qb-list">
                ${filtered.length ? filtered.map(g => `
                    <div class="qb-card" data-group="${escapeHtml(g.id)}">
                        <div class="qb-row">
                            <div>
                                <div class="qb-title">${escapeHtml(g.label)}</div>
                                <div class="qb-sub">${escapeHtml(g.meta && g.meta.description ? g.meta.description : "")}</div>
                            </div>
                            <div>
                                <a class="qb-play" href="${escapeHtml(quizLandingPath(pendingManifestToLaunch || baseManifest.find(q => q.type === type && q.groupSet) || baseManifest.find(q => q.type === type) || {}, g.id))}" data-group="${escapeHtml(g.id)}" data-type="${escapeHtml(type)}">Play</a>
                            </div>
                        </div>
                        <div class="qb-tags">
                            ${(g.tags||[]).map(tag => `<span class="qb-tag">${escapeHtml(tag)}</span>`).join("")}
                        </div>
                    </div>
                `).join("") : `<div class="qb-empty">No groups match your search.</div>`}
            </div>
            ${renderDirectoryLinks()}
        `;

         // restore focus/selection to the recreated input so typing continues smoothly
        try {
            const newInput = panel.querySelector("#qb-filter");
            // On mobile, avoid auto-focusing (this opens the keyboard and can shift the viewport).
            const isMobile = (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
            if (newInput && oldCaret !== null && !isMobile) {
                newInput.focus();
                newInput.setSelectionRange(oldCaret, oldCaret);
            }
        } catch (e) { /* ignore */ }

        // wire back button to return to gamemode/type selection (group selector)
        const backBtn = panel.querySelector("#qb-back");
        if (backBtn) {
            backBtn.addEventListener("click", () => {
                pendingManifestToLaunch = null;
                currentView = "types";
                activeType = null;
                renderTypesView();
            });
        }

        panel.querySelector("#qb-filter").addEventListener("input", (e) => {
            renderGroupsView(type, e.target.value);
        });

        panel.querySelectorAll(".qb-play").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                // The anchor is a real crawlable fallback. Only intercept ordinary left-clicks.
                if (!isPlainLeftClick(e)) return;
                e.preventDefault();

                const group = btn.dataset.group;
                const type = btn.dataset.type;
                // ensure group metadata is available before launching (avoids wrong mode inference)
                await waitForGroups(800);
                if (pendingManifestToLaunch) {
                    startQuizForManifest(pendingManifestToLaunch, group);
                    pendingManifestToLaunch = null;
                } else {
                    startQuizFor(type, group);
                }
            });
        });
    }

    /* Start quiz ---------------------------------------------------------- */
    function startQuizFor(type, groupId) {
        // pick the most appropriate quiz definition from baseManifest
        let quizDef = baseManifest.find(q => q.type === type && q.groupSet);
        if (!quizDef) quizDef = baseManifest.find(q => q.type === type) || baseManifest[0];
        if (!quizDef) {
            console.warn("No quiz definition found to start");
            return;
        }

        // Use centralized inference so multiple entry paths choose the same mode/borders.
        const run = (window.AppModes && typeof window.AppModes.inferRunOptions === "function")
            ? window.AppModes.inferRunOptions({ manifestItem: quizDef, groupId, groups })
            : { mode: (typeof quizDef.mode === "string" ? quizDef.mode : "countries"), bordersFlag: Number(Boolean(quizDef.borders)) };

        const extra = { group: groupId, borders: String(run.bordersFlag) };
        if (typeof window.launchQuiz === "function") {
            window.launchQuiz(quizDef.file, run.mode, extra);
        } else {
            const params = new URLSearchParams();
            params.set("mode", run.mode);
            params.set("quiz", quizDef.file);
            params.set("group", groupId);
            params.set("borders", String(run.bordersFlag));
            window.location.search = params.toString();
        }
    }

    // Launch a specific manifest entry for a chosen group (used when a manifest was selected first)
    function startQuizForManifest(manifestItem, groupId) {
        if (!manifestItem) return;
        const run = (window.AppModes && typeof window.AppModes.inferRunOptions === "function")
            ? window.AppModes.inferRunOptions({ manifestItem, groupId, groups })
            : { mode: manifestItem.mode || "countries", bordersFlag: Number(Boolean(manifestItem.borders)) };
 
         // prefer launcher if available
         const quizRef = manifestItem.file || manifestItem.id || "";
         if (typeof window.launchQuiz === "function") {
            const extra = { group: groupId, borders: String(run.bordersFlag) };
             try {
                 // If manifest provided an inline config, merge it
                 if (manifestItem.config && typeof manifestItem.config === "object") {
                     const cfg = Object.assign({}, manifestItem.config, extra);
                     window.launchQuiz(cfg.file || quizRef, run.mode, cfg);
                 } else {
                    window.launchQuiz(quizRef, run.mode, extra);
                 }
             } catch (err) {
                 console.warn("startQuizForManifest: in-place launch failed, falling back to navigation", err);
                 const params = new URLSearchParams();
                params.set("mode", run.mode);
                 if (quizRef) params.set("quiz", quizRef);
                 params.set("group", groupId);
                 params.set("borders", String(run.bordersFlag));
                 window.location.search = params.toString();
             }
             // hide panel
             const panel = document.getElementById("quiz-browser");
             if (panel) {
                 panel.style.transition = "opacity 180ms ease, transform 180ms ease";
                 panel.style.opacity = "0";
                 panel.style.transform = "translateY(-8px)";
                 setTimeout(() => { panel.style.display = "none"; }, 200);
             }
             return;
         }
 
         // fallback to URL navigation
         const params = new URLSearchParams();
         params.set("mode", run.mode);
         if (quizRef) params.set("quiz", quizRef);
         params.set("group", groupId);
         params.set("borders", String(run.bordersFlag));
         window.location.search = params.toString();
     }

    /* Existing launchQuiz lives in this file already - keep it as-is; if not present,
       fallback to URL navigation. We assume launchQuiz() is defined below globally. */

    /* Init --------------------------------------------------------------- */
    async function init() {
        ensureBrowserUI();

        // load manifest (preferred) before rendering types
        try {
            baseManifest = await loadManifest();
        } catch (e) {
            baseManifest = window.SmurdyQuizManifest || [];
        }

        try {
            const res = await fetch("/src/data/country_groups.json");
            groups = await res.json();
        } catch (err) {
            console.warn("Could not load country_groups.json", err);
            groups = {};
        }

        // On narrow/mobile viewports: mark the body so CSS can hide the homepage info panel.
        // Do not mutate inline styles here so we can restore the left panel when a quiz runs.
        updateMobileRunState();

        // default view: types
        renderTypesView();
    }

    init();
})();

(function globalLaunch() {
    // Ensure launchQuiz exists for startQuizFor / buttons
    window.launchQuiz = function launchQuiz(file, mode, extraParams = {}) {
        const params = new URLSearchParams();
        params.set("mode", mode);
        params.set("quiz", file);
        for (const [k, v] of Object.entries(extraParams || {})) {
            params.set(k, v);
        }

        if (window.SmurdyQuiz && typeof window.SmurdyQuiz.loadQuizScript === "function") {
            try {
                window.SmurdyQuiz.currentMode = mode;
                if (extraParams.group) window.SmurdyQuiz.currentGroupId = extraParams.group;
                if (typeof extraParams.borders !== "undefined") {
                    window.SmurdyQuiz.currentShowBorders = Boolean(Number(extraParams.borders));
                }

                try {
                    // Ask runtime to load in-place
                    window.SmurdyQuiz.loadQuizScript(file, { updateUrl: true });
                } catch (err) {
                    throw err;
                } finally {
                    // After attempting to start, make panel visibility deterministic for mobile
                    try { updateMobileRunState(); } catch (_) {}
                }
                 return;
            } catch (err) {
                console.warn("In-place launch failed, falling back to navigation:", err);
                try { updateMobileRunState(); } catch(_) {}
            }
        }

        window.location.search = params.toString();
    };
})();