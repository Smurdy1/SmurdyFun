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
    const groupSets = {};

    async function loadGroupSet(groupSetId = "country_groups") {
        const safeId = String(groupSetId || "country_groups").trim();
        if (!/^[a-z0-9_-]+$/i.test(safeId)) {
            throw new Error(`Invalid group-set id: ${safeId}`);
        }
        if (groupSets[safeId]) return groupSets[safeId];

        const response = await fetch(`/src/data/${safeId}.json`);
        if (!response.ok) {
            throw new Error(`Could not load ${safeId}.json: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data || Array.isArray(data) || typeof data !== "object") {
            throw new Error(`Invalid group-set data: ${safeId}`);
        }

        let resolvedData = data;
        if (
            safeId === "flag_groups" &&
            window.SmurdyFlagCatalog?.expandFlagGroups
        ) {
            const countryGroups = groupSets.country_groups ||
                await loadGroupSet("country_groups");
            resolvedData = window.SmurdyFlagCatalog.expandFlagGroups(
                data,
                countryGroups
            );
        }

        groupSets[safeId] = resolvedData;
        return resolvedData;
    }

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
    function setBrowserPanelVisible(panel, visible) {
        if (!panel) return;

        panel.hidden = !visible;
        panel.setAttribute("aria-hidden", String(!visible));

        if (visible) {
            panel.style.removeProperty("pointer-events");
            panel.style.removeProperty("opacity");
            panel.style.removeProperty("transform");
            panel.style.setProperty("display", "flex", "important");
        } else {
            panel.style.setProperty("display", "none", "important");
            panel.style.setProperty(
                "pointer-events",
                "none",
                "important"
            );
        }
    }

    // Deterministically show/hide the two panels based on whether a quiz is running.
    function updateMobileRunState() {
        const isMobile = (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
        const quizPanel = document.getElementById("quiz-panel");
        const browserPanel = document.getElementById("quiz-browser");

        const params = new URLSearchParams(location.search);
        const hasQuizParam = !!params.get("quiz");
        const isQuizPath = /^\/quizzes\/[^\/]+\/[^\/]+\/?$/.test(location.pathname);
        const quizIsRunning = isQuizPath || hasQuizParam;

        if (!isMobile) {
            if (quizPanel) quizPanel.style.display = "";
            setBrowserPanelVisible(browserPanel, !quizIsRunning);
            return;
        }

        if (quizIsRunning) {
            if (quizPanel) quizPanel.style.display = "flex";
            setBrowserPanelVisible(browserPanel, false);
        } else {
            // Homepage state on mobile: hide the left panel and show the browser.
            if (quizPanel) quizPanel.style.display = "none";
            setBrowserPanelVisible(browserPanel, true);
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

    function quizLandingPath(manifestItemOrId, groupId) {
        const rawQuizId = typeof manifestItemOrId === "string"
            ? manifestItemOrId.replace(/^manifest:/i, "")
            : (
                manifestItemOrId?.id ||
                manifestItemOrId?.file ||
                manifestItemOrId?.title ||
                "quiz"
            );
        const quizId = slug(rawQuizId);
        const path = `/quizzes/${quizId}/${slug(groupId || "world")}/`;
        return path;
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
            if ((g.members || g.countries || []).length && (g.members || g.countries || []).length < 30) tagSet.add("small");
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
            border: var(--smurdy-panel-border, 1px solid rgba(0,0,0,.09));
            border-radius: var(--smurdy-radius-lg, 12px);
            box-shadow: var(--smurdy-shadow-panel, 0 8px 26px rgba(0,0,0,.14));
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
        .qb-play { margin-left:8px; padding:8px 10px; background:#005fa3; color:#fff; border-radius:8px; border:0; cursor:pointer; font-weight:700; text-decoration:none; display:inline-block; }
        .qb-play:hover,
        .qb-play:focus-visible { background:#004b82; }
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
            background: #005fa3;
            color: #fff;
            text-decoration: none;
            text-align: center;
            font-size: 15px;
            font-weight: 800;
        }
        .qb-directory-primary:hover,
        .qb-directory-primary:focus {
            background: #004b82;
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





        /* Unified quiz browser v2: three distinct selector rows and compact cards. */
        html body #quiz-browser {
            overflow: hidden !important;
        }

        /*
         * The mobile layout normally forces this panel to display:flex.
         * A running quiz must override that rule so the transparent menu
         * cannot sit above the map and capture every touch.
         */
        html body #quiz-browser[hidden],
        html body #quiz-browser[aria-hidden="true"] {
            display: none !important;
            pointer-events: none !important;
        }

        #qb-header,
        #qb-library-tabs,
        #qb-category-tabs,
        #qb-mode-tabs,
        #qb-family-tabs,
        #qb-search,
        #qb-directory-links {
            flex: 0 0 auto;
        }

        #qb-library-tabs {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 4px;
            margin: 10px 0 2px;
            padding: 4px;
            border-radius: 11px;
            background: #eef0f2;
        }

        .qb-library-tab {
            appearance: none;
            min-width: 0;
            min-height: 38px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #4b4b4b;
            padding: 7px 6px;
            font: inherit;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
        }

        .qb-library-tab:hover,
        .qb-library-tab:focus-visible {
            background: rgba(255,255,255,.72);
        }

        .qb-library-tab[aria-selected="true"] {
            background: #fff;
            color: #075f9e;
            box-shadow: 0 1px 3px rgba(0,0,0,.14);
        }

        .qb-library-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            min-height: 18px;
            margin-left: 3px;
            padding: 0 5px;
            border-radius: 999px;
            background: #dfe4e8;
            color: #555;
            font-size: 10px;
            line-height: 1;
        }

        .qb-library-tab[aria-selected="true"] .qb-library-count {
            background: #dceefb;
            color: #075f9e;
        }

        #qb-search {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: end;
            gap: 8px;
        }

        .qb-size-filter {
            display: flex;
            flex-direction: column;
            gap: 3px;
            color: #666;
            font-size: 10px;
            font-weight: 750;
        }

        #qb-size-filter {
            min-height: 38px;
            border: 1px solid #e0e0e0;
            border-radius: 9px;
            background: #fff;
            color: #333;
            padding: 7px 25px 7px 9px;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
        }

        #qb-header,
        #qb-title {
            min-width: 0;
        }

        #qb-title {
            overflow-wrap: anywhere;
        }

        /* Row 1: category cards. */
        #qb-category-tabs {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 12px 0;
            border-bottom: 1px solid rgba(0,0,0,.07);
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
        }

        .qb-category-tab {
            appearance: none;
            flex: 0 0 auto;
            min-width: 88px;
            min-height: 54px;
            border: 1px solid #d9d9d9;
            border-radius: 11px;
            background: #f7f7f7;
            color: #333;
            padding: 8px 12px;
            font: inherit;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            white-space: nowrap;
            transition: background .12s ease, border-color .12s ease;
        }

        .qb-category-tab:hover:not(:disabled),
        .qb-category-tab:focus-visible:not(:disabled) {
            border-color: #8bbce0;
            background: #f0f7fc;
        }

        .qb-category-tab[aria-selected="true"] {
            border-color: #0077cc;
            background: #0077cc;
            color: #fff;
        }

        .qb-category-tab:disabled {
            cursor: not-allowed;
            border-color: #ededed;
            background: #fafafa;
            color: #b7b7b7;
            font-weight: 650;
            opacity: .72;
        }

        .qb-coming-soon {
            display: block;
            margin-top: 4px;
            color: #bcbcbc;
            font-size: 9px;
            font-weight: 650;
            line-height: 1;
        }

        /* Row 2: compact segmented game-mode control. */
        #qb-mode-tabs {
            display: flex;
            gap: 2px;
            overflow-x: auto;
            overflow-y: hidden;
            margin: 12px 0 7px;
            padding: 4px;
            border-radius: 11px;
            background: #eef0f2;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
        }

        #qb-mode-tabs::-webkit-scrollbar {
            display: none;
        }

        .qb-mode-tab {
            appearance: none;
            flex: 0 0 auto;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #444;
            padding: 8px 12px;
            font: inherit;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            white-space: nowrap;
        }

        .qb-mode-tab:hover,
        .qb-mode-tab:focus-visible {
            background: rgba(255,255,255,.68);
        }

        .qb-mode-tab[aria-selected="true"] {
            background: #0077cc;
            color: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,.14);
        }

        .qb-mode-tab:disabled {
            cursor: not-allowed;
            color: #9b9b9b;
            opacity: .76;
        }

        .qb-mode-tab:disabled:hover {
            background: transparent;
        }

        .qb-mode-tab .qb-coming-soon {
            display: inline;
            margin: 0 0 0 5px;
            font-size: 10px;
            color: inherit;
        }

        /* Row 3: simple underlined content-family tabs. */
        #qb-family-tabs {
            display: flex;
            gap: 24px;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 5px 2px 3px;
            border-bottom: 1px solid rgba(0,0,0,.10);
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
        }

        #qb-family-tabs::-webkit-scrollbar {
            display: none;
        }

        .qb-family-tab {
            appearance: none;
            flex: 0 0 auto;
            border: 0;
            border-bottom: 3px solid transparent;
            background: transparent;
            color: #666;
            padding: 9px 1px 8px;
            font: inherit;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            white-space: nowrap;
        }

        .qb-family-tab:hover,
        .qb-family-tab:focus-visible {
            color: #222;
        }

        .qb-family-tab[aria-selected="true"] {
            border-bottom-color: #0077cc;
            color: #0077cc;
        }

        html body #quiz-browser #qb-list {
            flex: 1 1 auto;
            min-height: 0;
            max-height: none !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            padding: 10px 1px 3px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .qb-card {
            flex: 0 0 auto;
        }

        /* smurdy-card-two-column-v1 */
        .qb-card-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: start;
            gap: 12px;
            min-width: 0;
        }

        .qb-card-copy {
            min-width: 0;
        }

        .qb-card-copy .qb-title {
            min-width: 0;
            margin: 0;
            overflow-wrap: anywhere;
        }

        .qb-card-layout > .qb-play {
            align-self: start;
            min-width: 76px;
            margin: 0;
            padding: 8px 13px;
            text-align: center;
        }

        .qb-card-actions {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 7px;
            min-width: 76px;
        }

        .qb-card-actions > .qb-play {
            min-width: 76px;
            margin: 0;
            padding: 8px 13px;
            text-align: center;
        }

        .qb-favorite {
            appearance: none;
            align-self: flex-end;
            width: 36px;
            height: 34px;
            border: 1px solid #d8d8d8;
            border-radius: 8px;
            background: #fff;
            color: #626262;
            padding: 0;
            font: inherit;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
        }

        .qb-favorite:hover,
        .qb-favorite:focus-visible {
            border-color: #e2a900;
            color: #ad7900;
            background: #fffaf0;
        }

        .qb-favorite[aria-pressed="true"] {
            border-color: #e0ad25;
            background: #fff7d6;
            color: #a66f00;
        }

        .qb-card-context {
            margin-top: 4px;
            color: #075f9e;
            font-size: 11px;
            font-weight: 750;
        }

        .qb-card-copy .qb-sub {
            margin-top: 8px;
            line-height: 1.4;
        }

        .qb-card-copy .qb-tags {
            margin-top: 9px;
        }

        .qb-card-featured {
            border-color: rgba(0,119,204,.42);
            background: linear-gradient(
                135deg,
                rgba(0,119,204,.10),
                #fbfbfb 58%
            );
            box-shadow: 0 4px 14px rgba(0,119,204,.09);
        }

        .qb-main-badge {
            display: inline-block;
            margin-left: 7px;
            padding: 3px 7px;
            border-radius: 999px;
            background: #0077cc;
            color: #fff;
            font-size: 9px;
            font-weight: 850;
            line-height: 1.2;
            vertical-align: 2px;
            white-space: nowrap;
        }

        .qb-loading {
            padding: 24px 12px;
            color: #777;
            text-align: center;
        }

        @media (max-width: 700px) {
            html body #quiz-browser {
                /* smurdy-mobile-panel-top-anchor-v1 */

                /*
                 * Change this single value to resize the mobile panel.
                 * Examples: 60dvh, 70dvh, 80dvh.
                 */
                --smurdy-mobile-panel-size: 85dvh;

                position: fixed !important;
                left: 50% !important;
                right: auto !important;
                top: 12px !important;
                bottom: auto !important;
                transform: translateX(-50%) !important;

                /*
                 * The panel is 12px from both sides and 12px from the top,
                 * so the top and side gaps are exactly equal.
                 */
                width: calc(100vw - 24px) !important;
                max-width: 540px !important;

                height: min(
                    var(--smurdy-mobile-panel-size),
                    calc(100dvh - 48px)
                ) !important;
                max-height: min(
                    var(--smurdy-mobile-panel-size),
                    calc(100dvh - 48px)
                ) !important;

                margin: 0 !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                border-radius: 14px !important;
                padding: 10px 14px !important;
            }

            html body #quiz-browser #qb-list {
                flex: 1 1 auto;
                min-height: 0;
                max-height: none !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
            }

            #qb-category-tabs {
                scrollbar-width: none;
            }

            #qb-category-tabs::-webkit-scrollbar {
                display: none;
            }

            .qb-category-tab {
                min-width: 84px;
                min-height: 50px;
            }

            .qb-card {
                padding: 13px 14px;
            }

            .qb-card-layout {
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: start;
                gap: 10px;
            }

            .qb-card-layout > .qb-play {
                min-width: 72px;
                font-size: 14px;
            }

            #qb-directory-links {
                margin-top: 6px;
                padding-top: 7px;
            }

            .qb-directory-primary {
                padding: 8px 10px;
                font-size: 13px;
            }

            .qb-directory-popular {
                margin-top: 6px;
                font-size: 11px;
            }
        }


        /* smurdy-map-controls-and-collapse-v1 */

        /*
         * Keep MapLibre's zoom/compass controls in an always-available,
         * horizontal row at the bottom-left of the map.
         */
        .maplibregl-ctrl-bottom-left {
            left: 12px;
            bottom: 12px;
            z-index: 1500;
        }

        .maplibregl-ctrl-bottom-left .maplibregl-ctrl-group {
            display: flex !important;
            flex-direction: row !important;
            overflow: hidden;
        }

        .maplibregl-ctrl-bottom-left .maplibregl-ctrl-group button {
            float: none !important;
            border-top: 0 !important;
            border-bottom: 0 !important;
        }

        .maplibregl-ctrl-bottom-left .maplibregl-ctrl-group button + button {
            border-top: 0 !important;
            border-left: 1px solid #ddd !important;
        }

        #qb-mobile-weak-spots {
            display: none;
        }

        #qb-mobile-collapse {
            display: none;
        }

        @media (max-width: 700px) {
            html body #quiz-browser {
                transition:
                    transform 320ms cubic-bezier(.22, .8, .25, 1),
                    box-shadow 320ms ease !important;
                will-change: transform;
            }

            html body #quiz-browser.qb-mobile-collapsed {
                /*
                 * Slide the whole panel upward while leaving its final
                 * 40px visible as a reopening handle.
                 */
                transform:
                    translate(-50%, calc(-100% + 40px))
                    !important;
                box-shadow: 0 5px 18px rgba(0,0,0,.16) !important;
            }

            #qb-mobile-weak-spots {
                appearance: none;
                display: flex;
                flex: 0 0 auto;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                min-height: 44px;
                margin: 8px 0 0;
                padding: 10px 12px;
                border: 1px solid #d9d9d9;
                border-radius: 9px;
                background: #f5f5f5;
                color: #111;
                cursor: pointer;
                font: inherit;
                font-size: 14px;
                font-weight: 750;
                text-align: left;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
            }

            #qb-mobile-weak-spots:hover,
            #qb-mobile-weak-spots:focus-visible {
                background: #eaeaea;
            }

            #qb-mobile-collapse {
                appearance: none;
                display: flex;
                flex: 0 0 40px;
                align-items: center;
                justify-content: center;
                width: calc(100% + 28px);
                height: 40px;
                min-height: 40px;
                margin: 8px -14px -10px;
                padding: 0;
                border: 0;
                border-top: 1px solid rgba(0,0,0,.10);
                border-radius: 0 0 14px 14px;
                background: rgba(248,248,248,.98);
                color: #333;
                cursor: pointer;
                font: inherit;
                font-size: 17px;
                font-weight: 900;
                line-height: 1;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
            }

            #qb-mobile-collapse:hover,
            #qb-mobile-collapse:focus-visible {
                background: #efefef;
            }

            #qb-mobile-collapse-arrow {
                display: block;
                transform: translateY(1px);
                transition: transform 220ms ease;
            }

            html body #quiz-browser.qb-mobile-collapsed
            #qb-mobile-collapse-arrow {
                transform: rotate(180deg) translateY(-1px);
            }

            .maplibregl-ctrl-bottom-left {
                left: 10px;
                bottom: 10px;
            }
        }


        /* smurdy-simple-browser-heading-v1 */
        #qb-mobile-brand {
            display: none !important;
        }

        .qb-desktop-browser-title {
            display: block;
        }

        @media (max-width: 700px) {
            .qb-desktop-browser-title {
                display: none !important;
            }

            #qb-mobile-brand {
                display: flex !important;
                margin: 0 !important;
            }

            #qb-header {
                display: flex;
                align-items: center;
                min-height: 48px;
            }
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
    /* smurdy-unified-quiz-browser-v2 */
    let activeCategory = "maps";
    let activeInteraction = "click";
    let activeFamily = "countries";
    let activeLibraryView = "browse";
    let browserFilter = "";
    let activeSizeFilter = "all";
    let renderVersion = 0;
    let browserCollapsed = false;
    let pageDescriptionsPromise = null;
    let allCardsPromise = null;
    const CATEGORY_PRESENTATION = {
        maps: { title: "Maps" },
        flags: { title: "Flags" },
        capitals: { title: "Capitals" },
        cities: { title: "Cities" },
        shapes: { title: "Shapes" }
    };

    const CATEGORY_ORDER = [
        "maps",
        "flags",
        "capitals",
        "cities",
        "shapes"
    ];

    const MODE_PRESENTATION = {
        click: { title: "Click" },
        type: { title: "Type" },
        find: { title: "No Borders" },
        "find-point": { title: "Point" },
        locate: { title: "Locate" },
        "multiple-choice": { title: "Multiple Choice" }
    };

    const MODE_ORDER = [
        "click",
        "type",
        "find",
        "find-point",
        "locate",
        "multiple-choice"
    ];

    const FAMILY_PRESENTATION = {
        countries: { title: "Countries" },
        subdivisions: { title: "Subdivisions" }
    };

    const FAMILY_ORDER = [
        "countries",
        "subdivisions"
    ];

    function categoryKeyForManifest(item) {
        const explicit = String(
            item?.category ||
            item?.quizCategory ||
            ""
        ).toLowerCase();

        if (explicit) return explicit;

        const id = String(item?.id || "").toLowerCase();
        const tags = (item?.tags || []).map(
            tag => String(tag).toLowerCase()
        );

        if (id.includes("flag") || tags.includes("flags")) {
            return "flags";
        }
        if (id.includes("capital") || tags.includes("capitals")) {
            return "capitals";
        }
        if (id.includes("city") || tags.includes("cities")) {
            return "cities";
        }
        if (id.includes("shape") || tags.includes("shapes")) {
            return "shapes";
        }

        return "maps";
    }

    function interactionKeyForManifest(item) {
        const raw = String(
            item?.interaction ||
            item?.type ||
            item?.id ||
            ""
        ).toLowerCase();

        if (raw.includes("multiple-choice")) {
            return "multiple-choice";
        }
        if (raw.includes("find-point")) {
            return "find-point";
        }
        if (raw === "locate" || raw.includes("locate-flag")) {
            return "locate";
        }
        if (
            raw === "find" ||
            raw.includes("find-country") ||
            raw.includes("find-subdivision")
        ) {
            return "find";
        }
        if (raw === "type" || raw.includes("type")) {
            return "type";
        }

        return "click";
    }

    function familyKeyForManifest(item) {
        const explicit = String(
            item?.family ||
            item?.contentFamily ||
            ""
        ).toLowerCase();

        if (explicit) return explicit;

        const groupSet = String(item?.groupSet || "").toLowerCase();
        const subject = String(item?.subject || "").toLowerCase();
        const id = String(item?.id || "").toLowerCase();

        if (
            groupSet === "subdivision_groups" ||
            subject === "subdivisions" ||
            id.includes("subdivision")
        ) {
            return "subdivisions";
        }

        return "countries";
    }

    function familyKeysForManifest(item) {
        const explicit = Array.isArray(item?.families)
            ? item.families.map(value => String(value).toLowerCase()).filter(Boolean)
            : [];
        return explicit.length ? explicit : [familyKeyForManifest(item)];
    }

    function manifestIsPlayable(item) {
        return String(item?.status || "").toLowerCase() !== "coming-soon" &&
            !item?.config?.comingSoon;
    }

    function manifestsForCategory(category) {
        return (baseManifest || []).filter(
            item => categoryKeyForManifest(item) === category
        );
    }

    function manifestsForMode(category, interaction) {
        return manifestsForCategory(category).filter(
            item => interactionKeyForManifest(item) === interaction
        );
    }

    function manifestsForSelection(
        category,
        interaction,
        family
    ) {
        const manifests = manifestsForMode(category, interaction);
        return manifests.filter(
            item => manifestIsPlayable(item) && familyKeysForManifest(item).includes(family)
        );
    }

    function availableCategoryKeys() {
        const discovered = Array.from(
            new Set(
                (baseManifest || []).map(categoryKeyForManifest)
            )
        );

        return [
            ...CATEGORY_ORDER,
            ...discovered.filter(
                key => !CATEGORY_ORDER.includes(key)
            )
        ];
    }

    function availableInteractionKeys(category) {
        const discovered = Array.from(
            new Set(
                manifestsForCategory(category).map(
                    interactionKeyForManifest
                )
            )
        );

        const ordered = [
            ...MODE_ORDER.filter(
                key => discovered.includes(key)
            ),
            ...discovered.filter(
                key => !MODE_ORDER.includes(key)
            )
        ];

        return ordered;
    }

    function availableFamilyKeys(category, interaction) {
        const discovered = Array.from(
            new Set(
                manifestsForMode(category, interaction)
                    .filter(manifestIsPlayable)
                    .flatMap(familyKeysForManifest)
            )
        );

        const ordered = [
            ...FAMILY_ORDER.filter(
                key => discovered.includes(key)
            ),
            ...discovered.filter(
                key => !FAMILY_ORDER.includes(key)
            )
        ];

        return ordered;
    }

    function ensureValidSelection() {
        const categories = availableCategoryKeys();

        if (
            !categories.includes(activeCategory) ||
            !manifestsForCategory(activeCategory).length
        ) {
            activeCategory =
                categories.find(
                    key => manifestsForCategory(key).length
                ) ||
                "maps";
        }

        const interactions = availableInteractionKeys(activeCategory).filter(key =>
            manifestsForMode(activeCategory, key).some(manifestIsPlayable)
        );

        if (!interactions.includes(activeInteraction)) {
            activeInteraction = interactions[0] || "click";
        }

        const families = availableFamilyKeys(
            activeCategory,
            activeInteraction
        );

        if (!families.includes(activeFamily)) {
            activeFamily = families[0] || "countries";
        }
    }

    function loadPageDescriptions() {
        if (pageDescriptionsPromise) {
            return pageDescriptionsPromise;
        }

        pageDescriptionsPromise = fetch(
            "/src/data/quiz_page_descriptions.json"
        )
            .then(response => {
                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }
                return response.json();
            })
            .catch(error => {
                console.warn(
                    "Could not load quiz-page descriptions.",
                    error
                );
                return {};
            });

        return pageDescriptionsPromise;
    }

    function shortenDescription(text, maxLength = 150) {
        const normalized = String(text || "")
            .replace(/\s+/g, " ")
            .trim();

        if (!normalized) return "";

        const sentenceMatch = normalized.match(
            /^.*?[.!?](?:\s|$)/
        );
        let result = sentenceMatch
            ? sentenceMatch[0].trim()
            : normalized;

        if (result.length > maxLength) {
            result =
                result.slice(0, maxLength - 1)
                    .replace(/\s+\S*$/, "")
                    .trim() +
                "…";
        }

        return result;
    }

    function descriptionForCard(
        id,
        group,
        family,
        pageDescriptions
    ) {
        const custom = group?.description;
        const overview =
            pageDescriptions?.groups?.[id]?.overview;

        const selected = shortenDescription(
            custom || overview
        );

        if (selected) return selected;

        const label = group?.label || getFriendlyTypeLabel(id);

        if (family === "subdivisions") {
            const parent =
                group?.parent ||
                group?.parentName ||
                label;
            const unit = group?.unitName || "subdivisions";

            return `Practice the ${unit} of ${parent} on an interactive map.`;
        }

        if (id === "world") {
            return "Practice countries from every part of the world in one complete map.";
        }

        return `Practice the countries and locations of ${label} on an interactive map.`;
    }

    function memberCountForGroup(group) {
        const members = Array.isArray(group?.members)
            ? group.members
            : (
                Array.isArray(group?.countries)
                    ? group.countries
                    : []
            );
        const declaredCount = Number(group?.memberCount);
        return Number.isFinite(declaredCount) && declaredCount > 0
            ? declaredCount
            : members.length;
    }

    function tagsForGroup(id, group, family) {
        const tags = [];
        const memberCount = memberCountForGroup(group);

        if (family === "subdivisions") {
            tags.push("subdivisions");
        }

        if (/island|pacific|caribbean|tiny/.test(id) || id === "oceania") {
            tags.push("islands");
        }

        if (id === "european_union") {
            tags.push("organization");
        }

        if (id === "former_soviet_union") {
            tags.push("historical");
        }

        if (memberCount > 0 && memberCount < 30) {
            tags.push("small set");
        } else if (memberCount >= 30) {
            tags.push("large set");
        }

        return Array.from(new Set(tags)).slice(0, 2);
    }

    function buildCardsForManifest(
        manifestItem,
        groupCollection,
        pageDescriptions,
        selectedFamily = null
    ) {
        const interaction =
            interactionKeyForManifest(manifestItem);
        const fallbackFamily =
            familyKeyForManifest(manifestItem);
        const out = [];

        for (
            const [id, group]
            of Object.entries(groupCollection || {})
        ) {
            if (
                selectedFamily &&
                group.family &&
                group.family !== selectedFamily
            ) {
                continue;
            }

            if (
                Array.isArray(group.allowedTypes) &&
                group.allowedTypes.length > 0 &&
                !group.allowedTypes.includes(interaction)
            ) {
                continue;
            }

            const family =
                group.family ||
                selectedFamily ||
                fallbackFamily;

            out.push({
                id,
                label: group.label || getFriendlyTypeLabel(id),
                description: descriptionForCard(
                    id,
                    group,
                    family,
                    pageDescriptions
                ),
                tags: tagsForGroup(id, group, family),
                meta: group,
                manifest: manifestItem,
                memberCount: memberCountForGroup(group),
                featured:
                    family === "countries" &&
                    id === "world"
            });
        }

        out.sort((a, b) => {
            if (a.featured !== b.featured) {
                return a.featured ? -1 : 1;
            }
            return 0;
        });

        return out;
    }

    function quizLibrarySnapshot() {
        return window.SmurdyQuizLibrary?.getSnapshot?.() || {
            favorites: [],
            recent: []
        };
    }

    function quizLibraryKey(manifestId, groupId) {
        return window.SmurdyQuizLibrary?.quizKey?.(
            manifestId,
            groupId
        ) || `${manifestId}:${groupId}`;
    }

    function renderLibraryTabs() {
        const snapshot = quizLibrarySnapshot();
        const views = [
            { key: "browse", title: "Browse" },
            {
                key: "favorites",
                title: "Favorites",
                count: snapshot.favorites.length
            },
            {
                key: "recent",
                title: "Recent",
                count: snapshot.recent.length
            }
        ];

        return `
            <div
                id="qb-library-tabs"
                role="tablist"
                aria-label="Quiz browser views"
            >
                ${views.map(view => `
                    <button
                        class="qb-library-tab"
                        type="button"
                        role="tab"
                        data-library-view="${view.key}"
                        aria-selected="${view.key === activeLibraryView ? "true" : "false"}"
                    >
                        ${view.title}
                        ${typeof view.count === "number"
                            ? `<span class="qb-library-count">${view.count}</span>`
                            : ""}
                    </button>
                `).join("")}
            </div>
        `;
    }

    function renderCategoryTabs() {
        return `
            <div
                id="qb-category-tabs"
                role="tablist"
                aria-label="Quiz categories"
            >
                ${availableCategoryKeys().map(key => {
                    const info =
                        CATEGORY_PRESENTATION[key] ||
                        {
                            title:
                                getFriendlyTypeLabel(key)
                        };
                    const available =
                        manifestsForCategory(key).length > 0;
                    const selected =
                        available &&
                        key === activeCategory;

                    return `
                        <button
                            class="qb-category-tab"
                            type="button"
                            role="tab"
                            data-category="${escapeHtml(key)}"
                            aria-selected="${selected ? "true" : "false"}"
                            ${available ? "" : "disabled"}
                        >
                            ${escapeHtml(info.title)}
                            ${available
                                ? ""
                                : `<span class="qb-coming-soon">Coming soon!</span>`}
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderModeTabs() {
        return `
            <div
                id="qb-mode-tabs"
                role="tablist"
                aria-label="Game modes"
            >
                ${availableInteractionKeys(activeCategory)
                    .map(key => {
                        const info =
                            MODE_PRESENTATION[key] ||
                            {
                                title:
                                getFriendlyTypeLabel(key)
                            };
                        const available = manifestsForMode(
                            activeCategory,
                            key
                        ).some(manifestIsPlayable);
                        const selected =
                            available &&
                            key === activeInteraction;

                        return `
                            <button
                                class="qb-mode-tab"
                                type="button"
                                role="tab"
                                data-interaction="${escapeHtml(key)}"
                                aria-selected="${selected ? "true" : "false"}"
                                ${available ? "" : "disabled"}
                            >
                                ${escapeHtml(info.title)}
                                ${available
                                    ? ""
                                    : `<span class="qb-coming-soon">Coming soon!</span>`}
                            </button>
                        `;
                    }).join("")}
            </div>
        `;
    }

    function renderFamilyTabs() {
        return `
            <div
                id="qb-family-tabs"
                role="tablist"
                aria-label="Map families"
            >
                ${availableFamilyKeys(
                    activeCategory,
                    activeInteraction
                ).map(key => {
                    const info =
                        FAMILY_PRESENTATION[key] ||
                        {
                            title:
                                getFriendlyTypeLabel(key)
                        };

                    return `
                        <button
                            class="qb-family-tab"
                            type="button"
                            role="tab"
                            data-family="${escapeHtml(key)}"
                            aria-selected="${key === activeFamily ? "true" : "false"}"
                        >
                            ${escapeHtml(info.title)}
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderBrowseFilters() {
        if (activeLibraryView !== "browse") return "";

        return `
            ${renderCategoryTabs()}
            ${renderModeTabs()}
            ${renderFamilyTabs()}
        `;
    }

    function renderSearchControls() {
        const placeholder = activeLibraryView === "favorites"
            ? "Search favorites"
            : activeLibraryView === "recent"
                ? "Search recent quizzes"
                : "Search quiz sets";

        return `
            <div id="qb-search">
                <input
                    id="qb-filter"
                    type="search"
                    aria-label="Search quizzes"
                    placeholder="${placeholder}"
                    value="${escapeHtml(browserFilter)}"
                />
                ${activeLibraryView === "browse"
                    ? `<label class="qb-size-filter">
                        <span>Set size</span>
                        <select id="qb-size-filter">
                            <option value="all"${activeSizeFilter === "all" ? " selected" : ""}>Any</option>
                            <option value="small"${activeSizeFilter === "small" ? " selected" : ""}>Small</option>
                            <option value="large"${activeSizeFilter === "large" ? " selected" : ""}>Large</option>
                        </select>
                       </label>`
                    : ""}
            </div>
        `;
    }

    async function loadCardsForSelection() {
        const manifests = manifestsForSelection(
            activeCategory,
            activeInteraction,
            activeFamily
        );

        const pageDescriptions =
            await loadPageDescriptions();
        const cards = [];

        for (const manifestItem of manifests) {
            const groupSetId =
                manifestItem.groupSet ||
                "country_groups";

            try {
                const groupCollection =
                    await loadGroupSet(groupSetId);

                cards.push(
                    ...buildCardsForManifest(
                        manifestItem,
                        groupCollection,
                        pageDescriptions,
                        activeFamily
                    )
                );
            } catch (error) {
                console.error(
                    `Could not load ${groupSetId}`,
                    error
                );
            }
        }

        return cards;
    }

    function loadAllCards() {
        if (allCardsPromise) return allCardsPromise;

        allCardsPromise = (async () => {
            const pageDescriptions =
                await loadPageDescriptions();
            const cards = [];

            for (const manifestItem of baseManifest || []) {
                if (!manifestIsPlayable(manifestItem)) {
                    continue;
                }

                const groupSetId =
                    manifestItem.groupSet ||
                    "country_groups";

                try {
                    const groupCollection =
                        await loadGroupSet(groupSetId);
                    cards.push(
                        ...buildCardsForManifest(
                            manifestItem,
                            groupCollection,
                            pageDescriptions
                        )
                    );
                } catch (error) {
                    console.error(
                        `Could not load ${groupSetId}`,
                        error
                    );
                }
            }

            return cards;
        })();

        return allCardsPromise;
    }

    async function loadCardsForCurrentView() {
        if (activeLibraryView === "browse") {
            return loadCardsForSelection();
        }

        const allCards = await loadAllCards();
        const cardsByKey = new Map(
            allCards.map(card => [
                quizLibraryKey(card.manifest.id, card.id),
                card
            ])
        );
        const snapshot = quizLibrarySnapshot();
        const entries = activeLibraryView === "favorites"
            ? snapshot.favorites
            : snapshot.recent;

        return entries
            .map(entry => cardsByKey.get(entry.key))
            .filter(Boolean);
    }

    function filterCards(cards, filter, sizeFilter = "all") {
        const tokens = tokenize(filter);

        return cards.filter(card => {
            if (
                sizeFilter === "small" &&
                !(card.memberCount > 0 && card.memberCount < 30)
            ) {
                return false;
            }
            if (
                sizeFilter === "large" &&
                card.memberCount < 30
            ) {
                return false;
            }

            if (!tokens.length) return true;

            const hay = [
                card.label,
                card.id,
                card.description,
                card.meta?.parent || "",
                card.manifest?.title || "",
                MODE_PRESENTATION[
                    interactionKeyForManifest(card.manifest)
                ]?.title || "",
                FAMILY_PRESENTATION[
                    familyKeyForManifest(card.manifest)
                ]?.title || "",
                ...(card.tags || [])
            ].join(" ").toLowerCase();

            return tokens.every(
                token => hay.includes(token)
            );
        });
    }

    function renderCard(
        card,
        favoriteKeys,
        showContext,
        showSuggested
    ) {
        const key = quizLibraryKey(
            card.manifest.id,
            card.id
        );
        const favorite = favoriteKeys.has(key);
        const interaction =
            MODE_PRESENTATION[
                interactionKeyForManifest(card.manifest)
            ]?.title || card.manifest.title;
        const category = categoryKeyForManifest(card.manifest);
        const family = category === "flags"
            ? "Flags"
            : (
                FAMILY_PRESENTATION[
                    familyKeyForManifest(card.manifest)
                ]?.title || "Quiz"
            );
        const displayLabel =
            showContext && category === "flags"
                ? `${card.label} Flags`
                : card.label;

        return `
            <div
                class="qb-card${showSuggested && card.featured ? " qb-card-featured" : ""}${favorite ? " qb-card-favorite" : ""}"
                data-group="${escapeHtml(card.id)}"
            >
                <div class="qb-card-layout">
                    <div class="qb-card-copy">
                        <div class="qb-title">
                            ${escapeHtml(displayLabel)}
                            ${showSuggested && card.featured
                                ? `<span class="qb-main-badge">Suggested</span>`
                                : ""}
                        </div>

                        ${showContext
                            ? `<div class="qb-card-context">${escapeHtml(interaction)} · ${escapeHtml(family)}</div>`
                            : ""}

                        <div class="qb-sub">
                            ${escapeHtml(card.description)}
                        </div>

                        ${card.tags.length
                            ? `<div class="qb-tags">
                                ${card.tags.map(tag =>
                                    `<span class="qb-tag">${escapeHtml(tag)}</span>`
                                ).join("")}
                               </div>`
                            : ""}
                    </div>

                    <div class="qb-card-actions">
                        <button
                            class="qb-favorite"
                            type="button"
                            data-favorite-group="${escapeHtml(card.id)}"
                            data-favorite-manifest="${escapeHtml(card.manifest.id)}"
                            aria-pressed="${favorite ? "true" : "false"}"
                            aria-label="${favorite ? "Remove" : "Add"} ${escapeHtml(displayLabel)} ${favorite ? "from" : "to"} favorites"
                            title="${favorite ? "Remove from favorites" : "Add to favorites"}"
                        >${favorite ? "★" : "☆"}</button>
                        <a
                            class="qb-play"
                            href="${escapeHtml(
                                quizLandingPath(
                                    card.manifest,
                                    card.id
                                )
                            )}"
                            data-group="${escapeHtml(card.id)}"
                            data-manifest-id="${escapeHtml(
                                card.manifest.id
                            )}"
                        >Play</a>
                    </div>
                </div>
            </div>
        `;
    }


    function renderMobileCollapseHandle() {
        return `
            <button
                id="qb-mobile-collapse"
                type="button"
                aria-expanded="${browserCollapsed ? "false" : "true"}"
                aria-label="${browserCollapsed
                    ? "Open quiz browser"
                    : "Hide quiz browser and explore the map"}"
            >
                <span
                    id="qb-mobile-collapse-arrow"
                    aria-hidden="true"
                >▲</span>
            </button>
        `;
    }

    function applyBrowserCollapsedState(panel) {
        panel.classList.toggle(
            "qb-mobile-collapsed",
            browserCollapsed
        );

        const button = panel.querySelector(
            "#qb-mobile-collapse"
        );

        if (button) {
            button.setAttribute(
                "aria-expanded",
                browserCollapsed ? "false" : "true"
            );
            button.setAttribute(
                "aria-label",
                browserCollapsed
                    ? "Open quiz browser"
                    : "Hide quiz browser and explore the map"
            );
        }
    }

    function attachChromeEvents(panel) {
        panel.querySelector(
            "#qb-mobile-collapse"
        )?.addEventListener("click", () => {
            browserCollapsed = !browserCollapsed;
            applyBrowserCollapsedState(panel);
        });

        panel.querySelectorAll(
            "[data-library-view]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                activeLibraryView =
                    button.dataset.libraryView;
                browserFilter = "";
                void renderUnifiedBrowser();
            });
        });

        panel.querySelectorAll(
            "[data-category]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                if (button.disabled) return;

                activeCategory =
                    button.dataset.category;
                ensureValidSelection();
                void renderUnifiedBrowser();
            });
        });

        panel.querySelectorAll(
            "[data-interaction]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                activeInteraction =
                    button.dataset.interaction;
                ensureValidSelection();
                void renderUnifiedBrowser();
            });
        });

        panel.querySelectorAll(
            "[data-family]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                activeFamily =
                    button.dataset.family;
                browserFilter = "";
                void renderUnifiedBrowser();
            });
        });

        panel.querySelector(
            "#qb-filter"
        )?.addEventListener("input", event => {
            browserFilter = event.target.value;
            void renderUnifiedBrowser({
                preserveFocus: true
            });
        });

        panel.querySelector(
            "#qb-size-filter"
        )?.addEventListener("change", event => {
            activeSizeFilter = event.target.value;
            void renderUnifiedBrowser();
        });

    }


    /* smurdy-menu-map-launch-gate-v1 */
    let menuMapReadyPromise = null;
    let menuMapReadyConfirmed = false;

    function isHomepageLaunchContext() {
        try {
            const params = new URLSearchParams(location.search);
            return (
                !params.has("quiz") &&
                !/^\/quizzes\//i.test(location.pathname || "")
            );
        } catch (_) {
            return true;
        }
    }

    function getMenuMap() {
        return window.SmurdyQuiz?._menuMap || null;
    }

    function menuMapIsReady(menuMap) {
        if (!menuMap) return false;

        try {
            if (
                typeof menuMap.loaded === "function" &&
                menuMap.loaded()
            ) {
                return true;
            }
        } catch (_) {}

        try {
            if (
                typeof menuMap.isStyleLoaded === "function" &&
                menuMap.isStyleLoaded()
            ) {
                return true;
            }
        } catch (_) {}

        return false;
    }

    function waitForMainMenuMapReady() {
        if (!isHomepageLaunchContext()) {
            return Promise.resolve();
        }

        if (
            menuMapReadyConfirmed ||
            menuMapIsReady(getMenuMap())
        ) {
            menuMapReadyConfirmed = true;
            return Promise.resolve();
        }

        if (menuMapReadyPromise) {
            return menuMapReadyPromise;
        }

        menuMapReadyPromise = new Promise(resolve => {
            let watchedMap = null;
            let timer = null;
            let finished = false;

            const cleanUp = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }

                if (
                    watchedMap &&
                    typeof watchedMap.off === "function"
                ) {
                    try {
                        watchedMap.off("load", finish);
                    } catch (_) {}
                }
            };

            const finish = () => {
                if (finished) return;
                finished = true;
                cleanUp();
                menuMapReadyConfirmed = true;
                resolve();
            };

            const inspect = () => {
                timer = null;
                if (finished) return;

                if (!isHomepageLaunchContext()) {
                    finish();
                    return;
                }

                const menuMap = getMenuMap();

                if (menuMap !== watchedMap) {
                    if (
                        watchedMap &&
                        typeof watchedMap.off === "function"
                    ) {
                        try {
                            watchedMap.off("load", finish);
                        } catch (_) {}
                    }

                    watchedMap = menuMap;

                    if (
                        watchedMap &&
                        typeof watchedMap.on === "function"
                    ) {
                        watchedMap.on("load", finish);
                    }
                }

                /*
                 * Register the load listener first, then check readiness,
                 * so the event cannot slip through between those steps.
                 */
                if (menuMapIsReady(menuMap)) {
                    finish();
                    return;
                }

                timer = setTimeout(inspect, 30);
            };

            inspect();
        }).finally(() => {
            menuMapReadyPromise = null;
        });

        return menuMapReadyPromise;
    }

    function setQuizLaunchLinksReady(panel, ready) {
        const links = panel.querySelectorAll(
            ".qb-play[data-group][data-manifest-id]"
        );

        for (const link of links) {
            const manifestItem = (baseManifest || []).find(
                item => item.id === link.dataset.manifestId
            );
            const isFlagQuiz = manifestItem &&
                categoryKeyForManifest(manifestItem) === "flags";

            if (!link.dataset.readyText) {
                link.dataset.readyText =
                    link.textContent.trim() || "Play";
            }

            if (ready || isFlagQuiz) {
                link.removeAttribute("aria-disabled");
                link.removeAttribute("tabindex");
                link.style.removeProperty("pointer-events");
                link.style.removeProperty("opacity");
                link.style.removeProperty("cursor");
                link.textContent = link.dataset.readyText;
            } else {
                link.setAttribute("aria-disabled", "true");
                link.setAttribute("tabindex", "-1");
                link.style.setProperty(
                    "pointer-events",
                    "none",
                    "important"
                );
                link.style.opacity = ".58";
                link.style.cursor = "wait";
                link.textContent = "Loading map…";
            }
        }
    }

    async function synchronizeQuizLaunchAvailability(panel) {
        if (
            !isHomepageLaunchContext() ||
            menuMapReadyConfirmed ||
            menuMapIsReady(getMenuMap())
        ) {
            menuMapReadyConfirmed = true;
            setQuizLaunchLinksReady(panel, true);
            return;
        }

        setQuizLaunchLinksReady(panel, false);
        await waitForMainMenuMapReady();
        setQuizLaunchLinksReady(panel, true);
    }

    function attachCardEvents(panel) {

        panel.querySelectorAll(
            ".qb-favorite[data-favorite-group][data-favorite-manifest]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                window.SmurdyQuizLibrary?.toggleFavorite?.(
                    button.dataset.favoriteManifest,
                    button.dataset.favoriteGroup
                );
                void renderUnifiedBrowser({
                    preserveScroll: true
                });
            });
        });

        void synchronizeQuizLaunchAvailability(panel);

        panel.querySelectorAll(
            ".qb-play[data-group][data-manifest-id]"
        ).forEach(link => {
            link.addEventListener(
                "click",
                async event => {
                    if (!isPlainLeftClick(event)) {
                        return;
                    }

                    event.preventDefault();

                    if (
                        link.getAttribute("aria-disabled") === "true"
                    ) {
                        return;
                    }

                    const manifestItem =
                        (baseManifest || []).find(
                            item =>
                                item.id ===
                                link.dataset.manifestId
                        );

                    if (!manifestItem) return;

                    // Flag quizzes use their own image-first game shell rather
                    // than the MapLibre app, so open the crawlable flag page.
                    if (categoryKeyForManifest(manifestItem) === "flags") {
                        window.SmurdyQuizLaunchIntent?.store?.(
                            manifestItem.id,
                            link.dataset.group || "world",
                            "browser"
                        );
                        window.location.assign(link.href);
                        return;
                    }

                    await waitForMainMenuMapReady();

                    await startQuizForManifest(
                        manifestItem,
                        link.dataset.group
                    );
                }
            );
        });
    }

    async function renderUnifiedBrowser(
        {
            preserveFocus = false,
            preserveScroll = false
        } = {}
    ) {
        ensureValidSelection();

        const thisRender = ++renderVersion;
        const panel = ensureBrowserUI();

        const oldInput =
            preserveFocus &&
            panel.querySelector &&
            panel.querySelector("#qb-filter");
        const oldCaret =
            oldInput &&
            typeof oldInput.selectionStart === "number"
                ? oldInput.selectionStart
                : null;
        const oldList = preserveScroll &&
            panel.querySelector?.("#qb-list");
        const oldScrollTop = oldList
            ? oldList.scrollTop
            : null;

        panel.innerHTML = `
            <div id="qb-header">
                <div
                    id="qb-title"
                    class="qb-desktop-browser-title"
                >Choose a Quiz</div>

                <a
                    id="qb-mobile-brand"
                    href="https://smurdy.fun"
                    class="panel-brand"
                    style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;margin-bottom:8px;"
                >
                    <img
                        src="/assets/images/smurdeye-transparent.png?v=20260825-logo-1"
                        alt="Smurdy logo"
                        style="width:48px;height:48px;object-fit:contain"
                    >
                    <div style="display:flex;flex-direction:column;line-height:1;">
                        <span style="font-weight:700;font-size:16px;color:#000">Smurdy</span>
                    </div>
                </a>
            </div>

            ${renderLibraryTabs()}
            ${renderBrowseFilters()}

            <button
                id="qb-mobile-weak-spots"
                type="button"
                data-weak-spots-open
            >
                <span>Weak Spots</span>
                <span
                    class="weak-spots-count"
                    data-weak-spots-count
                    hidden
                ></span>
            </button>

            ${renderSearchControls()}

            <div id="qb-list">
                <div class="qb-loading">
                    Loading quizzes…
                </div>
            </div>

            ${renderDirectoryLinks()}
            ${renderMobileCollapseHandle()}
        `;

        attachChromeEvents(panel);
        applyBrowserCollapsedState(panel);
        window.SmurdyWeakSpots?.refreshMenuCount?.();

        const cards = filterCards(
            await loadCardsForCurrentView(),
            browserFilter,
            activeLibraryView === "browse"
                ? activeSizeFilter
                : "all"
        );

        if (thisRender !== renderVersion) return;

        const list = panel.querySelector("#qb-list");
        if (!list) return;

        const snapshot = quizLibrarySnapshot();
        const favoriteKeys = new Set(
            snapshot.favorites.map(entry => entry.key)
        );
        const showContext = activeLibraryView !== "browse";
        const emptyMessage = activeLibraryView === "favorites"
            ? "No favorites yet. Star a quiz to save it here."
            : activeLibraryView === "recent"
                ? "No recently played quizzes yet."
                : "No quiz sets match these filters.";

        list.innerHTML = cards.length
            ? cards.map(card => renderCard(
                card,
                favoriteKeys,
                showContext,
                activeLibraryView === "browse"
            )).join("")
            : `<div class="qb-empty">${emptyMessage}</div>`;

        attachCardEvents(panel);

        if (oldScrollTop !== null) {
            list.scrollTop = oldScrollTop;
        }

        if (oldCaret !== null) {
            try {
                const input =
                    panel.querySelector("#qb-filter");
                const isMobile =
                    (window.innerWidth || 0) <= 700 ||
                    /Mobi|Android/i.test(
                        navigator.userAgent || ""
                    );

                if (input && !isMobile) {
                    input.focus();
                    input.setSelectionRange(
                        oldCaret,
                        oldCaret
                    );
                }
            } catch (_) {}
        }
    }

    function renderTypesView() {
        void renderUnifiedBrowser();
    }

    function renderManifestView() {
        void renderUnifiedBrowser();
    }

    function renderModesView() {
        void renderUnifiedBrowser();
    }

    function renderFamiliesView() {
        void renderUnifiedBrowser();
    }

    function renderGroupsView() {
        void renderUnifiedBrowser();
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
            window.location.assign(
                quizLandingPath(quizDef, groupId)
            );
        }
    }

    // Launch a specific manifest entry for a chosen group (used when a manifest was selected first)
    async function startQuizForManifest(manifestItem, groupId) {
        await waitForMainMenuMapReady();

        if (!manifestItem) return;

        const groupSetId = manifestItem.groupSet || "country_groups";
        try {
            groups = await loadGroupSet(groupSetId);
            if (window.SmurdyQuiz && typeof window.SmurdyQuiz.setCurrentGroupSet === "function") {
                await window.SmurdyQuiz.setCurrentGroupSet(groupSetId);
            } else if (window.SmurdyQuiz) {
                window.SmurdyQuiz.currentGroupSet = groupSetId;
                window.SmurdyQuiz.groups = groups;
            }
        } catch (error) {
            console.error("Could not activate quiz group set", error);
            return;
        }

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
                 window.location.assign(
                     quizLandingPath(manifestItem, groupId)
                 );
             }
             // Remove the browser panel from both layout and hit-testing.
             // Mobile CSS uses display:flex !important, so a normal inline
             // display:none is not strong enough.
             setBrowserPanelVisible(
                 document.getElementById("quiz-browser"),
                 false
             );
             return;
         }
 
         // fallback to URL navigation
         window.location.assign(
             quizLandingPath(manifestItem, groupId)
         );
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
            groups = await loadGroupSet("country_groups");
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
        const libraryManifestId = String(file || "")
            .replace(/^manifest:/i, "")
            .toLowerCase();
        const libraryGroupId = String(
            extraParams.group || "world"
        ).toLowerCase();

        window.SmurdyQuizLibrary?.recordPlayed?.(
            libraryManifestId,
            libraryGroupId
        );

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
                if (extraParams.groupSet) window.SmurdyQuiz.currentGroupSet = extraParams.groupSet;
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

        const cleanQuizId = String(file || "")
            .replace(/^manifest:/i, "")
            .toLowerCase();
        const cleanGroupId = String(
            extraParams.group || "world"
        ).toLowerCase();

        if (
            /^[a-z0-9_-]+$/.test(cleanQuizId) &&
            /^[a-z0-9_-]+$/.test(cleanGroupId)
        ) {
            window.location.assign(
                `/quizzes/${cleanQuizId}/${cleanGroupId}/`
            );
            return;
        }

        window.location.search = params.toString();
    };
})();
