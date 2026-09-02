/*
 * Canonical country-quiz identities.
 *
 * Natural Earth's SOVEREIGNT field remains the default so dependencies such
 * as the Falkland Islands stay grouped with their sovereign state. Entries
 * here are narrowly documented exceptions for separately mapped political
 * entities that Smurdy intentionally treats as their own quiz answer.
 */
(function(root, factory) {
    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.SmurdyQuizEntities = api;
    }
})(typeof self !== "undefined" ? self : globalThis, function() {
    const ADMIN_OVERRIDES = Object.freeze({
        Palestine: Object.freeze({
            canonicalName: "Palestine",
            criterion: "UN non-member observer state"
        })
    });

    function getOverride(properties) {
        if (!properties) return null;

        const admin = String(
            properties.ADMIN ||
            properties.admin ||
            properties.GEOUNIT ||
            properties.geounit ||
            ""
        ).trim();

        return ADMIN_OVERRIDES[admin] || null;
    }

    function getCanonicalCountryName(feature) {
        const properties = feature && feature.properties
            ? feature.properties
            : (feature || {});
        const override = getOverride(properties);

        if (override) return override.canonicalName;

        const candidates = [
            properties.sovereignt,
            properties.SOVEREIGNT,
            properties.sovereignty,
            properties.BRK_NAME,
            properties.NAME_LONG,
            properties.NAME,
            properties.name,
            properties.admin,
            properties.ADMIN
        ].filter(Boolean);

        let raw = candidates.length ? String(candidates[0]).trim() : "";
        if (!raw && properties.iso_a3) raw = String(properties.iso_a3).trim();

        return raw
            .replace(/\s*\(.*\)\s*/g, "")
            .replace(/\s*,\s*/g, ", ")
            .trim() || "Unknown";
    }

    return Object.freeze({
        ADMIN_OVERRIDES,
        getCanonicalCountryName
    });
});
