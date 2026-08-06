import { copyFile, readFile } from "node:fs/promises";

const source = await readFile("src/index.js", "utf8");

if (!source.includes("export default")) {
  throw new Error("src/index.js must export the Roam extension lifecycle");
}

await copyFile("src/index.js", "extension.js");
await copyFile("src/styles.css", "extension.css");

console.log(`Built extension.js (${Buffer.byteLength(source)} bytes) and extension.css`);
