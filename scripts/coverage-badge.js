"use strict";
// Reads coverage/lcov.info and writes coverage/coverage-badge.json,
// a shields.io "endpoint" badge description.
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "coverage");
const lcov = fs.readFileSync(path.join(dir, "lcov.info"), "utf8");

let found = 0;
let hit = 0;
for (const line of lcov.split("\n")) {
	if (line.startsWith("LF:")) { found += Number(line.slice(3)); }
	if (line.startsWith("LH:")) { hit += Number(line.slice(3)); }
}
const pct = found === 0 ? 0 : Math.floor((hit / found) * 1000) / 10;
const color = pct >= 90 ? "brightgreen" : pct >= 80 ? "green" : pct >= 70 ? "yellow" : pct >= 60 ? "orange" : "red";

fs.writeFileSync(path.join(dir, "coverage-badge.json"), JSON.stringify({
	schemaVersion: 1,
	label: "coverage",
	message: pct + "%",
	color: color
}) + "\n");
console.log("Line coverage: " + pct + "% (" + hit + "/" + found + ")");
