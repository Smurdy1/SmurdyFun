(() => {
    const baseManifest = window.SmurdyQuizManifest || [];
    let groups = {};

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
        if (panel) return panel;

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
            #quiz-browser { position: absolute; top:16px; right:16px; width:380px; max-height:calc(100vh - 32px); overflow:hidden; z-index:2000;
                background: rgba(255,255,255,0.96); border-radius:12px; box-shadow:0 10px 28px rgba(0,0,0,0.18);
                display:flex; flex-direction:column; font-family: Arial, sans-serif; }
            #qb-header { padding:14px 16px; border-bottom:1px solid rgba(0,0,0,0.06); display:flex; align-items:center; gap:8px; }
            #qb-title { font-weight:700; font-size:18px; color:#111; flex:1; }
            #qb-back { background:transparent; border:0; color:#0077cc; cursor:pointer; font-weight:600; }
            #qb-search { padding:12px 16px; border-bottom:1px solid rgba(0,0,0,0.06); }
            #qb-search input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #e0e0e0; }
            #qb-list { overflow:auto; padding:12px; display:flex; flex-direction:column; gap:10px; }
            .qb-card { background:#fbfbfb; border:1px solid #eee; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px; }
            .qb-row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
            .qb-title { font-weight:700; color:#111; margin:0; font-size:15px; }
            .qb-sub { color:#666; font-size:13px; margin:0; }
            .qb-tags { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
            .qb-tag { font-size:11px; padding:5px 8px; background:#eee; border-radius:999px; color:#444; }
            .qb-play { margin-left:8px; padding:8px 10px; background:#222; color:#fff; border-radius:8px; border:0; cursor:pointer; font-weight:700; }
            .qb-empty { padding:18px; text-align:center; color:#777; }
        `;
        document.head.appendChild(style);
    }

    /* Views --------------------------------------------------------------- */
    let currentView = "types"; // "types" or "groups"
    let activeType = null;

    function renderTypesView(filter = "") {
        currentView = "types";
        activeType = null;
        const panel = ensureBrowserUI();
        const types = buildTypeCards();
        const tokens = tokenize(filter);

        const filtered = types.filter(t => {
            if (!tokens.length) return true;
            const hay = [t.type, ...(t.tags || [])].join(" ").toLowerCase();
            return tokens.every(tok => hay.includes(tok));
        });

        panel.innerHTML = `
            <div id="qb-header">
                <div id="qb-title">Choose quiz type</div>
            </div>
            <div id="qb-search"><input id="qb-filter" placeholder="Search types or tags (e.g. map, typing)" value="${escapeHtml(filter)}"/></div>
            <div id="qb-list">
                ${filtered.length ? filtered.map(t => `
                    <div class="qb-card" data-type="${escapeHtml(t.type)}">
                        <div class="qb-row">
                            <div>
                                <div class="qb-title">${escapeHtml(getFriendlyTypeLabel(t.type))}</div>
                                <div class="qb-sub">${escapeHtml((t.examples[0] && (t.examples[0].description || "")) || "")}</div>
                            </div>
                            <div>
                                <button class="qb-play" data-type="${escapeHtml(t.type)}">Choose</button>
                            </div>
                        </div>
                        <div class="qb-tags">
                            ${(t.tags||[]).map(tag => `<span class="qb-tag">${escapeHtml(tag)}</span>`).join("")}
                        </div>
                    </div>
                `).join("") : `<div class="qb-empty">No types match your search.</div>`}
            </div>
        `;

        panel.querySelector("#qb-filter").addEventListener("input", (e) => {
            renderTypesView(e.target.value);
        });

        panel.querySelectorAll(".qb-play").forEach(btn => {
            btn.addEventListener("click", () => {
                const type = btn.dataset.type;
                renderGroupsView(type);
            });
        });
    }

    function getFriendlyTypeLabel(type) {
        if (type === "click") return "Click";
        if (type === "type") return "Type";
        if (type === "find") return "Find";
        return (type || "Quiz").replace(/-/g, " ");
    }

    function renderGroupsView(type, filter = "") {
        currentView = "groups";
        activeType = type;
        const panel = ensureBrowserUI();
        const groupsList = buildGroupCardsForType(type);
        const tokens = tokenize(filter);

        const filtered = groupsList.filter(g => {
            if (!tokens.length) return true;
            const hay = [g.label, g.id, ...(g.tags||[])].join(" ").toLowerCase();
            return tokens.every(tok => hay.includes(tok));
        });

        panel.innerHTML = `
            <div id="qb-header">
                <button id="qb-back">← Back</button>
                <div id="qb-title">${escapeHtml(getFriendlyTypeLabel(type))} — select group</div>
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
                                <button class="qb-play" data-group="${escapeHtml(g.id)}" data-type="${escapeHtml(type)}">Play</button>
                            </div>
                        </div>
                        <div class="qb-tags">
                            ${(g.tags||[]).map(tag => `<span class="qb-tag">${escapeHtml(tag)}</span>`).join("")}
                        </div>
                    </div>
                `).join("") : `<div class="qb-empty">No groups match your search.</div>`}
            </div>
        `;

        panel.querySelector("#qb-back").addEventListener("click", () => renderTypesView(""));

        panel.querySelector("#qb-filter").addEventListener("input", (e) => {
            renderGroupsView(type, e.target.value);
        });

        panel.querySelectorAll(".qb-play").forEach(btn => {
            btn.addEventListener("click", () => {
                const group = btn.dataset.group;
                const type = btn.dataset.type;
                startQuizFor(type, group);
            });
        });
    }

    /* Start quiz ---------------------------------------------------------- */
    function startQuizFor(type, groupId) {
        // pick the most appropriate quiz definition from baseManifest
        // prefer quizzes that target a groupSet (country_groups) and match the type
        let quizDef = baseManifest.find(q => q.type === type && q.groupSet);
        if (!quizDef) quizDef = baseManifest.find(q => q.type === type) || baseManifest[0];
        if (!quizDef) {
            console.warn("No quiz definition found to start");
            return;
        }

        // determine group's borderset and numeric flag (as browse.js used previously)
        const g = groups[groupId] || {};
        const borderset = (typeof g.borderset !== "undefined") ? g.borderset : (quizDef.borders ? "countries" : "none");
        const bs = String(borderset).toLowerCase();
        let bordersFlag = 0;
        if (bs === "states" || bs === "countries") bordersFlag = 1;
        if (type === "find") bordersFlag = 0;

        // determine runtime mode (states -> 'states' else countries)
        const mode = (bs === "states") ? "states" : "countries";

        // call the global launcher; use window.launchQuiz to avoid a ReferenceError
        const extra = { group: groupId, borders: String(bordersFlag) };
        if (typeof window.launchQuiz === "function") {
            window.launchQuiz(quizDef.file, mode, extra);
        } else {
            // fallback to URL navigation if launcher isn't available yet
            const params = new URLSearchParams();
            params.set("mode", mode);
            params.set("quiz", quizDef.file);
            params.set("group", groupId);
            params.set("borders", String(bordersFlag));
            window.location.search = params.toString();
        }
    }

    /* Existing launchQuiz lives in this file already - keep it as-is; if not present,
       fallback to URL navigation. We assume launchQuiz() is defined below globally. */

    /* Init --------------------------------------------------------------- */
    async function init() {
        ensureBrowserUI();

        try {
            const res = await fetch("/src/data/country_groups.json");
            groups = await res.json();
        } catch (err) {
            console.warn("Could not load country_groups.json", err);
            groups = {};
        }

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

        // If runtime exists but mode differs, navigate so app initializes the correct MODE
        if (window.SmurdyQuiz && window.SmurdyQuiz.mode && window.SmurdyQuiz.mode !== mode) {
            window.location.search = params.toString();
            return;
        }

        // If runtime can load quizzes in-place, use it
        if (window.SmurdyQuiz && typeof window.SmurdyQuiz.loadQuizScript === "function") {
            try {
                window.SmurdyQuiz.currentMode = mode;
                if (extraParams.group) window.SmurdyQuiz.currentGroupId = extraParams.group;
                if (typeof extraParams.borders !== "undefined") {
                    window.SmurdyQuiz.currentShowBorders = Boolean(Number(extraParams.borders));
                }
                window.SmurdyQuiz.loadQuizScript(file);

                // hide the browser panel after starting
                const panel = document.getElementById("quiz-browser");
                if (panel) {
                    panel.style.transition = "opacity 180ms ease, transform 180ms ease";
                    panel.style.opacity = "0";
                    panel.style.transform = "translateY(-8px)";
                    setTimeout(() => { panel.style.display = "none"; }, 200);
                }
                return;
            } catch (err) {
                console.warn("In-place launch failed, falling back to navigation:", err);
            }
        }

        // fallback: navigate via URL params
        window.location.search = params.toString();
    };
})();