import { progress } from "./core.mjs";
const $ = (id) => document.getElementById(id);
const send = (message) => chrome.runtime.sendMessage(message);
async function render() {
  const {
    collection: state,
    autoDaily,
    autoError,
    workerError,
  } = await chrome.storage.local.get([
    "collection",
    "autoDaily",
    "autoError",
    "workerError",
  ]);
  $("status").textContent =
    `${state?.day ? state.day + " · " : ""}${progress(state)}`;
  const active = state?.queue.find((t) => t.key === state.active?.key);
  $("current").textContent = active
    ? `${active.store} / ${active.product.name}`
    : "";
  $("start").disabled = !!state?.running;
  $("stop").hidden = !state?.running;
  $("auto").checked = !!autoDaily;
  const stopped = Object.entries(state?.stopped || {})
    .map(([store, reason]) => `${store}: ${reason}`)
    .join(" ");
  $("error").textContent = workerError || state?.error || autoError || stopped;
  $("progress").max = state?.queue.length || 1;
  $("progress").value =
    state?.queue.filter((t) => t.status !== "pending").length || 0;
  $("notes").replaceChildren();
  for (const task of state?.queue.filter((t) => t.reason) || []) {
    const li = document.createElement("li");
    li.textContent = `${task.store} / ${task.product.name}: ${task.reason}`;
    $("notes").append(li);
  }
}
for (const [id, type] of [
  ["start", "start"],
  ["stop", "stop"],
])
  $(id).addEventListener("click", async () => {
    $(id).disabled = true;
    try {
      const result = await send({ type });
      if (!result.ok) throw Error(result.error);
      await render();
    } catch (error) {
      $("error").textContent =
        error.message + " · Start the website first: npm run dev in the site folder.";
    } finally {
      $(id).disabled = false;
    }
  });
$("auto").addEventListener("change", async (event) => {
  const result = await send({ type: "auto", enabled: event.target.checked });
  if (!result.ok) $("error").textContent = result.error;
});
chrome.storage.onChanged.addListener(render);
await render();

$("export").addEventListener("click", async () => {
  const { collection } = await chrome.storage.local.get("collection");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(collection || {}, null, 2)], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `trust-me-bru-collection-${collection?.day || "notes"}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
