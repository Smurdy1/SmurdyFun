#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..");
const COUNTRY_FLAGS_PATH = path.join(ROOT, "src/data/country_flags.json");
const COUNTRIES_PATH = path.join(ROOT, "src/data/countries.json");
const STATES_PATH = path.join(ROOT, "src/data/states.json");
const FLAGS_DIR = path.join(ROOT, "assets/flags");
const SOURCES_PATH = path.join(ROOT, "src/data/flag_sources.json");
const { ADMIN_OVERRIDES, getCanonicalCountryName } = require("../src/js/quiz_entities.js");

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "smurdy.fun flag sync/1.0 (https://smurdy.fun/contact/)";

// Natural Earth does not currently include Northern Cyprus as a separate feature.
const QID_OVERRIDES = new Map([
  ["Northern Cyprus", "Q23681"],
]);

// These entities intentionally have no P41 because their flag status is disputed
// or unofficial. Keep the selection explicit instead of guessing from Commons.
const FLAG_FILE_OVERRIDES = new Map([
  ["Antarctica", "Flag of Antarctica.svg"],
  ["Western Sahara", "Flag of Western Sahara.svg"],
]);

function parseArgs(argv) {
  const options = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node tools/sync_wikimedia_flags.js [--dry-run]

Downloads the current P41 (flag image) for every smurdy.fun country and all 50
US states. Wikidata chooses the Commons file; the original SVG is stored in
assets/flags and its source/license information in src/data/flag_sources.json.

Options:
  --dry-run  Resolve and validate every flag without changing repository files
  --help     Show this message`);
}

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}

function countryQid(entry, countryFeatures) {
  const override = QID_OVERRIDES.get(entry.name);
  if (override) return override;

  const exactName = countryFeatures.find(
    (feature) => feature.properties.NAME === entry.name,
  );
  if (exactName?.properties.WIKIDATAID) return exactName.properties.WIKIDATAID;

  const isoMatch = countryFeatures.find(
    (feature) => feature.properties.ISO_A2?.toLowerCase() === entry.code.toLowerCase(),
  );
  return isoMatch?.properties.WIKIDATAID ?? null;
}

function countryDestination(entry) {
  const localPath = [entry.flag_1x1, entry.flag_4x3].find((value) =>
    value?.startsWith("/assets/flags/"),
  );
  return localPath ? path.basename(localPath) : `${entry.code.toLowerCase()}.svg`;
}

function explicitQuizEntityTargets(countryFlags, countryFeatures) {
  const existing = new Set(countryFlags.map((entry) => entry.name));
  const targets = [];

  for (const feature of countryFeatures || []) {
    const properties = feature?.properties || {};
    const overrideKey = [
      properties.ADMIN,
      properties.admin,
      properties.GEOUNIT,
      properties.geounit,
    ].find((value) => value && ADMIN_OVERRIDES[String(value).trim()]);
    if (!overrideKey) continue;

    const name = getCanonicalCountryName(feature);
    if (!name || existing.has(name)) continue;
    const code = String(properties.ISO_A2 || properties.iso_a2 || "").toLowerCase();
    const qid = properties.WIKIDATAID || properties.wikidataid || null;
    if (!code || code === "-99") {
      throw new Error(`${name} has no usable ISO_A2 code for its flag filename`);
    }
    targets.push({ kind: "country", name, code, qid, filename: `${code}.svg` });
    existing.add(name);
  }

  return targets;
}

function buildTargets(countryFlags, countries, states) {
  const targets = countryFlags.map((entry) => ({
    kind: "country",
    name: entry.name,
    code: entry.code.toLowerCase(),
    qid: countryQid(entry, countries.features),
    filename: countryDestination(entry),
  }));

  targets.push(...explicitQuizEntityTargets(countryFlags, countries.features));

  for (const feature of states.features) {
    const properties = feature.properties;
    if (
      properties.admin !== "United States of America" ||
      properties.type_en !== "State"
    ) {
      continue;
    }

    targets.push({
      kind: "us-state",
      name: properties.name,
      code: properties.iso_3166_2.toLowerCase(),
      qid: properties.wikidataid,
      filename: `${properties.iso_3166_2.toLowerCase()}.svg`,
    });
  }

  const errors = [];
  const seenFilenames = new Map();
  for (const target of targets) {
    if (!target.qid) errors.push(`${target.name} has no Wikidata QID`);
    const previous = seenFilenames.get(target.filename);
    if (previous && previous.qid !== target.qid) {
      errors.push(
        `${target.filename} is assigned to both ${previous.name} and ${target.name}`,
      );
    }
    seenFilenames.set(target.filename, target);
  }
  if (errors.length) throw new Error(errors.join("\n"));

  return targets;
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchWithRetry(url, options = {}, attempts = 6) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(30_000),
        headers: { "User-Agent": USER_AGENT, ...options.headers },
      });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      if (response.status === 429) {
        await new Promise((resolve) =>
          setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 5_000),
        );
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw lastError;
}

async function fetchJson(url) {
  return (await fetchWithRetry(url)).json();
}

function preferredClaim(claims) {
  if (!claims?.length) return null;
  return (
    claims.find((claim) => claim.rank === "preferred") ??
    claims.find((claim) => claim.rank === "normal") ??
    null
  );
}

async function resolveFlagNames(targets) {
  const entities = new Map();
  const uniqueQids = [...new Set(targets.map((target) => target.qid))];

  for (const batch of chunks(uniqueQids, 50)) {
    const query = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "claims",
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const data = await fetchJson(`${WIKIDATA_API}?${query}`);
    for (const entity of Object.values(data.entities ?? {})) entities.set(entity.id, entity);
  }

  const errors = [];
  const resolved = targets.map((target) => {
    const entity = entities.get(target.qid);
    const claim = preferredClaim(entity?.claims?.P41);
    const commonsFile =
      FLAG_FILE_OVERRIDES.get(target.name) ?? claim?.mainsnak?.datavalue?.value ?? null;
    if (!commonsFile) errors.push(`${target.name} (${target.qid}) has no usable P41 flag`);
    return { ...target, commonsFile };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return resolved;
}

function stripHtml(value = "") {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveCommonsFiles(targets) {
  const files = new Map();
  const uniqueNames = [...new Set(targets.map((target) => target.commonsFile))];

  for (const batch of chunks(uniqueNames, 40)) {
    const query = new URLSearchParams({
      action: "query",
      prop: "imageinfo",
      titles: batch.map((name) => `File:${name}`).join("|"),
      iiprop: "url|mime|extmetadata",
      format: "json",
      formatversion: "2",
      redirects: "1",
      origin: "*",
    });
    const data = await fetchJson(`${COMMONS_API}?${query}`);
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const canonicalName = page.title.replace(/^File:/, "");
      files.set(canonicalName, { page, info });
    }
    for (const redirect of data.query?.redirects ?? []) {
      const from = redirect.from.replace(/^File:/, "");
      const to = redirect.to.replace(/^File:/, "");
      if (files.has(to)) files.set(from, files.get(to));
    }
  }

  const errors = [];
  const resolved = targets.map((target) => {
    const file = files.get(target.commonsFile);
    if (!file) {
      errors.push(`${target.name}: Commons file not found (${target.commonsFile})`);
      return target;
    }
    if (file.info.mime !== "image/svg+xml") {
      errors.push(`${target.name}: P41 is ${file.info.mime}, not SVG (${target.commonsFile})`);
    }
    const metadata = file.info.extmetadata ?? {};
    return {
      ...target,
      downloadUrl: file.info.url,
      descriptionUrl: file.info.descriptionurl,
      license: stripHtml(metadata.LicenseShortName?.value ?? metadata.UsageTerms?.value),
      artist: stripHtml(metadata.Artist?.value),
      credit: stripHtml(metadata.Credit?.value),
      attributionRequired: metadata.AttributionRequired?.value === "true",
    };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return resolved;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

async function downloadFlags(targets, tempDir) {
  let nextRequestAt = Date.now();
  async function waitForDownloadSlot() {
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(nextRequestAt, Date.now()) + 750;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  await mapLimit(targets, 2, async (target) => {
    await waitForDownloadSlot();
    const response = await fetchWithRetry(target.downloadUrl);
    const content = Buffer.from(await response.arrayBuffer());
    const beginning = content.subarray(0, 500).toString("utf8");
    if (!/<svg[\s>]/i.test(beginning)) {
      throw new Error(`${target.name}: downloaded file is not an SVG`);
    }
    // Commons originals use a mix of LF and CRLF. Normalize line endings so a
    // sync does not create platform-dependent diffs or trailing-CR warnings.
    const normalized = content
      .toString("utf8")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n");
    await fs.writeFile(path.join(tempDir, target.filename), normalized);
  });
}

function updateCountryFlagPaths(countryFlags, targets) {
  const countriesByName = new Map(
    targets.filter((target) => target.kind === "country").map((target) => [target.name, target]),
  );
  return countryFlags.map((entry) => {
    const target = countriesByName.get(entry.name);
    if (!target) throw new Error(`No downloaded flag target for ${entry.name}`);
    const publicPath = `/assets/flags/${target.filename}`;
    return { ...entry, flag_1x1: publicPath, flag_4x3: publicPath };
  });
}

function sourceManifest(targets) {
  return {
    source: "Wikidata P41 and Wikimedia Commons",
    generatedBy: "tools/sync_wikimedia_flags.js",
    flags: targets
      .map((target) => ({
        code: target.code,
        name: target.name,
        kind: target.kind,
        filename: target.filename,
        wikidataId: target.qid,
        commonsFile: target.commonsFile,
        commonsPage: target.descriptionUrl,
        license: target.license || "See Commons file page",
        artist: target.artist || undefined,
        credit: target.credit || undefined,
        attributionRequired: target.attributionRequired,
      }))
      .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name)),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const [countryFlags, countries, states] = await Promise.all([
    readJson(COUNTRY_FLAGS_PATH),
    readJson(COUNTRIES_PATH),
    readJson(STATES_PATH),
  ]);
  const targets = buildTargets(countryFlags, countries, states);
  console.log(`Resolving ${targets.length} flags from Wikidata...`);
  const withNames = await resolveFlagNames(targets);
  const resolved = await resolveCommonsFiles(withNames);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "smurdy-flags-"));
  try {
    console.log(`Downloading ${resolved.length} original SVGs from Commons...`);
    await downloadFlags(resolved, tempDir);
    if (options.dryRun) {
      console.log("Dry run complete. No files changed.");
      return;
    }

    await fs.mkdir(FLAGS_DIR, { recursive: true });
    for (const target of resolved) {
      await fs.copyFile(
        path.join(tempDir, target.filename),
        path.join(FLAGS_DIR, target.filename),
      );
    }
    await fs.writeFile(
      COUNTRY_FLAGS_PATH,
      `${JSON.stringify(updateCountryFlagPaths(countryFlags, resolved), null, 2)}\n`,
    );
    await fs.writeFile(
      SOURCES_PATH,
      `${JSON.stringify(sourceManifest(resolved), null, 2)}\n`,
    );
    console.log(`Updated ${resolved.length} flags and ${path.relative(ROOT, SOURCES_PATH)}.`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildTargets,
  explicitQuizEntityTargets,
  countryDestination,
  countryQid,
  preferredClaim,
  sourceManifest,
  updateCountryFlagPaths,
};
