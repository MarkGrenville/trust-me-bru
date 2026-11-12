// node collector/save-reading.mjs <capture.json>
// A capture is the JSON result from capture-takealot.cjs, not the tool wrapper.
import { readFile } from "node:fs/promises";
const filename = process.argv[2];
if (!filename) throw new Error("Supply a capture JSON file.");
const capture = JSON.parse(await readFile(filename, "utf8"));
if (capture.stop_store || !capture.reading)
  throw new Error(capture.reason || "No confirmed reading to save.");
const response = await fetch("http://127.0.0.1:3210/api/observe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(capture.reading),
});
console.log(response.status, await response.text());
if (!response.ok) process.exitCode = 1;
