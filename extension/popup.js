// Xiaoer VideoLab — popup: history, download, quick-open
const DAEMON = "http://127.0.0.1:7788";
const STORAGE_KEY = "videolab_pending";
const CACHE_KEY = "videolab_cache";
const LOCALE_KEY = "videolab_locale";

// ── i18n ─────────────────────────────────────────────

let _locale = "en";

const LOCALES = {
  en: {
    history: "History", emptyTitle: "No downloads yet",
    emptyHint: "Click below to download a video",
    offlineTitle: "Daemon not running",
    offlineHint: "Reopen this window; if it persists, restart the service",
    startBtn: "Start Service", download: "Download Video",
    detecting: "Detecting...", files: "{n} file(s)",
    done: "Done", downloading: "Downloading", queued: "Queued", failed: "Failed",
    play: "Play", openFolder: "Open Folder", redownload: "Redownload", retry: "Retry",
    sent: "Download request sent", started: "Daemon started",
    startFailed: "Start failed: {msg}", notInstalled: "Run install.sh first",
    daemonError: "Daemon returned {code}", daemonOfflineMsg: "Cannot reach daemon",
    douyinGrabbing: "Reading the playing video...",
    douyinPlayFirst: "Couldn't read the video — wait for it to load, then retry",
    feedNoVideo: "No video on screen — scroll a video into view (or open the post), then retry",
    fileNotFound: "File no longer exists on disk",
    cancel: "Remove", remove: "Remove from list", clearAll: "Clear", clearConfirm: "Clear all records?",
    justNow: "just now", minAgo: "{n} min ago", hrAgo: "{n} hr ago", dayAgo: "{n} day ago",
    today: "Today", yesterday: "Yesterday", earlier: "Earlier",
  },
  zh: {
    history: "记录", emptyTitle: "还没有下载记录",
    emptyHint: "点击下方按钮下载当前页视频",
    offlineTitle: "Daemon 未运行",
    offlineHint: "重新打开此窗口；若仍未运行，请重启服务",
    startBtn: "启动服务", download: "下载视频",
    detecting: "检测中...", files: "{n} 个文件",
    done: "完成", downloading: "下载中", queued: "等待中", failed: "失败",
    play: "播放", openFolder: "打开文件夹", redownload: "重下", retry: "重试",
    sent: "下载请求已发送", started: "Daemon 已启动",
    startFailed: "启动失败: {msg}", notInstalled: "需要先运行 install.sh",
    daemonError: "服务返回 {code}", daemonOfflineMsg: "无法连接到 daemon",
    douyinGrabbing: "正在读取正在播放的视频...",
    douyinPlayFirst: "没读到视频(可能还在加载)，稍等一两秒再点一次",
    feedNoVideo: "屏幕上没找到视频——把视频滑到屏幕里(或点开那条帖子)再点一次",
    fileNotFound: "文件已不存在于磁盘",
    cancel: "移除", remove: "从列表移除", clearAll: "清空", clearConfirm: "清空全部记录？",
    justNow: "刚刚", minAgo: "{n} 分钟前", hrAgo: "{n} 小时前", dayAgo: "{n} 天前",
    today: "今天", yesterday: "昨天", earlier: "更早",
  },
};

function t(key, args) {
  const text = (LOCALES[_locale] || LOCALES.en)[key] || key;
  if (!args) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => args[k] !== undefined ? args[k] : `{${k}}`);
}

async function setLocale(locale) {
  _locale = locale;
  await chrome.storage.local.set({ [LOCALE_KEY]: locale });
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  const toggle = document.getElementById("localeToggle");
  if (toggle) toggle.textContent = _locale === "en" ? "EN" : "中文";
}

// ── SVG icons ───────────────────────────────────────

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  reveal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  redownload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

let currentTabUrl = "";
let currentTabTitle = "";
let pollTimer = null;

// ── init ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Restore locale
  const { [LOCALE_KEY]: saved } = await chrome.storage.local.get(LOCALE_KEY);
  if (saved && LOCALES[saved]) _locale = saved;
  applyTranslations();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab?.url || "";
  currentTabTitle = tab?.title || "";

  // Intelligent video detection
  const btn = document.getElementById("downloadBtn");
  if (/^https?:/.test(currentTabUrl)) {
    btn.disabled = false;
    if (isLikelyVideoSite(currentTabUrl)) {
      setBtnLabel(t("download"), false);
    } else {
      setBtnLabel(t("detecting"), true);
    }
    // ALWAYS re-enable the button when the probe finishes — even on timeout/error
    // (hasVideo === null). Otherwise a slow/failed probe leaves it stuck on "检测中".
    // Feed pages (x.com/home…) aren't a video URL; probing them just burns a yt-dlp run.
    (feedSiteFor(currentTabUrl) ? Promise.resolve(null) : probeVideo(currentTabUrl))
      .then(hasVideo => {
        setBtnLabel(t("download"), false);
        if (hasVideo === false) btn.title = "No video detected, you can still try";
      })
      .catch(() => setBtnLabel(t("download"), false));
    // Hard safety net: never let "检测中" linger more than 10s no matter what.
    setTimeout(() => { if (btn.disabled && /^https?:/.test(currentTabUrl)) setBtnLabel(t("download"), false); }, 10000);
  } else {
    btn.disabled = true;
    btn.title = "Not an http(s) page";
    setBtnLabel(t("download"), true);
  }

  document.getElementById("downloadBtn").addEventListener("click", onDownload);

  const startBtn = document.getElementById("startDaemonBtn");
  if (startBtn) startBtn.addEventListener("click", onStartDaemon);

  const clearBtn = document.getElementById("clearAllBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearAllHistory);

  // Locale toggle
  document.getElementById("localeToggle").addEventListener("click", () => {
    setLocale(_locale === "en" ? "zh" : "en");
  });

  await loadHistory();
});

window.addEventListener("beforeunload", stopPolling);

// ── history loading ───────────────────────────────────

async function loadHistory() {
  hide("daemonOffline");
  const _clearBtn = document.getElementById("clearAllBtn");
  if (_clearBtn) _clearBtn.hidden = true; // renderHistory re-shows it when there are items

  const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
  const { [STORAGE_KEY]: pending = [] } = await chrome.storage.local.get(STORAGE_KEY);

  if (cached && cached.length > 0) {
    renderHistory(cached);
  } else if (pending.length > 0) {
    renderHistory(pending);
  } else {
    show("emptyState");
    applyTranslations(); // ensure empty state text is in current locale
  }

  // Fetch fresh data from daemon in the background
  let daemonEntries = [];
  let daemonOnline = false;

  try {
    const res = await fetch(`${DAEMON}/history`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      daemonEntries = await res.json();
      daemonOnline = true;
    }
  } catch { /* daemon offline */ }

  const daemonByUrl = {};
  for (const e of daemonEntries) daemonByUrl[e.url] = e;

  const activePending = pending.filter(p => {
    const d = daemonByUrl[p.url];
    return !d || d.status === "queued" || d.status === "downloading";
  });

  await chrome.storage.local.set({ [STORAGE_KEY]: activePending });

  const seen = new Set();
  const combined = [];

  // 1. Active pending (in-progress downloads) — highest priority
  for (const p of activePending) { combined.push(p); seen.add(p.url); }
  // 2. Daemon entries (completed downloads from server)
  for (const d of daemonEntries) { if (!seen.has(d.url)) { combined.push(d); seen.add(d.url); } }
  // 3. Cache fallback — keeps completed items visible even if daemon
  //    temporarily returns empty data mid-download (prevents list shrinkage)
  if (cached) {
    for (const c of cached) { if (!seen.has(c.url)) { combined.push(c); seen.add(c.url); } }
  }

  if (combined.length === 0) {
    if (!cached || cached.length === 0) {
      if (!daemonOnline) { show("daemonOffline"); applyTranslations(); return; }
      show("emptyState"); applyTranslations(); return;
    }
    return;
  }

  await chrome.storage.local.set({ [CACHE_KEY]: combined });
  if (cached && JSON.stringify(cached) === JSON.stringify(combined)) return;
  renderHistory(combined);

  if (activePending.length > 0) startPolling();
  else stopPolling();
}

// ── render ────────────────────────────────────────────

function renderHistory(entries) {
  hide("emptyState");
  hide("daemonOffline");
  const clearBtn = document.getElementById("clearAllBtn");
  if (clearBtn) clearBtn.hidden = !(entries && entries.length);
  const container = document.getElementById("historyList");
  container.innerHTML = "";

  const doneCount = entries.filter(e => e.status === "done").length;
  document.getElementById("counter").textContent = doneCount ? t("files", { n: doneCount }) : "";

  const groups = {};
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  for (const e of entries) {
    const ts = new Date(e.timestamp || now).getTime();
    let label;
    if (ts >= todayStart.getTime()) label = t("today");
    else if (ts >= yesterdayStart.getTime()) label = t("yesterday");
    else label = t("earlier");
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }

  const order = [t("today"), t("yesterday"), t("earlier")];
  for (const label of order) {
    if (!groups[label]) continue;
    const groupEl = document.createElement("div");
    groupEl.className = "date-group";
    groupEl.innerHTML = `<div class="date-label">${escHtml(label)}</div>`;
    for (const item of groups[label]) groupEl.appendChild(createItem(item));
    container.appendChild(groupEl);
  }
}

function createItem(item) {
  const el = document.createElement("div");
  el.className = "history-item";

  const title = extractTitle(item);
  const host = safeUrl(item.url, (u) => u.hostname.replace(/^www\./, ""));
  const time = formatTime(item.timestamp);

  let statusDot, statusLabel, statusClass;
  switch (item.status) {
    case "done": statusDot = "dot-done"; statusLabel = t("done"); statusClass = "status-done"; break;
    case "downloading": statusDot = "dot-pending"; statusLabel = t("downloading"); statusClass = "status-pending"; break;
    case "queued": statusDot = "dot-pending"; statusLabel = t("queued"); statusClass = "status-pending"; break;
    case "failed": statusDot = "dot-failed"; statusLabel = t("failed"); statusClass = "status-failed"; break;
    default: statusDot = ""; statusLabel = item.status || ""; statusClass = "";
  }

  el.innerHTML = `
    <div class="item-content">
      <div class="item-title" title="${escAttr(title)}">${escHtml(title)}</div>
      <div class="item-meta">
        <span class="status ${statusClass}" title="${statusLabel}"><span class="dot ${statusDot}"></span></span>
        <span class="item-url">${escHtml(host)}</span>
        <span class="item-time">${time}</span>
      </div>
    </div>
    <span class="item-actions" data-url="${escAttr(item.url)}" data-path="${escAttr(item.filepath || "")}"></span>
  `;

  const actionsDiv = el.querySelector(".item-actions");
  if (item.status === "done") {
    if (item.filepath) {
      addAction(actionsDiv, ICONS.play, t("play"), () => sendToDaemon("POST", "/open", { path: item.filepath }));
      addAction(actionsDiv, ICONS.reveal, t("openFolder"), () => sendToDaemon("POST", "/reveal", { path: item.filepath }));
    }
    addAction(actionsDiv, ICONS.redownload, t("redownload"), () => startDownload(item.url, item.title));
    addAction(actionsDiv, ICONS.cancel, t("remove"), () => removeItem(item));
  } else if (item.status === "failed") {
    addAction(actionsDiv, ICONS.retry, t("retry"), () => startDownload(item.url, item.title));
    addAction(actionsDiv, ICONS.cancel, t("remove"), () => removeItem(item));
  } else if (item.status === "queued" || item.status === "downloading") {
    addAction(actionsDiv, ICONS.cancel, t("cancel"), () => removePending(item.url));
  }
  return el;
}

// Remove a single entry from the list: drop it from the daemon's history file AND
// from local pending/cache, then re-render. Lets Jane declutter (esp. failed ones).
async function removeItem(item) {
  try {
    await fetch(`${DAEMON}/history-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: item.url }),
    });
  } catch (e) {}
  for (const key of [STORAGE_KEY, CACHE_KEY]) {
    const { [key]: arr = [] } = await chrome.storage.local.get(key);
    if (Array.isArray(arr)) {
      await chrome.storage.local.set({ [key]: arr.filter((e) => e.url !== item.url) });
    }
  }
  await loadHistory();
}

// Clear the whole list (keeps nothing). Wipes daemon history + local pending/cache.
async function clearAllHistory() {
  try {
    await fetch(`${DAEMON}/history-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: "all" }),
    });
  } catch (e) {}
  await chrome.storage.local.set({ [STORAGE_KEY]: [], [CACHE_KEY]: [] });
  await loadHistory();
}

function addAction(parent, svg, tooltip, handler) {
  const btn = document.createElement("button");
  btn.className = "action-btn icon-only";
  btn.dataset.tooltip = tooltip;
  btn.innerHTML = svg;
  btn.addEventListener("click", handler);
  parent.appendChild(btn);
}

// ── download ──────────────────────────────────────────

async function onDownload() {
  if (!currentTabUrl) return;
  // Some sites' anti-bot blocks yt-dlp at the network layer (Douyin's a_bogus), or
  // serve the video via MSE so there's no plain file URL (Xiaohongshu). For those we
  // read the real stream off the page and download it directly. See DIRECT_SITES.
  const site = directSiteFor(currentTabUrl);
  if (site) {
    await startDirectDownload(site);
    return;
  }
  // Feed sites: the tab URL is a timeline (x.com/home), not the video. Find the post
  // whose video is playing / on screen and hand yt-dlp that post's own URL.
  const feed = feedSiteFor(currentTabUrl);
  if (feed) {
    const found = await resolveFeedPost(feed);
    if (found) return startDownload(found.url, found.title);
    if (!feed.isPostUrl(currentTabUrl)) {
      showMsg(t("feedNoVideo"), "error");
      return;
    }
  }
  await startDownload(currentTabUrl, currentTabTitle);
}

// ── feed sites ────────────────────────────────────────
// yt-dlp handles the single-post URL fine; we only need to find it. `find` is injected
// into the page (self-contained) and returns { url, title } or null.
const FEED_SITES = [
  {
    name: "x",
    host: /(^|\.)(x|twitter)\.com$/i,
    isPostUrl: (url) => /\/status\/\d+/.test(url),
    find: findXPostWithVideo,
  },
];

function feedSiteFor(url) {
  const host = safeUrl(url, (u) => u.hostname) || "";
  return FEED_SITES.find((s) => s.host.test(host)) || null;
}

async function resolveFeedPost(feed) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const injection = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: feed.find });
    return (injection && injection[0] && injection[0].result) || null;
  } catch { return null; }
}

// Injected into an X/Twitter tab. Picks the playing video, else the one most on screen,
// and returns the URL of the tweet that owns it. Each tweet is an <article>; its
// timestamp is wrapped in a link to /<user>/status/<id>. A quoted tweet sits inside the
// outer article with its own timestamp, so take the last status link *before* the video.
function findXPostWithVideo() {
  const vh = window.innerHeight;
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  };
  const videos = [...document.querySelectorAll("article video")]
    .map((v) => { const seen = onScreen(v); return { v, score: seen && seen + (v.paused ? 0 : 1e6) }; })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { v } of videos) {
    const article = v.closest("article");
    let best = null;
    for (const a of article.querySelectorAll('a[href*="/status/"]')) {
      if (!a.querySelector("time")) continue;
      if (a.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING) best = a;
    }
    const m = best && best.getAttribute("href").match(/^\/([^/]+)\/status\/(\d+)/);
    if (!m) continue;
    const text = article.querySelector('[data-testid="tweetText"]');
    const title = ((text && text.innerText) || "").replace(/\s+/g, " ").trim().slice(0, 80);
    return { url: `https://x.com/${m[1]}/status/${m[2]}`, title: title || `${m[1]}_${m[2]}` };
  }
  return null;
}

// ── direct-grab sites ─────────────────────────────────
// Each site supplies a `grab` function that is injected into the page (so it must be
// fully self-contained) and returns { url, title }. Add a new site = one entry here.
const DIRECT_SITES = [
  { name: "douyin", host: /(^|\.)douyin\.com$/i, referer: "https://www.douyin.com/", grab: grabDouyinStream },
  { name: "xiaohongshu", host: /(^|\.)xiaohongshu\.com$/i, referer: "https://www.xiaohongshu.com/", grab: grabXhsStream },
];

function directSiteFor(url) {
  const host = safeUrl(url, (u) => u.hostname) || "";
  return DIRECT_SITES.find((s) => s.host.test(host)) || null;
}

// Injected into a Douyin tab (MAIN world). a_bogus blocks yt-dlp, so we read the real
// stream off the page. We ONLY return a session-free (unsigned) URL: clean zjcdn links
// download with the daemon's cookieless curl, whereas the link the <video> is actively
// playing is often a douyinvod link signed with tk=webid (bound to your login session)
// that 403s the daemon. The clean URLs live in the aweme's playAddr/bitRateList in the
// React tree, matched by modal_id so we get THIS video — and they exist even when logged
// in. The catch is the SPA hydrates that data asynchronously, so we retry until it's there.
async function grabDouyinStream() {
  const isSigned = (u) => /tk=webid|[?&]signature=|[?&]policy=/.test(u || "");
  const modalId =
    (location.href.match(/modal_id=(\d+)/) || location.href.match(/\/video\/(\d+)/) || [])[1] || "";

  const findOnce = () => {
    const candidates = [];
    let title = "";
    let root = null;
    const els = document.querySelectorAll("body *");
    for (let i = 0; i < els.length; i++) {
      const k = Object.keys(els[i]).find(
        (x) => x.startsWith("__reactContainer$") || x.startsWith("__reactFiber$")
      );
      if (k) { root = els[i][k]; break; }
    }
    if (root && modalId) {
      let done = false, scanned = 0;
      const pushList = (pa) => {
        if (!pa) return;
        if (Array.isArray(pa)) { for (const e of pa) { const u = e && (e.src || e.url); if (u) candidates.push(u); } }
        else if (pa.urlList) { for (const u of pa.urlList) if (u) candidates.push(u); }
      };
      const dig = (o, d) => {
        if (done || !o || typeof o !== "object" || d > 3) return;
        try {
          if ((String(o.awemeId) === modalId || String(o.aweme_id) === modalId) && o.video) {
            const v = o.video;
            pushList(v.playAddr); pushList(v.play_addr);
            if (v.bitRateList) for (const b of v.bitRateList) pushList(b.playAddr);
            title = (o.desc || "").slice(0, 80);
            done = true;
            return;
          }
        } catch (e) {}
        for (const k in o) {
          try { if (o[k] && typeof o[k] === "object") dig(o[k], d + 1); } catch (e) {}
        }
      };
      const stack = [[root, 0]];
      while (stack.length && !done && scanned < 80000) {
        const [node, depth] = stack.pop();
        if (!node || depth > 200) continue;
        scanned++;
        if (node.memoizedProps) dig(node.memoizedProps, 0);
        if (node.child) stack.push([node.child, depth + 1]);
        if (node.sibling) stack.push([node.sibling, depth]);
      }
    }
    return { clean: candidates.find((u) => !isSigned(u)) || "", title };
  };

  // Retry ~6s: the React data may not be hydrated yet the instant the user clicks.
  // THIS is what fixes the flaky "no url / signed-url 403 / please-play" failures.
  let r = findOnce();
  for (let i = 0; i < 12 && !r.clean; i++) {
    await new Promise((res) => setTimeout(res, 500));
    r = findOnce();
  }
  const title = r.title || (document.title || "").replace(/[-—|]\s*抖音.*$/, "").trim();
  return { url: r.clean, title };
}

// Injected into a Xiaohongshu note. The <video> src is a blob: (MSE), so the real
// CDN url isn't on the element — it lives in window.__INITIAL_STATE__. Self-contained.
async function grabXhsStream() {
  // noteDetailMap accumulates EVERY note visited this SPA session, so iterating it
  // returns the FIRST video viewed, not the current one. Match the URL's note id.
  const noteId = (location.pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-fA-F]+)/) || [])[1] || "";
  const findOnce = () => {
    try {
      const st = window.__INITIAL_STATE__;
      const nd = st && st.note && st.note.noteDetailMap;
      if (nd) {
        const ids = (noteId && nd[noteId]) ? [noteId] : Object.keys(nd);
        for (const id of ids) {
          const note = nd[id] && nd[id].note;
          const stream = note && note.video && note.video.media && note.video.media.stream;
          if (stream) {
            for (const codec of ["h264", "h265", "av1", "h266"]) {
              const arr = stream[codec];
              if (arr && arr[0] && arr[0].masterUrl) {
                const title = (note.title || note.desc || "").replace(/[\r\n]+/g, " ").slice(0, 80).trim();
                return { url: arr[0].masterUrl, title };
              }
            }
          }
        }
      }
    } catch (e) {}
    return { url: "", title: "" };
  };
  // Retry ~6s — __INITIAL_STATE__ may not be populated yet right when clicked.
  let r = findOnce();
  for (let i = 0; i < 12 && !r.url; i++) {
    await new Promise((res) => setTimeout(res, 500));
    r = findOnce();
  }
  return r;
}

async function startDirectDownload(site) {
  const btn = document.getElementById("downloadBtn");
  const dlIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const resetBtn = () => {
    btn.disabled = !/^https?:/.test(currentTabUrl);
    btn.innerHTML = `${dlIcon} ${t("download")}`;
  };
  btn.disabled = true;
  btn.innerHTML = `${dlIcon} ${t("douyinGrabbing")}`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: site.grab,
      world: "MAIN", // MUST run in the page's JS context — feed-page grabs read the
                     // React fiber / __INITIAL_STATE__, which the isolated world can't see.
    });
    const grabbed = injection && injection[0] && injection[0].result;
    if (!grabbed || !grabbed.url) {
      showMsg(t("douyinPlayFirst"), "error");
      resetBtn();
      return;
    }

    // Page title is often empty mid-render; fall back to the tab title, then to the
    // id from the URL (douyin /video/<id>, xhs /explore|/item/<id>) so files don't collide.
    const idFromUrl =
      (currentTabUrl.match(/(?:video|explore|item)\/(\w+)/) ||
       currentTabUrl.match(/modal_id=(\w+)/) || [])[1] || "";
    const title = grabbed.title || currentTabTitle || (idFromUrl ? `${site.name}_${idFromUrl}` : site.name);

    // The grab only ever returns a clean (unsigned) URL, which the daemon's curl CAN
    // fetch (verified). So hand it to the daemon like any other download — history,
    // cancel and quick-open all work natively.
    const res = await fetch(`${DAEMON}/download-direct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: grabbed.url,
        referer: site.referer,
        filename: `${title}.mp4`,
        pageUrl: currentTabUrl,
      }),
    });
    if (res.status === 202) {
      await onQueued(currentTabUrl, title);
    } else {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#e67e22" });
      showMsg(t("daemonError", { code: res.status }), "error");
    }
  } catch (e) {
    chrome.action.setBadgeText({ text: "✕" });
    chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });
    showMsg(t("daemonOfflineMsg"), "error");
  }
  resetBtn();
}

// Shared "download was queued" bookkeeping: persist a pending entry, flash the
// badge, refresh the list, start polling. Used by both the yt-dlp and direct paths.
async function onQueued(url, title) {
  const id = simpleHash(url);
  const proxyTitle = title || safeUrl(url, (u) => u.hostname.replace(/^www\./, ""));
  const entry = { id, url, title: proxyTitle, status: "queued", timestamp: new Date().toISOString() };
  const { [STORAGE_KEY]: pending = [] } = await chrome.storage.local.get(STORAGE_KEY);
  pending.unshift(entry);
  await chrome.storage.local.set({ [STORAGE_KEY]: pending });
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#27ae60" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3500);
  showMsg(t("sent"), "success");
  await loadHistory();
  startPolling();
}

async function onStartDaemon() {
  const btn = document.getElementById("startDaemonBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = t("detecting");
  try {
    const port = chrome.runtime.connectNative("com.xiaoer.videolab");
    port.onMessage.addListener((msg) => {
      if (msg.ok) {
        btn.textContent = "✓ " + t("started");
        btn.classList.add("copied");
        showMsg(t("started"), "success");
        setTimeout(async () => {
          try {
            const res = await fetch(`${DAEMON}/health`);
            if (res.ok) { hide("daemonOffline"); await loadHistory(); }
          } catch {}
        }, 2000);
      } else {
        btn.textContent = t("failed");
        showMsg(t("startFailed", { msg: msg.error || "" }), "error");
        btn.disabled = false;
      }
      setTimeout(() => { btn.textContent = t("startBtn"); btn.classList.remove("copied"); btn.disabled = false; }, 3000);
    });
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        btn.textContent = t("failed");
        showMsg(t("notInstalled"), "error");
        btn.disabled = false;
        setTimeout(() => { btn.textContent = t("startBtn"); }, 3000);
      }
    });
    port.postMessage({ action: "start" });
  } catch (e) {
    btn.textContent = t("failed");
    showMsg(t("startFailed", { msg: e.message }), "error");
    btn.disabled = false;
    setTimeout(() => { btn.textContent = t("startBtn"); }, 3000);
  }
}

async function startDownload(url, titleHint) {
  const btn = document.getElementById("downloadBtn");
  btn.disabled = true;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${t("detecting")}`;

  chrome.action.setBadgeText({ text: "…" });
  chrome.action.setBadgeBackgroundColor({ color: "#666" });

  try {
    const res = await fetch(`${DAEMON}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.status === 202) {
      await onQueued(url, titleHint);
    } else {
      const txt = await res.text();
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#e67e22" });
      showMsg(t("daemonError", { code: res.status }), "error");
    }
  } catch {
    chrome.action.setBadgeText({ text: "✕" });
    chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });
    showMsg(t("daemonOfflineMsg"), "error");
  }

  btn.disabled = /^https?:/.test(currentTabUrl);
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${t("download")}`;
}

// ── polling ───────────────────────────────────────────

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const { [STORAGE_KEY]: pending = [] } = await chrome.storage.local.get(STORAGE_KEY);
    if (pending.length === 0) { stopPolling(); return; }
    await loadHistory();
  }, 5000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/** Remove a pending download from storage, cancel on daemon, and refresh. */
async function removePending(url) {
  // Tell the daemon to kill the yt-dlp process for this URL (fire & forget)
  sendToDaemon("POST", "/cancel", { url });
  // Remove from local pending list
  const { [STORAGE_KEY]: pending = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const filtered = pending.filter(p => p.url !== url);
  if (filtered.length === pending.length) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  await loadHistory();
}

// ── helpers ───────────────────────────────────────────

async function sendToDaemon(method, path, body) {
  try {
    const res = await fetch(`${DAEMON}${path}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (path === "/open" || path === "/reveal") {
        const isNotFound = txt.includes("file not found");
        showMsg(isNotFound ? t("fileNotFound") : txt, "error");
      } else {
        showMsg(txt.length < 80 ? txt : t("daemonError", { code: res.status }), "error");
      }
    }
  } catch {
    showMsg(t("daemonOfflineMsg"), "error");
  }
}

function showMsg(text, type) {
  const el = document.getElementById("statusMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `status-msg ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

function show(id) { const el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add("hidden"); }

function setBtnLabel(text, disabled) {
  const btn = document.getElementById("downloadBtn");
  if (!btn) return;
  btn.disabled = disabled;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${text}`;
}

function formatTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t("justNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("minAgo", { n: min });
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return t("hrAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  return t("dayAgo", { n: days });
}

function extractTitle(item) {
  if (item.title) return item.title;
  if (item.filename) {
    const cleaned = item.filename.replace(/\.\w+$/, "").replace(/\s\[[\w-]+]$/, "");
    if (cleaned) return cleaned;
  }
  try { return new URL(item.url).hostname.replace(/^www\./, ""); }
  catch { return "Unknown"; }
}

// NOTE: also duplicated in background.js — keep in sync
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c; hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function safeUrl(url, fn) { try { return fn(new URL(url)); } catch { return url || ""; } }

function escHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escAttr(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ── video detection ────────────────────────────────

function isLikelyVideoSite(url) {
  try {
    const host = new URL(url).hostname;
    const sites = [
      "youtube.com", "youtu.be", "bilibili.com", "b23.tv",
      "twitter.com", "x.com", "tiktok.com", "douyin.com",
      "vimeo.com", "twitch.tv", "instagram.com", "facebook.com",
      "reddit.com", "weibo.com", "xiaohongshu.com",
      "ixigua.com", "youku.com", "iqiyi.com", "ted.com",
      "dailymotion.com", "sohu.com", "qq.com", "acfun.cn",
    ];
    return sites.some(s => host.includes(s));
  } catch { return false; }
}

async function probeVideo(url) {
  try {
    const res = await fetch(`${DAEMON}/probe?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(50000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.has_video === true;
  } catch { return null; }
}
