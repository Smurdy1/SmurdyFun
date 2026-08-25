// minimal bootstrap: capture URL config then load modes + app_core in order
(function(){
    // smurdy-independent-menu-map-control-v1
    const ASSET_VERSION = "20260825-weak-spots-1";

    const urlParams = new URLSearchParams(window.location.search);
    const cleanPathMatch = window.location.pathname.match(
        /^\/quizzes\/([^/]+)\/([^/]+)\/?$/
    );
    const pathQuizId = cleanPathMatch
        ? decodeURIComponent(cleanPathMatch[1])
        : null;
    const pathGroupId = cleanPathMatch
        ? decodeURIComponent(cleanPathMatch[2])
        : null;

    const supportedQuizIds = new Set([
        "click-country",
        "type-country",
        "find-country",
        "find-point",
        "click-subdivision",
        "type-subdivision",
        "find-subdivision",
        "find-point-subdivision"
    ]);
    const subdivisionAliases = {
        "click-country": "click-subdivision",
        "type-country": "type-subdivision",
        "find-country": "find-subdivision",
        "find-point": "find-point-subdivision"
    };

    function safeSlug(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function getLegacyQuizId() {
        if (
            window.location.pathname !== "/" &&
            window.location.pathname !== "/index.html"
        ) {
            return null;
        }

        let quizId = String(urlParams.get("quiz") || "")
            .replace(/^manifest:/i, "")
            .trim();

        if (!supportedQuizIds.has(quizId)) return null;

        const subdivisionRequest =
            quizId.includes("subdivision") ||
            urlParams.get("groupSet") === "subdivision_groups" ||
            urlParams.get("mode") === "states";

        if (subdivisionRequest && subdivisionAliases[quizId]) {
            quizId = subdivisionAliases[quizId];
        }

        return quizId;
    }

    const legacyQuizId = pathQuizId ? null : getLegacyQuizId();
    const cleanQuizId = pathQuizId || legacyQuizId;
    const cleanGroupId =
        pathGroupId ||
        urlParams.get("group") ||
        "world";
    const cleanUsesSubdivisions = Boolean(
        cleanQuizId && cleanQuizId.includes("subdivision")
    );

    window.__SmurdyConfig = {
        mode: urlParams.get("mode") || (cleanUsesSubdivisions ? "states" : "countries"),
        showBorders: urlParams.get("borders") === "1",
        quizGroupId: cleanGroupId,
        quizGroupSet:
            urlParams.get("groupSet") ||
            (cleanUsesSubdivisions ? "subdivision_groups" : "country_groups"),
        cleanQuizId
    };

    if (legacyQuizId) {
        const canonicalPath =
            `/quizzes/${safeSlug(legacyQuizId)}/${safeSlug(cleanGroupId)}/`;
        const canonicalUrl = new URL(
            canonicalPath,
            window.location.origin
        ).href;

        try {
            window.history.replaceState({}, "", canonicalPath);
        } catch (_) {}

        const canonicalLink = document.querySelector(
            'link[rel="canonical"]'
        );
        if (canonicalLink) canonicalLink.href = canonicalUrl;

        const openGraphUrl = document.querySelector(
            'meta[property="og:url"]'
        );
        if (openGraphUrl) {
            openGraphUrl.setAttribute("content", canonicalUrl);
        }
    }

    function versioned(src) {
        const separator = src.includes("?") ? "&" : "?";
        return src + separator + "v=" + encodeURIComponent(ASSET_VERSION);
    }

    function loadScript(src, onload) {
        const script = document.createElement("script");
        script.src = versioned(src);
        script.defer = true;
        script.onload = onload;
        script.onerror = function(error) {
            console.error("Failed to load", src, error);
            if (onload) onload();
        };
        document.head.appendChild(script);
    }

    /*
     * Do not normalize controls from app.js. The homepage uses an
     * independent menu map, so its control is configured inside
     * showMainMenuMap() in app_core.js.
     */
    loadScript("/src/js/modes.js", function() {
        loadScript("/src/js/app_core.js", function() {
            console.log("smurdy: bootstrap loaded modes + app_core");
        });
    });
})();
