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
    color: #f4f6f8 !important;
    border-color: #46515a !important;
    background: #1a2025 !important;
}
html[data-smurdy-theme="dark"] #quiz-target,
html[data-smurdy-theme="dark"] #qb-title,
html[data-smurdy-theme="dark"] #quiz-browser .qb-title,
html[data-smurdy-theme="dark"] #quiz-browser strong,
html[data-smurdy-theme="dark"] #quiz-browser h1,
html[data-smurdy-theme="dark"] #quiz-browser h2,
html[data-smurdy-theme="dark"] #quiz-browser h3 {
    color: #f4f6f8 !important;
}
html[data-smurdy-theme="dark"] #quiz-desc,
html[data-smurdy-theme="dark"] #quiz-progress,
html[data-smurdy-theme="dark"] #quiz-accuracy,
html[data-smurdy-theme="dark"] #quiz-result,
html[data-smurdy-theme="dark"] #quiz-browser .qb-sub,
html[data-smurdy-theme="dark"] #quiz-browser .qb-empty,
html[data-smurdy-theme="dark"] #quiz-browser label,
html[data-smurdy-theme="dark"] #quiz-browser .qb-size-label {
    color: #c7cdd2 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser #qb-header,
html[data-smurdy-theme="dark"] #quiz-browser #qb-search,
html[data-smurdy-theme="dark"] #quiz-browser #qb-directory-links,
html[data-smurdy-theme="dark"] #quiz-browser .qb-card {
    border-color: #46515a !important;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-card {
    background: #20272d !important;
    color: #f4f6f8 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-tag {
    background: #303941 !important;
    color: #d7dce0 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser #qb-library-tabs {
    background: #242c32 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser #qb-category-tabs::before,
html[data-smurdy-theme="dark"] #quiz-browser #qb-mode-tabs::before,
html[data-smurdy-theme="dark"] #quiz-browser #qb-family-tabs::before {
    background: #1a2025 !important;
    color: #aeb6bc !important;
}
html[data-smurdy-theme="dark"] #quiz-browser :is(.qb-library-tab, .qb-category-tab, .qb-mode-tab, .qb-family-tab) {
    color: #c1c8cd !important;
}
html[data-smurdy-theme="dark"] #quiz-browser :is(.qb-library-tab, .qb-category-tab, .qb-mode-tab, .qb-family-tab)[aria-selected="true"] {
    color: #69baf0 !important;
    border-color: #69baf0 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser :is(input, select) {
    border-color: #66717a !important;
    background: #14191d !important;
    color: #f4f6f8 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser input::placeholder {
    color: #9ca5ab !important;
    opacity: 1;
}
html[data-smurdy-theme="dark"] #quiz-browser option {
    background: #1a2025;
    color: #f4f6f8;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-play,
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary {
    border-color: #2489c9 !important;
    background: #2489c9 !important;
    color: #fff !important;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-play:hover,
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-primary:hover {
    background: #3298d8 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-favorite,
html[data-smurdy-theme="dark"] #quiz-browser button:not(.qb-play):not(.smurdy-page-share-trigger) {
    border-color: #59646c !important;
    background: #293138 !important;
    color: #edf1f4 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-favorite[aria-pressed="true"] {
    border-color: #c99d32 !important;
    background: #4b3d18 !important;
    color: #fff1b8 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser #qb-directory-links {
    background: #1a2025 !important;
}
html[data-smurdy-theme="dark"] #quiz-browser .qb-directory-popular a,
html[data-smurdy-theme="dark"] #quiz-browser #qb-directory-links a:not(.qb-directory-primary) {
    color: #78bdf0 !important;
}
html[data-smurdy-theme="dark"] .smurdy-page-share-trigger {
    border-color: #59646c !important;
    background: #293138 !important;
    color: #f4f6f8 !important;
}
html[data-smurdy-theme="dark"] #quiz-stats {
    color: #f4f6f8 !important;
}
html[data-smurdy-theme="dark"] #mobile-map-attrib .mobile-attrib-btn {
    background: rgba(20, 25, 29, .88) !important;
    color: #f4f6f8 !important;
}
html[data-smurdy-theme="dark"] #mobile-map-attrib .mobile-attrib-content {
    border-color: #46515a !important;
    background: #1a2025 !important;
    color: #d7dce0 !important;
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
