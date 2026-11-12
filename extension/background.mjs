import { API, dayAt, pause, makeQueue, nextTask, finishTask } from "./core.mjs";
import { readProduct } from "./reader.mjs";

export function createCollector(
  chrome,
  fetcher = fetch,
  clock = Date.now,
  random = Math.random,
) {
  let chain = Promise.resolve();
  // Serialize events, including tab events fired while a fetch is in flight.
  const serial = (fn) => {
    const result = chain.then(fn);
    chain = result.catch(() => {});
    return result;
  };
  const get = async () =>
    (await chrome.storage.local.get("collection")).collection;
  const save = (state) => chrome.storage.local.set({ collection: state });
  const api = async (path, options = {}) => {
    const response = await fetcher(API + path, {
      ...options,
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      throw Error(`Local price checker: HTTP ${response.status}`);
    return response.json();
  };
  const alarm = (when) =>
    chrome.alarms.create("collect-next", {
      when: Math.max(clock() + 100, when),
    });
  const close = async (state) => {
    if (state.active?.tabId !== undefined)
      await chrome.tabs.remove(state.active.tabId).catch(() => {});
  };
  async function stopWithError(state, reason) {
    await close(state);
    state.active = null;
    state.running = false;
    state.error = reason;
    await save(state);
    await chrome.alarms.clear("collect-next");
  }
  async function start() {
    const previous = await get();
    if (previous?.running) return previous;
    const data = await api("/api/collection");
    const stopped = previous?.day === data.day ? previous.stopped : {};
    // A store stopped for a block or three failures stays stopped for the day,
    // including if the button is pressed again. Do not hammer a retry.
    const queue = makeQueue(data);
    for (const task of queue)
      if (task.status === "pending" && stopped[task.store]) {
        task.status = "stopped";
        task.reason = stopped[task.store];
      }
    const state = {
      day: data.day,
      running: true,
      queue,
      stopped,
      failures: previous?.day === data.day ? previous.failures : {},
      lastVisit: previous?.lastVisit || {},
      nextAllowed: previous?.nextAllowed || {},
      active: null,
      updated: clock(),
      error: null,
    };
    await chrome.storage.local.set({
      collection: state,
      lastAutoDay: data.day,
      autoError: null,
      workerError: null,
    });
    await alarm(clock());
    return state;
  }
  async function tick() {
    const state = await get();
    if (!state?.running) return;
    if (state.day !== dayAt(clock()))
      return stopWithError(
        state,
        "Local date changed. Start a new daily collection.",
      );
    const task = state.active
      ? state.queue.find((t) => t.key === state.active.key)
      : nextTask(state);
    if (!task) {
      state.running = false;
      await save(state);
      await chrome.alarms.clear("collect-next");
      return;
    }
    if (!state.active) {
      let latest;
      try {
        latest = await api("/api/collection");
      } catch {
        return stopWithError(
          state,
          "Local price checker is offline. No further store pages opened.",
        );
      }
      if (latest.day !== state.day)
        return stopWithError(
          state,
          "Local date changed. Start a new daily collection.",
        );
      if (latest.completed.includes(task.key)) {
        finishTask(state, task, { ok: true, duplicate: true }, clock());
        await save(state);
        await alarm(clock());
        return;
      }
      const due = state.nextAllowed[task.store] || 0;
      if (clock() < due) {
        await alarm(due);
        return;
      }
      // Allocate a blank tab first, save ownership, then navigate. Recovery
      // never creates a second product tab for an already active task.
      const tab = await chrome.tabs.create({
        url: "about:blank",
        active: false,
      });
      state.active = {
        key: task.key,
        tabId: tab.id,
        phase: "blank",
        deadline: clock() + 60000,
      };
      await save(state);
    }
    if (state.active.phase === "blank") {
      state.lastVisit[task.store] = clock();
      state.nextAllowed[task.store] = clock() + pause(random);
      state.active.phase = "loading";
      await save(state);
      await alarm(state.active.deadline);
      try {
        await chrome.tabs.update(state.active.tabId, { url: task.url });
      } catch (error) {
        return fail(state, task, error.message);
      }
      return;
    }
    const tab = await chrome.tabs.get(state.active.tabId).catch(() => null);
    if (!tab) return fail(state, task, "Collection tab was closed.");
    if (tab.status !== "complete") {
      if (clock() >= state.active.deadline)
        return fail(state, task, "Product page did not finish loading.");
      await alarm(Math.min(state.active.deadline, clock() + 5000));
      return;
    }
    // Give hydrated price/seller blocks time to appear without another request.
    if (!state.active.readyAt) {
      state.active.readyAt = clock() + 8000;
      await save(state);
    }
    if (clock() < state.active.readyAt) {
      await alarm(state.active.readyAt);
      return;
    }
    let result;
    try {
      const rows = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: readProduct,
        args: [task],
      });
      result = rows[0]?.result;
    } catch (error) {
      return fail(state, task, `Page could not be read: ${error.message}`);
    }
    if (!result?.reading) {
      // One additional DOM-only read for slow hydration. A block stops immediately.
      if (
        !result?.blocked &&
        !state.active.rechecked &&
        clock() + 5000 < state.active.deadline
      ) {
        state.active.rechecked = true;
        state.active.readyAt = clock() + 5000;
        await save(state);
        await alarm(state.active.readyAt);
        return;
      }
      return fail(
        state,
        task,
        result?.reason || "No readable price.",
        result?.blocked,
      );
    }
    if (
      dayAt(clock()) !== state.day ||
      result.reading.observed_at.slice(0, 10) !== state.day
    )
      return stopWithError(
        state,
        "Local date changed during the reading. No price saved.",
      );
    let response;
    try {
      response = await fetcher(API + "/api/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.reading),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      return stopWithError(
        state,
        "Local price checker is offline. No further store pages opened.",
      );
    }
    if (!response.ok && response.status !== 409) {
      if (response.status >= 500)
        return stopWithError(
          state,
          `Local price log unavailable (HTTP ${response.status}).`,
        );
      return fail(
        state,
        task,
        `Reading rejected by local checker (HTTP ${response.status}).`,
      );
    }
    // Keep the seller evidence and errors in extension storage, never alter old readings.
    task.evidence = result.evidence || null;
    await close(state);
    finishTask(
      state,
      task,
      { ok: true, duplicate: response.status === 409 },
      clock(),
    );
    await save(state);
    await alarm(clock());
  }
  async function fail(state, task, reason, blocked = false) {
    await close(state);
    finishTask(state, task, { ok: false, reason, blocked }, clock());
    await save(state);
    await alarm(clock());
  }
  async function cancel() {
    const state = await get();
    if (state) {
      await close(state);
      state.active = null;
      state.running = false;
      state.error = "Stopped by you.";
      await save(state);
    }
    await chrome.alarms.clear("collect-next");
  }
  async function daily() {
    const settings = await chrome.storage.local.get([
      "autoDaily",
      "lastAutoDay",
      "collection",
    ]);
    if (
      settings.autoDaily &&
      settings.lastAutoDay !== dayAt(clock()) &&
      !settings.collection?.running
    ) {
      try {
        await start();
      } catch (error) {
        await chrome.storage.local.set({ autoError: error.message });
      }
    }
  }
  async function ensure() {
    await chrome.alarms.create("daily-check", { periodInMinutes: 15 });
    const state = await get();
    if (state?.running) await alarm(clock());
    await daily();
  }
  return {
    api,
    get,
    start: () => serial(start),
    tick: () => serial(tick),
    cancel: () => serial(cancel),
    daily: () => serial(daily),
    ensure: () => serial(ensure),
  };
}

if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  const collector = createCollector(chrome);
  const report = async (error) => {
    await collector.cancel().catch(() => {});
    await chrome.storage.local.set({ workerError: error.message });
  };
  chrome.alarms.onAlarm.addListener((alarm) => {
    (alarm.name === "collect-next"
      ? collector.tick()
      : collector.daily()
    ).catch(report);
  });
  chrome.tabs.onUpdated.addListener((id, change) => {
    if (change.status === "complete")
      collector
        .get()
        .then((state) => {
          if (state?.running && state.active?.tabId === id)
            return collector.tick();
        })
        .catch(report);
  });
  chrome.tabs.onRemoved.addListener((id) => {
    collector
      .get()
      .then((state) => {
        if (state?.running && state.active?.tabId === id)
          return collector.tick();
      })
      .catch(report);
  });
  chrome.runtime.onInstalled.addListener(() =>
    collector.ensure().catch(report),
  );
  chrome.runtime.onStartup.addListener(() => collector.ensure().catch(report));
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    let operation;
    const controls = sender.url === chrome.runtime.getURL("popup.html");
    // Only extension pages can start/stop collection or change the daily switch.
    if (controls && message.type === "start") operation = collector.start();
    else if (controls && message.type === "stop")
      operation = collector.cancel();
    else if (
      controls &&
      message.type === "auto" &&
      typeof message.enabled === "boolean"
    )
      operation = chrome.storage.local
        .set({ autoDaily: message.enabled, autoError: null })
        .then(() => collector.ensure());
    else if (controls && message.type === "status") operation = collector.get();
    else if (
      message.type === "check" &&
      sender.tab &&
      typeof sender.url === "string"
    )
      // Ignore URLs supplied by page messages; use Chrome's actual sender URL.
      operation = collector.api(
        "/api/check?url=" + encodeURIComponent(sender.url),
      );
    else return;
    Promise.resolve(operation).then(
      (data) => reply({ ok: true, data }),
      (error) => reply({ ok: false, error: error.message }),
    );
    return true;
  });
}
