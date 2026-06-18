"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const requiredFontAssets = [
  "public/assets/fonts/manrope-latin-var.woff2",
  "public/assets/fonts/manrope-latin-ext-var.woff2",
  "public/assets/fonts/sora-latin-var.woff2",
  "public/assets/fonts/sora-latin-ext-var.woff2"
];
const criticalFontPreloadAssets = [
  "public/assets/fonts/manrope-latin-var.woff2",
  "public/assets/fonts/sora-latin-var.woff2"
];
const requiredLogoAssets = [
  "public/assets/brand/logo-header-light-96.png",
  "public/assets/brand/logo-header-dark-96.png"
];
const requiredFiles = [
  "server.js",
  "data/questions.json",
  "data/roster.json",
  "data/races.json",
  "data/last-season-results.json",
  "views/home.ejs",
  "views/questions.ejs",
  "views/partials/header.ejs",
  "views/partials/footer.ejs",
  "public/styles.css",
  "public/app.js",
  ...requiredLogoAssets,
  ...requiredFontAssets
];

let failed = false;

for (const relativePath of requiredFiles) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    failed = true;
    console.error(`Missing required production file: ${relativePath}`);
  }
}

for (const relativePath of requiredFiles.filter((file) => file.endsWith(".json"))) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) continue;
  try {
    JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (err) {
    failed = true;
    console.error(`Invalid JSON in ${relativePath}: ${err.message}`);
  }
}

const headerPath = path.join(ROOT, "views/partials/header.ejs");
const headerTemplate = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, "utf8") : "";
const stylesPath = path.join(ROOT, "public/styles.css");
const styles = fs.existsSync(stylesPath) ? fs.readFileSync(stylesPath, "utf8") : "";
const appPath = path.join(ROOT, "public/app.js");
const appScript = fs.existsSync(appPath) ? fs.readFileSync(appPath, "utf8") : "";

const requiredHeaderPatterns = [
  {
    pattern: /assetPath\(["']\/styles\.css["']\)/,
    message: "Shared stylesheet must use the assetPath versioning helper."
  },
  {
    pattern: /assetPath\(["']\/app\.js["']\)/,
    message: "Shared script must use the assetPath versioning helper."
  },
];

for (const logoAsset of requiredLogoAssets) {
  const publicPath = `/${logoAsset.replace(/^public\//, "")}`;
  requiredHeaderPatterns.push({
    pattern: new RegExp(`assetPath\\(["']${publicPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\)`),
    message: `Header logo must use the optimized versioned asset: ${publicPath}`
  });
  requiredHeaderPatterns.push({
    pattern: new RegExp(
      `<link[^>]+rel=["']preload["'][^>]+href=["']<%= assetPath\\(["']${publicPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\) %>["'][^>]+as=["']image["']`
    ),
    message: `Header logo must be preloaded as an image: ${publicPath}`
  });
}

for (const fontAsset of criticalFontPreloadAssets) {
  const publicPath = `/${fontAsset.replace(/^public\//, "")}`;
  requiredHeaderPatterns.push({
    pattern: new RegExp(`assetPath\\(["']${publicPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\)`),
    message: `Critical font preload must use the assetPath versioning helper: ${publicPath}`
  });
}

for (const { pattern, message } of requiredHeaderPatterns) {
  if (!pattern.test(headerTemplate)) {
    failed = true;
    console.error(message);
  }
}

if (/fonts\.(googleapis|gstatic)\.com/i.test(`${headerTemplate}\n${styles}`)) {
  failed = true;
  console.error("Shared head must not depend on external Google Font delivery.");
}

if (/\bdata-logo-(light|dark)\b/.test(headerTemplate) || /syncLogos/.test(appScript)) {
  failed = true;
  console.error("Theme logo selection must not depend on a client-side src swap.");
}

const fontFaceBlocks = styles.match(/@font-face\s*\{[^}]*\}/g) || [];
const requiredFontFaces = [
  { family: "Manrope", file: "manrope-latin-var.woff2" },
  { family: "Manrope", file: "manrope-latin-ext-var.woff2" },
  { family: "Sora", file: "sora-latin-var.woff2" },
  { family: "Sora", file: "sora-latin-ext-var.woff2" }
];

for (const { family, file } of requiredFontFaces) {
  const hasFontFace = fontFaceBlocks.some((block) =>
    block.includes(`font-family: "${family}"`) &&
    block.includes(`url("/assets/fonts/${file}")`) &&
    /font-display:\s*block/.test(block)
  );
  if (!hasFontFace) {
    failed = true;
    console.error(`Missing stable self-hosted ${family} font-face for ${file}.`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("Production assets are present and shared asset loading is stable.");
