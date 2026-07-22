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

        groupSets[safeId] = data;
        return data;
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





        /* Unified quiz browser v2: three distinct selector rows and compact cards. */
        html body #quiz-browser {
            overflow: hidden !important;
        }

        #qb-header,
        #qb-category-tabs,
        #qb-mode-tabs,
        #qb-family-tabs,
        #qb-search,
        #qb-directory-links {
            flex: 0 0 auto;
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
            padding: 10px 0;
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
            border-color: #e3e3e3;
            background: #f3f3f3;
            color: #999;
            opacity: 1;
        }

        .qb-coming-soon {
            display: block;
            margin-top: 4px;
            color: #aaa;
            font-size: 9px;
            font-weight: 750;
            line-height: 1;
        }

        /* Row 2: compact segmented game-mode control. */
        #qb-mode-tabs {
            display: flex;
            gap: 2px;
            overflow-x: auto;
            overflow-y: hidden;
            margin: 10px 0 4px;
            padding: 3px;
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
            background: #222;
            color: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,.16);
        }

        /* Row 3: simple underlined content-family tabs. */
        #qb-family-tabs {
            display: flex;
            gap: 24px;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 2px 2px 0;
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
                --smurdy-mobile-panel-size: 70dvh;

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
    let browserFilter = "";
    let renderVersion = 0;
    let browserCollapsed = false;
    let pageDescriptionsPromise = null;

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
        "multiple-choice": { title: "Multiple Choice" }
    };

    const MODE_ORDER = [
        "click",
        "type",
        "find",
        "find-point",
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
        return manifestsForMode(category, interaction).filter(
            item => familyKeyForManifest(item) === family
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

        return [
            ...MODE_ORDER.filter(
                key => discovered.includes(key)
            ),
            ...discovered.filter(
                key => !MODE_ORDER.includes(key)
            )
        ];
    }

    function availableFamilyKeys(category, interaction) {
        const discovered = Array.from(
            new Set(
                manifestsForMode(category, interaction).map(
                    familyKeyForManifest
                )
            )
        );

        return [
            ...FAMILY_ORDER.filter(
                key => discovered.includes(key)
            ),
            ...discovered.filter(
                key => !FAMILY_ORDER.includes(key)
            )
        ];
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

        const interactions =
            availableInteractionKeys(activeCategory);

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

    function tagsForGroup(id, group) {
        const tags = new Set(
            (group?.tags || []).map(
                tag => String(tag).toLowerCase()
            )
        );

        const members = Array.isArray(group?.members)
            ? group.members
            : (
                Array.isArray(group?.countries)
                    ? group.countries
                    : []
            );

        if (members.length > 0 && members.length < 30) {
            tags.add("small set");
        }

        if (id.match(/island|pacific|caribbean|tiny/)) {
            tags.add("islands");
        }

        return Array.from(tags);
    }

    function buildCardsForManifest(
        manifestItem,
        groupCollection,
        pageDescriptions
    ) {
        const interaction =
            interactionKeyForManifest(manifestItem);
        const family =
            familyKeyForManifest(manifestItem);
        const out = [];

        for (
            const [id, group]
            of Object.entries(groupCollection || {})
        ) {
            if (
                Array.isArray(group.allowedTypes) &&
                group.allowedTypes.length > 0 &&
                !group.allowedTypes.includes(interaction)
            ) {
                continue;
            }

            out.push({
                id,
                label: group.label || getFriendlyTypeLabel(id),
                description: descriptionForCard(
                    id,
                    group,
                    family,
                    pageDescriptions
                ),
                tags: tagsForGroup(id, group),
                meta: group,
                manifest: manifestItem,
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

                        return `
                            <button
                                class="qb-mode-tab"
                                type="button"
                                role="tab"
                                data-interaction="${escapeHtml(key)}"
                                aria-selected="${key === activeInteraction ? "true" : "false"}"
                            >
                                ${escapeHtml(info.title)}
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
    }

    function filterCards(cards, filter) {
        const tokens = tokenize(filter);

        if (!tokens.length) return cards;

        return cards.filter(card => {
            const hay = [
                card.label,
                card.id,
                card.description,
                card.meta?.parent || "",
                ...(card.tags || [])
            ].join(" ").toLowerCase();

            return tokens.every(
                token => hay.includes(token)
            );
        });
    }

    function renderCard(card) {
        return `
            <div
                class="qb-card${card.featured ? " qb-card-featured" : ""}"
                data-group="${escapeHtml(card.id)}"
            >
                <div class="qb-card-layout">
                    <div class="qb-card-copy">
                        <div class="qb-title">
                            ${escapeHtml(card.label)}
                            ${card.featured
                                ? `<span class="qb-main-badge">Suggested</span>`
                                : ""}
                        </div>

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
            "[data-category]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                if (button.disabled) return;

                activeCategory =
                    button.dataset.category;
                browserFilter = "";
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
                browserFilter = "";
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
    }

    function attachCardEvents(panel) {
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

                    const manifestItem =
                        (baseManifest || []).find(
                            item =>
                                item.id ===
                                link.dataset.manifestId
                        );

                    if (!manifestItem) return;

                    await startQuizForManifest(
                        manifestItem,
                        link.dataset.group
                    );
                }
            );
        });
    }

    async function renderUnifiedBrowser(
        { preserveFocus = false } = {}
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

        const categoryTitle =
            CATEGORY_PRESENTATION[activeCategory]?.title ||
            getFriendlyTypeLabel(activeCategory);
        const modeTitle =
            MODE_PRESENTATION[activeInteraction]?.title ||
            getFriendlyTypeLabel(activeInteraction);
        const familyTitle =
            FAMILY_PRESENTATION[activeFamily]?.title ||
            getFriendlyTypeLabel(activeFamily);

        panel.innerHTML = `
            <div id="qb-header">
                <div id="qb-title">
                    ${escapeHtml(categoryTitle)}
                    ·
                    ${escapeHtml(modeTitle)}
                    ·
                    ${escapeHtml(familyTitle)}
                </div>
            </div>

            ${renderCategoryTabs()}
            ${renderModeTabs()}
            ${renderFamilyTabs()}

            <div id="qb-search">
                <input
                    id="qb-filter"
                    placeholder="Search available quiz sets"
                    value="${escapeHtml(browserFilter)}"
                />
            </div>

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

        const cards = filterCards(
            await loadCardsForSelection(),
            browserFilter
        );

        if (thisRender !== renderVersion) return;

        const list = panel.querySelector("#qb-list");
        if (!list) return;

        list.innerHTML = cards.length
            ? cards.map(renderCard).join("")
            : `<div class="qb-empty">No quiz sets match your search.</div>`;

        attachCardEvents(panel);

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
            const params = new URLSearchParams();
            params.set("mode", run.mode);
            params.set("quiz", quizDef.file);
            params.set("group", groupId);
            params.set("borders", String(run.bordersFlag));
            window.location.search = params.toString();
        }
    }

    // Launch a specific manifest entry for a chosen group (used when a manifest was selected first)
    async function startQuizForManifest(manifestItem, groupId) {
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
                 const params = new URLSearchParams();
                params.set("mode", run.mode);
                 if (quizRef) params.set("quiz", quizRef);
                 params.set("group", groupId);
                 params.set("groupSet", groupSetId);
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
         params.set("groupSet", groupSetId);
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

        window.location.search = params.toString();
    };
})();