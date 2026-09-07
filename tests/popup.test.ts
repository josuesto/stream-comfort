// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPopup } from '../src/popup/popup';
import { ACTIONS, type Request, type Settings, type TabStatus } from '../src/shared/types';

const html = readFileSync(resolve('src/popup/popup.html'), 'utf8');
const originalSettings = (): Settings => ({
  version: 1,
  enabled: true,
  services: { crunchyroll: { intro: true, recap: false, credits: false, nextEpisode: false } },
});
const originalStatus = (): TabStatus => ({
  service: 'crunchyroll', pageSupported: true, playerReady: true, paused: false,
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
      else settings.services.crunchyroll[request.key] = request.value;
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
    expect(document.getElementById('status-detail')?.textContent).toContain('HBO/Max');
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
});
