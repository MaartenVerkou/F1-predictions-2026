"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
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
  "public/assets/brand/logo-header-light-96.png",
  "public/assets/brand/logo-header-dark-96.png"
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

const requiredHeaderPatterns = [
  {
    pattern: /assetPath\(["']\/styles\.css["']\)/,
    message: "Shared stylesheet must use the assetPath versioning helper."
  },
  {
    pattern: /assetPath\(["']\/app\.js["']\)/,
    message: "Shared script must use the assetPath versioning helper."
  },
  {
    pattern: /assetPath\(["']\/assets\/brand\/logo-header-light-96\.png["']\)/,
    message: "Header light logo must use the optimized versioned asset."
  },
  {
    pattern: /assetPath\(["']\/assets\/brand\/logo-header-dark-96\.png["']\)/,
    message: "Header dark logo must use the optimized versioned asset."
  }
];

for (const { pattern, message } of requiredHeaderPatterns) {
  if (!pattern.test(headerTemplate)) {
    failed = true;
    console.error(message);
  }
}

if (/fonts\.(googleapis|gstatic)\.com/i.test(headerTemplate)) {
  failed = true;
  console.error("Shared head must not depend on external Google Font delivery.");
}

if (/"(Sora|Manrope)"/.test(styles)) {
  failed = true;
  console.error("Core typography must use the deliberate system font stack.");
}

if (failed) {
  process.exit(1);
}

console.log("Production assets are present and shared asset loading is stable.");
