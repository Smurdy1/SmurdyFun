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

    const STYLE_ID = "smurdy-perfect-style-v1";
    const BROWSER_SELECTOR = "[data-smurdy-perfect]";
    const SHARE_SELECTOR = "[data-smurdy-perfect-share]";
    let originalBuildResult = null;
    let originalRenderShare = null;
    let originalHideShare = null;

    function isPerfectResult(result) {
        if (!result) return false;
        const total = Math.max(0, Number(result.total) || 0);
        const completed = Math.max(0, Number(result.completedCount) || 0);
        const accuracy = Number(result.accuracyPercent);
        const firstTry = Math.max(0, Number(result.firstTryCorrect) || 0);
        return total > 0 && completed === total && accuracy === 100 && firstTry === total;
    }

    function injectStyles(document) {
        if (!document || document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .smurdy-perfect-indicator,
            .smurdy-share-perfect {
                color: #2e8b57;
                font: inherit;
                font-weight: 700;
                line-height: 1.25;
            }
            .smurdy-perfect-indicator {
                margin: 10px 0 0;
            }
            .smurdy-share-perfect {
                margin-top: 2px;
            }
            html[data-smurdy-theme="dark"] .smurdy-perfect-indicator,
            html[data-smurdy-theme="dark"] .smurdy-share-perfect {
                color: #65c982;
            }
        `;
        document.head.appendChild(style);
    }

    function renderBrowserIndicator(container, result, before) {
        if (!container) return null;
        const document = container.ownerDocument || root?.document;
        if (!document) return null;
        injectStyles(document);

        let indicator = container.querySelector(BROWSER_SELECTOR);
        if (!isPerfectResult(result)) {
            if (indicator) indicator.hidden = true;
            return indicator;
        }

        if (!indicator) {
            indicator = document.createElement("div");
            indicator.dataset.smurdyPerfect = "";
            indicator.className = "smurdy-perfect-indicator";
            indicator.setAttribute("role", "status");
            indicator.textContent = "Perfect";
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
        injectStyles(document);

        let indicator = section.querySelector(SHARE_SELECTOR);
        if (!isPerfectResult(result)) {
            if (indicator) indicator.hidden = true;
            return indicator;
        }

        if (!indicator) {
            indicator = document.createElement("div");
            indicator.dataset.smurdyPerfectShare = "";
            indicator.className = "smurdy-share-perfect";
            indicator.textContent = "Perfect";
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

        originalBuildResult = api.buildResult;
        originalRenderShare = api.renderShare;
        originalHideShare = api.hideShare;

        api.buildResult = function buildPerfectResult(options = {}) {
            const result = originalBuildResult(options);
            result.isPerfect = isPerfectResult(result);
            result.perfectText = result.isPerfect ? "Perfect" : "";
            return result;
        };

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
            configurable: false,
            enumerable: false
        });
        return api;
    }

    function installCompletionHook() {
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
        } catch (_) {
            const timer = root.setInterval(() => {
                if (!root.SmurdyQuizCompletion) return;
                root.clearInterval(timer);
                patchCompletion(root.SmurdyQuizCompletion);
            }, 100);
            root.setTimeout(() => root.clearInterval(timer), 10000);
        }
    }

    function install() {
        installCompletionHook();
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
