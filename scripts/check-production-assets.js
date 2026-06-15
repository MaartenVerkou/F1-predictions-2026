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
  "public/app.js"
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

if (failed) {
  process.exit(1);
}

console.log("Production assets are present and JSON config is valid.");
