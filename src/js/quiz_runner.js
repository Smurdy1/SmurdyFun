window.runNameQuiz = function runNameQuiz(config) {
    const SQ = window.SmurdyQuiz;

    // reuse a global runner-state object so repeated calls are safe
    if (!window._smurdyQuizRunner) window._smurdyQuizRunner = {};
    const RUN = window._smurdyQuizRunner;

    // Declare shared UI references before setQuizPanelMode() is first called.
    // Previously that first call hit the temporal dead zone and silently failed.
    let inputEl = null;
    let submitButton = null;
    let progress = null;
    let accuracy = null;
    let result = null;
    let stats = null;

    // Ensure a bottom mobile container exists and move controls there on small screens.
    function ensureMobileBottom() {
        if (!document.getElementById("quiz-bottom")) {
            const b = document.createElement("div");
            b.id = "quiz-bottom";
            document.body.appendChild(b);
        }
    }

    function arrangeMobilePanels() {
        const isMobile = (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
        const panel = document.getElementById("quiz-panel");
        const bottom = document.getElementById("quiz-bottom");
        const buttons = document.getElementById("quiz-buttons");

        if (!panel || !bottom || !buttons) return;

        if (isMobile) {
            // top: instruction panel (#quiz-panel)
            panel.style.display = "flex";
            panel.style.flexDirection = "column";
            panel.style.alignItems = "center";
            // bottom: move controls into bottom container
            if (buttons.parentNode !== bottom) bottom.appendChild(buttons);
            bottom.style.display = "flex";
            bottom.style.flexDirection = "column";
        } else {
            // desktop: restore original layout
            if (buttons.parentNode !== panel) panel.appendChild(buttons);
            bottom.style.display = "none";
            panel.style.display = "";
            panel.style.flexDirection = "";
            panel.style.alignItems = "";
        }
    }

    // initialize mobile bottom + listener (only once)
    try {
        ensureMobileBottom();
        arrangeMobilePanels();
        if (!RUN._mobileResizeBound) {
            window.addEventListener("resize", arrangeMobilePanels);
            RUN._mobileResizeBound = true;
        } else {
            // still ensure panels arranged on repeated init
            arrangeMobilePanels();
        }
    } catch (_) {}

    // Wire Give Up button once, but replace the active run callback each time.
    // This avoids retaining a closure from an older quiz run.
    try {
        const giveUpBtn = document.getElementById("quiz-giveup");

        RUN.giveUpCurrentQuestion = () => {
            try {
                if (!currentName || locked) return;

                locked = true;
                attempts++;
                finishWrong(currentName, true);
            } catch (e) { /* tolerate any errors */ }
        };

        if (giveUpBtn && !giveUpBtn._giveupBound) {
            giveUpBtn.addEventListener("click", () => {
                try {
                    if (typeof RUN.giveUpCurrentQuestion === "function") {
                        RUN.giveUpCurrentQuestion();
                    }
                } catch (e) { /* tolerate any errors */ }
            });
            giveUpBtn._giveupBound = true;
        }
    } catch (_) {}

    // Return one canonical node for an id and remove accidental duplicates.
    function getSingleRunnerNode(id) {
        try {
            const matches = Array.from(document.querySelectorAll("#" + id));
            for (let i = 1; i < matches.length; i++) matches[i].remove();
            return matches[0] || null;
        } catch (_) {
            return document.getElementById(id);
        }
    }

    // Ensure a persistent compact stats element exists (created once; CSS controls visibility).
    function ensureStatsElement() {
        const existing = getSingleRunnerNode("quiz-stats");
        if (existing) {
            stats = existing;
            return existing;
        }

        const panel = document.getElementById("quiz-panel");
        if (!panel) return null;

        const statsEl = document.createElement("div");
        statsEl.id = "quiz-stats";
        statsEl.innerHTML = '<span id="stats-count"></span><span id="stats-timer"></span><span id="stats-accuracy"></span>';
        // append near top so it stays with the panel regardless of button reparenting
        panel.appendChild(statsEl);
        stats = statsEl;
        return statsEl;
    }
    try { ensureStatsElement(); } catch (_) {}

    // Toggle quiz-panel between "homepage" (description + suggest) and "game" (timer + controls).
    function setQuizPanelMode(mode) {
        const panel = document.getElementById("quiz-panel"); // <- ensure panel is defined
        const desc = document.getElementById("quiz-desc");
        const suggest = document.getElementById("quiz-suggest");
        const restart = document.getElementById("quiz-restart");
        const back = document.getElementById("quiz-back");
        const giveUp = document.getElementById("quiz-giveup");
        let timer = document.getElementById("quiz-timer");
        const target = document.getElementById("quiz-target");

        // Reuse the app's existing nodes and remove any duplicate ids before
        // deciding whether a node needs to be created.
        progress = getSingleRunnerNode("quiz-progress");
        accuracy = getSingleRunnerNode("quiz-accuracy");
        result = getSingleRunnerNode("quiz-result");
        stats = getSingleRunnerNode("quiz-stats");

        // ensure mobile panels arranged after any mode switch
        try { arrangeMobilePanels(); } catch (_) {}

        if (mode === "game") {
            if (desc) desc.style.display = "none";
            if (suggest) suggest.style.display = "none";
            if (restart) restart.style.display = "";
            if (back) back.style.display = "";
            if (giveUp) giveUp.style.display = "";

            // ensure timer exists and is visible
            if (!timer && target) {
                timer = document.createElement("div");
                timer.id = "quiz-timer";
                timer.style.marginTop = "6px";
                timer.style.fontWeight = "700";
                target.parentNode.insertBefore(timer, target.nextSibling);
            }
            if (timer) timer.style.display = "";

            // ensure progress/accuracy exist (desktop) AND the compact mobile stats row
            if (!progress && panel) {
                progress = document.createElement("div");
                progress.id = "quiz-progress";
                progress.style.color = "rgba(0,0,0,0.7)";
                progress.style.marginTop = "6px";
                const buttons = document.getElementById("quiz-buttons");
                if (buttons && buttons.parentNode === panel) panel.insertBefore(progress, buttons);
                else panel.appendChild(progress);
            }
            if (progress) progress.style.display = "";

            if (!accuracy && panel) {
                accuracy = document.createElement("div");
                accuracy.id = "quiz-accuracy";
                accuracy.style.color = "rgba(0,0,0,0.7)";
                accuracy.style.marginTop = "4px";
                const buttons = document.getElementById("quiz-buttons");
                if (buttons && buttons.parentNode === panel) panel.insertBefore(accuracy, buttons);
                else panel.appendChild(accuracy);
            }
            if (accuracy) accuracy.style.display = "";

            // ensure the persistent stats element exists; don't set inline display (CSS governs visibility)
            try { ensureStatsElement(); } catch (_) {}
            stats = getSingleRunnerNode("quiz-stats");
            if (stats) {
                stats.style.marginTop = "6px";
                // Let the responsive CSS decide whether compact stats are shown.
                stats.style.removeProperty("display");
            }

            // ensure result exists and is visible
            if (!result && panel) {
                result = document.createElement("div");
                result.id = "quiz-result";
                result.setAttribute("aria-live", "polite");
                result.style.marginTop = "6px";
                const buttons = document.getElementById("quiz-buttons");
                if (buttons && buttons.parentNode === panel) panel.insertBefore(result, buttons);
                else panel.appendChild(result);
            }
            if (result) result.style.display = "";
        } else {
            // homepage
            if (desc) desc.style.display = "";
            if (suggest) suggest.style.display = "";
            if (restart) restart.style.display = "none";
            if (back) back.style.display = "none";
            if (giveUp) giveUp.style.display = "none";
            if (timer) timer.style.display = "none";
            if (progress) progress.style.display = "none";
            if (accuracy) accuracy.style.display = "none";
            if (result) {
                result.textContent = "";
                result.style.display = "none";
            }
            if (stats) stats.style.setProperty("display", "none", "important");
        }
    }

    // Ensure the panel shows the game UI when a quiz starts.
    try { setQuizPanelMode("game"); } catch (e) {}

    // hide browser panel when a game starts
    try {
        const panel = document.getElementById("quiz-browser");
        if (panel) panel.style.display = "none";
    } catch (e) {}

    const {
         mode, // "click" or "type"
         titleBuilder,
         inputPlaceholder = "Type answer...",
         successText = "Correct!",
         wrongTextType = (answer) => `Wrong: ${answer}`,
         doneText = (timeText) => `Finished in ${timeText}`,
         persistCompletedHighlights = true,
         showTargetOnWrong = true,
         clickableLayerId = null,
         // custom for "find the point"
         findPoint = false
        , borders = null
    } = config;
    
    // Honor manifest/runner preference for borders when provided; otherwise fall back to app default.
    try {
        if (typeof borders !== "undefined" && borders !== null) {
            SQ.setShowBorders(Boolean(borders));
        } else {
            SQ.setShowBorders(Boolean(SQ.showBordersInitial));
        }
    } catch (e) { /* ignore if map not ready */ }
    
    // helper ids used for the temporary point
    const FIND_POINT_SOURCE = "find-point-src";
    const FIND_POINT_LAYER = "find-point-layer";

    let currentName = null;
    let lastQuestionName = null;
    let currentFeature = null;               // <-- new: store feature object for current question
    let currentCanonicalNormalized = null;   // <-- new: normalized canonical key for comparisons
    let locked = false;
    let completed = new Set();
    let currentPoint = null; // {lng, lat}

    let attempts = 0;
    let correctAnswers = 0;

    let timerInterval = null;
    let startTime = null;
    let finalElapsedMs = 0;

    // This object survives between quiz runs, but the canonical pool depends on
    // the active map data and group. Never reuse a previous quiz's cached pool.
    RUN._canonBuilt = false;
    RUN._canonList = null;
    RUN._canonByKey = null;
    RUN._canonByBestName = null;

    /* --- Smurdy subdivision canonicalization fix --- */
    function isSubdivisionMapMode() {
        try {
            const runtimeMode = String(
                SQ.currentMode ||
                SQ.mode ||
                ""
            ).toLowerCase();

            const group = (typeof SQ.getCurrentGroup === "function")
                ? SQ.getCurrentGroup()
                : (SQ.groups && SQ.currentGroupId ? SQ.groups[SQ.currentGroupId] : null);

            const borderSet = String(group?.borderset || "").toLowerCase();
            const groupId = String(SQ.currentGroupId || "").toLowerCase();

            return (
                runtimeMode === "states" ||
                borderSet === "states" ||
                groupId === "us_states"
            );
        } catch (_) {
            return false;
        }
    }

    // Build a canonical index that maps each country sovereign, or each
    // individual subdivision in state/province mode, to its best feature.
    function buildCanonicalIndex() {
        if (RUN._canonBuilt) return;
        RUN._canonBuilt = true;
        RUN._canonByKey = new Map(); // key -> { key, bestName, displayName, score, feature }

        if (!SQ.mainData || !Array.isArray(SQ.mainData.features)) {
            RUN._canonList = null;
            return;
        }

        function norm(s) {
            return String(s || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9 ]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function ringArea(ring) {
            if (!Array.isArray(ring) || ring.length < 3) return 0;
            let a = 0;
            for (let i = 0, n = ring.length; i < n; i++) {
                const [x1, y1] = ring[i];
                const [x2, y2] = ring[(i + 1) % n];
                a += x1 * y2 - x2 * y1;
            }
            return Math.abs(a) / 2;
        }

        function featureArea(feature) {
            if (!feature || !feature.geometry) return 0;
            const g = feature.geometry;
            let sum = 0;
            try {
                if (g.type === "Polygon") {
                    const rings = g.coordinates;
                    let outer = ringArea(rings[0] || []);
                    let holes = 0;
                    for (let i = 1; i < rings.length; i++) holes += ringArea(rings[i] || []);
                    return Math.max(0, outer - holes);
                } else if (g.type === "MultiPolygon") {
                    for (const poly of g.coordinates) {
                        const rings = poly;
                        let outer = ringArea(rings[0] || []);
                        let holes = 0;
                        for (let i = 1; i < rings.length; i++) holes += ringArea(rings[i] || []);
                        sum += Math.max(0, outer - holes);
                    }
                    return sum;
                }
            } catch (e) { /* ignore */ }
            return 0;
        }

        const subdivisionMode = isSubdivisionMapMode();

        for (const f of SQ.mainData.features) {
            const p = f.properties || {};

            // In country mode, SQ.getFeatureName() may still return a sovereign
            // name by design. In subdivision mode it returns the state name.
            const featureName = String(
                (typeof SQ.getFeatureName === "function"
                    ? SQ.getFeatureName(f)
                    : (p.name || p.NAME || p.name_en || p.NAME_EN || p.postal || p.POSTAL || p.admin || p.ADMIN || "")
                ) || ""
            ).trim();

            // Country maps intentionally merge overseas pieces by sovereign.
            // State/province maps must instead keep every subdivision separate.
            const sovereign = String(
                subdivisionMode
                    ? featureName
                    : (p.sovereignt || p.SOVEREIGNT || p.sovereignty || p.ADMIN || p.admin || featureName || "")
            ).trim();
            if (!sovereign) continue;
            const key = norm(sovereign);
            if (!key) continue;

            const adminNorm = norm(p.admin || p.ADMIN || "");
            const nameNorm = norm(featureName || "");

            const area = featureArea(f) || 0;
            // scoring: huge bonus if feature's admin/name equals the sovereign (likely mainland),
            // smaller bonus if admin equals sovereign, otherwise area only.
            let bonus = 0;
            if (nameNorm === key) bonus += 1000000000;
            if (adminNorm === key) bonus += 500000000;
            const score = area + bonus;

            const existing = RUN._canonByKey.get(key);
            if (!existing || score > existing.score) {
                RUN._canonByKey.set(key, {
                    key,
                    bestName: featureName,
                    displayName: subdivisionMode
                        ? featureName
                        : (p.sovereignt || p.SOVEREIGNT || p.admin || p.ADMIN || p.name || p.NAME || featureName),
                    score,
                    area,
                    feature: f
                });
            }
        }

        // Build canonical list of best feature names (stable order: alphabetical display name)
        let arr = Array.from(RUN._canonByKey.values());
        arr.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));

        // Respect the active group, but compare every useful Natural Earth name.
        // Some sovereign labels are abbreviated even though admin/long names are not
        // (for example the Marshall Islands and Solomon Islands).
        try {
            const allowedSet = (typeof SQ.getAllowedNamesForCurrentGroup === "function")
                ? SQ.getAllowedNamesForCurrentGroup()
                : null;

            if (allowedSet && allowedSet.size > 0) {
                const groupNameByNorm = new Map();
                try {
                    const group = (typeof SQ.getCurrentGroup === "function")
                        ? SQ.getCurrentGroup()
                        : null;
                    for (const groupName of (group?.members || group?.countries || [])) {
                        const key = (typeof SQ.normalizeAnswer === "function")
                            ? SQ.normalizeAnswer(groupName)
                            : norm(groupName);
                        if (key) groupNameByNorm.set(key, String(groupName));
                    }
                } catch (_) {}

                arr = arr.filter(entry => {
                    try {
                        const p = entry.feature?.properties || {};
                        const candidates = [
                            p.admin,
                            p.ADMIN,
                            p.NAME_LONG,
                            p.name_long,
                            p.BRK_NAME,
                            entry.bestName,
                            entry.displayName,
                            (typeof SQ.getFeatureName === "function")
                                ? SQ.getFeatureName(entry.feature)
                                : "",
                            p.name,
                            p.NAME,
                            p.sovereignt,
                            p.SOVEREIGNT
                        ];

                        let matchedNorm = null;
                        let matchedName = null;

                        for (const candidate of candidates) {
                            if (!candidate) continue;
                            const check = (typeof SQ.normalizeAnswer === "function")
                                ? SQ.normalizeAnswer(candidate)
                                : norm(candidate);

                            if (allowedSet.has(check)) {
                                matchedNorm = check;
                                matchedName = String(candidate);
                                break;
                            }
                        }

                        if (!matchedNorm) return false;

                        entry.quizName =
                            groupNameByNorm.get(matchedNorm) ||
                            matchedName ||
                            entry.bestName;
                        return true;
                    } catch (e) {
                        return false;
                    }
                });
            }
        } catch (e) {
            // if anything fails, fall back to full arr
        }

        RUN._canonList = arr.map(entry => entry.quizName || entry.bestName);
        // also a quick lookup map by every name the runner can emit
        RUN._canonByBestName = new Map();
        for (const entry of arr) {
            if (entry.bestName) RUN._canonByBestName.set(norm(entry.bestName), entry);
            if (entry.quizName) RUN._canonByBestName.set(norm(entry.quizName), entry);
        }
    }

    // Override getNames used by this runner to return canonical list (one entry per sovereign).
    function getNames() {
        try {
            buildCanonicalIndex();
            if (Array.isArray(RUN._canonList) && RUN._canonList.length) return RUN._canonList.slice();
        } catch (_) {}
        return SQ.getAllNames ? SQ.getAllNames() : [];
    }

    // Optionally wrap/patch SQ.getFeatureByName to resolve canonical bestName matches first.
    (function patchGetFeatureByName() {
        if (!SQ || !SQ.mainData) return;
        if (SQ._patchedGetFeatureByName) return;
        const orig = SQ.getFeatureByName;
        function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
        SQ.getFeatureByName = function(name) {
            try {
                buildCanonicalIndex();
                const key = norm(name);
                // if name matches a chosen bestName, return that feature
                if (RUN._canonByBestName && RUN._canonByBestName.has(norm(name))) {
                    return RUN._canonByBestName.get(norm(name)).feature;
                }
                // else, if name matches a sovereign key, return its best feature
                if (RUN._canonByKey && RUN._canonByKey.has(key)) {
                    return RUN._canonByKey.get(key).feature;
                }
            } catch (e) { /* ignore */ }
            if (typeof orig === "function") {
                try { return orig.call(SQ, name); } catch (_) {}
            }
            // fallback: brute-force search by properties (safe)
            try {
                const target = norm(name);
                for (const f of SQ.mainData.features) {
                    const p = f.properties || {};
                    if (norm(p.name || p.NAME || "") === target) return f;
                    if (norm(p.admin || p.ADMIN || "") === target) return f;
                    if (norm(p.sovereignt || p.SOVEREIGNT || "") === target) return f;
                }
            } catch (_) {}
            return null;
        };
        SQ._patchedGetFeatureByName = true;
    })();
    
    // helper functions for runner state
    // Prevent applying a "target" highlight in click mode — click-mode should never pre-highlight.
    function setState(name, stateName) {
        try {
            if (!name) return;
            if (mode === "click" && stateName === "target") {
                // intentionally ignore target state in click mode
                return;
            }
            if (typeof SQ.setFeatureStateByName === "function") {
                return SQ.setFeatureStateByName(name, stateName);
            }
        } catch (e) {
            // swallow to avoid breaking UI
        }
    }

    function clearStates() {
        SQ.clearAllStates();
        // remove any temporary point marker layers + source (outer/inner)
        try {
            const outerId = FIND_POINT_LAYER + "-outer";
            const innerId = FIND_POINT_LAYER + "-inner";
            if (SQ.map.getLayer(outerId)) SQ.map.removeLayer(outerId);
            if (SQ.map.getLayer(innerId)) SQ.map.removeLayer(innerId);
        } catch (e) {}
        try {
            if (SQ.map.getSource(FIND_POINT_SOURCE)) SQ.map.removeSource(FIND_POINT_SOURCE);
        } catch (e) {}
        currentPoint = null;
    }

    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function getRemaining() {
        return getNames().filter(name => !completed.has(name));
    }

    // Avoid immediately repeating the previous target when another option exists.
    // This applies after a wrong answer, Give Up, and Restart.
    function getQuestionCandidates(remaining) {
        const source = Array.isArray(remaining) ? remaining : [];
        if (source.length <= 1 || !lastQuestionName) return source;

        const previous = normalizeName(lastQuestionName);
        const filtered = source.filter(name => normalizeName(name) !== previous);
        return filtered.length ? filtered : source;
    }

    function updateCounter() {
        const total = getNames().length;
        SQ.setProgressText(`${completed.size} / ${total} completed`);
        const compact = `${completed.size} / ${total}`;
        const s = document.getElementById("stats-count");
        if (s) s.textContent = compact;
        const p = document.getElementById("quiz-progress");
        if (p) p.textContent = `${completed.size} / ${total} completed`;
    }

    function updateAccuracy() {
        const percent = attempts === 0
            ? 100
            : Math.round((correctAnswers / attempts) * 100);

        SQ.setAccuracyText(`${percent}% correct`);
        const s = document.getElementById("stats-accuracy");
        if (s) s.textContent = `${percent}%`;
        const a = document.getElementById("quiz-accuracy");
        if (a) a.textContent = `${percent}% correct`;
    }

    function repaintCompleted() {
        if (!persistCompletedHighlights) return;

        for (const name of completed) {
            setState(name, "correct");
        }
    }

    function normalizeName(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    // Compute an antimeridian-aware bounding box around the active group using
    // each country's largest/main polygon. This avoids overseas territories and
    // correctly frames regions such as Oceania.
    function getCurrentGroupBounds() {
        try {
            const longitudes = [];
            let minLat = Infinity;
            let maxLat = -Infinity;

            for (const name of getNames()) {
                const feature = SQ.getFeatureByName(name);
                if (!feature || !feature.geometry) continue;

                const bounds = (typeof SQ.getBestFeatureBounds === "function")
                    ? SQ.getBestFeatureBounds(feature.geometry)
                    : null;
                if (!bounds) continue;

                const [[minLng, featureMinLat], [maxLng, featureMaxLat]] = bounds;
                if (![minLng, maxLng, featureMinLat, featureMaxLat].every(Number.isFinite)) continue;

                longitudes.push(minLng, maxLng);
                minLat = Math.min(minLat, featureMinLat);
                maxLat = Math.max(maxLat, featureMaxLat);
            }

            if (longitudes.length < 2 || !Number.isFinite(minLat) || !Number.isFinite(maxLat)) {
                return null;
            }

            const wrapped = longitudes
                .map(lng => ((lng % 360) + 360) % 360)
                .sort((a, b) => a - b);

            let largestGap = -1;
            let gapIndex = 0;
            for (let i = 0; i < wrapped.length; i++) {
                const next = (i === wrapped.length - 1)
                    ? wrapped[0] + 360
                    : wrapped[i + 1];
                const gap = next - wrapped[i];
                if (gap > largestGap) {
                    largestGap = gap;
                    gapIndex = i;
                }
            }

            let start = wrapped[(gapIndex + 1) % wrapped.length];
            let end = wrapped[gapIndex];
            if (end < start) end += 360;

            let span = end - start;
            let west = start > 180 ? start - 360 : start;
            let east = west + span;

            if (span < 1) {
                west -= 0.5;
                east += 0.5;
            }
            if (maxLat - minLat < 1) {
                minLat -= 0.5;
                maxLat += 0.5;
            }

            minLat = Math.max(-85, minLat);
            maxLat = Math.min(85, maxLat);

            return [[west, minLat], [east, maxLat]];
        } catch (_) {
            return null;
        }
    }

    // Frame the selected group only when a click-mode round begins or restarts.
    // Individual click questions never trigger camera movement.
    function zoomToCurrentGroup() {
        if (mode !== "click" || !SQ.map || typeof SQ.map.fitBounds !== "function") {
            return false;
        }

        const bounds = getCurrentGroupBounds();
        if (!bounds) return false;

        const isMobile =
            (window.innerWidth || 0) <= 700 ||
            /Mobi|Android/i.test(navigator.userAgent || "");

        const panel = document.getElementById("quiz-panel");
        const leftPadding = Math.min(
            480,
            Math.max(300, ((panel && panel.offsetWidth) || 360) + 40)
        );

        try {
            if (typeof SQ.map.stop === "function") SQ.map.stop();
            SQ.map.fitBounds(bounds, {
                padding: isMobile
                    ? { top: 120, right: 36, bottom: 120, left: 36 }
                    : { top: 60, right: 60, bottom: 60, left: leftPadding },
                maxZoom: 5.3,
                duration: 650
            });
            return true;
        } catch (_) {
            return false;
        }
    }

    // Return the answer label represented by a feature.
    // Countries prefer sovereign/admin names; subdivision maps must use the
    // individual state/province name instead of collapsing to its country.
    function canonicalNameForFeature(feature) {
        try {
            if (!feature || !feature.properties) return "";
            const p = feature.properties;

            if (isSubdivisionMapMode()) {
                return String(
                    (typeof SQ.getFeatureName === "function"
                        ? SQ.getFeatureName(feature)
                        : (p.name || p.NAME || p.name_en || p.NAME_EN || p.postal || p.POSTAL || "")
                    ) || ""
                );
            }

            // Prefer full sovereign/admin fields so abbreviated map labels
            // such as "S. Sudan" do not become quiz answers.
            return String(
                p.sovereignt ||
                p.SOVEREIGNT ||
                p.admin ||
                p.ADMIN ||
                p.name ||
                p.NAME ||
                p.NAME_EN ||
                p.name_en ||
                ""
            );
        } catch (e) {
            return "";
        }
    }

    // Return a stable canonical display name for a feature/name (avoid abbreviated/display variants).
    function getCanonicalDisplayName(name) {
        try {
            if (!name) return "";

            // Explicit group names are the intended quiz labels. Do not replace
            // them with shortened sovereign labels from the map dataset.
            const entry = RUN._canonByBestName?.get(normalizeName(name));
            if (entry?.quizName) return entry.quizName;

            // Prefer direct feature properties when available (avoid resolving by display label)
            if (typeof SQ.getFeatureByName === "function") {
                const f = SQ.getFeatureByName(name);
                if (f && f.properties) {
                    return canonicalNameForFeature(f) || String(name);
                }
            }
        } catch (e) { /* ignore */ }
        return String(name);
    }

    function formatElapsed(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function setTimerText(ms) {
        const el = document.getElementById("quiz-timer");
        const txt = formatElapsed(ms);
        if (el) el.textContent = txt;
        const s = document.getElementById("stats-timer");
        if (s) s.textContent = txt;
    }
 
    function startTimer() {
        stopTimer();
        startTime = Date.now();
        finalElapsedMs = 0;
        setTimerText(0);
 
        timerInterval = setInterval(() => {
            finalElapsedMs = Date.now() - startTime;
            setTimerText(finalElapsedMs);
        }, 100);
    }
 
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function resetTimer() {
        stopTimer();
        startTime = null;
        finalElapsedMs = 0;
        setTimerText(0);
    }

    function removeTypingUI() {
        const old = document.getElementById("type-quiz-controls");
        if (old) old.remove();
        inputEl = null;
        submitButton = null;
    }

    function createTypingUI() {
        removeTypingUI();
 
        const controls = document.createElement("div");
        controls.id = "type-quiz-controls";
        controls.style.marginTop = "10px";
        controls.style.display = "flex";
        controls.style.gap = "8px";
 
        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.placeholder = inputPlaceholder;
        inputEl.autocomplete = "off";
        inputEl.spellcheck = false;
        inputEl.style.flex = "1";
        inputEl.style.padding = "8px 10px";
        inputEl.style.border = "1px solid #ccc";
        inputEl.style.borderRadius = "8px";
        inputEl.style.fontSize = "16px";
 
        submitButton = document.createElement("button");
        submitButton.textContent = "Guess";
        submitButton.style.padding = "8px 12px";
        submitButton.style.border = "none";
        submitButton.style.borderRadius = "8px";
        submitButton.style.background = "#222";
        submitButton.style.color = "white";
        submitButton.style.cursor = "pointer";
 
        controls.appendChild(inputEl);
        controls.appendChild(submitButton);
 
        const panel = document.getElementById("quiz-panel");
        // On mobile, place typing controls into bottom container so panels are separate.
        const bottom = document.getElementById("quiz-bottom");
        const isMobile = (window.innerWidth || 0) <= 700 || /Mobi|Android/i.test(navigator.userAgent || "");
        if (isMobile && bottom) bottom.insertBefore(controls, bottom.firstChild);
        else panel.appendChild(controls);
 
        submitButton.addEventListener("click", submitGuess);
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submitGuess();
        });
    }

    function setInputEnabled(enabled) {
        if (!inputEl || !submitButton) return;
        inputEl.disabled = !enabled;
        submitButton.disabled = !enabled;
    }

    function focusInput() {
        if (!inputEl) return;
        inputEl.focus();
        inputEl.select();
    }

    // Place or update the yellow point marker at lnglat and ensure the layer/source exist.
    function showPointAt(lnglat) {
        try {
            const src = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [lnglat.lng, lnglat.lat] },
                    properties: {}
                }]
            };

            // add or update source
            if (!SQ.map.getSource(FIND_POINT_SOURCE)) {
                SQ.map.addSource(FIND_POINT_SOURCE, { type: "geojson", data: src });
            } else {
                SQ.map.getSource(FIND_POINT_SOURCE).setData(src);
            }

            // draw two small concentric circles on top: outer red ring + inner white dot (target look)
            const outerId = FIND_POINT_LAYER + "-outer";
            const innerId = FIND_POINT_LAYER + "-inner";

            if (!SQ.map.getLayer(outerId)) {
                SQ.map.addLayer({
                    id: outerId,
                    type: "circle",
                    source: FIND_POINT_SOURCE,
                    paint: {
                        // smaller radii so point is subtle; scales with zoom
                        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 4, 7, 8, 10],
                        "circle-color": "#e53935",
                        "circle-stroke-color": "#222",
                        "circle-stroke-width": 1,
                        "circle-opacity": 0.95
                    }
                });
            }

            if (!SQ.map.getLayer(innerId)) {
                SQ.map.addLayer({
                    id: innerId,
                    type: "circle",
                    source: FIND_POINT_SOURCE,
                    paint: {
                        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.5, 4, 3.5, 8, 5],
                        "circle-color": "#ffffff",
                        "circle-stroke-color": "#e53935",
                        "circle-stroke-width": 0.8,
                        "circle-opacity": 1
                    }
                });
            }

            currentPoint = { lng: lnglat.lng, lat: lnglat.lat };
        } catch (e) {
            console.warn("showPointAt failed", e);
        }
    }
    
    // ---- New helpers for robust point selection on land ----
    function ringArea(ring) {
        if (!Array.isArray(ring) || ring.length < 3) return 0;
        let a = 0;
        for (let i = 0, n = ring.length; i < n; i++) {
            const [x1, y1] = ring[i];
            const [x2, y2] = ring[(i + 1) % n];
            a += x1 * y2 - x2 * y1;
        }
        return Math.abs(a) / 2;
    }

    function ringCentroid(ring) {
        // centroid for a non-self-intersecting polygon ring
        let cx = 0, cy = 0, a = 0;
        for (let i = 0, n = ring.length; i < n; i++) {
            const [x0, y0] = ring[i];
            const [x1, y1] = ring[(i + 1) % n];
            const cross = x0 * y1 - x1 * y0;
            cx += (x0 + x1) * cross;
            cy += (y0 + y1) * cross;
            a += cross;
        }
        if (Math.abs(a) < 1e-9) {
            // fallback: average of vertices
            let sx = 0, sy = 0;
            for (const p of ring) { sx += p[0]; sy += p[1]; }
            return { lng: sx / ring.length, lat: sy / ring.length };
        }
        a = a / 2;
        cx = cx / (6 * a);
        cy = cy / (6 * a);
        return { lng: cx, lat: cy };
    }

    function getLargestPartCentroid(feature) {
        if (!feature || !feature.geometry) return null;
        const g = feature.geometry;
        try {
            if (g.type === "Polygon") {
                const outer = g.coordinates[0];
                return ringCentroid(outer);
            }
            if (g.type === "MultiPolygon") {
                let best = null;
                for (const poly of g.coordinates) {
                    const outer = poly[0];
                    const area = ringArea(outer);
                    if (!best || area > best.area) best = { area, ring: outer };
                }
                if (best) return ringCentroid(best.ring);
            }
        } catch (e) { /* ignore malformed */ }
        return null;
    }

    function ensureFindPointLayer() {
        // make sure the source/layer exist (layer creation is safe to call repeatedly)
        try {
            if (!SQ.map.getSource(FIND_POINT_SOURCE)) {
                SQ.map.addSource(FIND_POINT_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            }
            const outerId = FIND_POINT_LAYER + "-outer";
            const innerId = FIND_POINT_LAYER + "-inner";
            if (!SQ.map.getLayer(outerId)) {
                SQ.map.addLayer({
                    id: outerId,
                    type: "circle",
                    source: FIND_POINT_SOURCE,
                    paint: {
                        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 4, 7, 8, 10],
                        "circle-color": "#e53935",
                        "circle-stroke-color": "#222",
                        "circle-stroke-width": 1,
                        "circle-opacity": 0.95
                    }
                });
            }
            if (!SQ.map.getLayer(innerId)) {
                SQ.map.addLayer({
                    id: innerId,
                    type: "circle",
                    source: FIND_POINT_SOURCE,
                    paint: {
                        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.5, 4, 3.5, 8, 5],
                        "circle-color": "#ffffff",
                        "circle-stroke-color": "#e53935",
                        "circle-stroke-width": 0.8,
                        "circle-opacity": 1
                    }
                });
            }
        } catch (e) { /* ignore if map not ready */ }
    }

    // point-in-ring (ray-casting)
    function pointInRing(pt, ring) {
        const x = pt.lng, y = pt.lat;
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi + 0) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // polygon: array of rings (first = outer, others = holes)
    function pointInPolygon(pt, polygon) {
        if (!Array.isArray(polygon) || polygon.length === 0) return false;
        if (!pointInRing(pt, polygon[0])) return false;
        // ensure not inside a hole
        for (let i = 1; i < polygon.length; i++) {
            if (pointInRing(pt, polygon[i])) return false;
        }
        return true;
    }

    // Try to pick a truly random point inside one of the supplied countries.
    async function pickRandomLandPoint(candidateNames, maxTries = 200) {
        const remainingNames = Array.isArray(candidateNames) ? candidateNames : [];
        if (remainingNames.length === 0) return null;

        const triedNames = new Set();
        const total = remainingNames.length;
        const innerAttempts = 60; // attempts per polygon bbox

        for (let attempt = 0; attempt < maxTries && triedNames.size < total; attempt++) {
            const idx = Math.floor(Math.random() * remainingNames.length);
            const name = remainingNames[idx];
            if (triedNames.has(name)) continue;
            triedNames.add(name);

            const feature = SQ.getFeatureByName(name);
            if (!feature || !feature.geometry) continue;

            const g = feature.geometry;
            // choose a polygon part (for MultiPolygon) — prefer large parts by picking max-area part first
            let parts = [];
            try {
                if (g.type === "Polygon") parts = [g.coordinates];
                else if (g.type === "MultiPolygon") parts = g.coordinates;
            } catch (e) { continue; }

            // shuffle parts but prefer larger ones (simple sort by bbox area)
            parts = parts
                .map(p => {
                    const ring = p[0];
                    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
                    for (const v of ring) {
                        minx = Math.min(minx, v[0]); maxx = Math.max(maxx, v[0]);
                        miny = Math.min(miny, v[1]); maxy = Math.max(maxy, v[1]);
                    }
                    return { part: p, area: (maxx - minx) * (maxy - miny), bbox: [minx, miny, maxx, maxy] };
                })
                .sort((a,b) => b.area - a.area);

            // try sampling inside each part up to innerAttempts
            for (const meta of parts) {
                const [minx, miny, maxx, maxy] = meta.bbox;
                if (!isFinite(minx) || !isFinite(miny) || !isFinite(maxx) || !isFinite(maxy)) continue;
                for (let k = 0; k < innerAttempts; k++) {
                    const lng = minx + Math.random() * (maxx - minx);
                    const lat = miny + Math.random() * (maxy - miny);
                    const pt = { lng, lat };
                    if (pointInPolygon(pt, meta.part)) {
                        return { name, lnglat: pt };
                    }
                }
            }

            // yield occasionally to keep UI responsive
            if ((attempt & 31) === 0) await new Promise(r => setTimeout(r, 0));
        }

        // fallback: return centroid of a random remaining country (should be on land)
        for (const name of remainingNames) {
            const feature = SQ.getFeatureByName(name);
            if (!feature) continue;
            const pt = getLargestPartCentroid(feature);
            if (pt) return { name, lnglat: pt };
        }
        
        return null;
    }
    // ---- end helpers ----
     
    async function nextQuestion() {
        const remaining = getRemaining();
 
        if (remaining.length === 0) {
            const total = getNames().length;
            SQ.setTargetText("Done!");
            // Ensure we clear any lingering target highlight (yellow) after the final correct answer.
            try { SQ.setTargetByName(null); } catch (e) {}
            SQ.setProgressText(`${total} / ${total} completed`);
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
            stopTimer();
            setInputEnabled(false);

            // Keep the quiz panel in game-mode showing "Done!" until the user clicks Back.
            try { setQuizPanelMode("game"); } catch (e) {}
            return;
        }
 
        const candidates = getQuestionCandidates(remaining);

        // For findPoint mode, choose a random country and place the dot on its largest polygon part.
        if (mode === "type" && findPoint) {
            try { SQ.setShowBorders(false); } catch (e) {}
            clearStates(); // clear previous point/state before picking
            // ensure the layer exists (creates on first use)
            ensureFindPointLayer();
            const picked = await pickRandomLandPoint(candidates);
            if (picked) {
                currentName = picked.name;
                showPointAt(picked.lnglat);
                try {
                    SQ.map.easeTo({ center: [picked.lnglat.lng, picked.lnglat.lat], duration: 700, zoom: Math.min(6, Math.max(3.6, SQ.map.getZoom())) });
                } catch (e) {}
            } else {
                // fallback: pick a country name if no suitable feature found
                currentName = randomChoice(candidates);
            }
        } else {
            currentName = randomChoice(candidates);
        }

        lastQuestionName = currentName;
        locked = false;

        // Preserve the placed point for "findPoint" typing mode.
        if (!(mode === "type" && findPoint)) {
            clearStates();
        }
        repaintCompleted();

        if (mode === "type") {
            // For findPoint mode we use a point marker, so skip setting feature-state target.
            if (!findPoint) setState(currentName, "target");
            if (typeof SQ.zoomToFeatureByName === "function") {
                SQ.zoomToFeatureByName(currentName);
            }
        }

        // Always show canonical full name in the target area (avoid showing abbreviated/display variants)
        // Update currentFeature and canonical key for comparisons (used by click mode)
        try {
            currentFeature = (typeof SQ.getFeatureByName === "function") ? SQ.getFeatureByName(currentName) : null;
            const canon = currentFeature ? canonicalNameForFeature(currentFeature) : getCanonicalDisplayName(currentName);
            currentCanonicalNormalized = normalizeName(canon || currentName);
        } catch (e) {
            currentFeature = null;
            currentCanonicalNormalized = normalizeName(currentName || "");
        }

        // Ensure click mode does NOT pre-highlight any country.
        // Clear temporary target state and repaint only the completed highlights so the map stays neutral.
        try {
            if (mode === "click") {
                // clear any runner-managed states, repaint completed ones
                clearStates();
                repaintCompleted();
                // also tell core to clear its "target by name" if present (defensive)
                if (typeof SQ.setTargetByName === "function") {
                    try { SQ.setTargetByName(null); } catch (_) {}
                }
            }
        } catch (_) {}

        // Each mode controls its own prompt. Typing modes intentionally display
        // an instruction instead of revealing the answer.
        const displayName = getCanonicalDisplayName(currentName);
        SQ.setTargetText(
            (typeof titleBuilder === "function") ? titleBuilder(displayName) : displayName
        );

        // Ensure click mode never shows a pre-highlight target.
        // Some core implementations react to setTargetText or internal state asynchronously,
        // so clear any core-managed target immediately and again on the next tick.
        if (mode === "click") {
            try { if (typeof SQ.setTargetByName === "function") SQ.setTargetByName(null); } catch (_) {}
            // second clear on next tick guards against async core behavior
            setTimeout(() => {
                try { if (typeof SQ.setTargetByName === "function") SQ.setTargetByName(null); } catch (_) {}
            }, 8);
        }

        SQ.setResultText("");
        updateCounter();
        updateAccuracy();

        if (mode === "type") {
            if (inputEl) inputEl.value = "";
            setInputEnabled(true);
            focusInput();
        }
    }

    function restartQuiz() {
        currentName = null;
        locked = false;
        completed = new Set();
        attempts = 0;
        correctAnswers = 0;
 
        clearStates();
        SQ.setResultText("");
        updateCounter();
        updateAccuracy();
        resetTimer();
        startTimer();
 
        // ensure panel uses the game UI when restarting
        try { setQuizPanelMode("game"); } catch (e) {}
 
         if (mode === "click") {
             zoomToCurrentGroup();
         } else if (typeof SQ.resetView === "function") {
             SQ.resetView();
         }
         if (mode === "type" && inputEl) {
             inputEl.value = "";
             setInputEnabled(true);
         }
 
         // hide browser panel when restarting/starting the quiz
         try {
             const panel = document.getElementById("quiz-browser");
             if (panel) panel.style.display = "none";
         } catch (e) {}
 
         nextQuestion();
     }

    function finishCorrect() {
        correctAnswers++;
        completed.add(currentName);

        // Remove any temporary target state, then briefly reveal the answered
        // country in green. Find Point clears it before the next question.
        try { if (typeof SQ.setTargetByName === "function") SQ.setTargetByName(null); } catch (_) {}
        try { setState(currentName, "correct"); } catch (_) {}

        // If completed highlights persist, restore all earlier correct answers too.
        try { if (persistCompletedHighlights) repaintCompleted(); } catch (_) {}

        SQ.setResultText(successText);
        updateCounter();
        updateAccuracy();

        setTimeout(() => {
            if (!persistCompletedHighlights) {
                clearStates();
            }
            nextQuestion();
        }, 700);
    }

    function finishWrong(clickedOrGuess, gaveUp = false) {
        // Remove any temporary target state so the red answer state is visible.
        try { if (typeof SQ.setTargetByName === "function") SQ.setTargetByName(null); } catch (_) {}

        if (mode === "click") {
            if (gaveUp) {
                // Give Up marks the current target wrong. There is no clicked country.
                try { setState(currentName, "wrong"); } catch (_) {}
            } else {
                try { setState(clickedOrGuess, "wrong"); } catch (_) {}

                // Show the correct target after an ordinary incorrect click.
                if (showTargetOnWrong) {
                    try {
                        if (typeof SQ.setFeatureStateByName === "function") {
                            try { SQ.setFeatureStateByName(currentName, "target"); } catch (_) { /* ignore */ }
                        } else {
                            try { setState(currentName, "target"); } catch (_) {}
                        }
                    } catch (_) {}
                }
            }
        } else {
            // Includes Type Country and Find Point. The next question clears it.
            try { setState(currentName, "wrong"); } catch (_) {}
        }

        if (mode === "type" || gaveUp) {
            SQ.setResultText(`Wrong. Answer: ${currentName}`);
        } else {
            SQ.setResultText(`Wrong. Guessed: ${clickedOrGuess}`);
        }

        updateAccuracy();

        setTimeout(() => {
            clearStates();
            repaintCompleted();
            nextQuestion();
        }, 900);
    }

    function handleClick(featureOrName) {
        try {
            // click handler should only act in click mode and use local state
            if (locked || !currentName || mode !== "click") return;

            // accept either a feature object from the map or a name string
            let clickedFeature = null;
            if (featureOrName && typeof featureOrName === "object" && featureOrName.properties) {
                clickedFeature = featureOrName;
            } else if (typeof featureOrName === "string") {
                // try to resolve to feature object without using display-name matching
                try { clickedFeature = (typeof SQ.getFeatureByName === "function") ? SQ.getFeatureByName(featureOrName) : null; } catch (_) { clickedFeature = null; }
            }

            if (!clickedFeature) return;

            // compute canonical normalized key for clicked feature
            const clickedCanon = normalizeName(canonicalNameForFeature(clickedFeature) || SQ.getFeatureName(clickedFeature) || "");

            // ignore clicks on already completed canonical keys
            for (const c of completed) {
                if (normalizeName(c) === clickedCanon) return;
            }

            locked = true;
            attempts++;

            if (clickedCanon === currentCanonicalNormalized) {
                // mark clicked feature correct (show immediate green)
                // use finishCorrect flow to update counters and highlight
                finishCorrect();
            } else {
                // mark clicked feature wrong (show immediate red) and highlight correct afterwards as configured
                // pass the clicked display name for user feedback
                const display = (typeof SQ.getFeatureName === "function") ? SQ.getFeatureName(clickedFeature) : (clickedFeature.properties && (clickedFeature.properties.name || clickedFeature.properties.admin));
                finishWrong(display || clickedCanon);
            }
        } catch (e) {
            console.error("handleClick failed", e);
        }
    }

    function submitGuess() {
        if (locked || !currentName || !inputEl) return;

        const guess = inputEl.value.trim();
        if (!guess) return;

        locked = true;
        attempts++;

        if (SQ.isAcceptedAnswer(currentName, guess)) {
            finishCorrect();
        } else {
            finishWrong(guess);
        }
    }

    const restartButton = document.getElementById("quiz-restart");
    if (restartButton) restartButton.onclick = restartQuiz;

    const backButton = document.getElementById("quiz-back");
    if (backButton) backButton.onclick = () => SQ.goToMainMenu();

    if (mode === "type") {
        createTypingUI();
    } else if (mode === "click") {
        removeTypingUI();

        // attach map click handler idempotently (remove previous handler if present)
        try {
            if (RUN._clickHandler && SQ.map && typeof SQ.map.off === "function") {
                try { SQ.map.off("click", RUN._clickHandler); } catch (_) {}
                RUN._clickHandler = null;
            }
            const handler = (e) => {
                try {
                    // try common event shapes: Mapbox passes e.point; some libs pass the event itself
                    const pt = (e && (e.point || e)) || e;
                    let feature = null;
                    if (typeof SQ.getClickedMainFeature === "function") {
                        try { feature = SQ.getClickedMainFeature(pt); } catch (_) { feature = null; }
                    }
                    // fallback: some integrations expose a getFeatureAtLngLat helper
                    if (!feature && e && e.lngLat && typeof SQ.getFeatureAtLngLat === "function") {
                        try { feature = SQ.getFeatureAtLngLat(e.lngLat); } catch (_) { feature = null; }
                    }
                    if (!feature) return;
                    handleClick(feature);
                } catch (_) { /* tolerate click handling errors */ }
            };
             if (SQ.map && typeof SQ.map.on === "function") {
                 SQ.map.on("click", handler);
                 RUN._clickHandler = handler;
             }
         } catch (e) { /* tolerate map readiness errors */ }
     }
 
    updateCounter();
    updateAccuracy();
    resetTimer();
    startTimer();

    // Click modes begin framed around the selected map group. Camera movement
    // after this point remains fully controlled by the player.
    if (mode === "click") zoomToCurrentGroup();

    nextQuestion();

    // Replace or add a single robust implementation of SmurdyQuiz.getFeatureByName
    // that prefers local/admin feature matches over sovereignt (territories) and
    // uses area as tie-breaker so the mainland is selected instead of overseas islands.
    SmurdyQuiz.getFeatureByName = SmurdyQuiz.getFeatureByName || function(name) {
        if (!name || !SmurdyQuiz.mainData || !Array.isArray(SmurdyQuiz.mainData.features)) return null;

        function norm(s) {
            return String(s || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9 ]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function ringArea(ring) {
            if (!Array.isArray(ring) || ring.length < 3) return 0;
            let a = 0;
            for (let i = 0, n = ring.length; i < n; i++) {
                const [x1, y1] = ring[i];
                const [x2, y2] = ring[(i + 1) % n];
                a += x1 * y2 - x2 * y1;
            }
            return Math.abs(a) / 2;
        }

        function featureArea(feature) {
            if (!feature || !feature.geometry) return 0;
            const g = feature.geometry;
            let sum = 0;
            try {
                if (g.type === "Polygon") {
                    // area of outer ring minus holes
                    const rings = g.coordinates;
                    let outer = ringArea(rings[0] || []);
                    let holes = 0;
                    for (let i = 1; i < rings.length; i++) holes += ringArea(rings[i] || []);
                    return Math.max(0, outer - holes);
                } else if (g.type === "MultiPolygon") {
                    for (const poly of g.coordinates) {
                        const rings = poly;
                        let outer = ringArea(rings[0] || []);
                        let holes = 0;
                        for (let i = 1; i < rings.length; i++) holes += ringArea(rings[i] || []);
                        sum += Math.max(0, outer - holes);
                    }
                    return sum;
                }
            } catch (e) {
                return 0;
            }
        }

        const target = norm(name);
        const candidates = [];

        for (const f of SmurdyQuiz.mainData.features) {
            const p = f.properties || {};
            const admin = norm(p.admin || p.ADMIN || p.name || p.NAME || p.NAME_EN || "");
            const sovereignt = norm(p.sovereignt || p.SOVEREIGNT || p.sov_a3 || "");
            const otherNames = norm(p.name || p.NAME || p.NAME_EN || p.name_en || "");

            // match types:
            //  - admin/name (local feature name) is best
            //  - otherNames also good
            //  - sovereignt (sovereign state) is fallback (likely territories)
            let matchType = null;
            if (admin === target || otherNames === target) matchType = "local";
            else if (sovereignt === target) matchType = "sovereign";
            else continue;

            const area = featureArea(f);
            // score: prioritize local matches; if only sovereign match, penalize so mainland wins
            const score = (matchType === "local" ? 1000000 : 100) + area;
            candidates.push({ feature: f, score, area, matchType });
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].feature;
    };
};

/* --- Smurdy share result module v3 --- */
(function () {
    if (window.__smurdyShareResultModuleV3Loaded) return;
    window.__smurdyShareResultModuleV3Loaded = true;

    const SECTION_ID = "quiz-share";
    const BUTTON_ID = "quiz-share-button";
    const STYLE_ID = "smurdy-share-style-v3";

    function byId(id) {
        return document.getElementById(id);
    }

    function textOf(id) {
        const node = byId(id);
        return node ? String(node.textContent || "").trim() : "";
    }

    function injectStyles() {
        if (byId(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            #${SECTION_ID} {
                display: none;
                width: 100%;
                margin-top: 18px;
                padding-top: 16px;
                border-top: 1px solid rgba(0,0,0,.12);
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }
            #${SECTION_ID} .quiz-share-copy {
                display: flex;
                min-width: 0;
                flex-direction: column;
                gap: 2px;
                text-align: left;
            }
            #${SECTION_ID} .quiz-share-title {
                font-weight: 800;
                line-height: 1.2;
            }
            #${SECTION_ID} .quiz-share-subtitle {
                color: rgba(0,0,0,.62);
                font-size: .92rem;
                line-height: 1.35;
            }
            #${BUTTON_ID} {
                flex: 0 0 auto;
                padding: 11px 16px;
                border: 0;
                border-radius: 10px;
                background: #111;
                color: #fff;
                font: inherit;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,.18);
                transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
            }
            #${BUTTON_ID}:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(0,0,0,.22);
            }
            #${BUTTON_ID}:focus-visible {
                outline: 3px solid rgba(0,119,204,.28);
                outline-offset: 2px;
            }
            #${BUTTON_ID}:disabled {
                cursor: default;
                opacity: .7;
                transform: none;
            }
            @media (max-width: 700px) {
                #${SECTION_ID} {
                    align-items: stretch;
                    flex-direction: column;
                }
                #${BUTTON_ID} {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function humanizeSlug(value) {
        return String(value || "")
            .replace(/^manifest:/i, "")
            .replace(/[\-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function getSearchParams() {
        try {
            return new URLSearchParams(window.location.search || "");
        } catch (_) {
            return new URLSearchParams("");
        }
    }

    function getRouteText() {
        const params = getSearchParams();
        return `${window.location.pathname || ""} ${params.get("quiz") || ""}`.toLowerCase();
    }

    function getModeKey() {
        const route = getRouteText();
        if (route.includes("find-point")) return "find-point";
        if (route.includes("find-country")) return "find-country";
        if (route.includes("type-country")) return "type-country";
        if (route.includes("click-country")) return "click-country";

        const currentTitle = String(
            (window.SmurdyQuiz && window.SmurdyQuiz.currentQuizTitle) || ""
        ).toLowerCase();
        if (currentTitle.includes("find point")) return "find-point";
        if (currentTitle.includes("find")) return "find-country";
        if (currentTitle.includes("type")) return "type-country";
        return "click-country";
    }

    function getModeLabel() {
        const mode = getModeKey();
        if (mode === "find-point") return "Find the Point";
        if (mode === "find-country") return "Find the Region";
        if (mode === "type-country") return "Type the Region";
        return "Click the Region";
    }

    function getGroupId() {
        const sq = window.SmurdyQuiz || {};
        if (sq.currentGroupId) return String(sq.currentGroupId);
        if (sq.groupId) return String(sq.groupId);

        const params = getSearchParams();
        const queryGroup = params.get("group");
        if (queryGroup) return String(queryGroup);

        const routeMatch = String(window.location.pathname || "")
            .match(/\/quizzes\/[^/]+\/([^/]+)\/?/i);
        if (routeMatch && routeMatch[1]) return routeMatch[1];

        return "world";
    }

    function getGroupLabel() {
        const sq = window.SmurdyQuiz || {};
        try {
            if (typeof sq.getCurrentGroup === "function") {
                const current = sq.getCurrentGroup();
                if (current && current.label) return String(current.label);
            }
        } catch (_) {}

        const groupId = getGroupId();
        const collections = [
            sq.countryGroups,
            sq.country_groups,
            sq.groups,
            window.SmurdyCountryGroups,
            window.countryGroups
        ];

        for (const collection of collections) {
            if (!collection || typeof collection !== "object") continue;
            const entry = collection[groupId];
            if (entry && entry.label) return String(entry.label);
        }

        if (!groupId || groupId === "__all__") return "World";
        return humanizeSlug(groupId);
    }

    function getQuizLabel() {
        return `${getGroupLabel()} · ${getModeLabel()}`;
    }

    function getCompletionState() {
        const target = textOf("quiz-target");
        const progress = textOf("quiz-progress");
        const result = textOf("quiz-result");

        const targetDone = /^done!?$/i.test(target);
        const progressMatch = progress.match(/(\d+)\s*\/\s*(\d+)\s*completed/i);
        const progressDone = Boolean(
            progressMatch && Number(progressMatch[1]) === Number(progressMatch[2])
        );
        const resultDone = /\bfinished\s+in\b/i.test(result);

        return {
            completed: targetDone || (progressDone && resultDone),
            target,
            progress,
            result
        };
    }

    function extractAccuracyValue() {
        const accuracy = textOf("quiz-accuracy");
        const match = accuracy.match(/(\d+(?:\.\d+)?)\s*%/);
        return match ? `${match[1]}%` : "--";
    }

    function extractTimeValue() {
        const timer = textOf("quiz-timer").replace(/^time\s*:?\s*/i, "").trim();
        if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(timer)) return timer;

        const result = textOf("quiz-result");
        const resultMatch = result.match(/finished\s+in\s+([^.!]+)/i);
        return resultMatch ? resultMatch[1].trim() : (timer || "--:--");
    }

    function extractProgressValue() {
        const progress = textOf("quiz-progress");
        const match = progress.match(/(\d+)\s*\/\s*(\d+)/);
        return match ? `${match[1]}/${match[2]}` : "Complete";
    }

    function ensureShareSection() {
        injectStyles();

        let section = byId(SECTION_ID);
        if (section) return section;

        const panel = byId("quiz-panel");
        if (!panel) return null;

        section = document.createElement("section");
        section.id = SECTION_ID;
        section.setAttribute("aria-label", "Share quiz result");

        const copy = document.createElement("div");
        copy.className = "quiz-share-copy";

        const title = document.createElement("div");
        title.className = "quiz-share-title";
        title.textContent = "Challenge a friend";

        const subtitle = document.createElement("div");
        subtitle.className = "quiz-share-subtitle";
        subtitle.textContent = "Share your result and see if they can beat it.";

        const button = document.createElement("button");
        button.id = BUTTON_ID;
        button.type = "button";
        button.textContent = "Share result";
        button.setAttribute("aria-label", "Share your quiz result as an image");
        button.addEventListener("click", onShareButtonClick);

        copy.append(title, subtitle);
        section.append(copy, button);

        // Keep this out of #quiz-buttons. On mobile the normal controls may be
        // moved into #quiz-bottom, while this share callout stays in the panel.
        panel.appendChild(section);
        return section;
    }

    function showShareSection() {
        const section = ensureShareSection();
        if (section) section.style.display = "flex";
    }

    function hideShareSection() {
        const section = byId(SECTION_ID);
        if (section) section.style.display = "none";

        const button = byId(BUTTON_ID);
        if (button) {
            button.disabled = false;
            button.textContent = "Share result";
        }
    }

    let lastCompleted = null;

    function updateVisibility(force = false) {
        const completed = getCompletionState().completed;
        if (!force && completed === lastCompleted) return;
        lastCompleted = completed;

        if (completed) showShareSection();
        else hideShareSection();
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Could not load image: ${source}`));
            image.src = source;
        });
    }

    async function loadExistingSmurdyLogo() {
        const existing = document.querySelector('img[src*="Smurdeye"]');
        const sources = [
            existing && (existing.currentSrc || existing.src),
            "/assets/images/SmurdeyeBig.png",
            "/assets/images/Smurdeye.png"
        ].filter(Boolean);

        for (const source of [...new Set(sources)]) {
            try {
                return await loadImage(source);
            } catch (_) {}
        }
        return null;
    }

    function drawContainedImage(ctx, image, x, y, width, height) {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(
            image,
            x + (width - drawWidth) / 2,
            y + (height - drawHeight) / 2,
            drawWidth,
            drawHeight
        );
    }

    function drawStatCard(ctx, x, y, width, label, value) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,.075)";
        roundRect(ctx, x, y, width, 136, 20);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,.10)";
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, width, 136, 20);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.font = "650 25px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText(label, x + 24, y + 40);

        ctx.fillStyle = "#fff";
        ctx.font = "850 44px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText(value, x + 24, y + 94);
        ctx.restore();
    }

    function splitTextIntoLines(ctx, text, maxWidth, maxLines) {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        const lines = [];
        let line = "";

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width <= maxWidth || !line) {
                line = candidate;
            } else {
                lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);

        if (lines.length <= maxLines) return lines;
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.…]+$/, "")}…`;
        return kept;
    }

    function drawAdaptiveHeadline(ctx, text, x, top, maxWidth) {
        let fontSize = 50;
        let lines = [];

        while (fontSize >= 38) {
            ctx.font = `850 ${fontSize}px system-ui, -apple-system, Segoe UI, Arial`;
            lines = splitTextIntoLines(ctx, text, maxWidth, 2);
            const originalLineCount = (() => {
                const words = String(text || "").split(/\s+/).filter(Boolean);
                let count = 1;
                let line = "";
                for (const word of words) {
                    const candidate = line ? `${line} ${word}` : word;
                    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
                    else { count++; line = word; }
                }
                return count;
            })();
            if (originalLineCount <= 2) break;
            fontSize -= 2;
        }

        const lineHeight = fontSize + 8;
        lines.forEach((line, index) => {
            ctx.fillText(line, x, top + index * lineHeight);
        });
        return top + (lines.length - 1) * lineHeight;
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas export failed."));
            }, "image/png");
        });
    }

    async function buildShareImageBlob() {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create the share image canvas.");

        const background = ctx.createLinearGradient(0, 0, 1200, 630);
        background.addColorStop(0, "#0d0d0d");
        background.addColorStop(.58, "#171717");
        background.addColorStop(1, "#222");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, 1200, 630);

        // Procedural grid drawn entirely in Canvas.
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,.025)";
        for (let x = 0; x <= 1200; x += 86) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 630);
            ctx.stroke();
        }
        for (let y = 0; y <= 630; y += 86) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1200, y);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,255,255,.055)";
        roundRect(ctx, 44, 44, 1112, 542, 28);
        ctx.fill();

        const logo = await loadExistingSmurdyLogo();
        if (logo) {
            ctx.fillStyle = "rgba(255,255,255,.96)";
            roundRect(ctx, 82, 78, 86, 70, 13);
            ctx.fill();
            drawContainedImage(ctx, logo, 91, 85, 68, 56);
        }

        ctx.fillStyle = "#fff";
        ctx.font = "850 34px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText("Smurdy", logo ? 194 : 88, 111);

        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.font = "650 22px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText("Geography quiz result", logo ? 194 : 88, 143);

        const headline = `I finished the ${getGroupLabel()} map quiz`;
        ctx.fillStyle = "#fff";
        const headlineBottom = drawAdaptiveHeadline(ctx, headline, 88, 225, 1024);

        ctx.fillStyle = "rgba(255,255,255,.82)";
        ctx.font = "750 28px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText(getModeLabel(), 90, Math.max(322, headlineBottom + 52));

        const cardY = 365;
        drawStatCard(ctx, 88, cardY, 306, "Time", extractTimeValue());
        drawStatCard(ctx, 420, cardY, 306, "Accuracy", extractAccuracyValue());
        drawStatCard(ctx, 752, cardY, 306, "Completed", extractProgressValue());

        // Keep the two footer items on opposite sides so they can never overlap.
        ctx.fillStyle = "#fff";
        ctx.font = "850 28px system-ui, -apple-system, Segoe UI, Arial";
        ctx.textAlign = "left";
        ctx.fillText("Can you beat this?", 88, 558);

        ctx.fillStyle = "rgba(255,255,255,.72)";
        ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Arial";
        ctx.textAlign = "right";
        ctx.fillText("Play at smurdy.fun", 1110, 558);
        ctx.textAlign = "left";

        return await canvasToBlob(canvas);
    }

    function buildShareText() {
        return [
            `I finished ${getQuizLabel()}`,
            `${extractAccuracyValue()} accuracy`,
            `${extractTimeValue()} time`,
            "Can you beat it? https://smurdy.fun/"
        ].join(" • ");
    }

    async function writeSharePayloadToClipboard(blob, text) {
        if (!navigator.clipboard || !window.ClipboardItem) return false;

        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "image/png": blob,
                    "text/plain": new Blob([text], { type: "text/plain" })
                })
            ]);
            return true;
        } catch (_) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob })
                ]);
                return true;
            } catch (_) {
                return false;
            }
        }
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    async function onShareButtonClick() {
        const button = byId(BUTTON_ID);
        if (!button || button.disabled) return;

        const originalText = "Share result";
        button.disabled = true;
        button.textContent = "Preparing...";

        try {
            const blob = await buildShareImageBlob();
            const slug = String(getGroupId() || "quiz")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") || "quiz";
            const filename = `smurdy-${slug}-result.png`;
            const file = new File([blob], filename, { type: "image/png" });
            const shareText = buildShareText();

            if (
                typeof navigator.share === "function" &&
                typeof navigator.canShare === "function" &&
                navigator.canShare({ files: [file] })
            ) {
                button.textContent = "Sharing...";
                try {
                    await navigator.share({
                        files: [file],
                        text: shareText,
                        title: `${getQuizLabel()} result`
                    });
                    button.textContent = "Shared";
                } catch (error) {
                    if (error && error.name === "AbortError") {
                        button.textContent = originalText;
                        button.disabled = false;
                        return;
                    }
                    throw error;
                }
            } else {
                button.textContent = "Copying...";
                const copied = await writeSharePayloadToClipboard(blob, shareText);
                if (copied) {
                    button.textContent = "Copied image";
                } else {
                    downloadBlob(blob, filename);
                    button.textContent = "Downloaded";
                }
            }

            window.setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 1400);
        } catch (error) {
            console.warn("Smurdy share result failed:", error);
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    function install() {
        ensureShareSection();
        updateVisibility(true);

        // Read-only polling avoids the feedback loop caused by the first version's
        // document-wide style observer. 400 ms is quick enough to feel immediate.
        window.setInterval(() => updateVisibility(false), 400);

        window.addEventListener("popstate", () => updateVisibility(true));
        window.addEventListener("hashchange", () => updateVisibility(true));
        window.addEventListener("smurdy:mainmenu", () => {
            lastCompleted = false;
            hideShareSection();
        });
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) updateVisibility(true);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
        install();
    }
})();
