(() => {
    "use strict";

    const launchButton = document.querySelector("[data-smurdy-quiz-launch]");
    if (!launchButton) return;

    function ensureAnalytics() {
        if (window.SmurdyAnalytics) {
            return Promise.resolve(window.SmurdyAnalytics);
        }

        return new Promise(resolve => {
            let script = document.querySelector("script[data-smurdy-analytics]");
            if (!script) {
                script = document.createElement("script");
                script.src = "/src/js/analytics.js?v=20260823-quiz-analytics-1";
                script.defer = true;
                script.setAttribute("data-smurdy-analytics", "true");
                document.head.appendChild(script);
            }

            const finish = () => resolve(window.SmurdyAnalytics || null);
            script.addEventListener("load", finish, { once: true });
            script.addEventListener("error", finish, { once: true });

            if (window.SmurdyAnalytics) finish();
        });
    }

    void ensureAnalytics().then(analytics => {
        if (!analytics) return;
        analytics.trackLandingPageView({
            page_type: "quiz_landing"
        });
    });

    async function launchQuiz() {
        if (launchButton.disabled) return;

        const originalText = launchButton.textContent;
        launchButton.disabled = true;
        launchButton.textContent = "Loading quiz...";
        document.documentElement.setAttribute("aria-busy", "true");

        try {
            const response = await fetch("/", {
                credentials: "same-origin",
                headers: { "X-Smurdy-Quiz-Launch": "in-place" }
            });
            if (!response.ok) {
                throw new Error(`Could not load the quiz app (HTTP ${response.status}).`);
            }

            const appHtml = await response.text();
            if (!appHtml.includes('id="map"') || !appHtml.includes('/src/js/app.js')) {
                throw new Error("The quiz app shell was not found.");
            }

            // Rebuild the document from the normal app shell. The browser keeps
            // the current clean /quizzes/<mode>/<group>/ URL, so the same URL is
            // both the crawlable landing page and the playable quiz.
            document.open();
            document.write(appHtml);
            document.close();
        } catch (error) {
            console.error("Smurdy in-place quiz launch failed:", error);
            document.documentElement.removeAttribute("aria-busy");
            launchButton.disabled = false;
            launchButton.textContent = originalText;
            window.alert("The quiz could not load. Please try again.");
        }
    }

    launchButton.addEventListener("click", launchQuiz);
})();
