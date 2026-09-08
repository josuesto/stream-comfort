// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPopup } from '../src/popup/popup';
import { defaultSettings } from '../src/shared/settings';
import { messages, translate, type MessageKey } from '../src/popup/i18n';
import { ACTIONS, type Request, type ServiceId, type Settings, type TabStatus } from '../src/shared/types';

const html = readFileSync(resolve('src/popup/popup.html'), 'utf8');
const originalSettings = (): Settings => ({
  version: 2,
  language: 'es',
  enabled: true,
  platforms: { crunchyroll: true, hbomax: true },
  actions: { intro: true, recap: false, credits: false, nextEpisode: false },
});
const originalStatus = (service: ServiceId = 'crunchyroll'): TabStatus => ({
  service, pageSupported: true, playerReady: true, paused: false,
  manualHold: false, lastAction: null, episodeId: service === 'crunchyroll' ? 'EPISODE01' : '00000000-0000-4000-8000-000000000001',
  capabilities: {
    intro: { supported: true, detail: 'Control de intro verificado.' },
    recap: { supported: false, detail: 'No se ha verificado un control de resumen.' },
    credits: { supported: false, detail: 'No hay una señal fiable de créditos.' },
    nextEpisode: { supported: true, detail: 'Avanza al finalizar el vídeo.' },
  },
});

function fixture() {
  let settings = originalSettings();
  let status: TabStatus | null = originalStatus();
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
  const sendMessage = vi.fn(async (request: Request) => {
    if (request.type === 'GET_SETTINGS') return { ok: true, settings: structuredClone(settings) };
    if (request.type === 'SET_SETTING') {
      if (request.key === 'enabled') settings.enabled = request.value;
      else settings.actions[request.key] = request.value;
      return { ok: true, settings: structuredClone(settings) };
    }
    if (request.type === 'SET_LANGUAGE') {
      settings.language = request.language;
      return { ok: true, settings: structuredClone(settings) };
    }
    if (request.type === 'SET_PLATFORM') {
      settings.platforms[request.service] = request.enabled;
      return { ok: true, settings: structuredClone(settings) };
    }
    if (request.type === 'SET_TAB_PAUSE') {
      if (status) status = { ...status, paused: request.paused, manualHold: request.paused ? status.manualHold : false };
      return { ok: true, paused: request.paused };
    }
    return { ok: false };
  });
  const tabMessage = vi.fn(async () => {
    if (!status) throw new Error('Could not establish connection');
    return structuredClone(status);
  });
  const api = {
    runtime: { sendMessage },
    tabs: { query: vi.fn(async () => [{ id: 7 }]), sendMessage: tabMessage },
    storage: {
      onChanged: {
        addListener: vi.fn(listener => listeners.add(listener)),
        removeListener: vi.fn(listener => listeners.delete(listener)),
      },
    },
  } as unknown as Pick<typeof chrome, 'tabs' | 'runtime' | 'storage'>;
  return {
    api, sendMessage, tabMessage, listeners,
    settings: () => settings,
    setSettings: (value: Settings) => { settings = value; },
    setStatus: (value: TabStatus | null) => { status = value; },
  };
}

function input(id: string) { return document.getElementById(id) as HTMLInputElement; }
async function settle() { for (let count = 0; count < 8; count += 1) await Promise.resolve(); }
async function change(id: string, checked: boolean) {
  input(id).checked = checked;
  input(id).dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}
async function changeLanguage(value: 'en' | 'es') {
  const select = document.getElementById('language') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

describe('popup controls', () => {
  let cleanup: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  });
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });
  async function start(f = fixture()) {
    const controller = await mountPopup(document, f.api);
    cleanup = controller.dispose;
    return { ...f, controller };
  }

  it.each(['en', 'es'] as const)('offers only the four playback actions in %s', async language => {
    const f = fixture();
    f.setSettings({ ...originalSettings(), language });
    await start(f);
    expect([...document.querySelectorAll('.actions input')].filter(node => !node.id.startsWith('platform-')).map(node => node.id))
      .toEqual(['intro', 'recap', 'credits', 'nextEpisode']);
    expect(document.querySelector('#selectedEpisode, #edit-episodes, #episodes-panel')).toBeNull();
    expect(input('nextEpisode').checked).toBe(false);
  });

  it.each(['en', 'es'] as const)('keeps an unchanged %s popup still instead of rewriting it on each poll', async language => {
    const initial = fixture();
    initial.setSettings({ ...originalSettings(), language });
    const f = await start(initial);
    const control = document.getElementById('tab-pause')!;
    control.focus();
    document.body.scrollTop = 40;
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver(records => changes.push(...records));
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    await vi.advanceTimersByTimeAsync(10000);
    changes.push(...observer.takeRecords());
    observer.disconnect();
    expect(f.tabMessage.mock.calls.length).toBeGreaterThan(1);
    expect(changes).toHaveLength(0);
    expect(document.activeElement).toBe(control);
    expect(document.body.scrollTop).toBe(40);
  });

  it('starts in English independently of browser language and translates platform controls', async () => {
    document.documentElement.lang = 'es';
    const f = fixture();
    f.setSettings(defaultSettings());
    await start(f);
    expect(document.documentElement.lang).toBe('en');
    expect(input('language').value).toBe('en');
    expect(document.getElementById('intro-label')?.textContent).toBe('Skip intros');
    expect(document.getElementById('status')?.textContent).toBe('Ready in this tab');
    expect(document.getElementById('tab-heading')?.textContent).toBe('This tab');
    document.getElementById('platforms-button')!.click();
    expect(document.getElementById('platforms-heading')?.textContent).toBe('Your platforms');
    expect(document.getElementById('platforms-button')?.textContent).toBe('Back');
    await changeLanguage('es');
    expect(document.getElementById('platforms-heading')?.textContent).toBe('Tus plataformas');
    expect(document.getElementById('platforms-button')?.textContent).toBe('Volver');
    for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
      expect(node.textContent).toBe(messages.es[node.dataset.i18n as MessageKey]);
    }
  });

  it('keeps skip preferences and paused state intact, and remembers language on reopen', async () => {
    const f = fixture();
    const previous = originalSettings();
    previous.enabled = false;
    previous.platforms.hbomax = false;
    f.setSettings(previous);
    f.setStatus({ ...originalStatus(), paused: true, manualHold: true });
    const mounted = await start(f);
    await changeLanguage('en');
    expect(f.settings()).toEqual({ ...previous, language: 'en' });
    expect(document.getElementById('tab-pause')?.textContent).toBe('Resume for this tab');
    expect(document.getElementById('manual-hold')?.hidden).toBe(false);
    expect(f.sendMessage.mock.calls.map(([m]) => m.type)).toEqual(['GET_SETTINGS', 'SET_LANGUAGE']);
    mounted.controller.dispose();
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    await start(f);
    expect(document.documentElement.lang).toBe('en');
    expect(document.getElementById('enabled-label')?.textContent).toBe('Enable extension');
  });

  it('rolls back a failed language save and allows retry without altering skip choices', async () => {
    const f = await start();
    const previous = structuredClone(f.settings());
    f.sendMessage.mockRejectedValueOnce(new Error('storage unavailable'));
    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('es');
    expect(input('language').value).toBe('es');
    expect(input('language').disabled).toBe(false);
    expect(document.getElementById('error')?.textContent).toContain('preferencia anterior');
    expect(f.settings()).toEqual(previous);
    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(f.settings()).toEqual({ ...previous, language: 'en' });
  });

  it('lets an unrelated page change all shared preferences and language', async () => {
    const f = fixture();
    f.setStatus(null);
    await start(f);
    await changeLanguage('en');
    expect(document.getElementById('status')?.textContent).toBe('No supported player in this tab');
    expect(document.getElementById('tab-note')?.textContent).toBe('Tab pause is available when a supported player is open.');
    expect(document.getElementById('service-heading')?.textContent).toBe('Playback preferences');
    expect(document.querySelector('.support-note')?.textContent).toBe('Currently supports Crunchyroll and HBO Max.');
    for (const action of ACTIONS) {
      expect(input(action).disabled).toBe(false);
      await change(action, true);
      expect(f.settings().actions[action]).toBe(true);
    }
    expect((document.getElementById('tab-pause') as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks conflicting edits until a pending language save settles', async () => {
    const f = await start();
    let resolveSave!: (value: { ok: boolean; settings: Settings }) => void;
    f.sendMessage.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
    await changeLanguage('en');
    expect(input('language').disabled).toBe(true);
    expect(input('intro').disabled).toBe(true);
    await change('intro', false);
    expect(f.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_SETTING' }));
    resolveSave({ ok: true, settings: { ...f.settings(), language: 'en' } });
    await settle();
    expect(input('language').disabled).toBe(false);
    expect(input('intro').checked).toBe(true);
    expect(document.documentElement.lang).toBe('en');
  });

  it('rejects a malformed saved language instead of breaking popup rendering', async () => {
    const f = await start();
    f.sendMessage.mockResolvedValueOnce({ ok: true, settings: { ...f.settings(), language: 'fr' as never } });
    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('es');
    expect(input('language').value).toBe('es');
    expect(input('language').disabled).toBe(false);
    expect(document.getElementById('error-panel')?.hidden).toBe(false);
  });

  it('explains tab limitations without disabling the shared choices', async () => {
    const f = fixture();
    const status = originalStatus('hbomax');
    status.lastAction = 'recap';
    status.capabilities.intro = { supported: false, detail: 'Solo español.', reason: 'spanishPlayerRequired' };
    f.setStatus(status);
    await start(f);
    await changeLanguage('en');
    expect(document.getElementById('tab-limitations')?.textContent).toContain('player set to Spanish');
    expect(document.getElementById('last-action')?.textContent).toBe('Last action: recap.');
    expect(input('intro').disabled).toBe(false);
    await change('intro', false);
    expect(document.getElementById('tab-limitations')?.hidden).toBe(true);
  });

  it('keeps both catalogs complete with matching interpolation parameters', () => {
    expect(Object.keys(messages.es).sort()).toEqual(Object.keys(messages.en).sort());
    for (const key of Object.keys(messages.en) as MessageKey[]) {
      expect(messages.es[key].match(/\{\w+\}/g) ?? []).toEqual(messages.en[key].match(/\{\w+\}/g) ?? []);
      for (const language of ['en', 'es'] as const) {
        expect(translate(language, key, { service: 'Crunchyroll', count: 2, action: 'intro' })).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('does not flash an older unpaused status after the pause button succeeds', async () => {
    const f = await start();
    let resolve!: (value: TabStatus) => void;
    f.tabMessage.mockReturnValueOnce(new Promise<TabStatus>(done => { resolve = done; }));
    const pending = f.controller.refreshStatus();
    document.getElementById('tab-pause')!.click();
    await settle();
    expect(document.getElementById('status')!.textContent).toBe('En pausa en esta pestaña');
    resolve(originalStatus());
    await pending;
    expect(document.getElementById('status')!.textContent).toBe('En pausa en esta pestaña');
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('tab-pause')!.textContent).toBe('Reanudar en esta pestaña');
  });

  it('preserves independently selected actions when the main switch is cycled', async () => {
    const f = await start();
    expect(input('intro').checked).toBe(true);
    expect(input('nextEpisode').checked).toBe(false);
    expect(input('credits').checked).toBe(false);
    await change('nextEpisode', true);
    await change('intro', false);
    await change('enabled', false);
    await change('enabled', true);
    expect(f.settings().actions).toEqual({ intro: false, recap: false, credits: false, nextEpisode: true });
    expect(input('intro').checked).toBe(false);
    expect(input('nextEpisode').checked).toBe(true);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'enabled', value: true });
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'intro', value: false });
  });

  it('uses the same settings on HBO and Crunchyroll without service-specific writes', async () => {
    const f = fixture();
    f.setStatus(originalStatus('hbomax'));
    await start(f);
    expect(document.getElementById('service-heading')?.textContent).toBe('Preferencias de reproducción');
    await change('intro', false);
    await change('nextEpisode', true);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'nextEpisode', value: true });
    f.setStatus(originalStatus('crunchyroll'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(input('intro').checked).toBe(false);
    expect(input('nextEpisode').checked).toBe(true);
  });

  it('keeps an unsupported action editable and explains its availability', async () => {
    const f = await start();
    await change('recap', true);
    expect(input('recap').checked).toBe(true);
    expect(input('recap').disabled).toBe(false);
    expect(document.getElementById('recap-detail')?.textContent).toContain('HBO Max');
    expect(document.getElementById('tab-limitations')?.hidden).toBe(false);
    expect(f.settings().actions.recap).toBe(true);
  });

  it('preserves choices through unrelated pages, episode changes, and reopening', async () => {
    const f = fixture();
    f.setStatus(null);
    const { controller } = await start(f);
    await change('intro', false);
    await change('credits', true);
    for (const status of [originalStatus('crunchyroll'), originalStatus('hbomax'), null]) {
      f.setStatus(status);
      await controller.refreshStatus();
      expect(input('intro').checked).toBe(false);
      expect(input('credits').checked).toBe(true);
      expect(input('credits').disabled).toBe(false);
    }
    controller.dispose();
    await start(f);
    expect(input('credits').checked).toBe(true);
    expect(input('intro').checked).toBe(false);
  });

  it('keeps a pending shared save stable when the current tab changes', async () => {
    const f = await start();
    let finishSave!: (response: Awaited<ReturnType<typeof f.sendMessage>>) => void;
    f.sendMessage.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    await change('intro', false);
    f.setStatus(originalStatus('hbomax'));
    await f.controller.refreshStatus();
    expect(input('intro').checked).toBe(false);
    expect(input('intro').disabled).toBe(true);
    const settings = originalSettings();
    settings.actions.intro = false;
    finishSave({ ok: true, settings });
    await settle();
    expect(input('intro').checked).toBe(false);
    expect(input('intro').disabled).toBe(false);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'intro', value: false });
  });

  it('opens a simple platform panel and preserves independent platform and action choices', async () => {
    const f = fixture();
    f.setStatus(originalStatus('hbomax'));
    await start(f);
    const button = document.getElementById('platforms-button') as HTMLButtonElement;
    expect(document.getElementById('platforms-panel')?.hidden).toBe(true);
    button.click();
    expect(button.textContent).toBe('Volver');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('platforms-panel')?.hidden).toBe(false);
    expect(document.getElementById('playback-settings')?.hidden).toBe(true);
    expect(input('platform-crunchyroll').checked).toBe(true);
    expect(input('platform-hbomax').checked).toBe(true);
    await change('platform-hbomax', false);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_PLATFORM', service: 'hbomax', enabled: false });
    expect(f.settings().platforms).toEqual({ crunchyroll: true, hbomax: false });
    expect(f.settings().actions).toEqual(originalSettings().actions);
    button.click();
    expect(button.textContent).toBe('Plataformas');
    expect(document.getElementById('playback-settings')?.hidden).toBe(false);
    expect(document.getElementById('status')?.textContent).toBe('Plataforma desactivada');
    expect(document.getElementById('status-detail')?.textContent).toContain('Activa HBO Max');
    expect(input('intro').checked).toBe(true);
    await change('enabled', false);
    expect(document.getElementById('status')?.textContent).toBe('Extensión desactivada');
    await change('enabled', true);
    expect(document.getElementById('status')?.textContent).toBe('Plataforma desactivada');
    expect(f.settings().platforms).toEqual({ crunchyroll: true, hbomax: false });
    button.click();
    await change('platform-hbomax', true);
    button.click();
    expect(document.getElementById('status')?.textContent).toBe('Lista en esta pestaña');
    expect(f.settings().actions).toEqual(originalSettings().actions);
  });

  it('rolls back a failed platform save and permits a retry', async () => {
    const f = await start();
    (document.getElementById('platforms-button') as HTMLButtonElement).click();
    f.sendMessage.mockRejectedValueOnce(new Error('storage unavailable'));
    await change('platform-hbomax', false);
    expect(input('platform-hbomax').checked).toBe(true);
    expect(input('platform-hbomax').disabled).toBe(false);
    expect(document.getElementById('error-panel')?.hidden).toBe(false);
    expect(f.settings().platforms.hbomax).toBe(true);
    await change('platform-hbomax', false);
    expect(input('platform-hbomax').checked).toBe(false);
    expect(document.getElementById('error-panel')?.hidden).toBe(true);
  });

  it('can configure platforms when the current page has no supported receiver', async () => {
    const f = fixture();
    f.setStatus(null);
    await start(f);
    (document.getElementById('platforms-button') as HTMLButtonElement).click();
    expect(input('platform-hbomax').disabled).toBe(false);
    await change('platform-crunchyroll', false);
    expect(f.settings().platforms).toEqual({ crunchyroll: false, hbomax: true });
  });

  it.each([
    ['unknown service', { ...originalStatus(), service: 'unknown' }],
    ['malformed feature', { ...originalStatus('hbomax'), capabilities: { ...originalStatus().capabilities, intro: { supported: 'true', detail: 'Invalid' } } }],
    ['missing feature', { ...originalStatus('hbomax'), capabilities: { intro: { supported: true, detail: 'Partial' } } }],
  ])('fails closed for a status handshake with %s', async (_name, invalidStatus) => {
    const f = fixture();
    f.tabMessage.mockResolvedValueOnce(invalidStatus as unknown as TabStatus);
    await start(f);
    expect(document.getElementById('service-heading')?.textContent).toBe('Preferencias de reproducción');
    expect(document.getElementById('status')?.textContent).toContain('No hay un reproductor compatible');
    for (const action of ACTIONS) expect(input(action).disabled).toBe(false);
    expect((document.getElementById('tab-pause') as HTMLButtonElement).disabled).toBe(true);
    await change('intro', false);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'intro', value: false });
  });

  it.each([
    ['missing actions', { ...originalSettings(), actions: undefined }],
    ['malformed actions', { ...originalSettings(), actions: { ...originalSettings().actions, intro: 'true' } }],
    ['malformed platform switch', { ...originalSettings(), platforms: { crunchyroll: true, hbomax: 'true' } }],
  ])('disables saving when the settings response has %s', async (_name, invalidSettings) => {
    const f = fixture();
    f.sendMessage.mockResolvedValueOnce({ ok: true, settings: invalidSettings as unknown as Settings });
    await start(f);
    expect(input('enabled').disabled).toBe(true);
    for (const action of ACTIONS) expect(input(action).disabled).toBe(true);
    expect(input('platform-hbomax').disabled).toBe(true);
    expect(document.getElementById('error-panel')?.hidden).toBe(false);
  });

  it('allows choosing actions while every platform is off', async () => {
    const f = fixture();
    f.setSettings({ ...originalSettings(), platforms: { crunchyroll: false, hbomax: false } });
    await start(f);
    for (const action of ACTIONS) expect(input(action).disabled).toBe(false);
    await change('nextEpisode', true);
    expect(f.settings().actions.nextEpisode).toBe(true);
    expect(f.settings().platforms).toEqual({ crunchyroll: false, hbomax: false });
  });

  it('keeps settings usable even when Chrome cannot identify an active tab', async () => {
    const f = fixture();
    vi.mocked(f.api.tabs.query).mockRejectedValueOnce(new Error('No tab'));
    await start(f);
    for (const action of ACTIONS) expect(input(action).disabled).toBe(false);
    await change('credits', true);
    expect(f.settings().actions.credits).toBe(true);
    expect((document.getElementById('tab-pause') as HTMLButtonElement).disabled).toBe(true);
  });

  it('rolls back a rejected save and reports the error', async () => {
    const f = await start();
    f.sendMessage.mockRejectedValueOnce(new Error('storage unavailable'));
    await change('intro', false);
    expect(input('intro').checked).toBe(true);
    expect(input('intro').disabled).toBe(false);
    expect(document.getElementById('error-panel')?.hidden).toBe(false);
    expect(document.getElementById('error')?.textContent).toContain('preferencia anterior');
    await change('intro', false);
    expect(input('intro').checked).toBe(false);
    expect(document.getElementById('error-panel')?.hidden).toBe(true);
  });

  it('resumes a manual hold explicitly without enabling the global preference', async () => {
    const f = fixture();
    f.setSettings({ ...originalSettings(), enabled: false });
    f.setStatus({ ...originalStatus(), manualHold: true });
    await start(f);
    expect(document.getElementById('manual-hold')?.hidden).toBe(false);
    const pause = document.getElementById('tab-pause') as HTMLButtonElement;
    expect(pause.textContent).toContain('Reanudar');
    pause.click();
    await settle();
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_TAB_PAUSE', tabId: 7, paused: false });
    expect(f.settings().enabled).toBe(false);
    expect(document.getElementById('manual-hold')?.hidden).toBe(true);
    expect(pause.textContent).toContain('Pausar');
  });

  it('updates capability and pause controls after navigation without stale status', async () => {
    const f = await start();
    f.setStatus({ ...originalStatus(), pageSupported: false, playerReady: false });
    await f.controller.refreshStatus();
    expect(input('intro').disabled).toBe(false);
    expect(document.getElementById('status')?.textContent).toContain('No hay un reproductor compatible');
    f.setStatus({ ...originalStatus(), paused: true });
    await f.controller.refreshStatus();
    expect(input('intro').disabled).toBe(false);
    expect(document.getElementById('status')?.textContent).toContain('En pausa');
    expect(document.getElementById('tab-pause')?.textContent).toContain('Reanudar');
  });

  it('reflects local settings changes and stops polling when the popup closes', async () => {
    const f = await start();
    f.setSettings({ ...originalSettings(), enabled: false });
    for (const listener of f.listeners) listener({}, 'local');
    await settle();
    expect(input('enabled').checked).toBe(false);
    f.controller.dispose();
    expect(f.listeners.size).toBe(0);
    const calls = f.tabMessage.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(f.tabMessage).toHaveBeenCalledTimes(calls);
  });

  it('disables stale settings after a malformed refresh and recovers on retry', async () => {
    const f = await start();
    f.sendMessage.mockResolvedValueOnce({ ok: true, settings: { ...originalSettings(), platforms: null } as unknown as Settings });
    for (const listener of f.listeners) listener({}, 'local');
    await settle();
    expect(input('enabled').disabled).toBe(true);
    expect(input('intro').disabled).toBe(true);
    expect(input('platform-hbomax').disabled).toBe(true);
    await change('intro', false);
    expect(f.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_SETTING' }));
    (document.getElementById('retry') as HTMLButtonElement).click();
    await settle();
    expect(input('enabled').disabled).toBe(false);
    expect(input('intro').checked).toBe(true);
    expect(input('platform-hbomax').disabled).toBe(false);
  });
});
