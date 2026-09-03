"use strict";

const ASSET_VERSION = "20260903-final-unity-1";

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function joinRoot(root, pathname) {
    const base = String(root || "").replace(/\/+$/, "");
    const path = "/" + String(pathname || "").replace(/^\/+/, "");
    return base ? base + path : path;
}

function classNames(...values) {
    return values
        .flatMap(value => String(value || "").split(/\s+/))
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .join(" ");
}

function renderSharedStyles(root = "") {
    return `<link rel="stylesheet" href="${escapeHtml(joinRoot(root, `/styles/quiz_shared.css?v=${ASSET_VERSION}`))}">`;
}

function renderBrand({ root = "", className = "" } = {}) {
    return `<a class="${escapeHtml(classNames("quiz-brand", className))}" href="${escapeHtml(joinRoot(root, "/"))}" aria-label="Smurdy home">
    <img src="${escapeHtml(joinRoot(root, "/assets/images/smurdeye-transparent.png?v=20260825-logo-1"))}" alt=""><span>Smurdy</span>
  </a>`;
}

function renderLandingActions({
    root = "",
    quizId,
    groupId,
    className = "",
    buttonClass = "",
    includeHome = false
} = {}) {
    if (!quizId || !groupId) {
        throw new Error("renderLandingActions requires quizId and groupId");
    }

    const containerClass = classNames("quiz-actions", className);
    const baseButtonClass = classNames("quiz-button", buttonClass);
    const primaryClass = classNames(baseButtonClass, "primary");
    const favoriteClass = classNames(baseButtonClass, "favorite");
    const secondaryClass = classNames(baseButtonClass, "secondary");
    const home = includeHome
        ? `\n      <a class="${escapeHtml(secondaryClass)}" href="${escapeHtml(joinRoot(root, "/"))}">Back to home</a>`
        : "";

    return `<div class="${escapeHtml(containerClass)}" data-smurdy-quiz-actions>
      <button class="${escapeHtml(primaryClass)}" type="button" data-smurdy-quiz-launch>Open quiz</button>
      <button class="${escapeHtml(favoriteClass)}" type="button" data-smurdy-quiz-favorite aria-pressed="false">☆ Add to favorites</button>
      <a class="${escapeHtml(secondaryClass)}" href="${escapeHtml(joinRoot(root, "/quizzes/"))}">Browse all quizzes</a>${home}
    </div>`;
}

function renderFooter({ root = "", className = "" } = {}) {
    const footerClass = classNames("quiz-footer", className);
    const links = [
        ["Home", "/"],
        ["About", "/about/"],
        ["Contact", "/contact/"],
        ["Privacy", "/privacy/"]
    ];
    return `<footer class="${escapeHtml(footerClass)}">Smurdy geography quizzes. ${links
        .map(([label, href]) => `<a href="${escapeHtml(joinRoot(root, href))}">${label}</a>`)
        .join(" | ")}</footer>`;
}

function renderLandingScripts({ root = "" } = {}) {
    const scripts = [
        `/src/js/manifest.js?v=${ASSET_VERSION}`,
        `/src/js/quiz_definitions.js?v=${ASSET_VERSION}`,
        `/src/js/quiz_landing.js?v=${ASSET_VERSION}`
    ];
    return scripts
        .map(src => `<script src="${escapeHtml(joinRoot(root, src))}" defer></script>`)
        .join("\n  ");
}

module.exports = {
    ASSET_VERSION,
    escapeHtml,
    joinRoot,
    classNames,
    renderSharedStyles,
    renderBrand,
    renderLandingActions,
    renderFooter,
    renderLandingScripts
};
