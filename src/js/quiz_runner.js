window.runNameQuiz = function runNameQuiz(config) {
    const SQ = window.SmurdyQuiz;

    // Toggle quiz-panel between "homepage" (description + suggest) and "game" (timer + controls).
    function setQuizPanelMode(mode) {
        const desc = document.getElementById("quiz-desc");
        const suggest = document.getElementById("quiz-suggest");
        const restart = document.getElementById("quiz-restart");
        const back = document.getElementById("quiz-back");
        let timer = document.getElementById("quiz-timer");
        const target = document.getElementById("quiz-target");

        if (mode === "game") {
            if (desc) desc.style.display = "none";
            if (suggest) suggest.style.display = "none";
            if (restart) restart.style.display = "";
            if (back) back.style.display = "";

            // ensure timer exists and is visible
            if (!timer && target) {
                timer = document.createElement("div");
                timer.id = "quiz-timer";
                timer.style.marginTop = "6px";
                timer.style.fontWeight = "700";
                target.parentNode.insertBefore(timer, target.nextSibling);
            }
            if (timer) timer.style.display = "";

            // ensure progress exists (insert before buttons)
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

            // ensure accuracy exists
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
            if (timer) timer.style.display = "none";
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
    let locked = false;
    let completed = new Set();
    let currentPoint = null; // {lng, lat}

    let attempts = 0;
    let correctAnswers = 0;

    let inputEl = null;
    let submitButton = null;

    let timerInterval = null;
    let startTime = null;
    let finalElapsedMs = 0;

    function getNames() {
        return SQ.getAllNames();
    }

    function setState(name, stateName) {
        return SQ.setFeatureStateByName(name, stateName);
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

    function updateCounter() {
        const total = getNames().length;
        SQ.setProgressText(`${completed.size} / ${total} completed`);
    }

    function updateAccuracy() {
        const percent = attempts === 0
            ? 100
            : Math.round((correctAnswers / attempts) * 100);

        SQ.setAccuracyText(`${percent}% correct`);
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

    function formatElapsed(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function setTimerText(ms) {
        const el = document.getElementById("quiz-timer");
        if (el) el.textContent = formatElapsed(ms);
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
        inputEl.style.fontSize = "14px";

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
        panel.appendChild(controls);

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

    // Try to pick a truly random point inside a remaining country's polygon part.
    async function pickRandomLandPoint(maxTries = 200) {
        const remainingNames = getRemaining();
        if (!remainingNames || remainingNames.length === 0) return null;

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
            SQ.setProgressText(`${total} / ${total} completed`);
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
            stopTimer();
            setInputEnabled(false);

            // restore homepage-like panel when quiz finishes (only show paragraphs/suggest when on homepage)
            try { setQuizPanelMode("home"); } catch (e) {}

             // show browser panel again when quiz finishes
             try {
                 const panel = document.getElementById("quiz-browser");
                 if (panel) {
                     panel.style.display = "block";
                     panel.style.opacity = "";
                     panel.style.transform = "";
                 }
             } catch (e) {}
 
             return;
         }
 
        // For findPoint mode, choose a random country and place the dot on its largest polygon part.
        if (mode === "type" && findPoint) {
            try { SQ.setShowBorders(false); } catch (e) {}
            clearStates(); // clear previous point/state before picking
            // ensure the layer exists (creates on first use)
            ensureFindPointLayer();
            const picked = await pickRandomLandPoint();
            if (picked) {
                currentName = picked.name;
                showPointAt(picked.lnglat);
                try {
                    SQ.map.easeTo({ center: [picked.lnglat.lng, picked.lnglat.lat], duration: 700, zoom: Math.min(6, Math.max(3.6, SQ.map.getZoom())) });
                } catch (e) {}
            } else {
                // fallback: pick a country name if no suitable feature found
                currentName = randomChoice(remaining);
            }
        } else {
            currentName = randomChoice(remaining);
        }
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

        SQ.setTargetText(titleBuilder(currentName));
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

         if (typeof SQ.resetView === "function") {
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

        // For findPoint mode: do not set feature-state highlights (keep visuals clean)
        if (!findPoint) setState(currentName, "correct");
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

    function finishWrong(clickedOrGuess) {
        // In findPoint mode we avoid setting per-feature wrong/correct states so map colors do not persist.
        if (!findPoint) {
            if (mode === "click") {
                setState(clickedOrGuess, "wrong");
            } else {
                setState(currentName, "wrong");
            }
            if (showTargetOnWrong && mode === "click") {
                setState(currentName, "target");
            }
        }

        if (mode === "type") {
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

    function handleClick(clickedName) {
        if (locked || !currentName) return;
        if (!clickedName || clickedName === "Unknown") return;
        if (completed.has(clickedName)) return;

        locked = true;
        attempts++;

        if (clickedName === currentName) {
            finishCorrect();
        } else {
            finishWrong(clickedName);
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

        SQ.map.on("click", (e) => {
            const feature = SQ.getClickedMainFeature(e.point);
            if (!feature) return;

            const clickedName = SQ.getFeatureName(feature);
            handleClick(clickedName);
        });
    }

    updateCounter();
    updateAccuracy();
    resetTimer();
    startTimer();
    nextQuestion();
};