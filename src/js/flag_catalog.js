(function initFlagCatalog(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SmurdyFlagCatalog = api;
})(typeof self !== "undefined" ? self : globalThis, function createFlagCatalogApi() {
    "use strict";

    function humanize(value) {
        return String(value || "")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function membersForGroup(group) {
        if (Array.isArray(group?.members)) return group.members.slice();
        if (Array.isArray(group?.countries)) return group.countries.slice();
        return [];
    }

    function memberCountForGroup(group) {
        const declared = Number(group?.memberCount || 0);
        if (Number.isFinite(declared) && declared > 0) return declared;
        return membersForGroup(group).length;
    }

    function defaultNotable(group) {
        if (Array.isArray(group?.notable) && group.notable.length) {
            return group.notable.slice(0, 5);
        }
        return membersForGroup(group).slice(0, 5);
    }

    function derivedCountryGroup(groupId, mapGroup, override = {}) {
        const label = override.label || mapGroup?.label || humanize(groupId);
        const memberCount = memberCountForGroup(mapGroup);
        const base = {
            label,
            shortLabel: label,
            family: "countries",
            allowedTypes: ["type"],
            unitName: "country",
            memberCount,
            sourceKind: "country",
            description: `Identify ${memberCount} flags from Smurdy's ${label} country set.`,
            lead: `Type the country represented by each flag in the ${label} set.`,
            overview: `This flag set uses the same ${label} country group as Smurdy's map quizzes, keeping flag and map practice aligned.`,
            challenge: "Neighboring countries and recurring flag patterns can look similar, so small symbols, stripe order, and proportions matter.",
            studyTip: `Learn the ${label} set in smaller clusters, then mix the full group once the designs feel familiar.`,
            notable: defaultNotable(mapGroup)
        };

        const merged = { ...base, ...override };
        merged.label = override.label || label;
        merged.shortLabel = override.shortLabel || merged.label;
        merged.family = "countries";
        merged.allowedTypes = ["type"];
        merged.memberCount = memberCount;
        merged.sourceKind = "country";
        merged.notable = Array.isArray(override.notable)
            ? override.notable.slice()
            : defaultNotable(mapGroup);

        if (groupId === "world") delete merged.sourceGroup;
        else merged.sourceGroup = groupId;

        return merged;
    }

    function expandFlagGroups(flagOverrides = {}, countryGroups = {}) {
        const expanded = {};

        for (const [groupId, mapGroup] of Object.entries(countryGroups || {})) {
            if (
                Array.isArray(mapGroup?.allowedTypes) &&
                mapGroup.allowedTypes.length &&
                !mapGroup.allowedTypes.includes("type")
            ) {
                continue;
            }

            const memberCount = memberCountForGroup(mapGroup);
            if (!memberCount) continue;

            expanded[groupId] = derivedCountryGroup(
                groupId,
                mapGroup,
                flagOverrides?.[groupId] || {}
            );
        }

        for (const [groupId, group] of Object.entries(flagOverrides || {})) {
            if (!expanded[groupId]) expanded[groupId] = { ...group };
        }

        return expanded;
    }

    return Object.freeze({
        humanize,
        membersForGroup,
        memberCountForGroup,
        expandFlagGroups
    });
});
