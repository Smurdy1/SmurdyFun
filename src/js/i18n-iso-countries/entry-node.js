var library = require(".");
library.registerLocale(require("i18n-iso-countries/langs/en.json"));
library.registerLocale(require("i18n-iso-countries/langs/fr.json"));
// add the locales you need...
module.exports = library;
