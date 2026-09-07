// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPopup } from '../src/popup/popup';
import { ACTIONS, type Request, type ServiceId, type Settings, type TabStatus } from '../src/shared/types';

const html = readFileSync(resolve('src/popup/popup.html'), 'utf8');
const originalSettings = (): Settings => ({
  version: 1,
  enabled: true,
  platforms: { crunchyroll: true, hbomax: true },
  services: {
    crunchyroll: { intro: true, recap: false, credits: false, nextEpisode: false },
    hbomax: { intro: true, recap: false, credits: false, nextEpisode: false },
  },
});
const originalStatus = (service: ServiceId = 'crunchyroll'): TabStatus => ({
  service, pageSupported: true, playerReady: true, paused: false,
  manualHold: false, lastAction: null,
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
      else if (request.service) settings.services[request.service][request.key] = request.value;
      else return { ok: false };
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

  it('preserves independently selected actions when the main switch is cycled', async () => {
    const f = await start();
    expect(input('intro').checked).toBe(true);
    expect(input('nextEpisode').checked).toBe(false);
    expect(input('credits').checked).toBe(false);
    await change('nextEpisode', true);
    await change('intro', false);
    await change('enabled', false);
    await change('enabled', true);
    expect(f.settings().services.crunchyroll).toEqual({ intro: false, recap: false, credits: false, nextEpisode: true });
    expect(input('intro').checked).toBe(false);
    expect(input('nextEpisode').checked).toBe(true);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'enabled', value: true });
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'intro', value: false, service: 'crunchyroll' });
  });

  it('shows and writes HBO Max preferences without changing Crunchyroll', async () => {
    const f = fixture();
    const preferences = originalSettings();
    preferences.services.hbomax.intro = false;
    f.setSettings(preferences);
    f.setStatus(originalStatus('hbomax'));
    await start(f);
    expect(document.getElementById('service-heading')?.textContent).toBe('HBO Max');
    expect(document.getElementById('autoplay-note')?.textContent).toContain('HBO Max');
    expect(document.getElementById('intro-detail')?.textContent).toContain('«Omitir intro»');
    expect(input('intro').checked).toBe(false);
    expect(input('nextEpisode').checked).toBe(false);
    await change('nextEpisode', true);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'nextEpisode', value: true, service: 'hbomax' });
    expect(f.settings().services.hbomax.nextEpisode).toBe(true);
    expect(f.settings().services.crunchyroll).toEqual(originalSettings().services.crunchyroll);
  });

  it('uses the current service capability handshake for every action', async () => {
    const f = fixture();
    const status = originalStatus('hbomax');
    status.capabilities.recap = { supported: true, detail: 'Control de resumen verificado.' };
    status.capabilities.credits = { supported: true, detail: 'Control de créditos verificado.' };
    status.capabilities.nextEpisode = { supported: false, detail: 'El control no confirma el siguiente episodio.' };
    f.setStatus(status);
    await start(f);
    expect(input('recap').disabled).toBe(false);
    expect(input('credits').disabled).toBe(false);
    expect(input('nextEpisode').disabled).toBe(true);
    expect(document.getElementById('nextEpisode-detail')?.textContent).toContain('no confirma');
    await change('recap', true);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'recap', value: true, service: 'hbomax' });
    await change('nextEpisode', true);
    expect(input('nextEpisode').checked).toBe(false);
    expect(f.settings().services.hbomax.nextEpisode).toBe(false);
  });

  it('changes displayed service preferences after navigation', async () => {
    const f = fixture();
    const preferences = originalSettings();
    preferences.services.hbomax.intro = false;
    preferences.services.hbomax.nextEpisode = true;
    f.setSettings(preferences);
    const { controller } = await start(f);
    expect(input('intro').checked).toBe(true);
    f.setStatus(originalStatus('hbomax'));
    await controller.refreshStatus();
    expect(document.getElementById('service-heading')?.textContent).toBe('HBO Max');
    expect(input('intro').checked).toBe(false);
    expect(input('nextEpisode').checked).toBe(true);
    f.setStatus(originalStatus());
    await controller.refreshStatus();
    expect(document.getElementById('service-heading')?.textContent).toBe('Crunchyroll');
    expect(document.getElementById('intro-detail')?.textContent).toContain('«Saltar intro»');
    expect(input('intro').checked).toBe(true);
    expect(input('nextEpisode').checked).toBe(false);
  });

  it('keeps a pending action save attached to its original service after navigation', async () => {
    const f = await start();
    let finishSave!: (response: Awaited<ReturnType<typeof f.sendMessage>>) => void;
    f.sendMessage.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    await change('intro', false);
    expect(input('intro').checked).toBe(false);
    f.setStatus(originalStatus('hbomax'));
    await f.controller.refreshStatus();
    expect(input('intro').checked).toBe(true);
    expect(input('intro').disabled).toBe(true);
    const responseSettings = originalSettings();
    responseSettings.services.crunchyroll.intro = false;
    finishSave({ ok: true, settings: responseSettings });
    await settle();
    expect(input('intro').checked).toBe(true);
    expect(input('intro').disabled).toBe(false);
    expect(f.sendMessage).toHaveBeenCalledWith({ type: 'SET_SETTING', key: 'intro', value: false, service: 'crunchyroll' });
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
    expect(f.settings().services).toEqual(originalSettings().services);
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
    expect(f.settings().services).toEqual(originalSettings().services);
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
    expect(document.getElementById('service-heading')?.textContent).toBe('Esta pestaña');
    expect(document.getElementById('status')?.textContent).toContain('no es compatible');
    for (const action of ACTIONS) {
      expect(input(action).disabled).toBe(true);
      expect(input(action).checked).toBe(false);
    }
    await change('intro', true);
    expect(f.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_SETTING' }));
    expect(input('intro').checked).toBe(false);
  });

  it.each([
    ['missing HBO Max settings', { ...originalSettings(), services: { crunchyroll: originalSettings().services.crunchyroll } }],
    ['malformed HBO Max settings', { ...originalSettings(), services: { ...originalSettings().services, hbomax: { ...originalSettings().services.hbomax, intro: 'true' } } }],
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

  it('explains unsupported features and keeps the episode skip list distinct', async () => {
    await start();
    expect(input('intro').disabled).toBe(false);
    expect(input('recap').disabled).toBe(true);
    expect(input('credits').disabled).toBe(true);
    expect(input('episode-list').disabled).toBe(true);
    expect(document.getElementById('recap-detail')?.textContent).toContain('No se ha verificado');
    expect(document.getElementById('credits-detail')?.textContent).toContain('señal fiable');
    expect(document.getElementById('episode-list-detail')?.textContent).toContain('No disponible');
    expect(input('recap').checked).toBe(false);
    expect(input('nextEpisode').disabled).toBe(false);
  });

  it('treats a missing receiver as unsupported and keeps the main preference available', async () => {
    const f = fixture();
    f.setStatus(null);
    await start(f);
    expect(input('enabled').disabled).toBe(false);
    for (const action of ACTIONS) expect(input(action).disabled).toBe(true);
    expect((document.getElementById('tab-pause') as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById('status')?.textContent).toContain('no es compatible');
    expect(document.getElementById('status-detail')?.textContent).toContain('Crunchyroll o HBO Max');
    expect(document.getElementById('service-heading')?.textContent).toBe('Esta pestaña');
    expect(document.getElementById('autoplay-note')?.textContent).toContain('cada plataforma');
    for (const action of ACTIONS) expect(input(action).checked).toBe(false);
    expect(f.api.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(f.tabMessage).toHaveBeenCalledWith(7, { type: 'GET_STATUS' });
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
    expect(input('intro').disabled).toBe(true);
    expect(document.getElementById('status')?.textContent).toContain('no es compatible');
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
