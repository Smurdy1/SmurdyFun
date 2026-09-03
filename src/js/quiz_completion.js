(function initQuizCompletion(root, factory) {
    "use strict";

    const api = factory(root);
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.SmurdyQuizCompletion = api;
})(typeof window !== "undefined" ? window : null, function createQuizCompletionApi(root) {
    "use strict";

    const SHARE_STYLE_ID = "smurdy-quiz-completion-style-v1";
    const SHARE_SELECTOR = "[data-smurdy-share]";

    function formatElapsed(milliseconds) {
        const totalSeconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function humanizeSlug(value) {
        return String(value || "")
            .replace(/^manifest:/i, "")
            .replace(/[\-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function modeLabelForQuiz(quizId) {
        const labels = {
            "click-country": "Click Countries",
            "type-country": "Type Countries",
            "find-country": "No Borders",
            "find-point": "Find from a Point",
            "click-subdivision": "Click States",
            "type-subdivision": "Type States",
            "find-subdivision": "No Borders States",
            "find-point-subdivision": "Find State from a Point",
            "type-flag": "Flags",
            "type-flag-subdivision": "State Flags"
        };
        return labels[String(quizId || "")] || humanizeSlug(quizId || "Quiz");
    }

    function absoluteQuizUrl(value) {
        const raw = String(value || "").trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        const path = raw || "/";
        return `https://smurdy.fun${path.startsWith("/") ? path : `/${path}`}`;
    }

    function buildShareText(result) {
        return [
            `I finished ${result.quizLabel} on Smurdy`,
            `${result.accuracyText} accuracy | ${result.timeText} | ${result.progressText} completed`,
            `Can you beat it? ${result.url}`
        ].join("\n");
    }

    function buildResult(options = {}) {
        const session = options.session;
        const total = Math.max(0, Number(options.total) || 0);
        const snapshot = session?.snapshot?.({ total }) || {
            total,
            attempts: 0,
            correctAnswers: 0,
            firstTryCorrect: 0,
            completedCount: 0,
            missCount: 0,
            accuracyPercent: 100,
            elapsedMs: 0
        };
        const misses = Array.isArray(session?.getMisses?.())
            ? session.getMisses().slice()
            : [];
        const quizId = String(options.quizId || "");
        const groupId = String(options.groupId || "world");
        const groupLabel = String(options.groupLabel || humanizeSlug(groupId || "World") || "World");
        const modeLabel = String(options.modeLabel || modeLabelForQuiz(quizId));
        const quizLabel = String(options.quizLabel || `${groupLabel} ${modeLabel}`.trim());
        const itemSingular = String(options.itemSingular || "place");
        const itemPlural = String(options.itemPlural || `${itemSingular}s`);
        const url = absoluteQuizUrl(
            options.url || (quizId && groupId ? `/quizzes/${quizId}/${groupId}/` : "/")
        );

        const result = {
            ...snapshot,
            quizId,
            groupId,
            groupLabel,
            modeLabel,
            quizLabel,
            itemSingular,
            itemPlural,
            misses,
            missedItems: misses.map(item => item.item).filter(item => item !== null && item !== undefined),
            hasMisses: misses.length > 0,
            timeText: formatElapsed(snapshot.elapsedMs),
            accuracyText: `${snapshot.accuracyPercent}%`,
            progressText: `${snapshot.completedCount}/${snapshot.total}`,
            url,
            shareHeadline: String(
                options.shareHeadline || `I finished the ${groupLabel} geography quiz`
            )
        };
        result.shareText = buildShareText(result);
        result.shareTitle = `${quizLabel} result`;
        result.shareFilename = `smurdy-${String(groupId || "quiz")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "quiz"}-result.png`;
        return result;
    }

    function describeMiss(item) {
        const pieces = [];
        const count = Math.max(0, Number(item?.count) || 0);
        pieces.push(`${count} ${count === 1 ? "miss" : "misses"}`);
        const gaveUp = Math.max(0, Number(item?.gaveUp) || 0);
        if (gaveUp) pieces.push(gaveUp === 1 ? "gave up once" : `gave up ${gaveUp} times`);
        const guesses = Array.isArray(item?.guesses) ? item.guesses.filter(Boolean) : [];
        if (guesses.length) pieces.push(`guessed ${guesses.join(", ")}`);
        return pieces.join(", ");
    }

    function retryMissed(result, startRetry, options = {}) {
        const items = Array.isArray(result?.missedItems)
            ? result.missedItems.slice()
            : [];
        if (!items.length || typeof startRetry !== "function") return 0;

        const eventTarget = options.eventTarget || root;
        try {
            if (eventTarget?.dispatchEvent) {
                const EventCtor = eventTarget.CustomEvent || root?.CustomEvent;
                const event = EventCtor
                    ? new EventCtor("smurdy:quizretry", { detail: { count: items.length } })
                    : { type: "smurdy:quizretry", detail: { count: items.length } };
                eventTarget.dispatchEvent(event);
            }
        } catch (_) {}

        startRetry(items, result);
        return items.length;
    }

    function createAnalyticsReporter(options = {}) {
        const session = options.session;
        const getContext = typeof options.context === "function"
            ? options.context
            : () => (options.context || {});
        const getTotal = typeof options.total === "function"
            ? options.total
            : () => Math.max(0, Number(options.total) || 0);
        const isDisabled = typeof options.disabled === "function"
            ? options.disabled
            : () => Boolean(options.disabled);
        const getAnalytics = () => options.analytics || options.root?.SmurdyAnalytics || root?.SmurdyAnalytics;

        function answerPayload(correct) {
            const snapshot = session?.snapshot?.({ total: getTotal() }) || {};
            return {
                ...getContext(),
                correct: Boolean(correct),
                attempts: Math.max(0, Number(snapshot.attempts) || 0),
                correctAnswers: Math.max(0, Number(snapshot.correctAnswers) || 0),
                completedPlaces: Math.max(0, Number(snapshot.completedCount) || 0),
                placesTotal: Math.max(0, Number(snapshot.total) || 0)
            };
        }

        function begin(startReason) {
            if (isDisabled()) return;
            try {
                getAnalytics()?.beginQuiz?.({
                    ...getContext(),
                    places_total: getTotal(),
                    start_reason: startReason
                });
            } catch (_) {}
        }

        function answer(correct) {
            if (isDisabled()) return;
            try { getAnalytics()?.recordAnswer?.(answerPayload(correct)); } catch (_) {}
        }

        function complete(result) {
            if (isDisabled()) return;
            const payload = answerPayload(true);
            const elapsedMs = result?.elapsedMs ?? session?.getElapsedMs?.() ?? 0;
            try {
                getAnalytics()?.completeQuiz?.({
                    ...payload,
                    completionTimeSeconds: Math.round(Math.max(0, Number(elapsedMs) || 0) / 1000)
                });
            } catch (_) {}
        }

        return { begin, answer, complete, answerPayload };
    }

    function renderReview(container, result, options = {}) {
        if (!container) return null;
        const misses = Array.isArray(result?.misses) ? result.misses : [];
        container.replaceChildren();
        container.hidden = misses.length === 0;
        if (!misses.length) return container;

        const document = container.ownerDocument || root?.document;
        if (!document) return container;

        if (options.ariaLabelledBy) {
            container.setAttribute("aria-labelledby", options.ariaLabelledBy);
        }

        const header = document.createElement("div");
        if (options.headerClass) header.className = options.headerClass;
        const titleWrap = document.createElement("div");
        const title = document.createElement(options.titleTag || "strong");
        if (options.titleId) title.id = options.titleId;
        if (options.titleClass) title.className = options.titleClass;
        title.textContent = options.title || "Review your misses";
        titleWrap.appendChild(title);

        const summaryText = typeof options.summary === "function"
            ? options.summary(result)
            : options.summary;
        if (summaryText) {
            const summary = document.createElement("span");
            if (options.summaryClass) summary.className = options.summaryClass;
            summary.textContent = summaryText;
            titleWrap.appendChild(summary);
        }
        header.appendChild(titleWrap);

        if (options.showRetry !== false) {
            const retry = document.createElement("button");
            retry.type = "button";
            retry.textContent = options.retryLabel || "Retry Missed";
            if (options.retryId) retry.id = options.retryId;
            if (options.retryClass) retry.className = options.retryClass;
            retry.addEventListener("click", () => {
                retryMissed(result, options.onRetry, { eventTarget: options.eventTarget || root });
            });
            header.appendChild(retry);
        }
        container.appendChild(header);

        const list = document.createElement(options.listTag || "ol");
        if (options.listClass) list.className = options.listClass;
        misses.forEach((item, index) => {
            const row = document.createElement("li");
            if (typeof options.renderItem === "function") {
                options.renderItem(item, row, document, index);
            } else {
                const name = document.createElement("span");
                name.textContent = item.name;
                row.appendChild(name);
            }
            list.appendChild(row);
        });
        container.appendChild(list);
        return container;
    }

    function renderSummary(container, result, options = {}) {
        if (!container || !result) return null;
        const document = container.ownerDocument || root?.document;
        if (!document) return container;
        container.replaceChildren();
        container.hidden = false;

        const title = document.createElement(options.titleTag || "h2");
        title.textContent = options.title || "Results";
        container.appendChild(title);

        const grid = document.createElement("div");
        if (options.gridClass) grid.className = options.gridClass;
        const stats = Array.isArray(options.stats) ? options.stats : [
            { label: "Correct first try", value: `${result.firstTryCorrect}/${result.total}` },
            { label: "Accuracy", value: result.accuracyText },
            { label: "Time", value: result.timeText }
        ];
        stats.forEach(stat => {
            const card = document.createElement("div");
            const strong = document.createElement("strong");
            strong.textContent = String(stat.value);
            const label = document.createElement("span");
            label.textContent = String(stat.label);
            card.append(strong, label);
            grid.appendChild(card);
        });
        container.appendChild(grid);
        return container;
    }

    function injectShareStyles(document) {
        if (!document || document.getElementById(SHARE_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = SHARE_STYLE_ID;
        style.textContent = `
            [data-smurdy-share] {
                width: 100%;
                margin-top: 18px;
                padding-top: 16px;
                border-top: 1px solid rgba(0,0,0,.12);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }
            [data-smurdy-share] .smurdy-share-copy {
                display: flex;
                min-width: 0;
                flex-direction: column;
                gap: 2px;
                text-align: left;
            }
            [data-smurdy-share] .smurdy-share-title { font-weight: 800; line-height: 1.2; }
            [data-smurdy-share] .smurdy-share-subtitle {
                color: rgba(0,0,0,.62);
                font-size: .92rem;
                line-height: 1.35;
            }
            [data-smurdy-share] .smurdy-share-button {
                flex: 0 0 auto;
                padding: 11px 16px;
                border: 0;
                border-radius: 10px;
                background: #111;
                color: #fff;
                font: inherit;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,.18);
                transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
            }
            [data-smurdy-share] .smurdy-share-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(0,0,0,.22);
            }
            [data-smurdy-share] .smurdy-share-button:focus-visible {
                outline: 3px solid rgba(0,119,204,.28);
                outline-offset: 2px;
            }
            [data-smurdy-share] .smurdy-share-button:disabled {
                cursor: default;
                opacity: .7;
                transform: none;
            }
            @media (max-width: 700px) {
                [data-smurdy-share] { align-items: stretch; flex-direction: column; }
                [data-smurdy-share] .smurdy-share-button { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    function renderShare(container, result, options = {}) {
        if (!container || !result) return null;
        const document = container.ownerDocument || root?.document;
        if (!document) return null;
        injectShareStyles(document);

        let section = container.querySelector(SHARE_SELECTOR);
        if (!section) {
            section = document.createElement("section");
            section.dataset.smurdyShare = "";
            section.setAttribute("aria-label", "Share quiz result");

            const copy = document.createElement("div");
            copy.className = "smurdy-share-copy";
            const title = document.createElement("div");
            title.className = "smurdy-share-title";
            title.textContent = "Challenge a friend";
            const subtitle = document.createElement("div");
            subtitle.className = "smurdy-share-subtitle";
            subtitle.textContent = "Share your result and see if they can beat it.";
            copy.append(title, subtitle);

            const button = document.createElement("button");
            button.className = "smurdy-share-button";
            button.type = "button";
            button.textContent = "Share result";
            button.setAttribute("aria-label", "Share your quiz result as an image");
            button.addEventListener("click", () => shareResult(section._smurdyResult, button));
            section.append(copy, button);
        }

        section._smurdyResult = result;
        section.hidden = false;
        if (options.before && options.before.parentNode === container) {
            container.insertBefore(section, options.before);
        } else if (section.parentNode !== container) {
            container.appendChild(section);
        } else if (!section.parentNode) {
            container.appendChild(section);
        }
        return section;
    }

    function hideShare(container) {
        const section = container?.querySelector?.(SHARE_SELECTOR);
        if (!section) return;
        section.hidden = true;
        const button = section.querySelector(".smurdy-share-button");
        if (button) {
            button.disabled = false;
            button.textContent = "Share result";
        }
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Could not load image: ${source}`));
            image.src = source;
        });
    }

    async function loadExistingSmurdyLogo(document) {
        const existing = document.querySelector('img[src*="smurdeye" i]');
        const sources = [
            existing && (existing.currentSrc || existing.src),
            "/assets/images/smurdeye-transparent.png?v=20260825-logo-1",
            "/assets/images/apple-touch-icon.png?v=20260825-logo-1"
        ].filter(Boolean);
        for (const source of [...new Set(sources)]) {
            try { return await loadImage(source); } catch (_) {}
        }
        return null;
    }

    function drawContainedImage(ctx, image, x, y, width, height) {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function drawStatCard(ctx, x, y, width, label, value) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,.075)";
        roundRect(ctx, x, y, width, 136, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.10)";
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, width, 136, 20);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.font = "650 25px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText(label, x + 24, y + 40);
        ctx.fillStyle = "#fff";
        ctx.font = "850 44px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText(value, x + 24, y + 94);
        ctx.restore();
    }

    function splitTextIntoLines(ctx, text, maxWidth, maxLines) {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        const lines = [];
        let line = "";
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
            else { lines.push(line); line = word; }
        }
        if (line) lines.push(line);
        if (lines.length <= maxLines) return lines;
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.…]+$/, "")}…`;
        return kept;
    }

    function drawAdaptiveHeadline(ctx, text, x, top, maxWidth) {
        let fontSize = 50;
        let lines = [];
        while (fontSize >= 38) {
            ctx.font = `850 ${fontSize}px system-ui, -apple-system, Segoe UI, Arial`;
            lines = splitTextIntoLines(ctx, text, maxWidth, 2);
            if (lines.length <= 2 && !lines[lines.length - 1]?.endsWith("…")) break;
            fontSize -= 2;
        }
        const lineHeight = fontSize + 8;
        lines.forEach((line, index) => ctx.fillText(line, x, top + index * lineHeight));
        return top + (lines.length - 1) * lineHeight;
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas export failed.")), "image/png");
        });
    }

    async function buildShareImageBlob(result) {
        const document = root?.document;
        if (!document) throw new Error("Share images require a browser document.");
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create the share image canvas.");

        const background = ctx.createLinearGradient(0, 0, 1200, 630);
        background.addColorStop(0, "#0d0d0d");
        background.addColorStop(.58, "#171717");
        background.addColorStop(1, "#222");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, 1200, 630);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,.025)";
        for (let x = 0; x <= 1200; x += 86) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke();
        }
        for (let y = 0; y <= 630; y += 86) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,.055)";
        roundRect(ctx, 44, 44, 1112, 542, 28);
        ctx.fill();

        const logo = await loadExistingSmurdyLogo(document);
        if (logo) {
            ctx.fillStyle = "rgba(255,255,255,.96)";
            roundRect(ctx, 82, 78, 86, 70, 13);
            ctx.fill();
            drawContainedImage(ctx, logo, 91, 85, 68, 56);
        }
        ctx.fillStyle = "#fff";
        ctx.font = "850 34px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText("Smurdy", logo ? 194 : 88, 111);
        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.font = "650 22px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText("Geography quiz result", logo ? 194 : 88, 143);

        ctx.fillStyle = "#fff";
        const headlineBottom = drawAdaptiveHeadline(ctx, result.shareHeadline, 88, 225, 1024);
        ctx.fillStyle = "rgba(255,255,255,.82)";
        ctx.font = "750 28px system-ui, -apple-system, Segoe UI, Arial";
        ctx.fillText(result.modeLabel, 90, Math.max(322, headlineBottom + 52));

        const cardY = 365;
        drawStatCard(ctx, 88, cardY, 306, "Time", result.timeText);
        drawStatCard(ctx, 420, cardY, 306, "Accuracy", result.accuracyText);
        drawStatCard(ctx, 752, cardY, 306, "Completed", result.progressText);
        ctx.fillStyle = "#fff";
        ctx.font = "850 28px system-ui, -apple-system, Segoe UI, Arial";
        ctx.textAlign = "left";
        ctx.fillText("Can you beat this?", 88, 558);
        ctx.fillStyle = "rgba(255,255,255,.72)";
        ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Arial";
        ctx.textAlign = "right";
        ctx.fillText("Play at smurdy.fun", 1110, 558);
        ctx.textAlign = "left";
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
            } catch (_) { return false; }
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

    async function shareResult(result, button) {
        if (!result || !button || button.disabled) return;
        const originalText = "Share result";
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
            const blob = await buildShareImageBlob(result);
            const file = new File([blob], result.shareFilename, { type: "image/png" });
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
            console.warn("Smurdy share result failed:", error);
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    return {
        formatElapsed,
        humanizeSlug,
        modeLabelForQuiz,
        buildShareText,
        buildResult,
        describeMiss,
        retryMissed,
        createAnalyticsReporter,
        renderReview,
        renderSummary,
        renderShare,
        hideShare,
        buildShareImageBlob,
        shareResult
    };
});
