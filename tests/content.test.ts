// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.crunchyroll.com/es-es/watch/EPISODE1/fixture"}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { defaultSettings, SETTINGS_KEY } from '../src/shared/settings';
import type { TabStatus } from '../src/shared/types';

const markup = readFileSync(resolve('fixtures/player-es.html'), 'utf8');
type MessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
type StorageListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function media(values: Partial<Record<'paused' | 'ended' | 'seeking' | 'readyState', boolean | number>>): void {
  const video = document.querySelector('video')!;
  for (const [key, value] of Object.entries(values)) Object.defineProperty(video, key, { value, configurable: true });
}

let messages: MessageListener[];
let storageChanges: StorageListener[];
let storageGet: ReturnType<typeof vi.fn>;
let sendMessage: ReturnType<typeof vi.fn>;
let documentListeners: MockInstance<Document['addEventListener']>;
let windowListeners: MockInstance<Window['addEventListener']>;

function message(value: unknown, senderId = 'fixture-extension'): ReturnType<typeof vi.fn> {
  const response = vi.fn();
  messages.forEach(listener => listener(value, { id: senderId }, response));
  return response;
}

function status(): TabStatus {
  return message({ type: 'GET_STATUS' }).mock.calls[0][0] as TabStatus;
}

function intro(): HTMLButtonElement {
  return document.querySelector('[data-testid="skip-intro-icon"]')!.closest('button')!;
}

function showIntro(visible: boolean): void {
  intro().setAttribute('aria-hidden', String(!visible));
  intro().setAttribute('aria-label', visible ? 'Saltar intro' : '');
  intro().querySelector('span')!.textContent = visible ? 'Saltar intro' : '';
}

/** Browser trust cannot be manufactured by dispatchEvent. Invoke the registered
 * handler with the same event shape to test classification, while real DOM/media
 * events, the adapter, engine and scheduler remain active in these wiring tests. */
function trustedInput(type: string, target: Element, source: Event = new MouseEvent(type)): void {
  const event = new Proxy(source, {
    get(real, property) {
      if (property === 'isTrusted') return true;
      if (property === 'target') return target;
      return Reflect.get(real, property, real);
    },
  });
  const listeners = documentListeners.mock.calls.filter(call => call[0] === type);
  listeners.forEach(([, listener]) => {
    if (typeof listener === 'function') listener.call(document, event);
    else listener?.handleEvent(event);
  });
}

async function tick(ms = 150): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = markup;
  document.documentElement.lang = 'es-ES';
  history.replaceState({}, '', '/es-es/watch/EPISODE1/fixture');
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
  media({ paused: false, ended: false, seeking: false, readyState: 4 });
  messages = [];
  storageChanges = [];
  storageGet = vi.fn().mockResolvedValue({ [SETTINGS_KEY]: defaultSettings() });
  sendMessage = vi.fn().mockResolvedValue({ ok: true, paused: false });
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'fixture-extension', sendMessage,
      onMessage: { addListener: (listener: MessageListener) => messages.push(listener) },
    },
    storage: {
      local: { get: storageGet },
      onChanged: { addListener: (listener: StorageListener) => storageChanges.push(listener) },
    },
  });
  documentListeners = vi.spyOn(document, 'addEventListener');
  windowListeners = vi.spyOn(window, 'addEventListener');
});

afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
  documentListeners.mock.calls.forEach(([type, listener, options]) => document.removeEventListener(type, listener, options));
  windowListeners.mock.calls.forEach(([type, listener, options]) => window.removeEventListener(type, listener, options));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('content bootstrap and local preferences', () => {
  it('waits for both local preferences and tab state before the first real click', async () => {
    const stored = deferred<Record<string, unknown>>();
    storageGet.mockReturnValue(stored.promise);
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick(1200);
    expect(click).not.toHaveBeenCalled();
    stored.resolve({ [SETTINGS_KEY]: defaultSettings() });
    await tick();
    expect(click).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_TAB_PAUSE' });
  });

  it('fails closed if worker tab state is unavailable', async () => {
    sendMessage.mockRejectedValue(new Error('worker unavailable'));
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick(1200);
    expect(click).not.toHaveBeenCalled();
    expect(status().paused).toBe(true);
  });

  it('starts paused for a paused tab and resumes through its own extension message', async () => {
    sendMessage.mockResolvedValue({ ok: true, paused: true });
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    expect(click).not.toHaveBeenCalled();
    message({ type: 'TAB_PAUSE_CHANGED', paused: false }, 'foreign-extension');
    await tick();
    expect(click).not.toHaveBeenCalled();
    message({ type: 'TAB_PAUSE_CHANGED', paused: false });
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('applies a local settings change before any pending action', async () => {
    const settings = defaultSettings();
    settings.services.crunchyroll.intro = false;
    storageGet.mockResolvedValue({ [SETTINGS_KEY]: settings });
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    expect(click).not.toHaveBeenCalled();
    storageChanges.forEach(listener => listener({ [SETTINGS_KEY]: { newValue: defaultSettings() } }, 'local'));
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not overwrite a newer tab pause with a stale bootstrap response', async () => {
    const stored = deferred<Record<string, unknown>>();
    storageGet.mockReturnValue(stored.promise);
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick(10);
    message({ type: 'TAB_PAUSE_CHANGED', paused: true });
    stored.resolve({ [SETTINGS_KEY]: defaultSettings() });
    await tick();
    expect(click).not.toHaveBeenCalled();
    expect(status().paused).toBe(true);
  });

  it('does not overwrite a newer global off setting with a stale bootstrap read', async () => {
    const tab = deferred<{ ok: true; paused: boolean }>();
    sendMessage.mockReturnValue(tab.promise);
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick(10);
    const disabled = defaultSettings();
    disabled.enabled = false;
    storageChanges.forEach(listener => listener({ [SETTINGS_KEY]: { newValue: disabled } }, 'local'));
    tab.resolve({ ok: true, paused: false });
    await tick();
    expect(click).not.toHaveBeenCalled();
  });
});

describe('content navigation and manual input wiring', () => {
  it('handles an SPA episode change and media load on the existing player', async () => {
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    expect(click).toHaveBeenCalledOnce();
    history.pushState({}, '', '/es-es/watch/EPISODE2/fixture');
    document.querySelector('video')!.dispatchEvent(new Event('loadstart'));
    await tick();
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('detects URL-only navigation but does not click the old episode controls', async () => {
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    history.pushState({}, '', '/es-es/watch/EPISODE2/fixture');
    await tick(1200);
    expect(click).toHaveBeenCalledOnce();
    expect(status().playerReady).toBe(false);
  });

  it('holds after a trusted timeline gesture, then resumes explicitly', async () => {
    showIntro(false);
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    trustedInput('pointerdown', document.querySelector('input.timeline-slider')!);
    showIntro(true);
    await tick();
    expect(click).not.toHaveBeenCalled();
    expect(status().manualHold).toBe(true);
    message({ type: 'TAB_PAUSE_CHANGED', paused: false });
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('lets starting playback proceed without putting automation on manual hold', async () => {
    showIntro(false);
    media({ paused: true });
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    trustedInput('pointerdown', document.querySelector('[data-testid="play-pause-button"]')!);
    media({ paused: false });
    showIntro(true);
    document.querySelector('video')!.dispatchEvent(new Event('play'));
    await tick();
    expect(click).toHaveBeenCalledOnce();
    expect(status().manualHold).toBe(false);
  });

  it('holds for keyboard activation of the service next-episode control', async () => {
    showIntro(false);
    await import('../src/content');
    await tick();
    const next = document.querySelector('[data-testid="next-episode-button"]')!;
    trustedInput('keydown', next, new KeyboardEvent('keydown', { key: 'Enter' }));
    trustedInput('click', next, new MouseEvent('click', { detail: 0 }));
    expect(status().manualHold).toBe(true);
  });

  it('keeps native activation of an unrelated player button out of manual hold', async () => {
    showIntro(false);
    await import('../src/content');
    await tick();
    const unrelated = document.createElement('button');
    document.querySelector('#player-container')!.append(unrelated);
    trustedInput('keydown', unrelated, new KeyboardEvent('keydown', { key: ' ' }));
    trustedInput('click', unrelated, new MouseEvent('click', { detail: 0 }));
    expect(status().manualHold).toBe(false);
  });

  it('holds a playback seek shortcut even while a player button has focus', async () => {
    showIntro(false);
    await import('../src/content');
    await tick();
    trustedInput('keydown', document.querySelector('[data-testid="next-episode-button"]')!,
      new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(status().manualHold).toBe(true);
  });

  it('remembers manual seeking while the initial settings request is still pending', async () => {
    const stored = deferred<Record<string, unknown>>();
    storageGet.mockReturnValue(stored.promise);
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    trustedInput('pointerdown', document.querySelector('input.timeline-slider')!);
    stored.resolve({ [SETTINGS_KEY]: defaultSettings() });
    await tick();
    expect(status().manualHold).toBe(true);
    expect(click).not.toHaveBeenCalled();
  });

  it('ignores synthetic page input and its own programmatic control click', async () => {
    showIntro(false);
    const click = vi.spyOn(intro(), 'click');
    await import('../src/content');
    await tick();
    document.querySelector('input.timeline-slider')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    showIntro(true);
    await tick();
    expect(click).toHaveBeenCalledOnce();
    expect(status().manualHold).toBe(false);
  });
});
