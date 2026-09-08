import { ACTIONS, isServiceId, isUiLanguage, type Action } from './shared/types';
import { SETTINGS_KEY, normalizeSettings, hasRetiredEpisodeSettings, updatePlatform, updateSetting, updateLanguage } from './shared/settings';

type Response =
  | { ok: true; settings: ReturnType<typeof normalizeSettings> }
  | { ok: true; paused: boolean }
  | { ok: false; error: string };

// Only transient work is in memory. Correctness-critical state is in Chrome storage.
let pending: Promise<void> = Promise.resolve();

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPopup(sender: chrome.runtime.MessageSender): boolean {
  const path = chrome.runtime.getManifest().action?.default_popup;
  return Boolean(path && !sender.tab && sender.url === chrome.runtime.getURL(path));
}

function isServiceContent(sender: chrome.runtime.MessageSender): boolean {
  if (!validTabId(sender.tab?.id) || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    const supported = url.origin === 'https://www.crunchyroll.com' || url.origin === 'https://play.hbomax.com';
    return supported && (!sender.origin || sender.origin === url.origin);
  } catch {
    return false;
  }
}

const pauseKey = (tabId: number) => `pause:${tabId}`;
const denied = (): Response => ({ ok: false, error: 'This request is not permitted.' });
const invalid = (): Response => ({ ok: false, error: 'Invalid extension request.' });

async function handle(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<Response> {
  if (sender.id !== chrome.runtime.id) return denied();
  const popup = isPopup(sender);
  const content = isServiceContent(sender);

  switch (message.type) {
    case 'GET_SETTINGS': {
      if (!popup && !content) return denied();
      return serial(async () => {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        const settings = normalizeSettings(data[SETTINGS_KEY]);
        if (hasRetiredEpisodeSettings(data[SETTINGS_KEY])) {
          await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        }
        return { ok: true, settings };
      });
    }
    case 'SET_LANGUAGE': {
      if (!popup) return denied();
      const { language } = message;
      if (!isUiLanguage(language)) return invalid();
      return serial(async () => {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        const settings = updateLanguage(normalizeSettings(data[SETTINGS_KEY]), language);
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        return { ok: true, settings };
      });
    }
    case 'SET_SETTING': {
      if (!popup) return denied();
      const { key, value, service } = message;
      if (typeof value !== 'boolean' || (key !== 'enabled' && !ACTIONS.includes(key as Action))) return invalid();
      if (key !== 'enabled' && !isServiceId(service)) return invalid();
      return serial(async () => {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        const settings = updateSetting(normalizeSettings(data[SETTINGS_KEY]), key as 'enabled' | Action, value,
          isServiceId(service) ? service : undefined);
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        return { ok: true, settings };
      });
    }
    case 'SET_PLATFORM': {
      if (!popup) return denied();
      const { service, enabled } = message;
      if (!isServiceId(service) || typeof enabled !== 'boolean') return invalid();
      return serial(async () => {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        const settings = updatePlatform(normalizeSettings(data[SETTINGS_KEY]), service, enabled);
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        return { ok: true, settings };
      });
    }
    case 'GET_TAB_PAUSE': {
      if (!content || !validTabId(sender.tab?.id)) return denied();
      const key = pauseKey(sender.tab.id);
      return serial(async () => {
        const data = await chrome.storage.session.get(key);
        // Missing is the initial state; malformed saved state conservatively pauses.
        return { ok: true, paused: data[key] === undefined ? false : data[key] !== false };
      });
    }
    case 'SET_TAB_PAUSE': {
      if (!popup) return denied();
      const { tabId, paused } = message;
      if (!validTabId(tabId) || typeof paused !== 'boolean') return invalid();
      return serial(async () => {
        await chrome.storage.session.set({ [pauseKey(tabId)]: paused });
        // Always notify, including false -> false: this explicitly resumes a manual hold.
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'TAB_PAUSE_CHANGED', paused });
        } catch {
          // The tab may be loading/closed. Its next content script reads saved state.
        }
        return { ok: true, paused };
      });
    }
    default:
      return invalid();
  }
}

const handledTypes = new Set(['GET_SETTINGS', 'SET_LANGUAGE', 'SET_SETTING', 'SET_PLATFORM', 'GET_TAB_PAUSE', 'SET_TAB_PAUSE']);

// Register synchronously. Async listeners require newer Chrome rollout behavior.
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isRecord(message) || typeof message.type !== 'string' || !handledTypes.has(message.type)) return;
  void handle(message, sender).then(sendResponse, () => sendResponse({
    ok: false,
    error: 'Local storage is unavailable. Please try again.',
  }));
  return true;
});

chrome.tabs.onRemoved.addListener(tabId => {
  void serial(() => chrome.storage.session.remove(pauseKey(tabId))).catch(() => {
    // Browser restart also clears session state; no viewing information is retained.
  });
});
