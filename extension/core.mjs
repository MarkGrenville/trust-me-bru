export const API = "http://127.0.0.1:3210";
export const dayAt = (now = Date.now()) =>
  new Date(now + 7200000).toISOString().slice(0, 10);
export const pause = (random = Math.random) =>
  20000 + Math.floor(random() * 10001);
export function makeQueue(data) {
  const done = new Set(data.completed);
  const tracked = new Set(
    data.stores.filter((s) => s.status === "tracked").map((s) => s.key),
  );
  return data.products.flatMap((product) =>
    Object.entries(product.stores)
      .filter(([store]) => tracked.has(store))
      .map(([store, url]) => ({
        product,
        store,
        url,
        key: `${product.id}|${store}`,
        status: done.has(`${product.id}|${store}`) ? "already" : "pending",
      })),
  );
}
export function nextTask(state) {
  return state.queue.find(
    (t) => t.status === "pending" && !state.stopped[t.store],
  );
}
export function finishTask(state, task, result, now = Date.now()) {
  task.status = result.ok ? (result.duplicate ? "already" : "saved") : "failed";
  task.reason = result.reason || null;
  state.failures[task.store] = result.ok
    ? 0
    : (state.failures[task.store] || 0) + 1;
  if (result.blocked || state.failures[task.store] >= 3) {
    state.stopped[task.store] = result.reason || "Three consecutive failures.";
    for (const item of state.queue)
      if (item.store === task.store && item.status === "pending") {
        item.status = "stopped";
        item.reason = state.stopped[task.store];
      }
  }
  state.updated = now;
  state.active = null;
}
export function progress(state) {
  if (!state) return "No collection yet.";
  const count = (status) =>
    state.queue.filter((t) => t.status === status).length;
  return `${state.running ? "Collecting" : "Finished"} · ${count("saved")} saved · ${count("already")} already recorded · ${count("failed")} unreadable · ${count("stopped")} stopped / ${state.queue.length} offers`;
}
