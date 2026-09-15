(function initSmurdyPerfect(root, factory) {
    "use strict";

    const api = factory(root);
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) {
        root.SmurdyPerfect = api;
        api.install();
    }
})(typeof window !== "undefined" ? window : null, function createSmurdyPerfectApi(root) {
    "use strict";

    const BROWSER_SELECTOR = "[data-smurdy-perfect]";
    const SHARE_SELECTOR = "[data-smurdy-perfect-share]";

    function isPerfectResult(result) {
        if (!result) return false;
        const total = Math.max(0, Number(result.total) || 0);
        const completed = Math.max(0, Number(result.completedCount) || 0);
        return total > 0 &&
            completed === total &&
            Number(result.accuracyPercent) === 100 &&
            result.hasMisses !== true;
    }

    function styleIndicator(element, share = false) {
        if (!element) return;
        element.style.color = "#2e8b57";
        element.style.fontWeight = "700";
        element.style.lineHeight = "1.25";
        element.style.marginTop = share ? "2px" : "10px";
    }

    function renderBrowserIndicator(container, result, before) {
        if (!container) return null;
        const document = container.ownerDocument || root?.document;
        if (!document) return null;

        let indicator = container.querySelector(BROWSER_SELECTOR);
        if (!isPerfectResult(result)) {
            if (indicator) indicator.hidden = true;
            return indicator;
        }

        if (!indicator) {
            indicator = document.createElement("div");
            indicator.dataset.smurdyPerfect = "";
            indicator.setAttribute("role", "status");
            indicator.textContent = "Perfect";
            styleIndicator(indicator);
        }
        indicator.hidden = false;

        if (before && before.parentNode === container) {
            container.insertBefore(indicator, before);
        } else if (indicator.parentNode !== container) {
            container.appendChild(indicator);
        }
        return indicator;
    }

    function renderShareIndicator(section, result) {
        if (!section) return null;
        const document = section.ownerDocument || root?.document;
        if (!document) return null;

        let indicator = section.querySelector(SHARE_SELECTOR);
        if (!isPerfectResult(result)) {
            if (indicator) indicator.hidden = true;
            return indicator;
        }

        if (!indicator) {
            indicator = document.createElement("div");
            indicator.dataset.smurdyPerfectShare = "";
            indicator.textContent = "Perfect";
            styleIndicator(indicator, true);
            const copy = section.querySelector(".smurdy-share-copy");
            if (copy) copy.appendChild(indicator);
            else section.insertBefore(indicator, section.firstChild);
        }
        indicator.hidden = false;
        return indicator;
    }

    function hideIndicators(container) {
        const browser = container?.querySelector?.(BROWSER_SELECTOR);
        if (browser) browser.hidden = true;
        const share = container?.querySelector?.(SHARE_SELECTOR);
        if (share) share.hidden = true;
    }

    function patchCompletion(api) {
        if (!api || api.__smurdyPerfectPatched) return api;
        const originalRenderShare = api.renderShare;
        const originalHideShare = api.hideShare;

        api.renderShare = function renderPerfectShare(container, result, options = {}) {
            const section = originalRenderShare(container, result, options);
            renderBrowserIndicator(container, result, section);
            renderShareIndicator(section, result);
            return section;
        };

        api.hideShare = function hidePerfectShare(container) {
            hideIndicators(container);
            return originalHideShare(container);
        };

        Object.defineProperty(api, "__smurdyPerfectPatched", {
            value: true,
            enumerable: false
        });
        return api;
    }

    function install() {
        if (!root) return;
        if (root.SmurdyQuizCompletion) {
            patchCompletion(root.SmurdyQuizCompletion);
            return;
        }

        let pendingValue;
        try {
            Object.defineProperty(root, "SmurdyQuizCompletion", {
                configurable: true,
                enumerable: true,
                get() { return pendingValue; },
                set(value) {
                    pendingValue = value;
                    delete root.SmurdyQuizCompletion;
                    root.SmurdyQuizCompletion = value;
                    patchCompletion(value);
                }
            });
        } catch (_) {}
    }

    return {
        isPerfectResult,
        renderBrowserIndicator,
        renderShareIndicator,
        hideIndicators,
        patchCompletion,
        install
    };
});
