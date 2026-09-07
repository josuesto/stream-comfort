import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../src/shared/settings';

type Sender = chrome.runtime.MessageSender;
type Listener = (message: unknown, sender: Sender, respond: (response: unknown) => void) => boolean | undefined;
type Reply = { ok: boolean; error?: string; paused?: boolean; settings?: ReturnType<typeof defaultSettings> };
const id = 'test-extension';
const popup: Sender = { id, url: `chrome-extension://${id}/popup.html` };
const content: Sender = {
  id, url: 'https://www.crunchyroll.com/watch/EPISODE-A/example',
  origin: 'https://www.crunchyroll.com', tab: { id: 17 } as chrome.tabs.Tab,
};

function makeArea(data: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => ({ [key]: structuredClone(data[key]) })),
    set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(data, structuredClone(values)); }),
    remove: vi.fn(async (key: string) => { delete data[key]; }),
  };
}

describe('MV3 settings and temporary tab pause', () => {
  let listener: Listener;
  let removed: (tabId: number) => void;
  let localData: Record<string, unknown>;
  let sessionData: Record<string, unknown>;
  let api: {
    runtime: {
      id: string;
      getManifest: ReturnType<typeof vi.fn>;
      getURL: ReturnType<typeof vi.fn>;
      onMessage: { addListener: ReturnType<typeof vi.fn> };
    };
    storage: { local: ReturnType<typeof makeArea>; session: ReturnType<typeof makeArea> };
    tabs: { sendMessage: ReturnType<typeof vi.fn>; onRemoved: { addListener: ReturnType<typeof vi.fn> } };
  };

  async function boot() {
    vi.resetModules();
    await import('../src/background');
  }

  function request(message: unknown, sender: Sender = popup): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const keepsChannel = listener(message, sender, response => resolve(response as Reply));
      if (keepsChannel !== true) reject(new Error('Expected an asynchronous response channel'));
    });
  }

  beforeEach(async () => {
    localData = {};
    sessionData = {};
    api = {
      runtime: {
        id,
        getManifest: vi.fn(() => ({ action: { default_popup: 'popup.html' } })),
        getURL: vi.fn((path: string) => `chrome-extension://${id}/${path}`),
        onMessage: { addListener: vi.fn((fn: Listener) => { listener = fn; }) },
      },
      storage: { local: makeArea(localData), session: makeArea(sessionData) },
      tabs: {
        sendMessage: vi.fn(async () => undefined),
        onRemoved: { addListener: vi.fn((fn: (tabId: number) => void) => { removed = fn; }) },
      },
    };
    vi.stubGlobal('chrome', api);
    await boot();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns defaults without overwriting storage', async () => {
    expect(await request({ type: 'GET_SETTINGS' })).toEqual({ ok: true, settings: defaultSettings() });
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('serializes simultaneous edits so independent settings are not lost', async () => {
    await Promise.all([
      request({ type: 'SET_SETTING', key: 'enabled', value: false }),
      request({ type: 'SET_SETTING', key: 'intro', value: false }),
      request({ type: 'SET_SETTING', key: 'nextEpisode', value: true }),
    ]);
    const result = await request({ type: 'GET_SETTINGS' });
    expect(result.settings?.enabled).toBe(false);
    expect(result.settings?.services.crunchyroll).toEqual({ intro: false, recap: true, credits: false, nextEpisode: true });
  });

  it('keeps settings after a worker restart', async () => {
    await request({ type: 'SET_SETTING', key: 'enabled', value: false });
    await boot();
    expect((await request({ type: 'GET_SETTINGS' })).settings?.enabled).toBe(false);
  });

  it('keeps pause through worker restart and navigation and isolates tabs', async () => {
    await request({ type: 'SET_TAB_PAUSE', tabId: 17, paused: true });
    expect(sessionData).toEqual({ 'pause:17': true });
    await boot();
    expect(await request({ type: 'GET_TAB_PAUSE' }, { ...content, url: 'https://www.crunchyroll.com/watch/EPISODE-B/next' }))
      .toEqual({ ok: true, paused: true });
    expect(await request({ type: 'GET_TAB_PAUSE' }, { ...content, tab: { id: 18 } as chrome.tabs.Tab }))
      .toEqual({ ok: true, paused: false });
    expect(localData).toEqual({});
  });

  it('broadcasts explicit resume even when the tab was already unpaused', async () => {
    await request({ type: 'SET_TAB_PAUSE', tabId: 17, paused: false });
    await request({ type: 'SET_TAB_PAUSE', tabId: 17, paused: false });
    expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(api.tabs.sendMessage).toHaveBeenLastCalledWith(17, { type: 'TAB_PAUSE_CHANGED', paused: false });
  });

  it('cleans up only the closed tab', async () => {
    sessionData['pause:17'] = true;
    sessionData['pause:18'] = true;
    removed(17);
    await request({ type: 'GET_SETTINGS' });
    expect(sessionData).toEqual({ 'pause:18': true });
  });

  it('preserves pause if the content script is absent during navigation', async () => {
    api.tabs.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
    expect(await request({ type: 'SET_TAB_PAUSE', tabId: 17, paused: true })).toEqual({ ok: true, paused: true });
    expect(await request({ type: 'GET_TAB_PAUSE' }, content)).toEqual({ ok: true, paused: true });
  });

  it('does not permit content scripts to edit settings or another tab pause', async () => {
    expect((await request({ type: 'SET_SETTING', key: 'credits', value: true }, content)).ok).toBe(false);
    expect((await request({ type: 'SET_TAB_PAUSE', tabId: 18, paused: false }, content)).ok).toBe(false);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.storage.session.set).not.toHaveBeenCalled();
  });

  it('validates extension identity and the actual sender origin', async () => {
    for (const sender of [
      { ...popup, id: 'another-extension' },
      { ...content, url: 'https://www.crunchyroll.com.evil.example/watch/X' },
      { ...content, origin: 'https://evil.example' },
      { ...popup, url: `chrome-extension://${id}/untrusted.html` },
    ]) {
      expect((await request({ type: 'GET_SETTINGS' }, sender)).ok).toBe(false);
    }
    expect(api.storage.local.get).not.toHaveBeenCalled();
  });

  it('ignores a claimed tab ID in a content request', async () => {
    sessionData['pause:17'] = true;
    expect(await request({ type: 'GET_TAB_PAUSE', tabId: 18 }, content)).toEqual({ ok: true, paused: true });
  });

  it('rejects malformed mutation values without writing', async () => {
    for (const message of [
      { type: 'SET_SETTING', key: 'credits', value: 'true' },
      { type: 'SET_SETTING', key: '__proto__', value: true },
      { type: 'SET_TAB_PAUSE', tabId: -1, paused: true },
      { type: 'SET_TAB_PAUSE', tabId: 1.5, paused: true },
      { type: 'SET_TAB_PAUSE', tabId: 17, paused: 'false' },
    ]) expect((await request(message)).ok).toBe(false);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.storage.session.set).not.toHaveBeenCalled();
  });

  it('reports storage failures and permits later requests to recover', async () => {
    api.storage.local.get.mockRejectedValueOnce(new Error('Unavailable'));
    expect((await request({ type: 'GET_SETTINGS' })).ok).toBe(false);
    expect((await request({ type: 'GET_SETTINGS' })).ok).toBe(true);
    api.storage.session.set.mockRejectedValueOnce(new Error('Unavailable'));
    expect((await request({ type: 'SET_TAB_PAUSE', tabId: 17, paused: true })).ok).toBe(false);
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('leaves unrelated content messages for their owner', () => {
    const respond = vi.fn();
    expect(listener({ type: 'GET_STATUS' }, popup, respond)).toBeUndefined();
    expect(respond).not.toHaveBeenCalled();
  });
});
