"use strict";

const fs = require("fs").promises;
const path = require("path");

async function stripTrailingWhitespace(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const cleaned = source.replace(/[ \t]+(?=\r?$)/gm, "");

  if (cleaned !== source) {
    await fs.writeFile(filePath, cleaned, "utf8");
  }
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      await stripTrailingWhitespace(entryPath);
    }
  }
}

(async function main() {
  const quizzesDir = path.resolve(__dirname, "..", "quizzes");
  await walk(quizzesDir);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
