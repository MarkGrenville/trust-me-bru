// Build the browser-tool callback from the shared reader and current watchlist.
const fs = require("node:fs");
const path = require("node:path");
const { readTakealotSeller } = require("./takealot-seller.cjs");
const { captureTakealotPage } = require("./capture-takealot.cjs");
const root = path.resolve(__dirname, "..");
const products = JSON.parse(
  fs.readFileSync(path.join(root, "data/watchlist.json"), "utf8"),
)
  .filter((p) => p.stores.takealot)
  .map((p) => ({ id: p.id, stores: { takealot: p.stores.takealot } }));
const output = path.join(root, ".playwright-mcp/takealot-reader.js");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  `async (page) => {\nconst readSeller = ${readTakealotSeller.toString()};\nreturn (${captureTakealotPage.toString()})(page, ${JSON.stringify(products)}, readSeller);\n}\n`,
);
console.log(
  "Prepared .playwright-mcp/takealot-reader.js for the current watchlist.",
);
