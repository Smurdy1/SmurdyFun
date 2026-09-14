(function initQuizRoutes(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.SmurdyQuizRoutes = api;
})(typeof window !== "undefined" ? window : null, function createQuizRoutesApi() {
    "use strict";

    const LEGACY_ROUTE_DEFINITIONS = Object.freeze({
        "click-country": Object.freeze({ category: "maps", interaction: "click", family: "countries" }),
        "click-subdivision": Object.freeze({ category: "maps", interaction: "click", family: "subdivisions" }),
        "type-country": Object.freeze({ category: "maps", interaction: "type", family: "countries" }),
        "type-subdivision": Object.freeze({ category: "maps", interaction: "type", family: "subdivisions" }),
        "find-country": Object.freeze({ category: "maps", interaction: "find", family: "countries" }),
        "find-subdivision": Object.freeze({ category: "maps", interaction: "find", family: "subdivisions" }),
        "find-point": Object.freeze({ category: "maps", interaction: "find-point", family: "countries" }),
        "find-point-subdivision": Object.freeze({ category: "maps", interaction: "find-point", family: "subdivisions" }),
        "type-capital": Object.freeze({ category: "capitals", interaction: "type", family: null }),
        "locate-capital": Object.freeze({ category: "capitals", interaction: "locate", family: null }),
        "type-flag": Object.freeze({ category: "flags", interaction: "type", family: null }),
        "locate-flag": Object.freeze({ category: "flags", interaction: "locate", family: null })
    });

    const ROUTE_TO_LEGACY = Object.freeze({
        "maps/click/countries": "click-country",
        "maps/click/subdivisions": "click-subdivision",
        "maps/type/countries": "type-country",
        "maps/type/subdivisions": "type-subdivision",
        "maps/find/countries": "find-country",
        "maps/find/subdivisions": "find-subdivision",
        "maps/find-point/countries": "find-point",
        "maps/find-point/subdivisions": "find-point-subdivision",
        "capitals/type/countries": "type-capital",
        "capitals/type/subdivisions": "type-capital",
        "capitals/locate/countries": "locate-capital",
        "capitals/locate/subdivisions": "locate-capital",
        "flags/type/countries": "type-flag",
        "flags/type/subdivisions": "type-flag",
        "flags/locate/countries": "locate-flag",
        "flags/locate/subdivisions": "locate-flag"
    });

    function clean(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function manifestItemFor(quizId, manifest = []) {
        const wanted = clean(quizId);
        return (Array.isArray(manifest) ? manifest : []).find(item => clean(item?.id) === wanted) || null;
    }

    function familyFor(quizId, groupId = "world", manifestItem = null) {
        const id = clean(quizId);
        const group = clean(groupId) || "world";
        const legacy = LEGACY_ROUTE_DEFINITIONS[id];
        if (legacy?.family) return legacy.family;

        const override = String(manifestItem?.groupSetOverrides?.[group] || "").toLowerCase();
        if (override === "subdivision_groups") return "subdivisions";

        const families = Array.isArray(manifestItem?.families)
            ? manifestItem.families.map(clean)
            : [];
        if (families.length === 1 && families[0]) return families[0];

        if (group === "us_states") return "subdivisions";
        return "countries";
    }

    function descriptorFor(quizId, groupId = "world", manifest = []) {
        const id = clean(quizId);
        if (!id) return null;
        const item = manifestItemFor(id, manifest);
        const legacy = LEGACY_ROUTE_DEFINITIONS[id];
        const category = clean(item?.category || legacy?.category || "maps");
        const interaction = clean(item?.interaction || item?.type || legacy?.interaction || "click");
        const family = familyFor(id, groupId, item);
        if (!category || !interaction || !family) return null;
        return Object.freeze({
            quizId: id,
            category,
            interaction,
            family,
            groupId: clean(groupId) || "world"
        });
    }

    function canonicalPath(quizId, groupId = "world", manifest = []) {
        const route = descriptorFor(quizId, groupId, manifest);
        if (!route) return "/quizzes/";
        return `/quizzes/${route.category}/${route.interaction}/${route.family}/${route.groupId}/`;
    }

    function familyPath(quizId, groupId = "world", manifest = []) {
        const route = descriptorFor(quizId, groupId, manifest);
        if (!route) return "/quizzes/";
        return `/quizzes/${route.category}/${route.interaction}/${route.family}/`;
    }

    function interactionPath(quizId, groupId = "world", manifest = []) {
        const route = descriptorFor(quizId, groupId, manifest);
        if (!route) return "/quizzes/";
        return `/quizzes/${route.category}/${route.interaction}/`;
    }

    function categoryPath(quizId, groupId = "world", manifest = []) {
        const route = descriptorFor(quizId, groupId, manifest);
        if (!route) return "/quizzes/";
        return `/quizzes/${route.category}/`;
    }

    function legacyPath(quizId, groupId = "world") {
        return `/quizzes/${clean(quizId)}/${clean(groupId) || "world"}/`;
    }

    function legacyDirectoryPath(quizId) {
        return `/quizzes/${clean(quizId)}/`;
    }

    function resolveQuizId(category, interaction, family, manifest = []) {
        const key = `${clean(category)}/${clean(interaction)}/${clean(family)}`;
        const direct = ROUTE_TO_LEGACY[key];
        if (direct) return direct;

        const candidates = (Array.isArray(manifest) ? manifest : []).filter(item => {
            if (clean(item?.category) !== clean(category)) return false;
            if (clean(item?.interaction || item?.type) !== clean(interaction)) return false;
            const families = Array.isArray(item?.families) ? item.families.map(clean) : [];
            return !families.length || families.includes(clean(family));
        });
        return clean(candidates[0]?.id) || null;
    }

    function parsePath(pathname, manifest = []) {
        const path = String(pathname || "");
        let match = path.match(/^\/quizzes\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?$/i);
        if (match) {
            const category = clean(decodeURIComponent(match[1]));
            const interaction = clean(decodeURIComponent(match[2]));
            const family = clean(decodeURIComponent(match[3]));
            const groupId = clean(decodeURIComponent(match[4])) || "world";
            const quizId = resolveQuizId(category, interaction, family, manifest);
            if (!quizId) return null;
            return { quizId, groupId, category, interaction, family, canonical: true };
        }

        match = path.match(/^\/quizzes\/([^/]+)\/([^/]+)\/?$/i);
        if (match) {
            const quizId = clean(decodeURIComponent(match[1]));
            const groupId = clean(decodeURIComponent(match[2])) || "world";
            if (!LEGACY_ROUTE_DEFINITIONS[quizId] && !manifestItemFor(quizId, manifest)) return null;
            const route = descriptorFor(quizId, groupId, manifest);
            return route ? { ...route, canonical: false } : null;
        }
        return null;
    }

    return Object.freeze({
        LEGACY_ROUTE_DEFINITIONS,
        ROUTE_TO_LEGACY,
        clean,
        familyFor,
        descriptorFor,
        canonicalPath,
        familyPath,
        interactionPath,
        categoryPath,
        legacyPath,
        legacyDirectoryPath,
        resolveQuizId,
        parsePath
    });
});
