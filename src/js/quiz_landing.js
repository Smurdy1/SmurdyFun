(() => {
    "use strict";

    const body = document.body;
    if (!body) return;
    body.classList.add("smurdy-quiz-landing");

    const route = String(location.pathname || "").match(
        /^\/quizzes\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i
    );
    const quizId = body.dataset.quizId || (route ? route[1] : "");
    const groupId = body.dataset.quizGroup || body.dataset.flagSet || (route ? route[2] : "world");
    const definition = window.SmurdyQuizDefinitions?.get?.(quizId) || null;
    const modality = body.dataset.quizModality || definition?.modality || "map";
    const launchButton = document.querySelector(
        "[data-smurdy-quiz-launch], [data-flag-launch]"
    );
    const favoriteButton = document.querySelector(
        "[data-smurdy-quiz-favorite], [data-flag-favorite]"
    );

    function ensureScript(attribute, source, ready) {
        return new Promise(resolve => {
            if (ready?.()) {
                resolve();
                return;
            }

            let script = document.querySelector(`script[${attribute}]`);
            if (!script) {
                script = document.createElement("script");
                script.src = source;
                script.defer = true;
                script.setAttribute(attribute, "true");
                document.head.appendChild(script);
            }
            script.addEventListener("load", resolve, { once: true });
            script.addEventListener("error", resolve, { once: true });
        });
    }

    async function ensureLibrary() {
        if (window.SmurdyQuizLibrary) return;
        await ensureScript(
            "data-smurdy-quiz-library",
            "/src/js/quiz_library.js?v=20260903-final-unity-1",
            () => Boolean(window.SmurdyQuizLibrary)
        );
    }

    function syncFavorite() {
        if (!favoriteButton || !quizId || !groupId) return;
        const saved = Boolean(
            window.SmurdyQuizLibrary?.isFavorite?.(quizId, groupId)
        );
        favoriteButton.setAttribute("aria-pressed", String(saved));
        favoriteButton.textContent = saved ? "★ Favorited" : "☆ Add to favorites";
    }

    async function prepareFavorite() {
        if (!favoriteButton) return;
        await ensureLibrary();
        syncFavorite();
        favoriteButton.addEventListener("click", () => {
            window.SmurdyQuizLibrary?.toggleFavorite?.(quizId, groupId);
            syncFavorite();
        });
        window.addEventListener("smurdy:quiz-library-change", syncFavorite);
    }

    async function prepareInitialLaunchIntent() {
        await ensureScript(
            "data-smurdy-launch-intent",
            "/src/js/quiz_launch_intent.js?v=20260903-final-unity-1",
            () => Boolean(window.SmurdyQuizLaunchIntent)
        );

        try {
            const params = new URLSearchParams(location.search);
            const legacyWeakSpots =
                params.get("weakSpotsPractice") === "1" &&
                Boolean(sessionStorage.getItem("smurdy-weak-spots-practice-v1"));

            if (legacyWeakSpots) {
                window.SmurdyQuizLaunchIntent?.store?.(
                    quizId,
                    groupId,
                    "weak_spots"
                );
                params.delete("weakSpotsPractice");
                const query = params.toString();
                history.replaceState(
                    {},
                    "",
                    location.pathname +
                        (query ? "?" + query : "") +
                        location.hash
                );
            }
            return window.SmurdyQuizLaunchIntent?.peekCurrent?.() || null;
        } catch (_) {
            return null;
        }
    }

    async function trackLandingView() {
        await ensureScript(
            "data-smurdy-analytics",
            "/src/js/analytics.js?v=20260823-quiz-analytics-1",
            () => Boolean(window.SmurdyAnalytics)
        );
        window.SmurdyAnalytics?.trackLandingPageView?.({
            page_type: "quiz_landing",
            quiz_mode: quizId,
            quiz_group: groupId
        });
    }

    async function launchMapQuiz() {
        const originalText = launchButton?.textContent || "Open quiz";
        if (launchButton?.disabled) return;
        if (launchButton) {
            launchButton.disabled = true;
            launchButton.textContent = "Loading quiz...";
        }
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

            document.open();
            document.write(appHtml);
            document.close();
        } catch (error) {
            console.error("Smurdy in-place quiz launch failed:", error);
            document.documentElement.removeAttribute("aria-busy");
            if (launchButton) {
                launchButton.disabled = false;
                launchButton.textContent = originalText;
            }
            window.alert("The quiz could not load. Please try again.");
        }
    }

    async function launchQuiz(intent = null) {
        if (!launchButton) return;
        if (modality === "flag") {
            const controller = window.SmurdyFlagQuizController;
            if (!controller?.launchQuiz) {
                console.error("Flag quiz controller is not ready.");
                return;
            }
            await controller.launchQuiz({ launchIntent: intent });
            return;
        }
        await launchMapQuiz();
    }

    launchButton?.addEventListener("click", () => {
        void launchQuiz(null);
    });
    void prepareFavorite();

    void prepareInitialLaunchIntent().then(intent => {
        if (intent) requestAnimationFrame(() => void launchQuiz(intent));
        else void trackLandingView();
    });
})();
