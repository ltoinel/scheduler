"use strict";
// Enables the versioned git hooks of .githooks/ (run by "npm install").
// Does nothing outside a git checkout (e.g. when installed as a dependency).
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
if (!fs.existsSync(path.join(root, ".git"))) {
	process.exit(0);
}
try {
	execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
} catch (err) {
	console.warn("Could not enable git hooks: " + err.message);
}
