"use strict";

const crypto = require("node:crypto");

const PROVIDER = "reddit_destructors";
const PROVIDER_SCHEMA = "reddit-destructors-rss-v1";
const DEFAULT_FEED_URL = "https://www.reddit.com/r/formula1/.rss?author=Dense-Strategy-867";
const DEFAULT_AUTHOR = "Dense-Strategy-867";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function stripMarkup(value) {
  const decoded = decodeEntities(String(value || ""));
  return decoded
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tagValue(fragment, tag) {
  const match = String(fragment || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeEntities(match[1].trim()) : "";
}

function attributeValue(fragment, tag, attribute) {
  const match = String(fragment || "").match(new RegExp(`<${tag}[^>]*\\b${attribute}=["']([^"']+)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function parseFeed(xml) {
  const source = String(xml || "");
  const fragments = source.match(/<(?:entry|item)\b[\s\S]*?<\/(?:entry|item)>/gi) || [];
  return fragments.map((fragment) => {
    const authorFragment = fragment.match(/<author\b[\s\S]*?<\/author>/i)?.[0] || "";
    const link = attributeValue(fragment, "link", "href") || tagValue(fragment, "link");
    const id = tagValue(fragment, "id") || tagValue(fragment, "guid") || link;
    const author = tagValue(authorFragment, "name") || tagValue(fragment, "author") || tagValue(fragment, "dc:creator");
    const content = tagValue(fragment, "content") || tagValue(fragment, "description");
    return {
      id: String(id || "").trim() || null,
      url: String(link || "").trim() || null,
      title: stripMarkup(tagValue(fragment, "title")),
      author: stripMarkup(author),
      publishedAt: tagValue(fragment, "published") || tagValue(fragment, "pubDate") || null,
      updatedAt: tagValue(fragment, "updated") || null,
      bodyHtml: String(content || "").trim(),
      bodyText: stripMarkup(content),
      imageUrls: Array.from(String(content || "").matchAll(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp)(?:\?[^\s"'<>]+)?/gi)).map((match) => match[0])
    };
  }).filter((entry) => entry.id || entry.url || entry.title);
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseMoney(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  const match = text.match(/\$?([0-9]+(?:\.[0-9]+)?)\s*(k|m|million|thousand)?/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = String(match[2] || "").toLowerCase();
  const multiplier = suffix === "m" || suffix === "million" ? 1_000_000 : suffix === "k" || suffix === "thousand" ? 1_000 : 1;
  return amount * multiplier;
}

function roundForTitle(title, races = [], season = null) {
  const normalizedTitle = normalizeKey(title);
  const matchingRace = (races || []).find((race) => {
    const labels = [race?.display_name, race?.raceName, race?.name, race?.circuit_name, race?.race_code]
      .map(normalizeKey)
      .filter(Boolean);
    return labels.some((label) => {
      const shortLabel = label.replace(/grandprix$/, "");
      return normalizedTitle.includes(shortLabel) || normalizedTitle.includes(`${shortLabel}gp`);
    });
  });
  if (matchingRace) return {
    round: Number(matchingRace.round_number ?? matchingRace.round),
    roundName: String(matchingRace.display_name || matchingRace.raceName || matchingRace.name || "").trim()
  };
  const year = season == null ? "" : String(season);
  const match = String(title || "").match(new RegExp(`${year ? `${year}\\s+` : ""}.*?after\\s+([A-Za-z][A-Za-z-]*(?:\\s+[A-Za-z][A-Za-z-]*)?)\\s+(?:Grand\\s+Prix|GP)`, "i"));
  return match ? { round: null, roundName: `${match[1]} Grand Prix` } : { round: null, roundName: null };
}

function parseDamageLines(bodyText) {
  const text = String(bodyText || "");
  const sectionMatch = text.match(/(?:^|\n)\s*damages?\s*:\s*([\s\S]*)/i);
  if (!sectionMatch) return { rows: [], warnings: ["damage_list_missing"] };
  const lines = sectionMatch[1].split("\n");
  const rows = [];
  const warnings = [];
  for (const line of lines) {
    const match = line.trim().match(/^(?:[-*•]\s*)?([A-Z]{3})\s*:\s*(.+)$/);
    if (!match) continue;
    const driverCode = match[1].toUpperCase();
    const detail = match[2].trim();
    const totalMatch = detail.match(/(?:total|cost|=)\s*[:=]?\s*(\$?\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|m|million|thousand)?)/i);
    const totalCost = totalMatch ? parseMoney(totalMatch[1]) : null;
    const componentText = totalMatch ? detail.slice(0, totalMatch.index).replace(/[|;,]+\s*$/, "") : detail;
    const components = componentText.split(/\s*,\s*/).map((name) => String(name || "").trim()).filter(Boolean).map((name) => ({
      name,
      price: null,
      quantity: 1,
      totalCost: null
    }));
    if (totalCost == null) warnings.push(`cost_missing:${driverCode}`);
    rows.push({ driverCode, components, totalCost, sourceText: line.trim() });
  }
  if (!rows.length) warnings.push("damage_rows_missing");
  return { rows, warnings };
}

function mapDamageRows({ post, season, races = [], drivers = [], teams = [] }) {
  const driverByCode = new Map((drivers || []).map((driver) => [String(driver.driver_code || driver.code || "").trim().toUpperCase(), driver]));
  const result = roundForTitle(post.title, races, season);
  const parsed = parseDamageLines(post.bodyText);
  const rows = parsed.rows.map((row) => {
    const driver = driverByCode.get(row.driverCode);
    const assignment = driver?.team || driver?.constructor || null;
    const constructorName = typeof assignment === "string" ? assignment : assignment?.display_name || assignment?.name || null;
    return {
      round: result.round,
      driverCode: row.driverCode,
      driverName: driver?.display_name || driver?.label || row.driverCode,
      driverId: driver?.id == null ? null : Number(driver.id),
      constructorName,
      constructorId: assignment?.id == null ? null : Number(assignment.id),
      components: row.components,
      totalCost: row.totalCost,
      sourceText: row.sourceText,
      resolution: {
        driver: driver ? "resolved" : "unresolved",
        constructor: constructorName ? "resolved" : "unresolved",
        cost: row.totalCost == null ? "unresolved" : "resolved"
      }
    };
  });
  return {
    ...result,
    rows,
    warnings: parsed.warnings,
    complete: Boolean(result.round && rows.length && parsed.warnings.length === 0 && rows.every((row) => row.constructorName && row.totalCost != null))
  };
}

function stableHash(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

async function fetchFeed({
  feedUrl = DEFAULT_FEED_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  headers = {},
  userAgent = "Mozilla/5.0 (compatible; WOK/1.0)",
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Reddit Destructors provider requires fetch.");
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(feedUrl, {
        headers: {
          accept: "application/atom+xml, application/rss+xml, text/xml;q=0.9",
          "user-agent": userAgent,
          ...headers
        },
        signal: controller.signal
      });
      if (response.status === 304) return { status: "not_modified", entries: [], headers: response.headers };
      if (response.ok) {
        const xml = await response.text();
        return {
          status: "ok",
          entries: parseFeed(xml),
          headers: response.headers,
          contentHash: stableHash(xml)
        };
      }
      const retryable = RETRYABLE_STATUS_CODES.has(response.status);
      const retryAfter = Number(response.headers?.get?.("retry-after") || 0);
      lastError = new Error(`Reddit RSS returned HTTP ${response.status}.`);
      lastError.statusCode = response.status;
      if (!retryable || attempt >= retries) throw lastError;
      await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : Math.min(250 * (2 ** attempt), 5_000));
    } catch (error) {
      lastError = error?.name === "AbortError" ? new Error("Reddit RSS request timed out.") : error;
      if (lastError?.statusCode && !RETRYABLE_STATUS_CODES.has(Number(lastError.statusCode))) throw lastError;
      if (attempt >= retries) throw lastError;
      await sleep(Math.min(250 * (2 ** attempt), 5_000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("Reddit RSS request failed.");
}

function selectCandidates(entries, { author = DEFAULT_AUTHOR, season, races = [] } = {}) {
  const expectedAuthor = normalizeKey(author);
  return (entries || []).map((entry) => ({
    ...entry,
    match: roundForTitle(entry.title, races, season)
  })).filter((entry) => {
    const authorMatches = !expectedAuthor || normalizeKey(entry.author).includes(expectedAuthor);
    const titleMatches = /destructor/i.test(entry.title) && /championship/i.test(entry.title);
    return authorMatches && titleMatches;
  }).sort((left, right) => Date.parse(right.publishedAt || right.updatedAt || 0) - Date.parse(left.publishedAt || left.updatedAt || 0));
}

module.exports = {
  DEFAULT_AUTHOR,
  DEFAULT_FEED_URL,
  PROVIDER,
  PROVIDER_SCHEMA,
  decodeEntities,
  fetchFeed,
  mapDamageRows,
  normalizeKey,
  parseDamageLines,
  parseFeed,
  parseMoney,
  roundForTitle,
  selectCandidates,
  stableHash,
  stripMarkup
};
