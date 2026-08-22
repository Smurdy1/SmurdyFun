(() => {
    "use strict";

    const launchButton = document.querySelector("[data-smurdy-quiz-launch]");
    if (!launchButton) return;

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
