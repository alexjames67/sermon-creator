"use strict";

const POLL_MS = 5000;
const els = {
  status: document.getElementById("status"),
  refresh: document.getElementById("refresh"),
  settingsBtn: document.getElementById("settingsBtn"),
  setup: document.getElementById("setup"),
  feed: document.getElementById("feed"),
  empty: document.getElementById("empty"),
  list: document.getElementById("list"),
  token: document.getElementById("token"),
  project: document.getElementById("project"),
  teamId: document.getElementById("teamId"),
  save: document.getElementById("save"),
  setupMsg: document.getElementById("setupMsg"),
};

let timer = null;
let config = { token: "", project: "", teamId: "" };

/* ---------- storage ---------- */
function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["token", "project", "teamId"], (v) => {
      resolve({
        token: v.token || "",
        project: v.project || "",
        teamId: v.teamId || "",
      });
    });
  });
}

function saveConfig(next) {
  return new Promise((resolve) => chrome.storage.local.set(next, resolve));
}

/* ---------- state mapping ---------- */
function classify(state) {
  switch (state) {
    case "READY":
      return { cls: "ready", label: "ready" };
    case "ERROR":
      return { cls: "error", label: "error" };
    case "CANCELED":
      return { cls: "canceled", label: "canceled" };
    case "BUILDING":
    case "INITIALIZING":
    case "QUEUED":
      return { cls: "building", label: state.toLowerCase() };
    default:
      return { cls: "canceled", label: (state || "unknown").toLowerCase() };
  }
}

function relTime(ms) {
  const diff = Date.now() - ms;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ---------- API ---------- */
async function fetchDeployments() {
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("app", config.project);
  url.searchParams.set("limit", "20");
  if (config.teamId) url.searchParams.set("teamId", config.teamId);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  return data.deployments || [];
}

/* ---------- render ---------- */
function render(deployments) {
  els.list.innerHTML = "";

  if (!deployments.length) {
    els.feed.hidden = true;
    els.empty.hidden = false;
    return;
  }
  els.empty.hidden = true;
  els.feed.hidden = false;

  let anyBuilding = false;

  for (const d of deployments) {
    const state = d.state || d.readyState || "UNKNOWN";
    const { cls, label } = classify(state);
    if (cls === "building") anyBuilding = true;

    const meta = d.meta || {};
    const commitMsg =
      meta.githubCommitMessage ||
      meta.gitlabCommitMessage ||
      meta.bitbucketCommitMessage ||
      d.name ||
      d.url ||
      "Deployment";
    const branch =
      meta.githubCommitRef || meta.gitlabCommitRef || meta.bitbucketCommitRef;
    const created = d.created || d.createdAt || Date.now();
    const href =
      d.inspectorUrl || (d.url ? `https://${d.url}` : "https://vercel.com");

    const row = document.createElement("a");
    row.className = "row";
    row.href = href;
    row.target = "_blank";
    row.rel = "noreferrer";

    const dot = document.createElement("span");
    dot.className = `dot ${cls}`;

    const main = document.createElement("div");
    main.className = "row-main";

    const msg = document.createElement("div");
    msg.className = "row-msg";
    msg.textContent = String(commitMsg).split("\n")[0];

    const sub = document.createElement("div");
    sub.className = "row-sub";

    const target = document.createElement("span");
    const isProd = d.target === "production";
    target.className = `target${isProd ? " production" : ""}`;
    target.textContent = isProd ? "production" : "preview";
    sub.appendChild(target);

    if (branch) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "·";
      const br = document.createElement("span");
      br.textContent = branch;
      sub.append(sep, br);
    }

    const sep2 = document.createElement("span");
    sep2.className = "sep";
    sep2.textContent = "·";
    const time = document.createElement("span");
    time.textContent = relTime(created);
    sub.append(sep2, time);

    main.append(msg, sub);

    const stateEl = document.createElement("span");
    stateEl.className = `row-state ${cls}`;
    stateEl.textContent = label;

    row.append(dot, main, stateEl);
    els.list.appendChild(row);
  }

  if (anyBuilding) {
    els.status.hidden = false;
    els.status.classList.add("live");
    els.status.textContent = "building";
  } else {
    els.status.classList.remove("live");
    els.status.hidden = false;
    els.status.textContent = "up to date";
  }
}

/* ---------- polling ---------- */
async function tick() {
  try {
    const deployments = await fetchDeployments();
    render(deployments);
  } catch (err) {
    els.status.hidden = false;
    els.status.classList.remove("live");
    els.status.textContent = "";
    showSetup(err.message);
  }
}

function startPolling() {
  stopPolling();
  tick();
  timer = setInterval(tick, POLL_MS);
}

function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
}

/* ---------- view switching ---------- */
function showSetup(errorMsg) {
  stopPolling();
  els.feed.hidden = true;
  els.empty.hidden = true;
  els.setup.hidden = false;
  els.token.value = config.token;
  els.project.value = config.project;
  els.teamId.value = config.teamId;
  els.setupMsg.textContent = errorMsg || "";
  els.setupMsg.classList.toggle("error", Boolean(errorMsg));
}

function showFeed() {
  els.setup.hidden = true;
  startPolling();
}

/* ---------- events ---------- */
els.save.addEventListener("click", async () => {
  const next = {
    token: els.token.value.trim(),
    project: els.project.value.trim(),
    teamId: els.teamId.value.trim(),
  };
  if (!next.token || !next.project) {
    els.setupMsg.textContent = "Token and project are both required.";
    els.setupMsg.classList.add("error");
    return;
  }
  await saveConfig(next);
  config = next;
  showFeed();
});

els.refresh.addEventListener("click", () => tick());

els.settingsBtn.addEventListener("click", () => {
  if (els.setup.hidden) showSetup();
  else if (config.token && config.project) showFeed();
});

/* ---------- boot ---------- */
(async function init() {
  config = await loadConfig();
  if (config.token && config.project) showFeed();
  else showSetup();
})();
