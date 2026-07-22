// minimal bootstrap: capture URL config then load modes + app_core in order
(function(){
    // smurdy-independent-menu-map-control-v1
    const ASSET_VERSION = "20260722-independent-menu-control-1";

    const urlParams = new URLSearchParams(window.location.search);

    window.__SmurdyConfig = {
        mode: urlParams.get("mode") || "countries",
        showBorders: urlParams.get("borders") === "1",
        quizGroupId: urlParams.get("group") || "world",
        quizGroupSet:
            urlParams.get("groupSet") || "country_groups"
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
