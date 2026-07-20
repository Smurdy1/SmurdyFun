// read bootstrap config and shared modes first
const cfg = window.__SmurdyConfig || {};
const urlParams = new URLSearchParams(window.location.search);
// store chosen mode on window so re-applying patches / re-evaluating scripts is idempotent
if (typeof window.__SmurdyMode === "undefined") {
    window.__SmurdyMode = cfg.mode || urlParams.get("mode") || "countries";
}
const mode = window.__SmurdyMode;
const showBorders = (typeof cfg.showBorders === "boolean") ? cfg.showBorders : (urlParams.get("borders") === "1");
const quizGroupId = cfg.quizGroupId || urlParams.get("group") || "world";

// MODE_CONFIGS + TINY_COUNTRIES are provided by modes.js (bootstrap loads modes.js before this file)
const appModes = window.AppModes || {};
const MODE_CONFIGS = appModes.MODE_CONFIGS || {};
const TINY_COUNTRIES = appModes.TINY_COUNTRIES || new Set();

// Ensure MODE is defined (fallback if modes.js didn't provide expected data)
// change const -> let so we can hot-swap mode config at runtime
let MODE = MODE_CONFIGS[mode] || MODE_CONFIGS.countries || (function(){
    console.warn("smurdy: MODE_CONFIGS missing or mode not found — using fallback MODE");
    return {
        dataFile: "/src/data/countries.json",
        tinyFile: "/src/data/tiny_countries.json",
        mapCenter: [0, 20],
        mapZoom: 1.8,
        minZoom: 1,
        maxZoom: 12,
        sourceId: "quiz-main",
        fillLayerId: "quiz-main-fill",
        outlineLayerId: null,
        usesTinyPoints: true,
        getCanonicalFeatureName(feature){ try{ const p = (feature && feature.properties) ? feature.properties : {}; return p.NAME || p.name || "Unknown"; } catch(e){ return "Unknown"; } },
        filterFeatures(f){ return Array.isArray(f) ? f : []; },
        filterTinyFeatures(f){ return Array.isArray(f) ? f : []; }
    };
})();
// Ensure window.AppModes exists but do not redeclare block-scoped variables (avoids redeclare errors)
window.AppModes = window.AppModes || { MODE_CONFIGS: {}, TINY_COUNTRIES: new Set() };

const map = new maplibregl.Map({
    container: "map",
    style: "https://demotiles.maplibre.org/style.json",
    center: MODE.mapCenter,
    zoom: MODE.mapZoom,
    minZoom: MODE.minZoom,
    maxZoom: MODE.maxZoom,
    // disable built-in attribution control so we can show a compact, compliant mobile attribution
    attributionControl: false
});
 
// remove built-in zoom UI on small screens: add NavigationControl only for non-mobile and toggle on resize
const isMobileViewport = () => (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
const navControl = new maplibregl.NavigationControl();
let navAdded = false;
if (!isMobileViewport()) {
    map.addControl(navControl, "top-right");
    navAdded = true;
}
window.addEventListener("resize", () => {
    const mobile = isMobileViewport();
    if (mobile && navAdded) {
        try { map.removeControl(navControl); } catch (e) {}
        navAdded = false;
    } else if (!mobile && !navAdded) {
        try { map.addControl(navControl, "top-right"); } catch (e) {}
        navAdded = true;
    }
});
 
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
 
// Mobile/top-panel collapsed "i" attribution control (defaults collapsed).
// Provides the minimal required attribution links: OpenStreetMap, OpenMapTiles, (MapLibre credit).
function setupMobileAttribution() {
    try {
        // create node only once
        if (document.getElementById("mobile-map-attrib")) return;
        const panel = document.getElementById("quiz-panel");
        const mapEl = document.getElementById("map");
        // build wrapper
        const wrap = document.createElement("div");
        wrap.id = "mobile-map-attrib";
        wrap.className = "mobile-attrib";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mobile-attrib-btn";
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", "Map attribution");
        btn.textContent = "i";

        const content = document.createElement("div");
        content.className = "mobile-attrib-content";
        // Minimal required attribution — confirm provider terms and replace exact wording if needed.
        content.innerHTML = `
            <div class="mobile-attrib-inner">
                Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a><br/>
                Tiles © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a><br/>
                Rendered with <a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>
            </div>
        `;

        btn.addEventListener("click", () => {
            const open = wrap.classList.toggle("open");
            btn.setAttribute("aria-expanded", String(!!open));
        });

        wrap.appendChild(btn);
        wrap.appendChild(content);

        // Preferred placement: top-right inside #quiz-panel on mobile.
        if (panel) {
            panel.style.position = panel.style.position || getComputedStyle(panel).position || "absolute";
            panel.appendChild(wrap);
        } else if (mapEl) {
            // fallback: place inside map bottom-left for desktop fallback
            mapEl.appendChild(wrap);
        }

        // Keep attribution present but visibility controlled by CSS; update on resize if needed
        window.addEventListener("resize", () => {
            // nothing to do here — CSS media queries handle show/hide; we keep DOM in place
        });
    } catch (e) {
        console.warn("setupMobileAttribution failed", e);
    }
}
try { setupMobileAttribution(); } catch (_) {}
 
const SmurdyQuiz = {
    map,
    mode,
    mainData: null,
    tinyData: null,
    mainFillLayerId: MODE.fillLayerId,
    tinyCircleLayerId: "quiz-tiny-circle",
    sourceId: MODE.sourceId,
    rawAliases: {},
    aliases: {},
    groups: {},
    currentGroupId: quizGroupId,
    showBordersInitial: showBorders,
    currentShowBorders: showBorders,
    // currently-highlighted target name (normalized string stored as given)
    currentTargetName: null,

    // Enable in-console debug: set SmurdyQuiz.debugTargets = true
    debugTargets: false,
    log(...args) { if (this.debugTargets) console.log("SmurdyQuiz:", ...args); },

    // small authoritative lists used by paint expressions (literal arrays)
    _allowedList: [],
    _correctList: [],
    _wrongList: [],
    _targetName: null,

    // Update the map paint expressions using small literal arrays (instant).
    updateLayerStyles() {
        try {
            const allowed = Array.from(this._allowedList || []);
            const correct = Array.from(this._correctList || []);
            const wrong = Array.from(this._wrongList || []);
            const target = this._targetName ? [this._targetName] : [];

            // main fill (color + opacity)
            if (this.map.getLayer(this.mainFillLayerId)) {
                const fillColorExpr = [
                    "case",
                    // quizState-like priority via property matching: target -> yellow, correct->green, wrong->red
                    ["in", ["get", "_canon"], ["literal", target]], "#ffd54f",
                    ["in", ["get", "_canon"], ["literal", correct]], "#4caf50",
                    ["in", ["get", "_canon"], ["literal", wrong]], "#f44336",
                    // in-group normal
                    ["in", ["get", "_canon"], ["literal", allowed]], "#e8e3d3",
                    // out-of-group dim
                    "#777777ff"
                ];
                const fillOpacityExpr = [
                    "case",
                    ["in", ["get", "_canon"], ["literal", target]], 0.8,
                    ["in", ["get", "_canon"], ["literal", correct]], 0.8,
                    ["in", ["get", "_canon"], ["literal", wrong]], 0.8,
                    ["in", ["get", "_canon"], ["literal", allowed]], 0.7,
                    0.16
                ];
                this.map.setPaintProperty(this.mainFillLayerId, "fill-color", fillColorExpr);
                this.map.setPaintProperty(this.mainFillLayerId, "fill-opacity", fillOpacityExpr);
            }

            // tiny circles
            if (this.map.getLayer(this.tinyCircleLayerId)) {
                const tinyColor = [
                    "case",
                    ["in", ["get", "_canon"], ["literal", target]], "#ffd54f",
                    ["in", ["get", "_canon"], ["literal", correct]], "#4caf50",
                    ["in", ["get", "_canon"], ["literal", wrong]], "#f44336",
                    // use same in-group color as main fill for tiny dots
                    ["in", ["get", "_canon"], ["literal", allowed]], "#e8e3d3",
                    "#666666"
                ];
                this.map.setPaintProperty(this.tinyCircleLayerId, "circle-color", tinyColor);
            }
        } catch (e) {
            // ignore if layers not ready
        }
    },

    // API: set lists / states (fast)
    setAllowedList(normSet) {
        this._allowedList = Array.from(normSet || []);
        this.updateLayerStyles();
    },

    setAnswerState(name, state) {
        // state: "correct" | "wrong" | null
        const norm = this.normalizeAnswer(name);
        // remove from both sets first
        this._correctList = (this._correctList || []).filter(x => x !== norm);
        this._wrongList = (this._wrongList || []).filter(x => x !== norm);
        if (state === "correct") this._correctList.push(norm);
        else if (state === "wrong") this._wrongList.push(norm);
        this.updateLayerStyles();
    },

    setTargetByNameSimple(name) {
        // immediate target highlight (name can be canonical or display)
        if (!name) {
            this._targetName = null;
            this.updateLayerStyles();
            return;
        }
        const resolved = this.resolveCanonicalName ? this.resolveCanonicalName(name) : name;
        const norm = this.normalizeAnswer(resolved || name);
        this._targetName = norm;
        this.updateLayerStyles();
    },

    // Resolve arbitrary display text to a canonical feature name (or null).
    // Uses nameIndex exact lookup, then getFeatureByName, then a safe single-candidate substring search.
    resolveCanonicalName(text) {
        try {
            const raw = String(text || "").trim();
            const norm = this.normalizeAnswer(raw);
            this.log("resolveCanonicalName()", { raw, norm });
            if (!norm) return null;

            // 1) fast exact lookup in nameIndex
            const idx = this.nameIndex?.[norm];
            if (idx && idx.canonicalName) {
                this.log("resolve -> exact nameIndex", idx.canonicalName);
                return idx.canonicalName;
            }

            // 2) try getFeatureByName (respects current group filter)
            const f = this.getFeatureByName(raw);
            if (f) {
                const cn = this.getFeatureName(f);
                this.log("resolve -> getFeatureByName", cn);
                return cn;
            }

            // 3) very conservative substring search — accept only a single candidate
            const keys = Object.keys(this.nameIndex || {});
            const candidates = [];
            for (const k of keys) {
                if (!k) continue;
                if (k === norm || k.includes(norm) || norm.includes(k)) candidates.push(k);
                if (candidates.length > 3) break; // too ambiguous
            }
            this.log("resolve candidates", candidates.slice(0,8));
            if (candidates.length === 1) {
                const entry = this.nameIndex[candidates[0]];
                this.log("resolve -> single candidate", entry?.canonicalName);
                return entry?.canonicalName || null;
            }

            return null;
        } catch (e) {
            console.error("SmurdyQuiz.resolveCanonicalName error", e);
            return null;
        }
    },

    // Batch feature-state writer to avoid blocking the main thread.
    // Accepts array of { source, id, state } and applies them in small chunks.
    batchSetFeatureStates(entries, chunkSize = 60) {
        if (!Array.isArray(entries) || entries.length === 0) return Promise.resolve();
        return new Promise(resolve => {
            let i = 0;
            const step = () => {
                const end = Math.min(i + chunkSize, entries.length);
                for (; i < end; i++) {
                    const e = entries[i];
                    try { map.setFeatureState({ source: e.source, id: e.id }, e.state); } catch (err) { /* ignore */ }
                }
                if (i < entries.length) {
                    // yield to render loop
                    requestAnimationFrame(step);
                } else {
                    // slight pause to let the style settle before resolving
                    setTimeout(resolve, 8);
                }
            };
            requestAnimationFrame(step);
        });
    },

    // Return true if the feature looks like a body of water (heuristic).
    isWaterFeature(feature) {
        if (!feature || !feature.properties) return false;
        const p = feature.properties || {};
        // prefer canonical name if available
        let name = "";
        try { name = String(this.getFeatureName(feature) || "") || ""; } catch (e) { name = String(p.NAME || p.name || ""); }
        const n = String(name).toLowerCase();

        // common water keywords (covers Great Lakes, seas, bays, rivers, etc.)
        const waterKeywords = ["lake", "sea", "gulf", "bay", "strait", "river", "ocean", "sound", "lagoon", "pond", "reservoir"];
        for (const kw of waterKeywords) {
            if (n.includes(kw)) return true;
        }

        // check a few common property fields that may indicate water
        if (p.featurecla && /lake|ocean|sea|water|reservoir|bay/i.test(p.featurecla)) return true;
        if (p.type && /lake|ocean|sea|water|reservoir|bay/i.test(p.type)) return true;
        if (p.FCLASS && /lake|ocean|sea|water|reservoir|bay/i.test(p.FCLASS)) return true;

        return false;
    },

    // Return true if a feature should be considered part of the current group.
    // This is used when setting feature-state "inGroup".
    isFeatureInCurrentGroup(feature) {
        if (!feature) return false;

        // Always treat water features as in-group so bodies of water are not dimmed across borders.
        if (this.isWaterFeature(feature)) return true;

        const groupId = this.currentGroupId || (this.currentQuiz && this.currentQuiz.group) || null;
        if (String(groupId).toLowerCase() === "world") return true;

        const allowed = this.getAllowedNamesForCurrentGroup();
        if (!allowed) return true; // no explicit group -> treat as world (no dimming)

        const canon = this.getFeatureName(feature) || "";
        const canonNorm = this.normalizeAnswer(canon);
        return allowed.has(canonNorm);
    },

    // return a list of normalized name candidates for a feature to improve matching
    getFeatureNameCandidates(feature) {
        const p = (feature && feature.properties) ? feature.properties : {};
        const candidates = [];
        // canonical getter (human-friendly)
        try { candidates.push(this.getFeatureName(feature)); } catch (e) {}
        // fallbacks from common properties
        [
            p.SOVEREIGNT,
            p.BRK_NAME,
            p.NAME_LONG,
            p.NAME,
            p.ADMIN,
            p.SUBUNIT,
            p.SUBUNIT || p.SUBUNIT,
            p.FORMAL_EN || p.FORMAL,
            p.GEOUNIT
        ].forEach(x => { if (x) candidates.push(String(x)); });

        // include resolved aliases for canonical candidate(s)
        const uniq = new Set(candidates.map(c => this.normalizeAnswer(c)));
        for (const c of Array.from(uniq)) {
            const canonical = this.normalizeAnswer(c);
            // try to find the canonical key as stored in aliases (aliases keys are original canonical strings)
            const aliasEntries = Object.entries(this.aliases || {});
            for (const [can, aliasList] of aliasEntries) {
                if (this.normalizeAnswer(can) === canonical) {
                    uniq.add(canonical);
                    for (const a of aliasList) uniq.add(this.normalizeAnswer(a));
                }
            }
        }

        return Array.from(uniq);
    },

    // build the fill-color expression used for the main fill layer.
    // If `dimOutside` is true, non-group features are drawn as a muted gray.
    buildFillColorExpression(dimOutside = false) {
        const normalMatch = [
            "match",
            ["feature-state", "quizState"],
            "target", "#ffd54f",
            "correct", "#4caf50",
            "wrong", "#f44336",
            // explicit default fill for in-group, previously transparent — make it the site base fill
            "#e8e3d3"
        ];

        if (!dimOutside) return normalMatch;

        // If dimOutside: use inGroup feature-state to decide between normal coloring or muted gray.
        return [
            "case",
            ["==", ["feature-state", "inGroup"], true],
            normalMatch,
            /* else */ "#777777ff"
        ];
    },

    // runtime API: toggle base/outline borders without reloading the page
    setShowBorders(show) {
        const effective = typeof show === "boolean" ? show : this.showBordersInitial;
        this.currentShowBorders = effective;

        try {
            // Refresh expression-driven styling
            try { this.updateLayerStyles(); } catch (e) { /* ignore */ }

            // toggle the current MODE outline layer (if present)
            try {
                if (MODE.outlineLayerId && this.map.getLayer(MODE.outlineLayerId)) {
                    this.map.setPaintProperty(MODE.outlineLayerId, "line-opacity", effective ? 1 : 0);
                }
            } catch (e) { /* ignore per-layer errors */ }

            // Also update common legacy style layers that were set on load (these can produce faint borders).
            // Use the same visual strength used at initialization (0.35 when enabled).
            const legacyOpacity = effective ? 0.35 : 0;
            try {
                if (this.map.getLayer("countries-boundary")) this.map.setPaintProperty("countries-boundary", "line-opacity", legacyOpacity);
            } catch (_) {}
            try {
                if (this.map.getLayer("coastline")) this.map.setPaintProperty("coastline", "line-opacity", legacyOpacity);
            } catch (_) {}

        } catch (e) {
            // ignore errors if layers/sources are not yet ready
        }
    },

    normalizeAnswer(text) {
        return String(text)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    },

    buildResolvedAliases() {
        // Lightweight: use the shipped aliases.json directly so normalized alias lookup works.
        // This avoids expensive expansion while enabling common alternate names.
        try {
            this.aliases = this.rawAliases || {};
        } catch (e) {
            this.aliases = {};
        }
    },

    isAcceptedAnswer(canonicalName, userAnswer) {
        const normalizedUser = this.normalizeAnswer(userAnswer);
        const normalizedCanonical = this.normalizeAnswer(canonicalName);

        if (normalizedUser === normalizedCanonical) {
            return true;
        }

        const aliases = this.aliases?.[canonicalName] || [];
        for (const alias of aliases) {
            if (this.normalizeAnswer(alias) === normalizedUser) {
                return true;
            }
        }

        return false;
    },

    getRawFeatureName(feature) {
        return MODE.getRawFeatureName(feature);
    },

    getFeatureName(feature) {
        return MODE.getCanonicalFeatureName(feature);
    },

    clearAllStates() {
        // Avoid per-feature feature-state writes. Update the allowed list used by expressions
        // and clear any per-answer/target lists so visuals reset instantly.
        try {
            const allowed = this.getAllowedNamesForCurrentGroup() || new Set(Object.keys(this.nameIndex || {}));
            this.setAllowedList(allowed);
        } catch (e) { /* ignore */ }

        // clear answer/target lists and refresh paints
        this._correctList = [];
        this._wrongList = [];
        this._targetName = null;
        this.updateLayerStyles();

        // Re-apply border visibility
        try { SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders); } catch (e) {}
     },

    setFeatureStateByName(name, quizState) {
        // Simplified: update small lists used by paint expressions instead of per-feature state writes.
        try {
            const resolved = this.resolveCanonicalName ? this.resolveCanonicalName(name) : name;
            if (!resolved) return false;
            const norm = this.normalizeAnswer(resolved);
            if (!norm) return false;

            // quizState: "target" | "correct" | "wrong" | null
            if (quizState === "target") {
                this.setTargetByNameSimple(resolved);
                return true;
            }
            if (quizState === "correct") {
                this.setAnswerState(resolved, "correct");
                return true;
            }
            if (quizState === "wrong") {
                this.setAnswerState(resolved, "wrong");
                return true;
            }
            // null -> clear both sets / target
            this.setAnswerState(resolved, null);
            return true;
        } catch (e) {
            console.warn("setFeatureStateByName simplified failed", e);
            return false;
        }
    },
 
    // Highlight/clear a target by canonical name (string). Clears previous target.
    setTargetByName(name) {
        try {
            this.log("setTargetByName()", name);
            // clear previous tracking
            this.currentTargetName = null;
            if (!name) {
                this.setTargetByNameSimple(null);
                return;
            }
            const resolved = this.resolveCanonicalName(name) || name;
            if (!resolved) {
                console.warn("SmurdyQuiz: could not resolve target name:", name);
                return;
            }
            // drive highlight from the small list-based api (instant)
            this.setTargetByNameSimple(resolved);
            this.currentTargetName = resolved;
        } catch (e) {
            console.error("SmurdyQuiz.setTargetByName error", e);
        }
     },
 
    // Set the displayed target text; optional canonicalName to force highlight.
    setTargetText(text, canonicalName) {
        try {
            document.getElementById("quiz-target").textContent = text;
            this.log("setTargetText()", { text, canonicalName });
            if (canonicalName) {
                this.log("setTargetText -> canonicalName provided, setting target", canonicalName);
                this.setTargetByName(canonicalName);
                return;
            }

            // If text looks like a generic instruction (contains words like "guess" or "type"),
            // do NOT clear an already-set target. Also do NOT clear when no target exists:
            // leaving the current state intact allows the quiz runner to set target elsewhere
            // (and avoids removing a pending highlight). Log to help debug missing target.
            const lower = String(text || "").toLowerCase();
            if (/\b(guess|type|highlighted|find|click)\b/.test(lower)) {
                this.log("setTargetText -> detected instruction text");
                if (this.currentTargetName) {
                    this.log("setTargetText -> keeping existing target", this.currentTargetName);
                    return; // keep highlight
                }
                // Previously we cleared here. That removed targets before the runner set them.
                // Now we leave things as-is and emit a debug hint so you can inspect why no target exists.
                this.log("setTargetText -> no existing target to keep; not clearing. If you expect a highlight, ensure the quiz runner calls setTargetByName() or passes canonicalName.");
                return;
            }

            // otherwise attempt to resolve the displayed text to a canonical name
            const resolved = this.resolveCanonicalName(text);
            if (resolved) {
                this.log("setTargetText -> resolved canonical", resolved);
                this.setTargetByName(resolved);
            } else {
                this.log("setTargetText: no canonical resolved for", text);
            }
        } catch (e) {
            console.error("SmurdyQuiz.setTargetText error", e);
        }
    },
 
    setProgressText(text) {
        const el = ensureSinglePanelNode("quiz-progress");
        if (!el) return;
        try {
            let out = String(text == null ? "" : text);
            const m = out.match(/^(\s*\d+\s*\/\s*)(\d+)([\s\S]*)$/);
            if (m) {
                let denom = 0;
                try {
                    if (SmurdyQuiz && typeof SmurdyQuiz.getQuizFeatures === "function") denom = (SmurdyQuiz.getQuizFeatures() || []).length;
                } catch (e) { denom = 0; }
                if (!denom) denom = (Number(SmurdyQuiz?.playableCount) || Number(m[2]) || 0);
                out = `${m[1]}${denom}${m[3] || ""}`;
            }
            el.textContent = out;
        } catch (e) {
            try { el.textContent = String(text); } catch(_) {}
        }
    },

    setAccuracyText(text) {
        const el = ensureSinglePanelNode("quiz-accuracy");
        if (!el) return;
        try { el.textContent = String(text == null ? "" : text); } catch(_) {}
    },

    setResultText(text) {
        const el = ensureSinglePanelNode("quiz-result");
        if (!el) return;
        try { el.setAttribute("aria-live", "polite"); el.textContent = String(text == null ? "" : text); } catch(_) {}
    },

    goToMainMenu() {
        // simple, reliable: navigate to root so the server-served homepage is shown
        try { window.location.href = "/"; } catch (e) { /* fallback */ window.location.search = ""; }
    },

    getClickedMainFeature(point) {
        // First check tiny-country dots
        if (this.tinyData && this.map.getLayer(this.tinyCircleLayerId)) {
            const tinyHits = this.map.queryRenderedFeatures(point, {
                layers: [this.tinyCircleLayerId]
            });

            if (tinyHits.length > 0) {
                const tinyFeature = tinyHits[0];
                const tinyName = this.getFeatureName(tinyFeature);

                const mainFeature = this.getFeatureByName(tinyName);
                if (mainFeature) {
                    return mainFeature;
                }
            }
        }

        // Then check normal land polygons
        if (this.map.getLayer(this.mainFillLayerId)) {
            const mainHits = this.map.queryRenderedFeatures(point, {
                layers: [this.mainFillLayerId]
            });

            if (mainHits.length > 0) {
                const clickedName = this.getFeatureName(mainHits[0]);
                const mainFeature = this.getFeatureByName(clickedName);
                if (mainFeature) {
                    return mainFeature;
                }
            }
        }

        return null;
    },

    getRingBounds(ring) {
        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;

        for (const coord of ring) {
            const lng = coord[0];
            const lat = coord[1];

            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        }

        return {
            minLng,
            minLat,
            maxLng,
            maxLat,
            width: maxLng - minLng,
            height: maxLat - minLat,
            area: (maxLng - minLng) * (maxLat - minLat)
        };
    },

    getBestFeatureBounds(geometry) {
        if (!geometry) return null;

        if (geometry.type === "Polygon") {
            const outerRing = geometry.coordinates[0];
            const b = this.getRingBounds(outerRing);
            return [
                [b.minLng, b.minLat],
                [b.maxLng, b.maxLat]
            ];
        }

        if (geometry.type === "MultiPolygon") {
            let best = null;

            for (const polygon of geometry.coordinates) {
                const outerRing = polygon[0];
                const b = this.getRingBounds(outerRing);

                if (!best || b.area > best.area) {
                    best = b;
                }
            }

            if (!best) return null;

            return [
                [best.minLng, best.minLat],
                [best.maxLng, best.maxLat]
            ];
        }

        return null;
    },

    zoomToFeatureByName(name) {
        const feature = this.getFeatureByName(name);
        if (!feature || !feature.geometry) return false;

        const bounds = this.getBestFeatureBounds(feature.geometry);
        if (!bounds) return false;

        const [[minLng, minLat], [maxLng, maxLat]] = bounds;

        const lngSpan = Math.abs(maxLng - minLng);
        const latSpan = Math.abs(maxLat - minLat);
        const biggestSpan = Math.max(lngSpan, latSpan);

        let maxZoom = 3.4;
        if (biggestSpan < 8) maxZoom = 3.8;
        if (biggestSpan < 4) maxZoom = 4.2;
        if (biggestSpan < 2) maxZoom = 4.6;
        if (biggestSpan < 1) maxZoom = 5;

        this.map.fitBounds(bounds, {
            padding: { top: 90, right: 90, bottom: 90, left: 90 },
            maxZoom,
            duration: 700
        });

        return true;
    },

    resetView() {
        this.map.easeTo({
            center: MODE.mapCenter,
            zoom: MODE.mapZoom,
            duration: 700
        });
    },

    async loadQuizScript(quizRef, options = { updateUrl: true }) {
        // Use the centralized inference helper (if present) so all launch paths agree.
        try {
            let manifestDef = null;
            if (typeof quizRef === "string" && quizRef.startsWith("manifest:")) {
                const id = quizRef.split(":")[1];
                manifestDef = (window.SmurdyQuizManifest || []).find(m => m.id === id) || null;
            }

            if (window.AppModes && typeof window.AppModes.inferRunOptions === "function") {
                const inferred = window.AppModes.inferRunOptions({
                    manifestItem: manifestDef,
                    groupId: this.currentGroupId,
                    explicitMode: this.currentMode || null,
                    explicitBorders: (typeof this.currentShowBorders === "boolean") ? this.currentShowBorders : undefined,
                    groups: this.groups || {}
                });
                if (inferred && inferred.mode && String(inferred.mode) !== String(this.mode)) {
                    // Do an in-place mode hot-swap so the page behaves like a refresh but without a white flicker.
                    // Update the URL (replace) so address bar is correct, then apply hotSwap and continue to launch.
                    const params = new URLSearchParams(location.search);
                    if (typeof quizRef === "string" && quizRef) params.set("quiz", quizRef);
                    params.set("mode", inferred.mode);
                    if (this.currentGroupId) params.set("group", this.currentGroupId);
                    if (typeof this.currentShowBorders !== "undefined") params.set("borders", this.currentShowBorders ? "1" : "0");
                    try { history.replaceState({}, "", "?" + params.toString()); } catch(e) {}
                    // perform hot-swap and then continue (no full reload)
                    try {
                        const swapped = await this.hotSwapMode(inferred.mode, quizRef);
                        if (!swapped) {
                            // fallback: force full reload if hot-swap failed
                            location.assign("?" + params.toString());
                            return;
                        }
                    } catch (e) {
                        // fallback to full reload
                        location.assign("?" + params.toString());
                        return;
                    }
                    // continue running — do NOT return; runner loading will proceed below
                 }
            }
        } catch (e) { /* ignore navigation helpers failing */ }

        const oldQuizScript = document.getElementById("active-quiz-script");
        if (oldQuizScript) oldQuizScript.remove();
 
        const oldRunnerScript = document.getElementById("quiz-runner-script");
        if (oldRunnerScript) oldRunnerScript.remove();
 
        // minimal URL update: push clean SEO path when requested
        try {
            if (options && options.updateUrl) {
                const slug = s => String(s||'').toLowerCase().replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-');
                let qid = null, gid = this.currentGroupId || quizGroupId;
                if (typeof quizRef === "string" && quizRef.startsWith("manifest:")) qid = quizRef.split(":")[1];
                else if (typeof quizRef === "string" && quizRef.indexOf("/") === -1 && quizRef.indexOf(".") === -1) qid = quizRef;
                else if (typeof quizRef === "object" && quizRef.quiz) qid = quizRef.quiz;
                else if (typeof quizRef === "string" && quizRef.indexOf("/") !== -1) qid = quizRef.replace(/.*\//,"").replace(/\.[^/.]+$/, "");
                if (qid) {
                    const path = `/quizzes/${slug(qid)}/${slug(gid)}/`;
                    if (location.pathname.replace(/\/$/,'') !== path.replace(/\/$/,'')) {
                        try { history.pushState({}, "", path); } catch (e) { /* ignore */ }
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // hide main-menu decorations once a quiz is loading (non-destructive)
        try { this.hideMainMenuMap(); } catch (_) {}
        const runner = document.createElement("script");
        // load the runner from the new location
        runner.src = "/src/js/quiz_runner.js";
        runner.id = "quiz-runner-script";

        runner.onload = async () => {
            try {
                // If caller passed an inline config object, call runNameQuiz directly after runner is ready
                if (quizRef && typeof quizRef === "object") {
                    // give the runner a tick to initialize its globals
                    setTimeout(() => {
                        if (typeof window.runNameQuiz === "function") {
                            window.runNameQuiz(quizRef);
                        } else {
                            console.error("Quiz runner loaded but runNameQuiz() is not available.");
                        }
                    }, 8);
                    return;
                }

                // manifest:ID references — resolve to manifest entry and either use its config or file
                if (typeof quizRef === "string" && quizRef.startsWith("manifest:")) {
                    const id = quizRef.split(":")[1];
                    // try existing manifest global first
                    let def = (window.SmurdyQuizManifest || []).find(m => m.id === id);

                    // if not present, try to load manifest.js (it may not have been injected yet)
                    if (!def) {
                        try {
                            await new Promise((resolve) => {
                                // avoid injecting twice
                                if (document.querySelector('script[data-manifest="true"]')) {
                                    // if injected but not parsed yet, wait briefly
                                    setTimeout(resolve, 60);
                                    return;
                                }
                                const s = document.createElement("script");
                                s.src = "/src/js/manifest.js";
                                s.async = true;
                                s.setAttribute("data-manifest", "true");
                                s.onload = () => resolve();
                                s.onerror = () => resolve();
                                document.head.appendChild(s);
                            });
                            def = (window.SmurdyQuizManifest || []).find(m => m.id === id);
                        } catch (e) { /* ignore */ }
                    }

                    if (!def) {
                        console.error("Manifest quiz not found:", id);
                        return;
                    }

                    if (def.config && typeof def.config === "object") {
                        // pass manifest-level prefs (like borders) into the runner config so the runner
                        // can honor manifest-specified border visibility.
                        const runnerConfig = Object.assign({}, def.config, { borders: def.borders });
                        setTimeout(() => {
                            if (typeof window.runNameQuiz === "function") {
                                window.runNameQuiz(runnerConfig);
                                // Runner started — ensure left panel shows game UI and hide browser
                                try { SmurdyQuiz.setQuizPanelMode("game"); } catch(_) {}
                                try {
                                    const panel = document.getElementById("quiz-browser");
                                    if (panel) {
                                        panel.style.transition = "opacity 180ms ease, transform 180ms ease";
                                        panel.style.opacity = "0";
                                        panel.style.transform = "translateY(-8px)";
                                        setTimeout(() => { panel.style.display = "none"; }, 200);
                                    }
                                } catch(_) {}
                            } else {
                                console.error("Quiz runner loaded but runNameQuiz() is not available.");
                            }
                        }, 8);
                        return;
                    }

                    // fallback: if manifest still references an external file, load it (backwards compatible)
                    if (def.file && typeof def.file === "string") {
                        const quizScript = document.createElement("script");
                        quizScript.src = def.file;
                        quizScript.id = "active-quiz-script";
                        // When that external quiz file loads it should initialize and call runNameQuiz.
                        // Listen briefly for the script to execute and then show the panel.
                        quizScript.onload = () => {
                            try { SmurdyQuiz.setQuizPanelMode("game"); } catch(_) {}
                            try {
                                const panel = document.getElementById("quiz-browser");
                                if (panel) { panel.style.display = "none"; panel.style.opacity = ""; panel.style.transform = ""; }
                            } catch(_) {}
                        };
                        document.body.appendChild(quizScript);
                        return;
                    }

                    console.error("Manifest entry has no config or file:", id);
                    return;
                }

                // legacy: direct path string
                if (typeof quizRef === "string") {
                    const quizScript = document.createElement("script");
                    quizScript.src = quizRef;
                    quizScript.id = "active-quiz-script";
                    quizScript.onload = () => {
                        try { SmurdyQuiz.setQuizPanelMode("game"); } catch(_) {}
                        try {
                            const panel = document.getElementById("quiz-browser");
                            if (panel) { panel.style.display = "none"; panel.style.opacity = ""; panel.style.transform = ""; }
                        } catch(_) {}
                    };
                    document.body.appendChild(quizScript);
                }
            } catch (err) {
                console.error("Failed to load quiz script", err);
            }
        };

        document.body.appendChild(runner);

        // ensure borders reflect currentShowBorders after (re)loading runner/resources
        runner.addEventListener("load", () => {
            try { this.setShowBorders(this.currentShowBorders); } catch (e) { /* ignore */ }
        });
    },

    getQuizFeaturePool() {
        const features = (this.mainData && this.mainData.features) || [];
        if (!this.currentQuiz?.group) return features;
        const allowed = this.getAllowedNamesForCurrentGroup();
        if (!allowed) return features;
        return features.filter(f => allowed.has(this.normalizeAnswer(this.getFeatureName(f))));
    },

    getCurrentGroup() {
        return this.groups?.[this.currentGroupId] || null;
    },

    getAllowedNamesForCurrentGroup() {
        const group = this.getCurrentGroup();
        if (!group) return null;

        // If explicit country list exists, build allowed set from it (including aliases)
        if (Array.isArray(group.countries) && group.countries.length > 0) {
            const allowed = new Set();
            const allFeatures = (this.mainData && Array.isArray(this.mainData.features)) ? this.mainData.features : [];

            for (const rawName of group.countries) {
                const normRaw = this.normalizeAnswer(rawName);
                if (!normRaw) continue;
                // don't add obviously tiny tokens (e.g. "of", "the", single letters)
                if (normRaw.length < 2) continue;
                allowed.add(normRaw);

                // try to find matching canonical feature and include its canonical + aliases
                const feat = allFeatures.find(f => this.normalizeAnswer(this.getFeatureName(f)) === normRaw);
                if (feat) {
                    const canonical = this.getFeatureName(feat);
                    allowed.add(this.normalizeAnswer(canonical));
                    const aliases = this.aliases?.[canonical] || [];
                    for (const a of aliases) {
                        const an = this.normalizeAnswer(a);
                        // skip too-generic or empty aliases
                        if (!an || an.length < 2) continue;
                        allowed.add(an);
                    }
                } else {
                    // also include any canonical names that contain the raw term (word-boundary)
                    for (const f of allFeatures) {
                        const canon = this.getFeatureName(f) || "";
                        const canonNorm = this.normalizeAnswer(canon);
                        if (canonNorm.includes(normRaw) || normRaw.includes(canonNorm)) {
                            allowed.add(canonNorm);
                            const aliases = this.aliases?.[canon] || [];
                            for (const a of aliases) {
                                const an = this.normalizeAnswer(a);
                                if (!an || an.length < 2) continue;
                                allowed.add(an);
                            }
                        }
                    }
                }
            }

            return allowed.size ? allowed : null;
        }

        // Fallback: derive groups by common continent/region if no explicit country list is provided.
        // Map common group ids to CONTINENT values in the GeoJSON.
        const gid = (this.currentGroupId || "").toString().toLowerCase();
        const continentMap = {
            "africa": ["Africa"],
            "europe": ["Europe"],
            "asia": ["Asia"],
            "north_america": ["North America"],
            "south_america": ["South America"],
            "americas": ["North America", "South America"],
            "eurasia": ["Europe", "Asia"],
            "oceania": ["Oceania"],
            "australia": ["Oceania"],
            "latin_america": ["South America", "North America"]
        };

        const continents = continentMap[gid] || (group.continents || null);
        if (Array.isArray(continents) && continents.length > 0) {
            const allowed = new Set();
            const allFeatures = (this.mainData && Array.isArray(this.mainData.features)) ? this.mainData.features : [];
            for (const f of allFeatures) {
                const p = f.properties || {};
                const cont = p.CONTINENT || p.continent || "";
                if (!cont) continue;
                if (continents.includes(cont)) {
                    const canonical = this.getFeatureName(f);
                    allowed.add(this.normalizeAnswer(canonical));
                    const aliases = this.aliases?.[canonical] || [];
                    for (const a of aliases) allowed.add(this.normalizeAnswer(a));
                }
            }
            return allowed.size ? allowed : null;
        }

        return null;
    },

    getQuizFeatures() {
        if (!this.mainData?.features) return [];

        const allowed = this.getAllowedNamesForCurrentGroup();
        if (!allowed) return this.mainData.features;
        return this.mainData.features.filter(feature =>
            allowed.has(this.normalizeAnswer(this.getFeatureName(feature)))
        );
    },

    getAllNames() {
        return this.getQuizFeatures()
            .map(feature => this.getFeatureName(feature))
            .filter(name => name !== "Unknown");
    },

    getFeatureByName(name) {
        const targetNorm = this.normalizeAnswer(name);
        for (const feature of this.getQuizFeatures()) {
            const featureName = this.getFeatureName(feature);
            if (this.normalizeAnswer(featureName) === targetNorm) return feature;
        }
        return null;
    },

    // Hot-swap the current MODE in-place: fetch new data & rebuild layers without full page reload.
    // Returns a Promise that resolves once the new mode is installed.
    async hotSwapMode(newMode, quizRef) {
        if (!newMode) return false;
        if (String(newMode) === String(this.mode)) return true;

        // resolve target MODE config
        const cfg = MODE_CONFIGS[newMode] || MODE_CONFIGS[String(newMode).toLowerCase()] || null;
        if (!cfg) {
            console.warn("hotSwapMode: unknown mode", newMode);
            return false;
        }

        // set runtime intention first
        this.mode = String(newMode);
        this.currentMode = String(newMode);
        MODE = cfg;

        try {
            // ease the map to the new center/zoom for a smooth transition (no white flicker)
            if (Array.isArray(MODE.mapCenter) && typeof MODE.mapZoom !== "undefined") {
                try { this.map.easeTo({ center: MODE.mapCenter, zoom: MODE.mapZoom, duration: 450 }); } catch (_) {}
            }

            // remove existing source/layers for previous MODE if present
            try {
                if (this.map.getLayer(this.mainFillLayerId)) this.map.removeLayer(this.mainFillLayerId);
            } catch(_) {}
            try {
                if (this.map.getLayer(MODE.outlineLayerId || "__none__")) this.map.removeLayer(MODE.outlineLayerId);
            } catch(_) {}
            try { if (this.map.getSource(MODE.sourceId)) this.map.removeSource(MODE.sourceId); } catch(_) {}

            // fetch the new GeoJSON
            const resp = await fetch(MODE.dataFile);
            this.mainData = await resp.json();

            if (!this.mainData || !Array.isArray(this.mainData.features)) {
                console.error("hotSwapMode: invalid GeoJSON for", MODE.dataFile);
                return false;
            }

            // apply mode-specific filtering
            this.mainData.features = MODE.filterFeatures(this.mainData.features);

            // assign ids and rebuild nameIndex (minimal)
            this.mainData.features.forEach((f, i) => { f.id = i; });
            this.nameIndex = {};
            for (const f of this.mainData.features) {
                try {
                    const canon = this.getFeatureName(f) || "";
                    const norm = this.normalizeAnswer(canon);
                    if (!norm) continue;
                    if (!this.nameIndex[norm]) this.nameIndex[norm] = { canonicalName: canon, main: [], tiny: [] };
                    this.nameIndex[norm].main.push(f.id);
                    if (!f.properties) f.properties = {};
                    f.properties._canon = norm;
                    f._canonicalNorm = norm;
                } catch (e) { /* ignore per-feature errors */ }
            }

            // add source + main fill layer (reuse existing ids from MODE)
            if (this.map.getSource(MODE.sourceId)) try { this.map.removeSource(MODE.sourceId); } catch(_) {}
            this.map.addSource(MODE.sourceId, { type: "geojson", data: this.mainData });

            // add fill layer
            try {
                this.map.addLayer({
                    id: MODE.fillLayerId,
                    type: "fill",
                    source: MODE.sourceId,
                    paint: {
                        "fill-color": this.buildFillColorExpression(true),
                        "fill-opacity": [
                            "case",
                            ["!=", ["feature-state", "quizState"], null], 0.7,
                            ["==", ["feature-state", "inGroup"], true], 0.7,
                            0.16
                        ]
                    }
                });
            } catch (e) {
                // layer may already exist; update source instead
                try { this.map.getLayer(MODE.fillLayerId) && this.map.setPaintProperty(MODE.fillLayerId, "fill-color", this.buildFillColorExpression(true)); } catch(_) {}
            }

            // outline layer
            if (!MODE.outlineLayerId) MODE.outlineLayerId = `${MODE.sourceId}-outline`;
            try {
                if (this.map.getLayer(MODE.outlineLayerId)) this.map.removeLayer(MODE.outlineLayerId);
            } catch (_) {}
            this.map.addLayer({
                id: MODE.outlineLayerId,
                type: "line",
                source: MODE.sourceId,
                paint: { "line-color": "#444", "line-width": 0.8, "line-opacity": this.currentShowBorders ? 1 : 0 }
            });

            // update playableCount/nameIndex based counts
            try { this.buildResolvedAliases(); } catch(_) {}
            this.playableCount = Object.keys(this.nameIndex || {}).length || (this.playableCount || 0);

            // re-apply allowed set (currentGroup may stay the same)
            try {
                const allowed = this.getAllowedNamesForCurrentGroup() || new Set(Object.keys(this.nameIndex || {}));
                this.setAllowedList(allowed);
                // schedule final feature-state passes asynchronously
                setTimeout(finalizeFeatureStates, 8);
            } catch (_) {}

            // load tiny points if used
            if (MODE.usesTinyPoints && MODE.tinyFile) {
                try {
                    const tresp = await fetch(MODE.tinyFile);
                    this.tinyData = await tresp.json();
                    // simple dedupe + id assign
                    const seen = new Set();
                    const dedup = [];
                    for (const rf of (this.tinyData.features || [])) {
                        const cn = this.getFeatureName(rf) || "";
                        const n = this.normalizeAnswer(cn);
                        if (!n || seen.has(n)) continue;
                        seen.add(n);
                        dedup.push(rf);
                    }
                    this.tinyData.features = dedup;
                    this.tinyData.features.forEach((f, idx) => { f.id = idx; if (!f.properties) f.properties = {}; f.properties._canon = this.normalizeAnswer(this.getFeatureName(f) || ""); });
                    try { if (this.map.getSource("quiz-tiny-source")) this.map.removeSource("quiz-tiny-source"); } catch(_) {}
                    this.map.addSource("quiz-tiny-source", { type: "geojson", data: this.tinyData });
                    // recreate tiny layer if missing
                    if (!this.map.getLayer("quiz-tiny-circle")) {
                        this.map.addLayer({
                            id: "quiz-tiny-circle",
                            type: "circle",
                            source: "quiz-tiny-source",
                            paint: {
                                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 3, 4, 5, 6, 8, 9],
                                "circle-color": "#666666",
                                "circle-opacity": 0.9
                            }
                        });
                    } else {
                        // update source data
                        try { this.map.getSource("quiz-tiny-source").setData(this.tinyData); } catch(_) {}
                    }
                } catch (_) { /* ignore tiny load errors */ }
            }

            // ensure borders visibility matches desired state
            try { this.setShowBorders(this.currentShowBorders); } catch(_) {}

            console.info("smurdy: hotSwapMode complete ->", newMode);
            return true;
        } catch (err) {
            console.error("hotSwapMode failed", err);
            return false;
        }
    },

    // Show a simple, non-destructive main-menu decoration that uses the same fill coloring
    // as quizzes and adds readable country labels. Minimal: toggles paint + a symbol layer.
    // Replace main-menu decorations with a separate lightweight overlay MapLibre instance.
    // This is intentionally non-destructive: it creates a temporary map in a new overlay div
    // that is removed when a quiz starts so the primary map and its layers are never altered.
    _menuMap: null,
    _menuMapDiv: null,

    showMainMenuMap() {
        try {
            // already active
            if (this._menuMap) return;

            // create overlay container that sits above the app map
            const container = document.getElementById("map");
            if (!container) return;

            // create a full-size overlay div
            const div = document.createElement("div");
            div.id = "menu-map-overlay";
            // ensure it sits above the main map but below UI panels (z-index conservative)
            div.style.position = "absolute";
            div.style.left = "0";
            div.style.top = "0";
            div.style.width = "100%";
            div.style.height = "100%";
            div.style.zIndex = "1000"; // overlay stacking
            div.style.pointerEvents = "auto"; // let user pan/zoom the menu map
            // Keep the existing map visible until the menu style is ready, then
            // fade the overlay in instead of flashing partially loaded tiles.
            div.style.opacity = "0";
            div.style.transition = "opacity 180ms ease";
            // keep same language as map container if set
            try { const lang = container.getAttribute("lang"); if (lang) div.setAttribute("lang", lang); } catch (_) {}

            // insert overlay into same parent as main map (covers it)
            container.parentNode.insertBefore(div, container.nextSibling);

            // Ensure the quiz panel stays visible above the overlay while the menu is active.
            try {
                const panel = document.getElementById("quiz-panel");
                if (panel) {
                    // save any inline style so we can restore later
                    this._menuSavedQuizPanelStyle = {
                        zIndex: panel.style.zIndex || "",
                        position: panel.style.position || ""
                    };
                    // ensure panel creates its own stacking context and sits above overlay
                    if (!panel.style.position) panel.style.position = "relative";
                    panel.style.zIndex = "2000";
                }
            } catch (_) {}

            // lightweight RTL plugin (safe to call multiple times)
            try {
                maplibregl.setRTLTextPlugin(
                    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js'
                );
            } catch (e) { /* ignore plugin load errors */ }

            // create new MapLibre instance for the menu
            const menuMap = new maplibregl.Map({
                container: div.id,
                style: 'https://tiles.openfreemap.org/styles/bright',
                center: Array.isArray(MODE.mapCenter) ? MODE.mapCenter.slice(0) : [17.49, 40.01],
                zoom: Math.max( Math.min(MODE.mapZoom || 3, 6), 2 ),
                interactive: true,
                // Avoid an additional tile cross-fade after the style has loaded.
                fadeDuration: 0,
                // do NOT add the built-in MapLibre attribution control for the overlay;
                // use the app's custom mobile "i" (setupMobileAttribution) which is only shown on mobile.
                attributionControl: false
            });

            // show a few UI controls on the menu map (optional)
            try {
                const nav = new maplibregl.NavigationControl();
                menuMap.addControl(nav, 'top-right');
            } catch (_) {}

            // When menu map loads, set the country label formatting similar to the example.
            menuMap.on('load', () => {
                try {
                    const candidateLayers = [
                        'label_country', // example target
                        'country-label', 'countries-label', 'place_country', 'place_label'
                    ];
                    for (const lid of candidateLayers) {
                        if (menuMap.getLayer(lid)) {
                            try {
                                // use format expression to show English + local name when available
                                menuMap.setLayoutProperty(lid, 'text-field', [
                                    'format',
                                    ['coalesce', ['get', 'name_en'], ['get', 'name']],
                                    {'font-scale': 1.1},
                                    '\n',
                                    {},
                                    ['coalesce', ['get', 'name_local'], ['get', 'name']],
                                    {'font-scale': 0.85}
                                ]);
                            } catch (_) { /* ignore per-layer failures */ }
                        }
                    }

                    // If none of the candidate layer ids exist, try to find the first symbol layer with text-field
                    const style = menuMap.getStyle();
                    if (style && Array.isArray(style.layers)) {
                        const fallback = style.layers.find(l => l.type === 'symbol' && l.layout && l.layout['text-field']);
                        if (fallback && fallback.id) {
                            try {
                                menuMap.setLayoutProperty(fallback.id, 'text-field', [
                                    'format',
                                    ['coalesce', ['get', 'name_en'], ['get', 'name']],
                                    {'font-scale': 1.1},
                                    '\n',
                                    {},
                                    ['coalesce', ['get', 'name_local'], ['get', 'name']],
                                    {'font-scale': 0.85}
                                ]);
                            } catch (_) {}
                        }
                    }
                } catch (e) {
                    console.warn("menuMap: label formatting failed", e);
                }

                requestAnimationFrame(() => {
                    if (this._menuMap === menuMap && this._menuMapDiv === div) {
                        div.style.opacity = "1";
                    }
                });
            });

            // remember instances so we can remove them later
            this._menuMap = menuMap;
            this._menuMapDiv = div;
            this._menuActive = true;
        } catch (e) {
            console.warn("showMainMenuMap failed", e);
        }
    },

    hideMainMenuMap() {
        try {
            if (this._menuMap) {
                try { this._menuMap.remove(); } catch (_) {}
                this._menuMap = null;
            }
            if (this._menuMapDiv && this._menuMapDiv.parentNode) {
                try { this._menuMapDiv.parentNode.removeChild(this._menuMapDiv); } catch (_) {}
                this._menuMapDiv = null;
            }

            // restore any saved quiz-panel inline styles so layout returns to previous state
            try {
                const panel = document.getElementById("quiz-panel");
                if (panel && this._menuSavedQuizPanelStyle) {
                    panel.style.zIndex = this._menuSavedQuizPanelStyle.zIndex || "";
                    panel.style.position = this._menuSavedQuizPanelStyle.position || "";
                    this._menuSavedQuizPanelStyle = null;
                }
            } catch (_) {}

            this._menuActive = false;
        } catch (e) {
            console.warn("hideMainMenuMap failed", e);
        }
    },
}

window.SmurdyQuiz = SmurdyQuiz;
 
// Start the independent menu map immediately instead of waiting for the quiz
// map's style, aliases, groups, country GeoJSON, and tiny-country data.
if (!urlParams.get("quiz")) {
    requestAnimationFrame(() => {
        try { SmurdyQuiz.showMainMenuMap(); } catch (_) {}
    });
}

map.on("load", async () => {
    const style = map.getStyle();

    try {
        const aliasesResponse = await fetch("/src/data/aliases.json");
        SmurdyQuiz.rawAliases = await aliasesResponse.json();
    } catch (err) {
        console.warn("Could not load aliases.json, continuing without aliases.", err);
        SmurdyQuiz.rawAliases = {};
    }

    try {
        const groupsResponse = await fetch("/src/data/country_groups.json");
        SmurdyQuiz.groups = await groupsResponse.json();
    } catch (err) {
        console.warn("Could not load country_groups.json, continuing without groups.", err);
        SmurdyQuiz.groups = {};
    }

    for (const layer of style.layers) {
        const isSymbolLayer = layer.type === "symbol";
        const hasTextField =
            layer.layout &&
            Object.prototype.hasOwnProperty.call(layer.layout, "text-field");

        if (isSymbolLayer && hasTextField) {
            map.setLayoutProperty(layer.id, "visibility", "none");
        }
    }

    if (map.getLayer("countries-fill")) {
        map.setPaintProperty("countries-fill", "fill-color", "#e8e3d3");
    }

    if (map.getLayer("crimea-fill")) {
        map.setPaintProperty("crimea-fill", "fill-color", "#e8e3d3");
    }

    const showBaseBorders = showBorders && mode !== "states";

    if (map.getLayer("countries-boundary")) {
        map.setPaintProperty("countries-boundary", "line-color", "#999999");
        map.setPaintProperty("countries-boundary", "line-opacity", showBaseBorders ? 0.35 : 0);
    }

    if (map.getLayer("coastline")) {
        map.setPaintProperty("coastline", "line-color", "#999999");
        map.setPaintProperty("coastline", "line-opacity", showBaseBorders ? 0.35 : 0);
    }

    const response = await fetch(MODE.dataFile);
    SmurdyQuiz.mainData = await response.json();

    if (
        SmurdyQuiz.mainData.type !== "FeatureCollection" ||
        !SmurdyQuiz.mainData.features
    ) {
        console.error(`${MODE.dataFile} is not a GeoJSON FeatureCollection`);
        return;
    }

    // --- Fix country counting: use actual playable feature count (from GeoJSON) ---
    // compute playable count after any MODE-specific filtering below and expose helpers
    // (we'll set SmurdyQuiz.playableCount after applying MODE.filterFeatures)
    // record alias key count too for debugging
    SmurdyQuiz.aliasKeyCount = Object.keys(SmurdyQuiz.rawAliases || {}).length;
    SmurdyQuiz.getPlayableCount = () => SmurdyQuiz.playableCount || 0;
    // helper to update common DOM placeholders that may show the count
    function writePlayableCountToDOM(count) {
        try {
            const ids = ["country-count", "countries-count"];
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el) el.textContent = String(count);
            }
            // class-based
            document.querySelectorAll(".country_count, .countries_count").forEach(el => el.textContent = String(count));
            // data-attr fallback
            document.querySelectorAll("[data-playable-count]").forEach(el => el.textContent = String(count));
        } catch (e) { /* ignore DOM errors */ }
    }
    // --- end counting helpers ---

    // keep the full dataset but allow mode-specific filtering (e.g. remove non-US states)
    SmurdyQuiz.mainData.features = MODE.filterFeatures(SmurdyQuiz.mainData.features);

    // playableCount will be computed after we build the nameIndex (dedup by canonical name) below
    // (temporary placeholder until nameIndex exists)
    SmurdyQuiz.playableCount = 0;
 
    // do NOT filter the mainData to the group; we'll dim non-group features via feature-state.
    const allowedNames = SmurdyQuiz.getAllowedNamesForCurrentGroup();
 
    // assign ids and build a fast nameIndex: normalized canonical -> { main: [ids], tiny: [ids] }
    SmurdyQuiz.mainData.features.forEach((feature, index) => { feature.id = index; });
    SmurdyQuiz.nameIndex = SmurdyQuiz.nameIndex || {};
    for (const feature of (SmurdyQuiz.mainData.features || [])) {
        const canon = SmurdyQuiz.getFeatureName(feature) || "";
        const norm = SmurdyQuiz.normalizeAnswer(canon);
        if (!norm) continue;
        if (!SmurdyQuiz.nameIndex[norm]) SmurdyQuiz.nameIndex[norm] = { canonicalName: canon, main: [], tiny: [] };
        SmurdyQuiz.nameIndex[norm].main.push(feature.id);
        // expose normalized canonical on feature.properties for expression-driven styling
        if (!feature.properties) feature.properties = {};
        feature.properties._canon = norm;
        feature._canonicalNorm = norm;
    }
 
    SmurdyQuiz.buildResolvedAliases();
    // Now compute playableCount as unique canonical names (deduped) — this should match aliases keys (201)
    const nameIndexCount = Object.keys(SmurdyQuiz.nameIndex || {}).length || 0;
    // Prefer aliases.json authoritative key count when available (keeps world = 201).
    SmurdyQuiz.playableCount = (SmurdyQuiz.aliasKeyCount && SmurdyQuiz.aliasKeyCount > 0) ? SmurdyQuiz.aliasKeyCount : nameIndexCount;
    console.info("smurdy: counts -> playable=", SmurdyQuiz.playableCount, " nameIndex=", nameIndexCount, " aliasKeys=", SmurdyQuiz.aliasKeyCount);
    writePlayableCountToDOM(SmurdyQuiz.playableCount);
 
    if (map.getLayer(MODE.fillLayerId)) {
        map.removeLayer(MODE.fillLayerId);
    }

    if (map.getLayer(MODE.outlineLayerId || "__none__")) {
        map.removeLayer(MODE.outlineLayerId);
    }

    if (map.getSource(MODE.sourceId)) {
        map.removeSource(MODE.sourceId);
    }

    map.addSource(MODE.sourceId, {
        type: "geojson",
        data: SmurdyQuiz.mainData
    });

    map.addLayer({
        id: MODE.fillLayerId,
        type: "fill",
        source: MODE.sourceId,
        paint: {
            // Prioritize quizState colors (target/correct/wrong) regardless of inGroup,
            // then fall back to in-group color or dimmed gray.
            "fill-color": [
                "case",
                // 1) If there is a quizState, color by it immediately
                ["!=", ["feature-state", "quizState"], null],
                    ["match",
                        ["feature-state", "quizState"],
                        "target", "#ffd54f",
                        "correct", "#4caf50",
                        "wrong", "#f44336",
                        // fallback default when quizState exists
                        "#e8e3d3"
                    ],
                // 2) Else if feature is inGroup, use normal in-group fill
                ["==", ["feature-state", "inGroup"], true], "#e8e3d3",
                // 3) Else dimmed out-of-group color
                "#777777ff"
            ],
            "fill-opacity": [
                "case",
                // show colored opacity for any quizState
                ["!=", ["feature-state", "quizState"], null], 0.7,
                // otherwise show full opacity for in-group, dim for out-of-group
                ["==", ["feature-state", "inGroup"], true], 0.7,
                0.16
            ]
         }
     });

    // Ensure an outline layer exists for borders (some MODEs may not set outlineLayerId)
    if (!MODE.outlineLayerId) {
        MODE.outlineLayerId = `${MODE.sourceId}-outline`;
    }
    
    if (!map.getLayer(MODE.outlineLayerId)) {
        map.addLayer({
            id: MODE.outlineLayerId,
            type: "line",
            source: MODE.sourceId,
            paint: {
                "line-color": "#444",
                "line-width": 0.8,
                "line-opacity": showBorders ? 1 : 0
            }
        });
    }

    // set per-feature inGroup feature-state now (so expressions using feature-state work)
    try {
        // If allowedNames is null/undefined that means "world" (allow everything).
        // Use all nameIndex keys as the allowed set in that case so nothing is dimmed.
        const allowed = allowedNames || new Set(Object.keys(SmurdyQuiz.nameIndex || {}));
        SmurdyQuiz.setAllowedList(allowed);
        // still build progressive outline in worker (non-blocking) if available
        try { SmurdyQuiz.requestGroupOutline(allowed); } catch (e) { /* ignore */ }
        // skip finalizeFeatureStates/any per-feature setFeatureState work to keep load fast
     } catch (e) {
         // ignore if source/layers not ready
     }

    // Re-apply borders/dimming now that per-feature inGroup states exist
    try {
        SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders);
    } catch (e) { /* ignore */ }

    if (MODE.usesTinyPoints && MODE.tinyFile) {
        const tinyResponse = await fetch(MODE.tinyFile);
        SmurdyQuiz.tinyData = await tinyResponse.json();

        if (
            SmurdyQuiz.tinyData.type === "FeatureCollection" &&
            SmurdyQuiz.tinyData.features
        ) {
            SmurdyQuiz.tinyData.features = MODE.filterTinyFeatures(SmurdyQuiz.tinyData.features);
            
            // do not filter tinyData — mark inGroup via feature-state below so we can dim non-group dots

            // When loading tinyData, apply similar dedupe before assigning IDs
            {
                const seenTiny = new Set();
                const dedupTiny = [];
                for (const rawFeature of (SmurdyQuiz.tinyData.features || [])) {
                    const canon = SmurdyQuiz.getFeatureName(rawFeature) || "";
                    const norm = SmurdyQuiz.normalizeAnswer(canon);
                    if (!norm) continue;
                    if (seenTiny.has(norm)) continue;
                    seenTiny.add(norm);
                    dedupTiny.push(rawFeature);
                }
                SmurdyQuiz.tinyData.features = dedupTiny;
                SmurdyQuiz.tinyData.features.forEach((feature, index) => {
                    feature.id = index;
                    try {
                        const canon = SmurdyQuiz.getFeatureName(feature) || "";
                        const norm = SmurdyQuiz.normalizeAnswer(canon);
                        if (!feature.properties) feature.properties = {};
                        feature.properties._canon = norm || "";
                        feature._canonicalNorm = norm || "";
                    } catch (e) { /* ignore */ }
                });
            }

            if (map.getLayer("quiz-tiny-circle")) {
                map.removeLayer("quiz-tiny-circle");
            }

            if (map.getSource("quiz-tiny-source")) {
                map.removeSource("quiz-tiny-source");
            }

            map.addSource("quiz-tiny-source", {
                type: "geojson",
                data: SmurdyQuiz.tinyData
            });

            map.addLayer({
                id: "quiz-tiny-circle",
                type: "circle",
                source: "quiz-tiny-source",
                paint: {
                    "circle-radius": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        1, 3,
                        3, 4,
                        5, 6,
                        8, 9
                    ],
                    // initial paint uses property-driven expressions to match main layer behavior
                    "circle-color": [
                        "case",
                        ["in", ["get", "_canon"], ["literal", []]], "#ffd54f", // target literal will be replaced by updateLayerStyles
                        "#666666"
                    ],
                    "circle-opacity": 0.9,
                     "circle-stroke-color": "#222222",
                     "circle-stroke-width": [
                         "case",
                        ["in", ["get", "_canon"], ["literal", []]], 1.4,
                        0.8
                     ]
                 }
             });

            map.on("mouseenter", "quiz-tiny-circle", () => {
                map.getCanvas().style.cursor = "pointer";
            });

            map.on("mouseleave", "quiz-tiny-circle", () => {
                map.getCanvas().style.cursor = "";
            });

            // No per-tiny-feature map.setFeatureState here — styling is driven by updateLayerStyles()
            // which uses properties._canon + the small literal lists (allowed/correct/wrong/target).
            // This keeps loading fast and the UI responsive.
         }
     }

    map.on("mouseenter", MODE.fillLayerId, () => {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", MODE.fillLayerId, () => {
        map.getCanvas().style.cursor = "";
    });

    const quizFile = urlParams.get("quiz");
    // show main-menu decorations only when no quiz is selected (safe, non-destructive)
    if (!quizFile) {
        try { SmurdyQuiz.showMainMenuMap(); } catch (_) {}
    }
    if (quizFile) {
        SmurdyQuiz.loadQuizScript(quizFile, { updateUrl: true });
    } else {
        const manifestScript = document.createElement("script");
        // ensure manifest comes from the new location
        manifestScript.src = "/src/js/manifest.js";
        manifestScript.id = "quiz-manifest-script";
        document.body.appendChild(manifestScript);
    }
});

// add helper to finalize and correct feature-states after batches
function finalizeFeatureStates() {
    // Batch corrections to avoid main-thread stalls on large datasets.
    const main = SmurdyQuiz.mainData?.features || [];
    const tiny = SmurdyQuiz.tinyData?.features || [];
    const batchSize = 400;

    let mi = 0;
    const processMain = () => {
        const end = Math.min(mi + batchSize, main.length);
        for (; mi < end; mi++) {
            const feature = main[mi];
            try {
                const expected = !!SmurdyQuiz.isFeatureInCurrentGroup(feature);
                const state = map.getFeatureState({ source: MODE.sourceId, id: feature.id }) || {};
                const current = !!state.inGroup;
                if (current !== expected) map.setFeatureState({ source: MODE.sourceId, id: feature.id }, { inGroup: expected });
            } catch (e) { /* ignore per-feature errors */ }
        }
        if (mi < main.length) setTimeout(processMain, 8);
        else processTiny();
    };

    let ti = 0;
    const processTiny = () => {
        const end = Math.min(ti + batchSize, tiny.length);
        for (; ti < end; ti++) {
            const feature = tiny[ti];
            try {
                const expected = !!SmurdyQuiz.isFeatureInCurrentGroup(feature);
                const state = map.getFeatureState({ source: "quiz-tiny-source", id: feature.id }) || {};
                const current = !!state.inGroup;
                if (current !== expected) map.setFeatureState({ source: "quiz-tiny-source", id: feature.id }, { inGroup: expected });
            } catch (e) { /* ignore per-feature errors */ }
        }
        if (ti < tiny.length) setTimeout(processTiny, 8);
        else {
            try { SmurdyQuiz.setShowBorders(SmurdyQuiz.currentShowBorders); } catch(e){}
        }
    };

    try { processMain(); } catch (e) { console.warn("finalizeFeatureStates failed", e); }
}

// minimal popstate handling: try to load quiz in-page, otherwise reload so homepage shows correctly
window.addEventListener("popstate", () => {
    try {
        const m = location.pathname.match(/\/quizzes\/([^\/]+)\/([^\/]+)\/?/);
        if (m && m[1]) {
            // attempt in-page load if runner available, otherwise reload
            if (window.SmurdyQuiz && typeof window.SmurdyQuiz.loadQuizScript === "function") {
                try { window.SmurdyQuiz.loadQuizScript("manifest:" + m[1], { updateUrl: false }); return; } catch (e) { /* fallthrough */ }
            }
            // fallback: reload to let server serve the right landing content
            location.reload();
            return;
        }
        // not a quiz path — reload to restore full homepage reliably
        location.reload();
    } catch (e) {
        location.reload();
    }
}, false);

// Ensure exactly one element exists for the given id. If multiples exist, remove extras and return the single element.
function ensureSinglePanelNode(id) {
    try {
        const matches = Array.from(document.querySelectorAll("#" + id));
        if (matches.length > 1) {
            // keep first, remove the rest
            for (let i = 1; i < matches.length; i++) matches[i].remove();
            return matches[0];
        }
        if (matches.length === 1) return matches[0];

        // not found -> create and insert before buttons (or append to panel/body)
        const el = document.createElement("div");
        el.id = id;
        const panel = document.getElementById("quiz-panel");
        const buttons = document.getElementById("quiz-buttons");
        if (panel) {
            if (buttons && buttons.parentNode === panel) panel.insertBefore(el, buttons);
            else panel.appendChild(el);
        } else {
            document.body.appendChild(el);
        }
        return el;
    } catch (e) {
        return document.getElementById(id) || null;
    }
}

// Remove accidental duplicates for a list of ids (called on panel mode change / restart)
function removeDuplicatePanelNodes(ids) {
    try {
        for (const id of ids) {
            const matches = Array.from(document.querySelectorAll("#" + id));
            if ( matches.length > 1) {
                for (let i = 1; i < matches.length; i++) matches[i].remove();
            }
        }
    } catch (e) { /* ignore */ }
}

// keep simple: toggle the homepage vs game controls so UI looks correct before runner starts
SmurdyQuiz.setQuizPanelMode = function(mode) {
    try {
        // dedupe these nodes early so restart won't leave multiple empty elements
        removeDuplicatePanelNodes(["quiz-progress", "quiz-accuracy", "quiz-result"]);

        const desc = document.getElementById("quiz-desc");
        const suggest = document.getElementById("quiz-suggest");
        const restart = document.getElementById("quiz-restart");
        const back = document.getElementById("quiz-back");
        const giveup = document.getElementById("quiz-giveup");
        const timer = document.getElementById("quiz-timer");
        const progress = document.getElementById("quiz-progress");
        const accuracy = document.getElementById("quiz-accuracy");
        const result = document.getElementById("quiz-result");

        if (mode === "game") {
            if (desc) desc.style.display = "none";
            if (suggest) suggest.style.display = "none";
            if (restart) restart.style.display = "";
            if (back) back.style.display = "";
            if (giveup) giveup.style.display = "";
            if (timer) timer.style.display = "";
            if (progress) progress.style.display = "";
            if (accuracy) accuracy.style.display = "";
            if (result) result.style.display = "";
        } else {
            if (desc) desc.style.display = "";
            if (suggest) suggest.style.display = "";
            if (restart) restart.style.display = "none";
            if (back) back.style.display = "none";
            if (giveup) giveup.style.display = "none";
            if (timer) timer.style.display = "none";
            if (progress) progress.style.display = "none";
            if (accuracy) accuracy.style.display = "none";
            if (result) result.style.display = "none";
        }
    } catch (e) {
        /* non-fatal */
    }
};

// Apply homepage visibility immediately. This removes the empty result div's
// min-height before the asynchronous map-loading pipeline finishes.
if (!urlParams.get("quiz")) {
    try { SmurdyQuiz.setQuizPanelMode("homepage"); } catch (_) {}
}

// App version badge
// Update APP_VERSION per project rules when you change code:
// - small bugfix: increment third digit (1.0.1)
// - add/remove feature: increment second digit (1.1.0)
// - breaking change: increment first digit (2.0.0)
const APP_VERSION = "1.3.0"; 

function injectVersionBadge() {
    try {
        if (document.getElementById("app-version")) return;
        const el = document.createElement("div");
        el.id = "app-version";
        el.textContent = "v" + APP_VERSION;
        el.setAttribute("aria-hidden", "true");

        // Visual styling: inset from safe-area with a subtle floating card look.
        el.style.position = "fixed";
        // place badge in bottom-right and respect safe-area inset on iOS
        el.style.right = "calc(env(safe-area-inset-right, 12px) + 8px)";
        el.style.bottom = "calc(env(safe-area-inset-bottom, 12px) + 8px)";
        el.style.zIndex = "99999";
        el.style.fontSize = "12px";
        el.style.padding = "6px 8px";
        el.style.borderRadius = "8px";
        el.style.background = "rgba(255,255,255,0.92)";
        el.style.color = "rgba(0,0,0,0.65)";
        el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
        el.style.pointerEvents = "none";
        el.style.userSelect = "none";
        el.style.fontFamily = "system-ui, Arial, sans-serif";

        document.body.appendChild(el);
    } catch (_) { /* tolerate errors */ }
}

try { injectVersionBadge(); } catch (_) {}