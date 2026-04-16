// Worker: build group outline in batches and post them to main thread.
self.normalize = function (text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

// simple canonical name extractor similar to MODE.getCanonicalFeatureName
self.getCanonicalFromProps = function (p) {
    if (!p) return "Unknown";
    const cand = [
        p.SOVEREIGNT, p.BRK_NAME, p.NAME_LONG, p.NAME, p.admin, p.ADMIN, p.NAME_EN, p.NAME_AR
    ].filter(Boolean);
    let raw = (cand.length ? String(cand[0]) : "").trim();
    if (!raw && p.iso_a3) raw = String(p.iso_a3).trim();
    raw = raw.replace(/\s*\(.*\)\s*/g, "").replace(/\s*,\s*/g, ", ").trim();
    return raw || "Unknown";
};

self.onmessage = async (ev) => {
    try {
        const { action } = ev.data;
        if (action !== "buildGroupOutline") return;
        const { dataFile, tinyFile, allowed = [], batchSize = 80 } = ev.data;
        const allowedSet = new Set(allowed.map(n => self.normalize(n)));

        const sendBatch = (buf) => {
            if (!buf || !buf.length) return;
            self.postMessage({ type: "batch", features: buf });
        };

        // helper to process a file URL and stream matching features
        const processUrl = async (url) => {
            if (!url) return;
            const res = await fetch(url);
            const json = await res.json();
            const feats = Array.isArray(json.features) ? json.features : [];
            let buf = [];
            for (let i = 0; i < feats.length; i++) {
                const f = feats[i];
                const p = f.properties || {};
                const canon = self.getCanonicalFromProps(p);
                const norm = self.normalize(canon);
                if (allowedSet.has(norm)) {
                    // include only geometry + properties minimal payload to keep messages small
                    buf.push({
                        type: "Feature",
                        geometry: f.geometry,
                        properties: Object.assign({}, p, { _canon: norm })
                    });
                    if (buf.length >= batchSize) {
                        sendBatch(buf);
                        buf = [];
                        // yield quickly (allow browser to process messages)
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }
            if (buf.length) sendBatch(buf);
        };

        await processUrl(dataFile);
        await processUrl(tinyFile);

        self.postMessage({ type: "done" });
    } catch (err) {
        self.postMessage({ type: "error", error: String(err && err.message ? err.message : err) });
    }
};