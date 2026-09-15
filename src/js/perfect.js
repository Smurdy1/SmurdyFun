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
    const WRAP_SELECTOR = "[data-smurdy-perfect-wrap]";
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
    }

    function findCompletionStatus(container) {
        if (!container?.querySelector) return null;
        return container.querySelector(".flag-result.is-finished") || container.querySelector("#quiz-target");
    }

    function removeLegacyIndicator(container) {
        const legacy = container?.querySelector?.(`${BROWSER_SELECTOR}:not(${WRAP_SELECTOR} ${BROWSER_SELECTOR})`);
        if (legacy) legacy.remove();
    }

    function renderBrowserIndicator(container, result) {
        if (!container) return null;
        const document = container.ownerDocument || root?.document;
        if (!document) return null;

        removeLegacyIndicator(container);
        let wrap = container.querySelector(WRAP_SELECTOR);

        if (!isPerfectResult(result)) {
            if (wrap) wrap.remove();
            return null;
        }

        const status = findCompletionStatus(container);
        if (!status) {
            if (wrap) wrap.remove();
            return null;
        }

        if (wrap && wrap.parentNode !== status) {
            wrap.remove();
            wrap = null;
        }

        if (!wrap) {
            wrap = document.createElement("span");
            wrap.dataset.smurdyPerfectWrap = "";

            const separator = document.createElement("span");
            separator.setAttribute("aria-hidden", "true");
            separator.textContent = " · ";

            const indicator = document.createElement("span");
            indicator.dataset.smurdyPerfect = "";
            indicator.textContent = "Perfect";
            styleIndicator(indicator);

            wrap.append(separator, indicator);
            status.appendChild(wrap);
        }

        return wrap.querySelector(BROWSER_SELECTOR);
    }

    function hideIndicator(container) {
        const wrap = container?.querySelector?.(WRAP_SELECTOR);
        if (wrap) wrap.remove();
        removeLegacyIndicator(container);
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

        // Keep Perfect attached to the result identity instead of floating as a separate section.
        ctx.font = "600 25px Arial, Helvetica, sans-serif";
        const modeWidth = ctx.measureText(String(result.modeLabel || "")).width;
        const separatorX = 72 + modeWidth + 12;
        ctx.fillStyle = "#555";
        ctx.fillText("·", separatorX, 310);
        ctx.fillStyle = PERFECT_COLOR;
        ctx.font = "700 25px Arial, Helvetica, sans-serif";
        ctx.fillText("Perfect", separatorX + 20, 310);
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
            renderBrowserIndicator(container, result);
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
