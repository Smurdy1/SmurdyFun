(() => {
    "use strict";

    document.body.classList.add("smurdy-quiz-landing");

    if (!document.querySelector("link[data-smurdy-landing-polish]")) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "/styles/quiz_landing.css?v=20260827-landing-width-1";
        stylesheet.setAttribute("data-smurdy-landing-polish", "true");
        document.head.appendChild(stylesheet);
    }

    const launchButton = document.querySelector("[data-smurdy-quiz-launch]");
    if (!launchButton) return;

    function ensureScript(attribute, source) {
        return new Promise(resolve => {
            if (attribute === "data-smurdy-launch-intent" && window.SmurdyQuizLaunchIntent) {
                resolve();
                return;
            }
            if (attribute === "data-smurdy-analytics" && window.SmurdyAnalytics) {
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
            const finish = () => resolve();
            script.addEventListener("load", finish, { once: true });
            script.addEventListener("error", finish, { once: true });
        });
    }

    async function prepareInitialLaunchIntent() {
        await ensureScript(
            "data-smurdy-launch-intent",
            "/src/js/quiz_launch_intent.js?v=20260903-flag-parity-1"
        );

        try {
            const params = new URLSearchParams(window.location.search);
            const legacyWeakSpots =
                params.get("weakSpotsPractice") === "1" &&
                Boolean(sessionStorage.getItem("smurdy-weak-spots-practice-v1"));

            if (legacyWeakSpots) {
                const route = window.SmurdyQuizLaunchIntent?.parseQuizPath?.(
                    window.location.pathname
                );
                if (route) {
                    window.SmurdyQuizLaunchIntent?.store?.(
                        route.quizId,
                        route.groupId,
                        "weak_spots"
                    );
                }
                params.delete("weakSpotsPractice");
                const query = params.toString();
                history.replaceState(
                    {},
                    "",
                    window.location.pathname +
                        (query ? "?" + query : "") +
                        window.location.hash
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
            "/src/js/analytics.js?v=20260823-quiz-analytics-1"
        );
        window.SmurdyAnalytics?.trackLandingPageView?.({
            page_type: "quiz_landing"
        });
    }

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

    void prepareInitialLaunchIntent().then(intent => {
        if (intent) requestAnimationFrame(launchQuiz);
        else void trackLandingView();
    });
})();

// smurdy-privacy-footer-link-v1
(() => {
    function addPrivacyLink() {
        const footer = document.querySelector("footer");
        if (!footer || footer.querySelector('a[href="/privacy/"], a[href$="/privacy/"]')) return;

        const separator = document.createTextNode(" · ");
        const link = document.createElement("a");
        link.href = "/privacy/";
        link.textContent = "Privacy";
        footer.append(separator, link);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", addPrivacyLink, { once: true });
    } else {
        addPrivacyLink();
    }
})();
