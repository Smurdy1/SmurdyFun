// minimal bootstrap: capture URL config then load modes + app_core in order
(function(){
    // capture a tiny config object so the split files can read initial params
    const urlParams = new URLSearchParams(window.location.search);
    window.__SmurdyConfig = {
        mode: urlParams.get("mode") || "countries",
        showBorders: urlParams.get("borders") === "1",
        quizGroupId: urlParams.get("group") || "world",
        quizGroupSet: urlParams.get("groupSet") || "country_groups"
    };

    function loadScript(src, onload){
        const s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.onload = onload;
        s.onerror = function(e){ console.error("Failed to load", src, e); if (onload) onload(); };
        document.head.appendChild(s);
    }

    // load modes first, then the large core file
    loadScript("/src/js/modes.js", function(){
        loadScript("/src/js/app_core.js", function(){
            // ready
            console.log("smurdy: bootstrap loaded modes + app_core");
        });
    });
})();