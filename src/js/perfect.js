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
    const PERFECT_COLOR = "#2e8b57";
    let originalBuildShareImageBlob = null;
    let originalShareResult = null;

    function isPerfectResult(result) {
        if (!result) return false;
        const total = Math.max(0, Number(result.total) || 0);
        const completed = Math.max(0, Number(result.completedCount) || 0);
        return total > 0 && completed === total && Number(result.accuracyPercent) === 100 && result.hasMisses !== true;
    }

    function styleIndicator(element) {
        element.style.color = PERFECT_COLOR;
        element.style.fontWeight = "700";
        element.style.lineHeight = "1.25";
        element.style.marginTop = "10px";
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

        if (before && before.parentNode === container) container.insertBefore(indicator, before);
        else if (indicator.parentNode !== container) container.appendChild(indicator);
        return indicator;
    }

    function hideIndicator(container) {
        const indicator = container?.querySelector?.(BROWSER_SELECTOR);
        if (indicator) indicator.hidden = true;
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas export failed.")), "image/png");
        });
    }

    function imageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            if (!root?.URL || !root?.Image) {
                reject(new Error("Share image tools are unavailable."));
                return;
            }
            const url = root.URL.createObjectURL(blob);
            const image = new root.Image();
            image.onload = () => {
                root.URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                root.URL.revokeObjectURL(url);
                reject(new Error("Could not read the share image."));
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
        ctx.fillStyle = PERFECT_COLOR;
        ctx.font = "700 28px Arial, Helvetica, sans-serif";
        ctx.fillText("Perfect", 72, 525);
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

    async function sharePerfectResult(result, button, api) {
        if (!result || !button || button.disabled) return;
        if (!isPerfectResult(result)) {
            return originalShareResult?.(result, button);
        }

        const originalText = "Share result";
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
            const blob = await api.buildShareImageBlob(result);
            const FileCtor = root?.File || File;
            const file = new FileCtor([blob], result.shareFilename, { type: "image/png" });
            const navigator = root?.navigator;

            if (
                typeof navigator?.share === "function" &&
                typeof navigator?.canShare === "function" &&
                navigator.canShare({ files: [file] })
            ) {
                button.textContent = "Sharing...";
                try {
                    await navigator.share({ files: [file], text: result.shareText, title: result.shareTitle });
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
                const copied = await writeSharePayloadToClipboard(blob, result.shareText);
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

    function bindShareButton(section, api) {
        if (!section) return;
        let button = section.querySelector(".smurdy-share-button");
        if (!button || button.dataset.smurdyPerfectImageBound === "true") return;

        const replacement = button.cloneNode(true);
        replacement.dataset.smurdyPerfectImageBound = "true";
        button.replaceWith(replacement);
        button = replacement;
        button.addEventListener("click", () => sharePerfectResult(section._smurdyResult, button, api));
    }

    function patchCompletion(api) {
        if (!api || api.__smurdyPerfectPatched) return api;
        const originalRenderShare = api.renderShare;
        const originalHideShare = api.hideShare;
        originalBuildShareImageBlob = api.buildShareImageBlob;
        originalShareResult = api.shareResult;

        api.buildShareImageBlob = async function buildPerfectShareImageBlob(result) {
            const blob = await originalBuildShareImageBlob(result);
            return addPerfectToShareImage(blob, result);
        };

        api.renderShare = function renderPerfectShare(container, result, options = {}) {
            const section = originalRenderShare(container, result, options);
            renderBrowserIndicator(container, result, section);
            bindShareButton(section, api);
            return section;
        };

        api.hideShare = function hidePerfectShare(container) {
            hideIndicator(container);
            return originalHideShare(container);
        };

        api.shareResult = function sharePerfect(result, button) {
            return sharePerfectResult(result, button, api);
        };

        Object.defineProperty(api, "__smurdyPerfectPatched", { value: true, enumerable: false });
        return api;
    }

    function install() {
        if (!root) return;
        if (root.SmurdyQuizCompletion) return patchCompletion(root.SmurdyQuizCompletion);

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
        hideIndicator,
        addPerfectToShareImage,
        patchCompletion,
        install
    };
});
