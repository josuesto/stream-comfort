// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://play.hbomax.com/video/watch/11111111-1111-1111-1111-111111111111"}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { defaultSettings, SETTINGS_KEY } from '../src/shared/settings';
import type { Settings, TabStatus } from '../src/shared/types';

const markup = readFileSync(resolve('fixtures/hbomax/player-es.html'), 'utf8');
const nextMarkup = readFileSync(resolve('fixtures/hbomax/up-next-es.html'), 'utf8');
const firstRoute = '/video/watch/11111111-1111-1111-1111-111111111111';
const secondRoute = '/video/watch/22222222-2222-2222-2222-222222222222';
type MessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
type StorageListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];

let messages: MessageListener[];
let storageChanges: StorageListener[];
let storageGet: ReturnType<typeof vi.fn>;
let sendMessage: ReturnType<typeof vi.fn>;
let documentListeners: MockInstance<Document['addEventListener']>;
let windowListeners: MockInstance<Window['addEventListener']>;

function control(testId: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
}

function skip(): HTMLButtonElement {
  return control('player-ux-skip-button') as HTMLButtonElement;
}

function showSkip(label: 'Omitir intro' | 'Omitir resumen' | 'Saltar' | null): void {
  control('skip').style.visibility = label === null ? 'hidden' : 'visible';
  if (label !== null) {
    skip().setAttribute('aria-label', label);
    skip().querySelector('span')!.textContent = label;
  }
}

function media(values: Partial<Record<'paused' | 'ended' | 'seeking' | 'readyState', boolean | number>>): void {
  const video = document.querySelector('video')!;
  for (const [key, value] of Object.entries(values)) Object.defineProperty(video, key, { value, configurable: true });
}

function message(value: unknown): ReturnType<typeof vi.fn> {
  const response = vi.fn();
  messages.forEach(listener => listener(value, { id: 'fixture-extension' }, response));
  return response;
}

function status(): TabStatus {
  return message({ type: 'GET_STATUS' }).mock.calls[0][0] as TabStatus;
}

function changeSettings(settings: Settings): void {
  storageChanges.forEach(listener => listener({ [SETTINGS_KEY]: { newValue: settings } }, 'local'));
}

/** dispatchEvent cannot create browser-trusted input. Invoke the registered
 * handler with a trusted event shape, as in the Crunchyroll wiring tests. */
function trustedInput(type: string, target: Element, source: Event = new MouseEvent(type)): void {
  const event = new Proxy(source, {
    get(real, property) {
      if (property === 'isTrusted') return true;
      if (property === 'target') return target;
      return Reflect.get(real, property, real);
    },
  });
  documentListeners.mock.calls.filter(call => call[0] === type).forEach(([, listener]) => {
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
  document.documentElement.lang = 'es-419';
  history.replaceState({}, '', firstRoute);
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

describe('HBO advancement wiring', () => {
  function mountNext() {
    showSkip(null);
    control('up_next').outerHTML = nextMarkup;
    return control('player-ux-up-next-button');
  }

  it('keeps advancement off until enabled, and shares one attempt across credits and end', async () => {
    const next = mountNext();
    const click = vi.spyOn(next,'click');
    await import('../src/content');
    await tick();
    expect(click).not.toHaveBeenCalled();
    const settings = defaultSettings();
    settings.actions.credits = true;
    settings.actions.nextEpisode = true;
    changeSettings(settings); await tick();
    expect(click).toHaveBeenCalledOnce();
    media({ended:true,paused:true});
    document.querySelector('video')!.dispatchEvent(new Event('ended'));
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('waits for video.ended when only end-of-video advancement is enabled', async () => {
    const click = vi.spyOn(mountNext(),'click');
    const settings = defaultSettings();
    settings.actions.nextEpisode = true;
    storageGet.mockResolvedValue({[SETTINGS_KEY]:settings});
    await import('../src/content'); await tick();
    expect(click).not.toHaveBeenCalled();
    media({ended:true,paused:true});
    document.querySelector('video')!.dispatchEvent(new Event('ended'));
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('clicks synchronously at the real end before HBO removes its player', async () => {
    const next = mountNext();
    const click = vi.spyOn(next,'click');
    const settings = defaultSettings();
    settings.actions.nextEpisode = true;
    storageGet.mockResolvedValue({[SETTINGS_KEY]:settings});
    await import('../src/content'); await tick();
    const video = document.querySelector('video')!;
    video.addEventListener('ended', () => {
      expect(click).toHaveBeenCalledOnce();
      control('playerContainer').remove();
    });
    media({ended:true,paused:true});
    video.dispatchEvent(new Event('ended'));
    expect(click).toHaveBeenCalledOnce();
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('never treats an ended event alone, or one from another video, as permission to advance', async () => {
    const click = vi.spyOn(mountNext(),'click');
    const settings = defaultSettings();
    settings.actions.nextEpisode = true;
    storageGet.mockResolvedValue({[SETTINGS_KEY]:settings});
    await import('../src/content'); await tick();
    document.querySelector('video')!.dispatchEvent(new Event('ended'));
    expect(click).not.toHaveBeenCalled();
    media({ended:true,paused:true});
    const unrelated = document.createElement('video');
    document.body.append(unrelated);
    unrelated.dispatchEvent(new Event('ended'));
    expect(click).not.toHaveBeenCalled();
  });

  it('respects cancelling native autoplay before a pending automation step', async () => {
    const click = vi.spyOn(mountNext(),'click');
    await import('../src/content'); await tick();
    const settings = defaultSettings();
    settings.actions.credits = true;
    changeSettings(settings);
    trustedInput('pointerdown',control('player-ux-up-next-dismiss'));
    await tick();
    expect(status().manualHold).toBe(true);
    expect(click).not.toHaveBeenCalled();
    message({type:'TAB_PAUSE_CHANGED',paused:false});
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });
});

describe('HBO content bootstrap and preferences', () => {
  it('selects HBO and clicks recap then intro once each when their shared node changes', async () => {
    showSkip('Omitir resumen');
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    expect(status().service).toBe('hbomax');
    expect(status().lastAction).toBe('recap');
    expect(click).toHaveBeenCalledOnce();
    showSkip('Omitir intro');
    await tick();
    expect(status().lastAction).toBe('intro');
    expect(click).toHaveBeenCalledTimes(2);
    showSkip('Omitir resumen');
    await tick();
    showSkip('Omitir intro');
    await tick(1200);
    expect(click).toHaveBeenCalledTimes(2);
    expect(status().manualHold).toBe(false);
  });

  it('loads shared choices set before playback and applies later edits without a reload', async () => {
    const settings = defaultSettings();
    settings.actions.intro = false;
    settings.actions.recap = false;
    storageGet.mockResolvedValue({ [SETTINGS_KEY]: settings });
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    expect(click).not.toHaveBeenCalled();
    showSkip('Omitir resumen');
    await tick();
    expect(click).not.toHaveBeenCalled();
    settings.actions.recap = true;
    changeSettings(settings);
    await tick();
    expect(click).toHaveBeenCalledOnce();
    settings.actions.intro = true;
    settings.platforms.crunchyroll = false;
    changeSettings(settings);
    showSkip('Omitir intro');
    await tick();
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('applies a platform disable before a pending action and does not let tab resume enable it', async () => {
    showSkip(null);
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    showSkip('Omitir intro');
    document.querySelector('video')!.dispatchEvent(new Event('timeupdate'));
    const settings = defaultSettings();
    settings.platforms.hbomax = false;
    changeSettings(settings);
    await tick();
    expect(click).not.toHaveBeenCalled();
    message({ type: 'TAB_PAUSE_CHANGED', paused: false });
    await tick();
    expect(click).not.toHaveBeenCalled();
    settings.platforms.hbomax = true;
    changeSettings(settings);
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not overwrite newer HBO platform settings with the initial storage response', async () => {
    let resolve!: (value: { ok: true; paused: boolean }) => void;
    sendMessage.mockReturnValue(new Promise(done => { resolve = done; }));
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick(10);
    const settings = defaultSettings();
    settings.platforms.hbomax = false;
    changeSettings(settings);
    resolve({ ok: true, paused: false });
    await tick();
    expect(click).not.toHaveBeenCalled();
  });

  it('ignores a promotional Saltar control while offering advancement settings', async () => {
    showSkip('Saltar');
    const settings = defaultSettings();
    settings.actions.credits = true;
    settings.actions.nextEpisode = true;
    storageGet.mockResolvedValue({ [SETTINGS_KEY]: settings });
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    media({ ended: true, paused: true });
    document.querySelector('video')!.dispatchEvent(new Event('ended'));
    await tick();
    expect(click).not.toHaveBeenCalled();
    expect(status().capabilities.credits.supported).toBe(true);
    expect(status().capabilities.nextEpisode.supported).toBe(true);
  });
});

describe('HBO content episode navigation and manual intent', () => {
  it('quarantines stale controls on SPA navigation until the new media load', async () => {
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    expect(click).toHaveBeenCalledOnce();
    history.pushState({}, '', secondRoute);
    await tick(1200);
    expect(click).toHaveBeenCalledOnce();
    expect(status().playerReady).toBe(false);
    document.querySelector('video')!.dispatchEvent(new Event('loadstart'));
    await tick();
    expect(click).toHaveBeenCalledTimes(2);
    expect(status().playerReady).toBe(true);
  });

  it('starts after entering a playback route from an HBO browse page without reload', async () => {
    history.replaceState({}, '', '/home');
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    expect(status().pageSupported).toBe(false);
    expect(click).not.toHaveBeenCalled();
    history.pushState({}, '', firstRoute);
    document.querySelector('video')!.dispatchEvent(new Event('loadedmetadata'));
    await tick(1200);
    expect(click).toHaveBeenCalledOnce();
    expect(status().pageSupported).toBe(true);
  });

  it.each([
    'player-ux-scrubber-position', 'player-ux-skip-back-button',
    'player-ux-skip-forward-button', 'player-ux-play-pause-button',
  ])('holds automation for trusted input on %s and resumes explicitly', async testId => {
    showSkip(null);
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    trustedInput('pointerdown', control(testId));
    showSkip('Omitir intro');
    await tick();
    expect(status().manualHold).toBe(true);
    expect(click).not.toHaveBeenCalled();
    message({ type: 'TAB_PAUSE_CHANGED', paused: false });
    await tick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('lets manually starting playback proceed without holding automation', async () => {
    showSkip(null);
    media({ paused: true });
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    trustedInput('pointerdown', control('player-ux-play-pause-button'));
    media({ paused: false });
    showSkip('Omitir intro');
    document.querySelector('video')!.dispatchEvent(new Event('play'));
    await tick();
    expect(status().manualHold).toBe(false);
    expect(click).toHaveBeenCalledOnce();
  });

  it.each(['player-ux-volume-button', 'player-ux-fullscreen-button'])(
    'does not hold for pointer or keyboard activation of %s', async testId => {
      showSkip(null);
      const click = vi.spyOn(skip(), 'click');
      await import('../src/content');
      await tick();
      const button = control(testId);
      trustedInput('pointerdown', button);
      trustedInput('keydown', button, new KeyboardEvent('keydown', { key: 'Enter' }));
      trustedInput('click', button, new MouseEvent('click', { detail: 0 }));
      document.dispatchEvent(new Event('fullscreenchange'));
      showSkip('Omitir intro');
      await tick();
      expect(status().manualHold).toBe(false);
      expect(click).toHaveBeenCalledOnce();
    },
  );

  it('ignores synthetic seeking input and scripted media events', async () => {
    showSkip(null);
    const click = vi.spyOn(skip(), 'click');
    await import('../src/content');
    await tick();
    control('player-ux-scrubber-position').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.querySelector('video')!.dispatchEvent(new Event('pause'));
    document.querySelector('video')!.dispatchEvent(new Event('seeked'));
    showSkip('Omitir intro');
    await tick();
    expect(status().manualHold).toBe(false);
    expect(click).toHaveBeenCalledOnce();
  });
});
