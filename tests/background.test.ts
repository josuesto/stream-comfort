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
const hboContent: Sender = {
  id, url: 'https://play.hbomax.com/video/watch/example',
  origin: 'https://play.hbomax.com', tab: { id: 18 } as chrome.tabs.Tab,
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

  it('removes legacy lists once while preserving current preferences and tab pauses', async () => {
    const current = defaultSettings();
    current.language = 'es';
    current.enabled = false;
    current.platforms.hbomax = false;
    current.services.crunchyroll.credits = true;
    localData.settings = {
      ...current, episodeLists: { crunchyroll: ['EPISODE01'], hbomax: [] },
      services: { ...current.services, crunchyroll: { ...current.services.crunchyroll, selectedEpisode: true } },
    };
    sessionData['pause:17'] = true;
    expect((await request({ type: 'GET_SETTINGS' })).settings).toEqual(current);
    expect(localData.settings).toEqual(current);
    expect(sessionData['pause:17']).toBe(true);
    await request({ type: 'GET_SETTINGS' });
    expect(api.storage.local.set).toHaveBeenCalledOnce();
    expect((await request({ type: 'SET_SETTING', key: 'selectedEpisode', value: true, service: 'crunchyroll' })).ok).toBe(false);
    const respond = vi.fn();
    expect(listener({ type: 'SET_EPISODE_LIST', service: 'crunchyroll', episodeIds: ['EPISODE01'] }, popup, respond)).toBeUndefined();
    expect(respond).not.toHaveBeenCalled();
    expect(api.storage.local.set).toHaveBeenCalledOnce();
  });

  it('keeps language across worker restarts and concurrent platform/action edits', async () => {
    await Promise.all([
      request({ type: 'SET_LANGUAGE', language: 'es' }),
      request({ type: 'SET_PLATFORM', service: 'hbomax', enabled: false }),
      request({ type: 'SET_SETTING', key: 'credits', service: 'crunchyroll', value: true }),
    ]);
    await boot();
    const saved = (await request({ type: 'GET_SETTINGS' })).settings!;
    expect(saved.language).toBe('es');
    expect(saved.platforms.hbomax).toBe(false);
    expect(saved.services.crunchyroll.credits).toBe(true);
    expect((await request({ type: 'SET_LANGUAGE', language: 'en' })).settings).toEqual({ ...saved, language: 'en' });
  });

  it('rejects malformed languages and language changes from streaming content', async () => {
    for (const language of [undefined, 'fr', 'ES', true, null, '__proto__']) {
      expect((await request({ type: 'SET_LANGUAGE', language })).ok).toBe(false);
    }
    for (const sender of [content, hboContent]) {
      expect((await request({ type: 'SET_LANGUAGE', language: 'es' }, sender)).ok).toBe(false);
    }
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('serializes simultaneous edits so independent settings are not lost', async () => {
    await Promise.all([
      request({ type: 'SET_SETTING', key: 'enabled', value: false }),
      request({ type: 'SET_SETTING', key: 'intro', value: false, service: 'crunchyroll' }),
      request({ type: 'SET_SETTING', key: 'nextEpisode', value: true, service: 'crunchyroll' }),
      request({ type: 'SET_SETTING', key: 'recap', value: false, service: 'hbomax' }),
      request({ type: 'SET_PLATFORM', service: 'hbomax', enabled: false }),
    ]);
    const result = await request({ type: 'GET_SETTINGS' });
    expect(result.settings?.enabled).toBe(false);
    expect(result.settings?.services.crunchyroll).toEqual({ intro: false, recap: true, credits: false, nextEpisode: true });
    expect(result.settings?.services.hbomax).toEqual({ intro: true, recap: false, credits: false, nextEpisode: false });
    expect(result.settings?.platforms).toEqual({ crunchyroll: true, hbomax: false });
  });

  it('reads old single-service preferences without overwriting them and migrates on the next edit', async () => {
    const previous = {
      version: 1, enabled: false,
      services: { crunchyroll: { intro: false, recap: false, credits: true, nextEpisode: true } },
    };
    localData.settings = previous;
    const read = await request({ type: 'GET_SETTINGS' }, hboContent);
    expect(read.ok).toBe(true);
    expect(read.settings?.enabled).toBe(false);
    expect(read.settings?.services.crunchyroll).toEqual(previous.services.crunchyroll);
    expect(read.settings?.services.hbomax).toEqual(defaultSettings().services.hbomax);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    const changed = await request({ type: 'SET_SETTING', key: 'intro', value: false, service: 'hbomax' });
    expect(changed.settings?.services.crunchyroll).toEqual(previous.services.crunchyroll);
    expect(changed.settings?.services.hbomax.intro).toBe(false);
    expect(localData.settings).toEqual(changed.settings);
  });

  it('requires an explicit supported service for action mutations', async () => {
    for (const service of [undefined, null, '', 'hbo', '__proto__', 'hbomax.evil']) {
      expect((await request({ type: 'SET_SETTING', key: 'credits', value: true, service })).ok).toBe(false);
    }
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect((await request({ type: 'SET_SETTING', key: 'enabled', value: false })).ok).toBe(true);
  });

  it('keeps settings after a worker restart', async () => {
    await request({ type: 'SET_SETTING', key: 'enabled', value: false });
    await boot();
    expect((await request({ type: 'GET_SETTINGS' })).settings?.enabled).toBe(false);
  });

  it('preserves each platform switch and action choices across global toggles and worker restart', async () => {
    await request({ type: 'SET_SETTING', key: 'credits', value: true, service: 'hbomax' });
    await request({ type: 'SET_PLATFORM', service: 'hbomax', enabled: false });
    await request({ type: 'SET_SETTING', key: 'enabled', value: false });
    await request({ type: 'SET_SETTING', key: 'enabled', value: true });
    await boot();
    const result = await request({ type: 'GET_SETTINGS' });
    expect(result.settings?.enabled).toBe(true);
    expect(result.settings?.platforms).toEqual({ crunchyroll: true, hbomax: false });
    expect(result.settings?.services.hbomax.credits).toBe(true);
    expect(result.settings?.services.crunchyroll.credits).toBe(false);
  });

  it('rejects unknown platforms, malformed switches, and content-script platform mutations', async () => {
    for (const message of [
      { type: 'SET_PLATFORM', service: 'unknown', enabled: false },
      { type: 'SET_PLATFORM', service: '__proto__', enabled: true },
      { type: 'SET_PLATFORM', enabled: false },
      { type: 'SET_PLATFORM', service: 'hbomax', enabled: 'false' },
    ]) expect((await request(message)).ok).toBe(false);
    expect((await request({ type: 'SET_PLATFORM', service: 'hbomax', enabled: false }, hboContent)).ok).toBe(false);
    expect(api.storage.local.set).not.toHaveBeenCalled();
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

  it('allows the observed HBO player origin to read preferences and its own pause', async () => {
    await request({ type: 'SET_TAB_PAUSE', tabId: 18, paused: true });
    expect(await request({ type: 'GET_SETTINGS' }, hboContent)).toEqual({ ok: true, settings: defaultSettings() });
    expect(await request({ type: 'GET_TAB_PAUSE' }, hboContent)).toEqual({ ok: true, paused: true });
    expect(await request({ type: 'GET_TAB_PAUSE' }, content)).toEqual({ ok: true, paused: false });
    expect((await request({ type: 'SET_SETTING', key: 'credits', value: true, service: 'hbomax' }, hboContent)).ok).toBe(false);
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
      { ...hboContent, url: 'https://play.hbomax.com.evil.example/video/watch/X' },
      { ...hboContent, url: 'https://auth.hbomax.com/', origin: 'https://auth.hbomax.com' },
      { ...hboContent, url: 'https://www.hbomax.com/', origin: 'https://www.hbomax.com' },
      { ...hboContent, url: 'http://play.hbomax.com/', origin: 'http://play.hbomax.com' },
      { ...hboContent, origin: 'https://evil.example' },
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
