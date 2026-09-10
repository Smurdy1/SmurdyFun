(() => {
    "use strict";

    const SITE_ORIGIN = "https://smurdy.fun";
    const SHARE_ASSET_VERSION = "20260910-sharing-1";
    const MODE_LABELS = {
        "click-country": "Click the Countries",
        "type-country": "Type the Countries",
        "find-country": "Find the Countries without Borders",
        "find-point": "Find the Country from a Point",
        "click-subdivision": "Click the States",
        "type-subdivision": "Type the States",
        "find-subdivision": "Find the States without Borders",
        "find-point-subdivision": "Find the State from a Point",
        "type-flag": "Type the Flags",
        "type-capital": "Type the Capitals"
    };
    const GROUP_LABELS = {
        world: "World",
        us_states: "US States",
        north_america: "North America",
        south_america: "South America",
        central_america: "Central America",
        central_america_caribbean: "Central America and the Caribbean",
        caribbean_islands: "Caribbean Islands",
        middle_east: "Middle East",
        mena: "Middle East and North Africa",
        southeast_asia: "Southeast Asia",
        eastern_europe: "Eastern Europe",
        western_europe: "Western Europe",
        west_africa: "West Africa",
        east_africa: "East Africa",
        southern_africa: "Southern Africa",
        central_asia: "Central Asia",
        south_asia: "South Asia",
        east_asia: "East Asia",
        latin_america: "Latin America",
        eu: "European Union",
        tiny_countries: "Tiny Countries",
        spanish_speaking: "Spanish-speaking Countries"
    };

    function humanize(value) {
        const raw = String(value || "").trim();
        if (GROUP_LABELS[raw]) return GROUP_LABELS[raw];
        return raw
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function routeContext(pathname = location.pathname) {
        const match = String(pathname || "").match(/^\/quizzes\/([^/]+)\/([^/]+)\/?$/i);
        if (!match) return null;
        const quizId = decodeURIComponent(match[1]);
        const groupId = decodeURIComponent(match[2]);
        const modeLabel = MODE_LABELS[quizId] || humanize(quizId);
        const groupLabel = GROUP_LABELS[groupId] || humanize(groupId);
        return {
            quizId,
            groupId,
            modeLabel,
            groupLabel,
            title: `${groupLabel}: ${modeLabel} | Smurdy`,
            description: `Try the ${groupLabel} ${modeLabel.toLowerCase()} quiz on Smurdy.`,
            url: `${SITE_ORIGIN}/quizzes/${encodeURIComponent(quizId)}/${encodeURIComponent(groupId)}/`,
            image: `${SITE_ORIGIN}/assets/social/quizzes/${encodeURIComponent(quizId)}/${encodeURIComponent(groupId)}.png?v=${SHARE_ASSET_VERSION}`,
            imageAlt: `${groupLabel} ${modeLabel} quiz on Smurdy`,
            isQuiz: true
        };
    }

    function metaContent(documentNode, selector) {
        return documentNode?.querySelector?.(selector)?.getAttribute("content")?.trim() || "";
    }

    function documentContext(documentNode = document) {
        const canonical = documentNode.querySelector('link[rel="canonical"]')?.href || "";
        const title = metaContent(documentNode, 'meta[property="og:title"]') || documentNode.title || "Smurdy";
        const description = metaContent(documentNode, 'meta[property="og:description"]') ||
            metaContent(documentNode, 'meta[name="description"]') ||
            "Free geography quizzes on Smurdy.";
        const image = metaContent(documentNode, 'meta[property="og:image"]') || `${SITE_ORIGIN}/assets/social/smurdy.png?v=${SHARE_ASSET_VERSION}`;
        const imageAlt = metaContent(documentNode, 'meta[property="og:image:alt"]') || "Smurdy geography quizzes";
        return {
            title,
            description,
            url: canonical || `${SITE_ORIGIN}${location.pathname}`,
            image,
            imageAlt,
            isQuiz: false
        };
    }

    function sameCanonicalRoute(url, pathname) {
        try {
            const canonicalPath = new URL(url, SITE_ORIGIN).pathname.replace(/\/+$/, "") || "/";
            const currentPath = String(pathname || "/").replace(/\/+$/, "") || "/";
            return canonicalPath === currentPath;
        } catch (_) {
            return false;
        }
    }

    async function resolveContext() {
        const route = routeContext();
        const current = documentContext(document);
        if (!route) return current;

        if (sameCanonicalRoute(current.url, location.pathname)) {
            return {
                ...route,
                title: current.title || route.title,
                description: current.description || route.description,
                image: current.image || route.image,
                imageAlt: current.imageAlt || route.imageAlt
            };
        }

        try {
            const response = await fetch(location.pathname, {
                credentials: "same-origin",
                cache: "force-cache"
            });
            if (response.ok) {
                const html = await response.text();
                const parsed = new DOMParser().parseFromString(html, "text/html");
                const fetched = documentContext(parsed);
                return {
                    ...route,
                    title: fetched.title || route.title,
                    description: fetched.description || route.description,
                    image: fetched.image || route.image,
                    imageAlt: fetched.imageAlt || route.imageAlt
                };
            }
        } catch (_) {}
        return route;
    }

    function invitationFor(context) {
        if (context.isQuiz) {
            return `Try the ${context.groupLabel} ${context.modeLabel.toLowerCase()} quiz on Smurdy.`;
        }
        if (location.pathname === "/quizzes/" || location.pathname.startsWith("/quizzes/")) {
            return "Browse free geography quizzes on Smurdy.";
        }
        return "Check out Smurdy, a free geography quiz site.";
    }

    async function copyText(text) {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (_) {}

        try {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand("copy");
            textarea.remove();
            return copied;
        } catch (_) {
            return false;
        }
    }

    function openExternal(url) {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (opened) opened.opener = null;
    }

    function setStatus(dialog, text) {
        const status = dialog.querySelector("[data-smurdy-page-share-status]");
        if (!status) return;
        status.textContent = text;
        if (text) window.setTimeout(() => {
            if (status.textContent === text) status.textContent = "";
        }, 1800);
    }

    function closeDialog(dialog) {
        if (typeof dialog.close === "function" && dialog.open) dialog.close();
        else dialog.hidden = true;
        document.documentElement.classList.remove("smurdy-page-share-open");
    }

    function createDialog() {
        const dialog = document.createElement("dialog");
        dialog.className = "smurdy-page-share-dialog";
        dialog.setAttribute("aria-labelledby", "smurdy-page-share-title");
        dialog.innerHTML = `
            <div class="smurdy-page-share-panel">
                <header>
                    <h2 id="smurdy-page-share-title">Share</h2>
                    <button type="button" class="smurdy-page-share-close">Close</button>
                </header>
                <div class="smurdy-page-share-preview">
                    <img data-smurdy-page-share-image alt="" loading="eager">
                    <strong data-smurdy-page-share-preview-title></strong>
                    <p data-smurdy-page-share-preview-copy></p>
                </div>
                <div class="smurdy-page-share-actions">
                    <button type="button" data-share-action="native">Share...</button>
                    <button type="button" data-share-action="copy">Copy link</button>
                    <button type="button" data-share-action="x">X</button>
                    <button type="button" data-share-action="facebook">Facebook</button>
                    <button type="button" data-share-action="reddit">Reddit</button>
                    <button type="button" data-share-action="email">Email</button>
                </div>
                <p class="smurdy-page-share-status" data-smurdy-page-share-status aria-live="polite"></p>
            </div>`;

        dialog.querySelector(".smurdy-page-share-close").addEventListener("click", () => closeDialog(dialog));
        dialog.addEventListener("cancel", () => document.documentElement.classList.remove("smurdy-page-share-open"));
        dialog.addEventListener("click", event => {
            if (event.target === dialog) closeDialog(dialog);
        });

        dialog.querySelector("[data-share-action='native']").hidden = typeof navigator.share !== "function";
        dialog.addEventListener("click", async event => {
            const button = event.target.closest?.("[data-share-action]");
            if (!button) return;
            const context = dialog._smurdyShareContext;
            if (!context) return;
            const invitation = invitationFor(context);
            const action = button.dataset.shareAction;
            const encodedUrl = encodeURIComponent(context.url);
            const encodedTitle = encodeURIComponent(context.title);
            const encodedText = encodeURIComponent(invitation);

            if (action === "native") {
                try {
                    await navigator.share({ title: context.title, text: invitation, url: context.url });
                } catch (error) {
                    if (error?.name !== "AbortError") setStatus(dialog, "Could not open sharing.");
                }
                return;
            }
            if (action === "copy") {
                const copied = await copyText(context.url);
                setStatus(dialog, copied ? "Link copied" : "Could not copy link");
                return;
            }
            if (action === "x") {
                openExternal(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
                return;
            }
            if (action === "facebook") {
                openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
                return;
            }
            if (action === "reddit") {
                openExternal(`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`);
                return;
            }
            if (action === "email") {
                location.href = `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${invitation}\n\n${context.url}`)}`;
            }
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    async function openShareDialog(dialog, trigger) {
        trigger.disabled = true;
        const context = await resolveContext();
        trigger.disabled = false;
        dialog._smurdyShareContext = context;

        const image = dialog.querySelector("[data-smurdy-page-share-image]");
        image.src = context.image;
        image.alt = context.imageAlt;
        dialog.querySelector("[data-smurdy-page-share-preview-title]").textContent = context.title.replace(/\s*\|\s*Smurdy\s*$/i, "");
        dialog.querySelector("[data-smurdy-page-share-preview-copy]").textContent = invitationFor(context);
        setStatus(dialog, "");

        document.documentElement.classList.add("smurdy-page-share-open");
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.hidden = false;
        }
    }

    function install() {
        if (!document.body || document.querySelector("[data-smurdy-page-share-trigger]")) return;
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "smurdy-page-share-trigger";
        trigger.dataset.smurdyPageShareTrigger = "";
        trigger.textContent = "Share";
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-label", "Share this page");
        document.body.appendChild(trigger);

        let dialog = null;
        trigger.addEventListener("click", () => {
            if (!dialog) dialog = createDialog();
            void openShareDialog(dialog, trigger);
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
})();
