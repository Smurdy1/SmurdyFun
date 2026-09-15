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
    const INDICATOR_SELECTOR = "[data-smurdy-perfect]";
    const RELEASE_VERSION = "1.15.1";
    let patchedApi = null;
    let originalApi = null;

    function isPerfectResult(result) {
        if (!result) return false;
        const total = Math.max(0, Number(result.total) || 0);
        const completed = Math.max(0, Number(result.completedCount) || 0);
        const accuracy = Number(result.accuracyPercent);
        const firstTry = Math.max(0, Number(result.firstTryCorrect) || 0);
        return total > 0 && completed === total && accuracy === 100 && firstTry === total;
    }

    function decorateShareText(result) {
        const text = String(result?.shareText || "");
        if (!isPerfectResult(result) || !text || /^Perfect\b/m.test(text)) return text;
        const lines = text.split("\n");
        if (lines.length >= 2) lines.splice(1, 0, "Perfect");
        else lines.push("Perfect");
        return lines.join("\n");
    }

    function injectStyles(document) {
        if (!document || document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .smurdy-perfect-indicator {
                margin: 12px 0 0;
                color: #2E8B57;
                font: inherit;
                font-weight: 700;
                line-height: 1.25;
            }
            html[data-smurdy-theme="dark"] .smurdy-perfect-indicator {
                color: #65c982;
            }
        `;
        document.head.appendChild(style);
    }

    function renderIndicator(container, result, before) {
        if (!container) return null;
        const document = container.ownerDocument || root?.document;
        if (!document) return null;
        injectStyles(document);

        let indicator = container.querySelector(INDICATOR_SELECTOR);
        const perfect = isPerfectResult(result);
        if (!perfect) {
            if (indicator) indicator.hidden = true;
            return indicator;
        }

        if (!indicator) {
            indicator = document.createElement("div");
            indicator.dataset.smurdyPerfect = "";
            indicator.className = "smurdy-perfect-indicator";
            indicator.setAttribute("role", "status");
        }
        indicator.textContent = String(result?.perfectText || "Perfect");
        indicator.hidden = false;

        if (before && before.parentNode === container) {
            container.insertBefore(indicator, before);
        } else if (indicator.parentNode !== container) {
            container.appendChild(indicator);
        }
        return indicator;
    }

    function hideIndicator(container) {
        const indicator = container?.querySelector?.(INDICATOR_SELECTOR);
        if (indicator) indicator.hidden = true;
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas export failed.")), "image/png");
        });
    }

    function imageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const url = root.URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => {
                root.URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                root.URL.revokeObjectURL(url);
                reject(new Error("Could not read share image."));
            };
            image.src = url;
        });
    }

    async function addPerfectToShareImage(blob, result) {
        if (!isPerfectResult(result) || !root?.document) return blob;
        const image = await imageFromBlob(blob);
        const canvas = root.document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return blob;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#2E8B57";
        ctx.font = "700 28px Arial, Helvetica, sans-serif";
        ctx.fillText(String(result?.perfectText || "Perfect"), 72, 522);
        return canvasToBlob(canvas);
    }

    async function writeSharePayloadToClipboard(blob, text) {
        const navigator = root?.navigator;
        if (!navigator?.clipboard || !root?.ClipboardItem) return false;
        try {
            await navigator.clipboard.write([new root.ClipboardItem({
                "image/png": blob,
                "text/plain": new Blob([text], { type: "text/plain" })
            })]);
            return true;
        } catch (_) {
            try {
                await navigator.clipboard.write([new root.ClipboardItem({ "image/png": blob })]);
                return true;
            } catch (_) {
                return false;
            }
        }
    }

    function downloadBlob(blob, filename) {
        const document = root?.document;
        if (!document || !root?.URL) return;
        const url = root.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        root.setTimeout(() => root.URL.revokeObjectURL(url), 1500);
    }

    async function sharePerfectResult(result, button) {
        if (!result || !button || button.disabled || !originalApi) return;
        if (!isPerfectResult(result)) {
            return originalApi.shareResult(result, button);
        }

        const originalText = "Share result";
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
            const baseBlob = await originalApi.buildShareImageBlob(result);
            const blob = await addPerfectToShareImage(baseBlob, result);
            const file = new File([blob], result.shareFilename, { type: "image/png" });
            const navigator = root?.navigator;
            const shareText = decorateShareText(result);

            if (
                typeof navigator?.share === "function" &&
                typeof navigator?.canShare === "function" &&
                navigator.canShare({ files: [file] })
            ) {
                button.textContent = "Sharing...";
                try {
                    await navigator.share({ files: [file], text: shareText, title: result.shareTitle });
                    button.textContent = "Shared";
                } catch (error) {
                    if (error?.name === "AbortError") {
                        button.disabled = false;
                        button.textContent = originalText;
                        return;
                    }
                    throw error;
                }
            } else {
                button.textContent = "Copying...";
                const copied = await writeSharePayloadToClipboard(blob, shareText);
                if (copied) button.textContent = "Copied image";
                else {
                    downloadBlob(blob, result.shareFilename);
                    button.textContent = "Downloaded";
                }
            }

            root?.setTimeout?.(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 1400);
        } catch (error) {
            console.warn("Smurdy perfect share result failed:", error);
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    function patchCompletion(api) {
        if (!api || api.__smurdyPerfectPatched) return api;
        originalApi = {
            buildResult: api.buildResult,
            renderShare: api.renderShare,
            hideShare: api.hideShare,
            buildShareImageBlob: api.buildShareImageBlob,
            shareResult: api.shareResult
        };

        api.buildResult = function buildPerfectResult(options = {}) {
            const result = originalApi.buildResult(options);
            result.isPerfect = isPerfectResult(result);
            result.perfectText = result.isPerfect ? "Perfect" : "";
            if (result.isPerfect) result.shareText = decorateShareText(result);
            return result;
        };

        api.renderShare = function renderPerfectShare(container, result, options = {}) {
            const section = originalApi.renderShare(container, result, options);
            renderIndicator(container, result, section);
            if (!section) return section;

            let button = section.querySelector(".smurdy-share-button");
            if (button && button.dataset.smurdyPerfectBound !== "true") {
                const replacement = button.cloneNode(true);
                replacement.dataset.smurdyPerfectBound = "true";
                button.replaceWith(replacement);
                button = replacement;
                button.addEventListener("click", () => {
                    sharePerfectResult(section._smurdyResult, button);
                });
            }
            return section;
        };

        api.hideShare = function hidePerfectShare(container) {
            hideIndicator(container);
            return originalApi.hideShare(container);
        };

        api.buildShareImageBlob = async function buildPerfectShareImageBlob(result) {
            const blob = await originalApi.buildShareImageBlob(result);
            return addPerfectToShareImage(blob, result);
        };

        api.shareResult = sharePerfectResult;
        Object.defineProperty(api, "__smurdyPerfectPatched", {
            value: true,
            configurable: false,
            enumerable: false
        });
        patchedApi = api;
        return api;
    }

    function syncVersionBadge() {
        const badge = root?.document?.getElementById("app-version");
        if (badge) badge.textContent = "v" + RELEASE_VERSION;
        return Boolean(badge);
    }

    function installVersionSync() {
        if (!root?.document) return;
        if (syncVersionBadge()) return;
        const observer = new MutationObserver(() => {
            if (syncVersionBadge()) observer.disconnect();
        });
        observer.observe(root.document.documentElement, { childList: true, subtree: true });
        root.setTimeout(() => observer.disconnect(), 10000);
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
        installVersionSync();
    }

    return {
        RELEASE_VERSION,
        isPerfectResult,
        decorateShareText,
        renderIndicator,
        hideIndicator,
        addPerfectToShareImage,
        patchCompletion,
        install,
        get patchedApi() { return patchedApi; }
    };
});
