(() => {
    "use strict";

    if (window.SmurdyAnalytics) return;

    /*
     * One-time setup:
     * Replace the empty value below with the GA4 web stream measurement ID.
     * Example format: G-ABC123DE45
     *
     * The analytics API and its debug event log still work while this is empty,
     * but no information is sent over the network.
     */
    const DEFAULT_MEASUREMENT_ID = "";

    const VISITOR_SEEN_KEY = "smurdy-analytics-seen-v1";
    const VISITOR_SESSION_KEY = "smurdy-analytics-visitor-type-v1";
    const DEBUG_LIMIT = 100;

    let loadedMeasurementId = "";
    let warnedAboutInvalidId = false;
    let activeRun = null;
    let landingViewTracked = false;

    function getMeasurementId() {
        return String(
            window.SMURDY_GA_MEASUREMENT_ID ||
            DEFAULT_MEASUREMENT_ID ||
            ""
        ).trim();
    }

    function getVisitorType() {
        try {
            const existingSessionType = sessionStorage.getItem(VISITOR_SESSION_KEY);
            if (existingSessionType) return existingSessionType;

            const visitorType = localStorage.getItem(VISITOR_SEEN_KEY)
                ? "returning"
                : "new";

            sessionStorage.setItem(VISITOR_SESSION_KEY, visitorType);
            localStorage.setItem(VISITOR_SEEN_KEY, String(Date.now()));
            return visitorType;
        } catch (_) {
            return "unknown";
        }
    }

    const visitorType = getVisitorType();

    function ensureGoogleTag() {
        const measurementId = getMeasurementId();
        if (!measurementId) return false;

        if (!/^G-[A-Z0-9]+$/i.test(measurementId)) {
            if (!warnedAboutInvalidId) {
                console.warn("Smurdy analytics: expected a GA4 measurement ID beginning with G-.");
                warnedAboutInvalidId = true;
            }
            return false;
        }

        if (loadedMeasurementId === measurementId) return true;
        loadedMeasurementId = measurementId;

        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function() {
            window.dataLayer.push(arguments);
        };

        window.gtag("js", new Date());
        window.gtag("config", measurementId);

        if (!document.querySelector('script[data-smurdy-google-tag]')) {
            const script = document.createElement("script");
            script.async = true;
            script.src =
                "https://www.googletagmanager.com/gtag/js?id=" +
                encodeURIComponent(measurementId);
            script.setAttribute("data-smurdy-google-tag", measurementId);
            document.head.appendChild(script);
        }

        return true;
    }

    function readPathContext() {
        const match = window.location.pathname.match(
            /^\/quizzes\/([^/]+)\/([^/]+)\/?$/
        );
        const config = window.__SmurdyConfig || {};
        const quiz = window.SmurdyQuiz || {};

        return {
            quiz_mode: match
                ? decodeURIComponent(match[1])
                : String(config.cleanQuizId || ""),
            quiz_group: match
                ? decodeURIComponent(match[2])
                : String(
                    quiz.currentGroupId ||
                    config.quizGroupId ||
                    ""
                )
        };
    }

    function cleanParameters(parameters) {
        const cleaned = {};

        for (const [key, value] of Object.entries(parameters || {})) {
            if (value === undefined || value === null || value === "") continue;

            if (typeof value === "boolean") {
                cleaned[key] = value ? 1 : 0;
            } else if (
                typeof value === "string" ||
                typeof value === "number"
            ) {
                cleaned[key] = value;
            }
        }

        return cleaned;
    }

    function buildParameters(parameters) {
        const context = readPathContext();

        return cleanParameters({
            quiz_mode: context.quiz_mode,
            quiz_group: context.quiz_group,
            visitor_type: visitorType,
            returning_visitor: visitorType === "returning",
            ...parameters
        });
    }

    function rememberDebugEvent(eventName, parameters) {
        window._smurdyAnalyticsDebug = window._smurdyAnalyticsDebug || [];
        window._smurdyAnalyticsDebug.push({
            event: eventName,
            parameters: { ...parameters },
            recorded_at: new Date().toISOString()
        });

        if (window._smurdyAnalyticsDebug.length > DEBUG_LIMIT) {
            window._smurdyAnalyticsDebug.splice(
                0,
                window._smurdyAnalyticsDebug.length - DEBUG_LIMIT
            );
        }

        try {
            window.dispatchEvent(new CustomEvent("smurdy:analytics-event", {
                detail: {
                    event: eventName,
                    parameters: { ...parameters }
                }
            }));
        } catch (_) {}
    }

    function track(eventName, parameters = {}) {
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) {
            console.warn("Smurdy analytics: invalid event name", eventName);
            return;
        }

        const payload = buildParameters(parameters);
        rememberDebugEvent(eventName, payload);

        if (ensureGoogleTag() && typeof window.gtag === "function") {
            window.gtag("event", eventName, payload);
        }
    }

    function elapsedSeconds(run) {
        if (!run) return 0;
        return Math.max(0, Math.round((Date.now() - run.startedAt) / 1000));
    }

    function accuracyPercent(correctAnswers, attempts) {
        if (!attempts) return 100;
        return Math.round((correctAnswers / attempts) * 100);
    }

    function updateRunSnapshot(snapshot = {}) {
        if (!activeRun) return;

        if (Number.isFinite(snapshot.attempts)) {
            activeRun.attempts = snapshot.attempts;
        }
        if (Number.isFinite(snapshot.correctAnswers)) {
            activeRun.correctAnswers = snapshot.correctAnswers;
        }
        if (Number.isFinite(snapshot.completedPlaces)) {
            activeRun.completedPlaces = snapshot.completedPlaces;
        }
        if (Number.isFinite(snapshot.placesTotal)) {
            activeRun.placesTotal = snapshot.placesTotal;
        }
    }

    function abandonmentParameters(reason, extra = {}) {
        const run = activeRun;
        const attempts = run ? run.attempts : 0;
        const correctAnswers = run ? run.correctAnswers : 0;

        return {
            ...(run ? run.context : {}),
            abandonment_reason: reason || "page_exit",
            answers_attempted: attempts,
            correct_answers: correctAnswers,
            accuracy_percent: accuracyPercent(correctAnswers, attempts),
            places_completed: run ? run.completedPlaces : 0,
            places_total: run ? run.placesTotal : 0,
            completion_time_seconds: run ? elapsedSeconds(run) : 0,
            ...extra
        };
    }

    function abandonQuiz(reason = "page_exit", extra = {}) {
        if (!activeRun || activeRun.finished) return;

        const parameters = abandonmentParameters(reason, extra);
        activeRun.finished = true;
        track("quiz_abandon", parameters);
    }

    const api = {
        track,

        trackLandingPageView(parameters = {}) {
            if (landingViewTracked) return;
            landingViewTracked = true;
            track("landing_page_view", parameters);
        },

        beginQuiz(parameters = {}) {
            if (activeRun && !activeRun.finished) {
                abandonQuiz(parameters.start_reason === "restart" ? "restart" : "replaced");
            }

            const context = buildParameters(parameters);
            activeRun = {
                context: {
                    quiz_mode: context.quiz_mode,
                    quiz_group: context.quiz_group
                },
                startedAt: Date.now(),
                attempts: 0,
                correctAnswers: 0,
                completedPlaces: 0,
                placesTotal: Number(parameters.places_total) || 0,
                firstAnswerTracked: false,
                finished: false
            };

            track("quiz_start", parameters);
        },

        recordAnswer(snapshot = {}) {
            if (!activeRun || activeRun.finished) return;
            updateRunSnapshot(snapshot);

            if (activeRun.firstAnswerTracked) return;
            activeRun.firstAnswerTracked = true;

            track("first_answer", {
                ...activeRun.context,
                answer_correct: Boolean(snapshot.correct),
                answers_attempted: activeRun.attempts,
                time_to_first_answer_seconds: elapsedSeconds(activeRun),
                places_total: activeRun.placesTotal
            });
        },

        completeQuiz(snapshot = {}) {
            if (!activeRun || activeRun.finished) return;
            updateRunSnapshot(snapshot);

            const attempts = activeRun.attempts;
            const correctAnswers = activeRun.correctAnswers;
            const duration = Number.isFinite(snapshot.completionTimeSeconds)
                ? snapshot.completionTimeSeconds
                : elapsedSeconds(activeRun);

            activeRun.finished = true;
            track("quiz_complete", {
                ...activeRun.context,
                answers_attempted: attempts,
                correct_answers: correctAnswers,
                accuracy_percent: accuracyPercent(correctAnswers, attempts),
                places_completed: activeRun.completedPlaces,
                places_total: activeRun.placesTotal,
                completion_time_seconds: Math.max(0, Math.round(duration))
            });
        },

        abandonQuiz,

        isEnabled() {
            return Boolean(getMeasurementId());
        },

        isReturningVisitor() {
            return visitorType === "returning";
        }
    };

    window.SmurdyAnalytics = api;
    ensureGoogleTag();

    window.addEventListener("pagehide", () => {
        abandonQuiz("page_exit", { transport_type: "beacon" });
    });
})();
