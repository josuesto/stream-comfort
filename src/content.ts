import { AutomationEngine } from './core/engine';
import { createServiceIntegration } from './services/registry';
import { isManualPlaybackIntent } from './services/manual-intent';
import { defaultSettings, normalizeSettings, SETTINGS_KEY } from './shared/settings';
import type { Request } from './shared/types';

const integration = createServiceIntegration(document, () => location.href);
if (integration) start(integration);

function start({adapter, manual}: NonNullable<ReturnType<typeof createServiceIntegration>>): void {
// Static scripts also run on browse pages so entering a watch route via SPA works.
// Bootstrap remains paused until local settings AND worker tab state are known.
let settings = defaultSettings();
let paused = true;
let initialized = false;
let initializing = false;
let settingsRevision = 0;
let pauseRevision = 0;
let disposed = false;
let pending: ReturnType<typeof setTimeout> | undefined;
let player: HTMLElement | null = null;
let video: HTMLVideoElement | null = null;
let lastUrl = location.pathname;

const engine = new AutomationEngine(adapter, () => ({settings, paused: paused || !initialized}));
const mediaEvents = ['loadedmetadata', 'loadstart', 'emptied', 'play', 'pause', 'ended', 'seeked', 'timeupdate'];

function schedule(): void {
  if (disposed || pending !== undefined) return;
  // Scheduling delay coalesces DOM updates; it never defines content boundaries.
  pending = setTimeout(() => {
    pending = undefined;
    try { bindPlayer(); engine.step(); } catch { initialized = false; }
  }, 100);
}

const playerObserver = new MutationObserver(schedule);
function bindPlayer(): void {
  const current = adapter.inspect();
  if (current.player !== player) {
    playerObserver.disconnect();
    player = current.player;
    if (player) playerObserver.observe(player, {subtree:true, childList:true, characterData:true, attributes:true,
      attributeFilter:['aria-hidden','aria-label','aria-disabled','disabled','hidden','inert','class','style']});
  }
  if (current.video !== video) {
    mediaEvents.forEach(name => video?.removeEventListener(name, schedule));
    video = current.video;
    mediaEvents.forEach(name => video?.addEventListener(name, schedule));
  }
}

function onManualIntent(event: Event): void {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  // Input can arrive before asynchronous preferences finish loading, or between
  // a SPA player replacement and the scheduled observer pass.
  bindPlayer();
  if (!isManualPlaybackIntent(event, adapter.inspect(), manual)) return;
  engine.manualInteraction(event.target);
}

document.addEventListener('pointerdown', onManualIntent, true);
document.addEventListener('click', onManualIntent, true);
document.addEventListener('keydown', onManualIntent, true);
const treeObserver = new MutationObserver(schedule);
treeObserver.observe(document.documentElement, {childList:true, subtree:true});
for (const name of ['visibilitychange', 'fullscreenchange']) document.addEventListener(name, schedule);
for (const name of ['popstate', 'hashchange', 'pageshow']) window.addEventListener(name, schedule);
// pushState in a page's main world is invisible to an isolated-world monkey patch.
// This one-second pathname check is the only idle polling; it does no DOM traversal.
const urlTimer = setInterval(() => {
  if (location.pathname !== lastUrl) { lastUrl = location.pathname; schedule(); }
}, 1000);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) {
    settingsRevision += 1;
    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    schedule();
  }
});
chrome.runtime.onMessage.addListener((message: Request, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'GET_STATUS') { respond(engine.getStatus()); return; }
  if (message.type === 'TAB_PAUSE_CHANGED' && typeof message.paused === 'boolean') {
    pauseRevision += 1;
    paused = message.paused;
    if (!paused) engine.resume();
    if (!initialized) void initialize();
    schedule();
    respond({ok:true});
  }
});

async function initialize(): Promise<void> {
  if (initializing) return;
  initializing = true;
  const settingsAtStart = settingsRevision;
  const pauseAtStart = pauseRevision;
  try {
    const [stored, tab] = await Promise.all([
      chrome.storage.local.get(SETTINGS_KEY),
      chrome.runtime.sendMessage({type:'GET_TAB_PAUSE'}),
    ]);
    if (!tab || tab.ok !== true || typeof tab.paused !== 'boolean') return;
    if (settingsRevision === settingsAtStart) settings = normalizeSettings(stored[SETTINGS_KEY]);
    if (pauseRevision === pauseAtStart) paused = tab.paused;
    initialized = true;
    schedule();
  } catch { /* No automation if the extension was reloaded or state is unavailable. */ }
  finally { initializing = false; }
}
void initialize();
window.addEventListener('pagehide', (event: PageTransitionEvent) => {
  if (event.persisted) return; // BFCache restores the existing document and listeners.
  disposed = true;
  if (pending !== undefined) clearTimeout(pending);
  clearInterval(urlTimer);
  treeObserver.disconnect();
  playerObserver.disconnect();
  engine.dispose();
}, {once:true});

}
