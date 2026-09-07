import { AutomationEngine } from './core/engine';
import { createCrunchyrollAdapter, SELECTORS } from './services/crunchyroll';
import { defaultSettings, normalizeSettings, SETTINGS_KEY } from './shared/settings';
import type { Request } from './shared/types';

// Static scripts also run on browse pages so entering /watch via SPA works.
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
const adapter = createCrunchyrollAdapter();
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
  const target = event.target;
  if (!player || !video) return;
  const inPlayer = player.contains(target);
  if (event instanceof KeyboardEvent) {
    if (target.matches('input:not([type="range"]),textarea,[contenteditable="true"]')) return;
    // Button activation is handled by its trusted click, including keyboard Enter.
    if (target.closest('button') && ['Enter', ' '].includes(event.key)) return;
    const playbackKeys = [' ', 'k', 'K', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
    const globalPlayerKey = target === document.body || target === document.documentElement;
    if ((!inPlayer && !globalPlayerKey) || !playbackKeys.includes(event.key)) return;
    // Starting playback is not a request to inhibit future skips.
    if ([' ', 'k', 'K'].includes(event.key) && video.paused) return;
    if (target.closest('[data-testid="volume-slider-container"]')) return;
  } else {
    if (!inPlayer) return;
    const button = target.closest('button');
    const seek = target.closest('input.timeline-slider,[data-testid="jump-backward-button"],[data-testid="jump-forward-button"]');
    const skip = button?.querySelector(SELECTORS.skipIcon);
    const next = target.closest(SELECTORS.next);
    const surface = inPlayer && !target.closest('button,input,[role="slider"],[role="menu"]');
    const pauseIntent = (target.closest('[data-testid="play-pause-button"]') || surface) && !video.paused;
    if (!seek && !skip && !next && !pauseIntent) return;
  }
  engine.manualInteraction(target);
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
