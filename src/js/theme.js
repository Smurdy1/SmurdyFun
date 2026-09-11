(() => {
    "use strict";

    const STORAGE_KEY = "smurdy-theme";
    const DARK = "dark";
    const LIGHT = "light";

    function readStoredTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT;
        } catch (_) {
            return LIGHT;
        }
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
        applyTheme(readStoredTheme());
        const toggle = document.querySelector("[data-smurdy-theme-toggle]");
        if (!toggle || toggle.dataset.smurdyThemeReady === "true") return;
        toggle.dataset.smurdyThemeReady = "true";
        toggle.addEventListener("click", toggleTheme);
    }

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
