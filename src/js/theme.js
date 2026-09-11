(() => {
    "use strict";

    const STORAGE_KEY = "smurdy-theme";
    const DARK = "dark";
    const LIGHT = "light";
    const OVERRIDE_STYLE_ID = "smurdy-theme-runtime-overrides";

    function readStoredTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT;
        } catch (_) {
            return LIGHT;
        }
    }

    function installRuntimeOverrides() {
        if (document.getElementById(OVERRIDE_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = OVERRIDE_STYLE_ID;
        style.textContent = `
html[data-smurdy-theme="dark"] #quiz-panel,
html[data-smurdy-theme="dark"] #quiz-browser {
    color: #f3f5f7 !important;
    border-color: #3c4750 !important;
    background: #181e23 !important;
}

html[data-smurdy-theme="dark"] #quiz-panel {
    box-shadow: 0 4px 18px rgba(0, 0, 0, .28) !important;
}

html[data-smurdy-theme="dark"] #quiz-target,
html[data-smurdy-theme="dark"] #qb-title,
html[data-smurdy-theme="dark"] #quiz-browser .qb-title,
html[data-smurdy-theme="dark"] #quiz-browser strong,
html[data-smurdy-theme="dark"] #quiz-browser h1,
html[data-smurdy-theme="dark"] #quiz-browser h2,
html[data-smurdy-theme="dark"] #quiz-browser h3 {
    color: #f3f5f7 !important;
}

html[data-smurdy-theme="dark"] #quiz-desc,
html[data-smurdy-theme="dark"] #quiz-progress,
html[data-smurdy-theme="dark"] #quiz-accuracy,
html[data-smurdy-theme="dark"] #quiz-result,
html[data-smurdy-theme="dark"] #quiz-browser .qb-sub,
html[data-smurdy-theme="dark"] #quiz-browser .qb-empty,
html[data-smurdy-theme="dark"] #quiz-browser label,
html[data-smurdy-theme="dark"] #quiz-browser .qb-size-label {
    color: #bcc4ca !important;
}

html[data-smurdy-theme="dark"] #quiz-timer {
    color: #9da7ae !important;
}

html[data-smurdy-theme="dark"] #quiz-browser #qb-header,
html[data-smurdy-theme="dark"] #quiz-browser #qb-search,
html[data-smurdy-theme="dark"] #quiz-browser #qb-directory-links {
    border-color: #354049 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser #qb-library-tabs {
    gap: 18px !important;
    padding: 0 0 7px !important;
    border-bottom: 1px solid #354049 !important;
    border-radius: 0 !important;
    background: transparent !important;
}

html[data-smurdy-theme="dark"] #quiz-browser :is(.qb-library-tab, .qb-category-tab, .qb-mode-tab, .qb-family-tab) {
    border-radius: 0 !important;
    background: transparent !important;
    color: #aeb7bd !important;
    font-weight: 600 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser :is(.qb-library-tab, .qb-category-tab, .qb-mode-tab, .qb-family-tab):hover {
    background: transparent !important;
    color: #e3e7ea !important;
}

html[data-smurdy-theme="dark"] #quiz-browser :is(.qb-library-tab, .qb-category-tab, .qb-mode-tab, .qb-family-tab)[aria-selected="true"] {
    background: transparent !important;
    color: #6dbaf0 !important;
    border-color: #6dbaf0 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser #qb-category-tabs::before,
html[data-smurdy-theme="dark"] #quiz-browser #qb-mode-tabs::before,
html[data-smurdy-theme="dark"] #quiz-browser #qb-family-tabs::before {
    background: #181e23 !important;
    color: #87929a !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-library-count {
    color: #7f8a92 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser :is(input, select) {
    border-color: #4c5861 !important;
    background: #12171b !important;
    color: #f3f5f7 !important;
    box-shadow: none !important;
}

html[data-smurdy-theme="dark"] #quiz-browser :is(input, select):focus {
    border-color: #5caee5 !important;
    outline-color: rgba(92, 174, 229, .28) !important;
}

html[data-smurdy-theme="dark"] #quiz-browser input::placeholder {
    color: #858f96 !important;
    opacity: 1;
}

html[data-smurdy-theme="dark"] #quiz-browser option {
    background: #181e23;
    color: #f3f5f7;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-card {
    margin: 0 !important;
    padding: 12px 2px !important;
    border: 0 !important;
    border-bottom: 1px solid #354049 !important;
    border-radius: 0 !important;
    background: transparent !important;
    color: #f3f5f7 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-card:last-child {
    border-bottom-color: transparent !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-tag {
    background: #252d33 !important;
    color: #c5ccd1 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-play,
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary {
    border-color: #2386c5 !important;
    background: #2386c5 !important;
    color: #fff !important;
    box-shadow: none !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-play:hover,
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary:hover {
    border-color: #3298d8 !important;
    background: #3298d8 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-favorite,
html[data-smurdy-theme="dark"] #quiz-browser button:not(.qb-play):not(.smurdy-page-share-trigger) {
    border-color: #46515a !important;
    background: #1c2328 !important;
    color: #c4cbd0 !important;
    box-shadow: none !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-favorite:hover,
html[data-smurdy-theme="dark"] #quiz-browser button:not(.qb-play):not(.smurdy-page-share-trigger):hover {
    border-color: #58656f !important;
    background: #222a30 !important;
    color: #eef1f3 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-favorite[aria-pressed="true"] {
    border-color: #a98229 !important;
    background: #3d3217 !important;
    color: #ffe9a6 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser #qb-directory-links {
    background: #181e23 !important;
}

html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-popular a,
html[data-smurdy-theme="dark"] #quiz-browser #qb-directory-links a:not(.qb-directory-primary) {
    color: #69b5e9 !important;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-trigger {
    border-color: #46515a !important;
    background: transparent !important;
    color: #c7ced3 !important;
    box-shadow: none !important;
}

html[data-smurdy-theme="dark"] .smurdy-page-share-trigger:hover {
    border-color: #58656f !important;
    background: #222a30 !important;
    color: #f0f3f5 !important;
}

html[data-smurdy-theme="dark"] #quiz-buttons .qb-btn,
html[data-smurdy-theme="dark"] #quiz-buttons button,
html[data-smurdy-theme="dark"] .weak-spots-menu-button {
    border-color: #46515a !important;
    background: #222a30 !important;
    color: #eef1f3 !important;
}

html[data-smurdy-theme="dark"] #quiz-buttons .qb-btn:hover,
html[data-smurdy-theme="dark"] #quiz-buttons button:hover,
html[data-smurdy-theme="dark"] .weak-spots-menu-button:hover {
    border-color: #58656f !important;
    background: #293239 !important;
}

html[data-smurdy-theme="dark"] #quiz-stats {
    color: #dce1e4 !important;
}

html[data-smurdy-theme="dark"] #mobile-map-attrib .mobile-attrib-btn {
    background: rgba(18, 23, 27, .9) !important;
    color: #f3f5f7 !important;
}

html[data-smurdy-theme="dark"] #mobile-map-attrib .mobile-attrib-content {
    border-color: #3c4750 !important;
    background: #181e23 !important;
    color: #ccd2d6 !important;
}`;
        document.head.appendChild(style);
    }

    function applyTheme(theme) {
        const next = theme === DARK ? DARK : LIGHT;
        document.documentElement.dataset.smurdyTheme = next;
        document.documentElement.style.colorScheme = next;

        const toggle = document.querySelector("[data-smurdy-theme-toggle]");
        if (toggle) {
            const isDark = next === DARK;
            toggle.setAttribute("aria-pressed", String(isDark));
            toggle.textContent = isDark ? "Light mode" : "Dark mode";
        }

        return next;
    }

    function saveTheme(theme) {
        const next = applyTheme(theme);
        try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
        return next;
    }

    function toggleTheme() {
        return saveTheme(readStoredTheme() === DARK ? LIGHT : DARK);
    }

    function installToggle() {
        installRuntimeOverrides();
        applyTheme(readStoredTheme());
        const toggle = document.querySelector("[data-smurdy-theme-toggle]");
        if (!toggle || toggle.dataset.smurdyThemeReady === "true") return;
        toggle.dataset.smurdyThemeReady = "true";
        toggle.addEventListener("click", toggleTheme);
    }

    installRuntimeOverrides();
    applyTheme(readStoredTheme());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installToggle, { once: true });
    } else {
        installToggle();
    }

    window.addEventListener("storage", event => {
        if (event.key === STORAGE_KEY) applyTheme(event.newValue === DARK ? DARK : LIGHT);
    });

    window.SmurdyTheme = Object.freeze({
        get: readStoredTheme,
        set: saveTheme,
        toggle: toggleTheme
    });
})();
