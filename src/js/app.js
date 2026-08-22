// minimal bootstrap: capture URL config then load modes + app_core in order
(function(){
    // smurdy-independent-menu-map-control-v1
    const ASSET_VERSION = "20260822-real-navigation-links-1";

    const urlParams = new URLSearchParams(window.location.search);
    const cleanPathMatch = window.location.pathname.match(
        /^\/quizzes\/([^/]+)\/([^/]+)\/?$/
    );
    const cleanQuizId = cleanPathMatch
        ? decodeURIComponent(cleanPathMatch[1])
        : null;
    const cleanGroupId = cleanPathMatch
        ? decodeURIComponent(cleanPathMatch[2])
        : null;
    const cleanUsesSubdivisions = Boolean(
        cleanQuizId && cleanQuizId.includes("subdivision")
    );

    window.__SmurdyConfig = {
        mode: urlParams.get("mode") || (cleanUsesSubdivisions ? "states" : "countries"),
        showBorders: urlParams.get("borders") === "1",
        quizGroupId: urlParams.get("group") || cleanGroupId || "world",
        quizGroupSet:
            urlParams.get("groupSet") ||
            (cleanUsesSubdivisions ? "subdivision_groups" : "country_groups"),
        cleanQuizId
    };

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
