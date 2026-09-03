(function initQuizDefinitions(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (!root) return;

    root.SmurdyQuizDefinitions = api.createRegistry(
        () => root.SmurdyQuizManifest || []
    );
})(typeof window !== "undefined" ? window : null, function createQuizDefinitionsApi() {
    "use strict";

    const MODALITY_ADAPTERS = Object.freeze({
        map: Object.freeze({
            id: "map",
            runner: "map-name",
            landingStrategy: "app-shell",
            requiresMenuMap: true
        }),
        flag: Object.freeze({
            id: "flag",
            runner: "flag",
            landingStrategy: "inline",
            requiresMenuMap: false
        })
    });

    const SUBDIVISION_ALIASES = Object.freeze({
        "click-country": "click-subdivision",
        "type-country": "type-subdivision",
        "find-country": "find-subdivision",
        "find-point": "find-point-subdivision"
    });

    function normalizeId(value) {
        const id = String(value || "")
            .replace(/^manifest:/i, "")
            .trim()
            .toLowerCase();
        return /^[a-z0-9_-]+$/.test(id) ? id : "";
    }

    function slug(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function inferCategory(item) {
        const explicit = String(item?.category || item?.quizCategory || "")
            .trim()
            .toLowerCase();
        if (explicit) return explicit;

        const id = normalizeId(item?.id || item?.file);
        const tags = (item?.tags || []).map(tag => String(tag).toLowerCase());
        if (id.includes("flag") || tags.includes("flags")) return "flags";
        if (id.includes("capital") || tags.includes("capitals")) return "capitals";
        if (id.includes("city") || tags.includes("cities")) return "cities";
        if (id.includes("shape") || tags.includes("shapes")) return "shapes";
        return "maps";
    }

    function inferInteraction(item) {
        const raw = String(
            item?.interaction || item?.type || item?.id || ""
        ).trim().toLowerCase();

        if (raw.includes("multiple-choice")) return "multiple-choice";
        if (raw.includes("find-point")) return "find-point";
        if (raw === "locate" || raw.includes("locate-flag")) return "locate";
        if (raw === "find" || raw.includes("find-country") || raw.includes("find-subdivision")) return "find";
        if (raw === "type" || raw.includes("type")) return "type";
        return "click";
    }

    function inferFamily(item) {
        const explicit = String(item?.family || item?.contentFamily || "")
            .trim()
            .toLowerCase();
        if (explicit) return explicit;

        const groupSet = String(item?.groupSet || "").toLowerCase();
        const subject = String(item?.subject || "").toLowerCase();
        const id = normalizeId(item?.id || item?.file);
        if (
            groupSet === "subdivision_groups" ||
            subject === "subdivisions" ||
            id.includes("subdivision")
        ) {
            return "subdivisions";
        }
        return "countries";
    }

    function inferFamilies(item) {
        const explicit = Array.isArray(item?.families)
            ? item.families.map(value => String(value).trim().toLowerCase()).filter(Boolean)
            : [];
        return explicit.length ? [...new Set(explicit)] : [inferFamily(item)];
    }

    function inferModality(item) {
        const explicit = String(item?.modality || item?.adapter || "")
            .trim()
            .toLowerCase();
        if (MODALITY_ADAPTERS[explicit]) return explicit;
        if (item?.config?.flagQuiz || inferCategory(item) === "flags") return "flag";
        return "map";
    }

    function normalizeDefinition(item) {
        if (!item || typeof item !== "object") return null;
        const id = normalizeId(item.id || item.file || item.title);
        if (!id) return null;

        const modality = inferModality(item);
        const families = inferFamilies(item);
        const status = String(item.status || "").trim().toLowerCase();
        const playable = status !== "coming-soon" && !item?.config?.comingSoon;

        return Object.freeze({
            id,
            title: String(item.title || item.name || id),
            category: inferCategory(item),
            interaction: inferInteraction(item),
            family: families[0] || "countries",
            families: Object.freeze(families.slice()),
            groupSet: String(item.groupSet || "country_groups"),
            modality,
            adapter: MODALITY_ADAPTERS[modality],
            playable,
            manifest: item
        });
    }

    function landingPath(itemOrId, groupId, manifest = []) {
        const item = typeof itemOrId === "object"
            ? itemOrId
            : manifest.find(entry => normalizeId(entry?.id) === normalizeId(itemOrId));
        const id = normalizeId(item?.id || itemOrId) || "quiz";
        return `/quizzes/${slug(id)}/${slug(groupId || "world")}/`;
    }

    function createRegistry(manifestProvider = () => []) {
        function manifestList() {
            const value = typeof manifestProvider === "function"
                ? manifestProvider()
                : manifestProvider;
            return Array.isArray(value) ? value : [];
        }

        function getManifest(id) {
            const wanted = normalizeId(id);
            return manifestList().find(item => normalizeId(item?.id) === wanted) || null;
        }

        function get(id) {
            return normalizeDefinition(getManifest(id));
        }

        function list() {
            return manifestList().map(normalizeDefinition).filter(Boolean);
        }

        function resolveLegacyQuizId(id, options = {}) {
            let resolved = normalizeId(id);
            if (!resolved) return null;

            const wantsSubdivisions =
                String(options.groupSet || "") === "subdivision_groups" ||
                String(options.mode || "") === "states";
            if (wantsSubdivisions && SUBDIVISION_ALIASES[resolved]) {
                resolved = SUBDIVISION_ALIASES[resolved];
            }

            const definition = get(resolved);
            return definition?.playable ? definition.id : null;
        }

        return Object.freeze({
            adapters: MODALITY_ADAPTERS,
            list,
            get,
            getManifest,
            normalize: normalizeDefinition,
            landingPath(itemOrId, groupId) {
                return landingPath(itemOrId, groupId, manifestList());
            },
            resolveLegacyQuizId,
            isModality(itemOrId, modality) {
                const definition = typeof itemOrId === "object" && itemOrId.manifest
                    ? itemOrId
                    : (typeof itemOrId === "object" ? normalizeDefinition(itemOrId) : get(itemOrId));
                return definition?.modality === modality;
            }
        });
    }

    return {
        MODALITY_ADAPTERS,
        SUBDIVISION_ALIASES,
        normalizeId,
        slug,
        inferCategory,
        inferInteraction,
        inferFamily,
        inferFamilies,
        inferModality,
        normalizeDefinition,
        landingPath,
        createRegistry
    };
});