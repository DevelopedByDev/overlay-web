#!/usr/bin/env node
/** Add import 'server-only' to every file under src/server/ (skip if already present). */
import fs from "node:fs";
import path from "node:path";

const SERVER_ROOT = path.resolve(import.meta.dirname, "..", "src", "server");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let added = 0;
for (const file of walk(SERVER_ROOT)) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("server-only")) continue;

  const shebang = text.startsWith("#!") ? text.match(/^#!.*\n/)?.[0] ?? "" : "";
  const rest = shebang ? text.slice(shebang.length) : text;
  const importLine = "import 'server-only'\n\n";
  fs.writeFileSync(file, shebang + importLine + rest);
  added++;
}
console.log(`Added server-only to ${added} files under src/server/`);
