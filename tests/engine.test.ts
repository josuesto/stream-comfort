// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationEngine, isControlVisible } from '../src/core/engine';
import { defaultSettings } from '../src/shared/settings';
import type { Action, Capabilities, PlaybackSnapshot, ServiceAdapter, ServiceId } from '../src/shared/types';

const capabilities: Capabilities = {
  intro: { supported: true, detail: 'fixture' },
  recap: { supported: true, detail: 'fixture' },
  credits: { supported: true, detail: 'fixture' },
  nextEpisode: { supported: true, detail: 'fixture' },
};

function media(video: HTMLVideoElement, values: Partial<Record<'paused' | 'ended' | 'seeking' | 'readyState', boolean | number>>): void {
  for (const [key, value] of Object.entries(values)) Object.defineProperty(video, key, { value, configurable: true });
}

function player(episodeId = 'episode-one'): PlaybackSnapshot {
  const root = document.createElement('div');
  const video = document.createElement('video');
  const intro = document.createElement('button');
  root.append(video, intro);
  document.body.append(root);
  media(video, { paused: false, ended: false, seeking: false, readyState: 4 });
  return { episodeId, player: root, video, candidates: { intro }, capabilities: structuredClone(capabilities) };
}

function fixture(service: ServiceId = 'crunchyroll') {
  let snapshot = player();
  const settings = defaultSettings();
  const state = { settings, paused: false };
  const adapter: ServiceAdapter = { id: service, inspect: vi.fn(() => snapshot) };
  const engine = new AutomationEngine(adapter, () => state, {
    isVisible: element => element.isConnected && !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  });
  engines.push(engine);
  return {
    engine, state, adapter,
    get snapshot() { return snapshot; },
    set snapshot(next: PlaybackSnapshot) { snapshot = next; },
    add(action: Action): HTMLButtonElement {
      const button = document.createElement('button');
      snapshot.player!.append(button);
      snapshot.candidates[action] = button;
      return button;
    },
  };
}

const engines: AutomationEngine[] = [];
beforeEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => { engines.splice(0).forEach(engine => engine.dispose()); });

describe('playback actions and settings', () => {
  it('ignores retired selection data and advances only at the normal enabled video end', () => {
    const f = fixture();
    f.snapshot.candidates = {};
    const next = f.add('nextEpisode');
    const click = vi.spyOn(next, 'click');
    Object.assign(f.snapshot.candidates, { selectedEpisode: next });
    Object.assign(f.snapshot.capabilities, { selectedEpisode: { supported: true, detail: 'legacy' } });
    Object.assign(f.state.settings, { episodeLists: { crunchyroll: [f.snapshot.episodeId], hbomax: [] } });
    Object.assign(f.state.settings.services.crunchyroll, { selectedEpisode: true });
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.state.settings.services.crunchyroll.nextEpisode = true;
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    media(f.snapshot.video!, { ended: true, paused: true });
    f.engine.step();
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
    expect(f.engine.lastAction).toBe('nextEpisode');
  });

  it('clicks the actual control once despite repeated steps and replacement buttons', () => {
    const f = fixture();
    const firstClick = vi.fn();
    f.snapshot.candidates.intro!.addEventListener('click', firstClick);
    f.engine.step();
    f.engine.step();
    expect(firstClick).toHaveBeenCalledTimes(1);
    const replacement = f.add('intro');
    const replacementClick = vi.spyOn(replacement, 'click');
    f.engine.step();
    expect(replacementClick).not.toHaveBeenCalled();
    expect(f.engine.lastAction).toBe('intro');
  });

  it('honors global, per-action and tab switches without consuming the action', () => {
    const f = fixture();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.state.settings.enabled = false;
    f.engine.step();
    f.state.settings.enabled = true;
    f.state.settings.services.crunchyroll.intro = false;
    f.engine.step();
    f.state.settings.services.crunchyroll.intro = true;
    f.state.paused = true;
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.state.paused = false;
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not advance with the defaults even if a next-episode button is supplied', () => {
    const f = fixture();
    f.snapshot.candidates = {};
    const credits = vi.spyOn(f.add('credits'), 'click');
    const next = vi.spyOn(f.add('nextEpisode'), 'click');
    f.engine.step();
    media(f.snapshot.video!, { ended: true, paused: true });
    f.engine.step();
    expect(credits).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['crunchyroll', 'hbomax'] as const)('honors the %s platform switch without consuming the action', service => {
    const f = fixture(service);
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.state.settings.platforms[service] = false;
    f.engine.step();
    f.engine.resume();
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    expect(f.state.settings.platforms[service]).toBe(false);
    f.state.settings.platforms[service] = true;
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it.each(['crunchyroll', 'hbomax'] as const)('keeps %s independent from the other platform and its action preferences', service => {
    const other = service === 'crunchyroll' ? 'hbomax' : 'crunchyroll';
    const f = fixture(service);
    f.state.settings.platforms[other] = false;
    f.state.settings.services[other].intro = false;
    f.state.settings.services[service].intro = false;
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.state.settings.services[service].intro = true;
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it.each(['crunchyroll', 'hbomax'] as const)('lets global off override the enabled %s platform', service => {
    const f = fixture(service);
    f.state.settings.enabled = false;
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    f.engine.resume();
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.state.settings.enabled = true;
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('uses the HBO action preferences and one shared credits/next-episode attempt', () => {
    const f = fixture('hbomax');
    f.snapshot.candidates = {};
    f.state.settings.services.hbomax.credits = true;
    f.state.settings.services.hbomax.nextEpisode = true;
    const credits = vi.spyOn(f.add('credits'), 'click');
    const next = vi.spyOn(f.add('nextEpisode'), 'click');
    f.engine.step();
    media(f.snapshot.video!, { ended: true, paused: true });
    f.engine.step();
    expect(credits).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it('requires the real media ended signal for automatic next episode', () => {
    const f = fixture();
    f.snapshot.candidates = {};
    f.state.settings.services.crunchyroll.nextEpisode = true;
    const click = vi.spyOn(f.add('nextEpisode'), 'click');
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    media(f.snapshot.video!, { ended: true, paused: true });
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('shares one advancement attempt between credits and next episode', () => {
    const f = fixture();
    f.snapshot.candidates = {};
    f.state.settings.services.crunchyroll.credits = true;
    f.state.settings.services.crunchyroll.nextEpisode = true;
    const credits = vi.spyOn(f.add('credits'), 'click');
    const next = vi.spyOn(f.add('nextEpisode'), 'click');
    f.engine.step();
    media(f.snapshot.video!, { ended: true, paused: true });
    f.engine.step();
    expect(credits).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps intro and recap decisions independent and performs only one action per step', () => {
    const f = fixture();
    const intro = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    const recap = vi.spyOn(f.add('recap'), 'click');
    f.engine.step();
    expect(intro).toHaveBeenCalledOnce();
    expect(recap).not.toHaveBeenCalled();
    f.engine.step();
    expect(recap).toHaveBeenCalledOnce();
  });

  it('fails closed for unsupported actions even with a candidate and enabled preference', () => {
    const f = fixture();
    f.snapshot.capabilities.intro.supported = false;
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    expect(f.engine.getStatus().capabilities.intro.supported).toBe(false);
  });

  it.each([
    ['paused', true], ['ended', true], ['seeking', true], ['readyState', 1],
  ] as const)('does not skip when media is %s=%s', (key, value) => {
    const f = fixture();
    media(f.snapshot.video!, { [key]: value });
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
  });

  it('never acts in a hidden document', () => {
    const f = fixture();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
  });

  it.each(['hidden', 'disabled', 'aria-disabled', 'disconnected', 'outside-player'])(
    'rejects a %s control', condition => {
      const f = fixture();
      const button = f.snapshot.candidates.intro!;
      if (condition === 'hidden') button.hidden = true;
      if (condition === 'disabled') button.setAttribute('disabled', '');
      if (condition === 'aria-disabled') f.snapshot.player!.setAttribute('aria-disabled', 'true');
      if (condition === 'disconnected') button.remove();
      if (condition === 'outside-player') document.body.append(button);
      const click = vi.spyOn(button, 'click');
      f.engine.step();
      expect(click).not.toHaveBeenCalled();
    },
  );

  it('records before click so a reentrant page callback cannot duplicate the action', () => {
    const f = fixture();
    const callback = vi.fn(() => f.engine.step());
    f.snapshot.candidates.intro!.addEventListener('click', callback);
    f.engine.step();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not retry an uncertain click that throws', () => {
    const f = fixture();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click').mockImplementation(() => { throw new Error('page failure'); });
    expect(() => f.engine.step()).not.toThrow();
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });
});

describe('manual interaction and navigation', () => {
  it('holds automation after manual input and allows explicit resume', () => {
    const f = fixture();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.manualInteraction(f.snapshot.video);
    expect(f.engine.getStatus().manualHold).toBe(true);
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.engine.resume();
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
    f.engine.manualInteraction();
    f.engine.resume();
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not treat scripted media pause/seek as manual input by itself', () => {
    const f = fixture();
    f.engine.step();
    f.snapshot.video!.dispatchEvent(new Event('seeking'));
    f.snapshot.video!.dispatchEvent(new Event('pause'));
    expect(f.engine.manualHold).toBe(false);
  });

  it('quarantines old controls when only the episode URL changes', () => {
    const f = fixture();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    f.snapshot.episodeId = 'episode-two';
    f.engine.step();
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
    expect(f.engine.getStatus().playerReady).toBe(false);
    f.snapshot.video!.dispatchEvent(new Event('loadstart'));
    media(f.snapshot.video!, { readyState: 0 });
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
    media(f.snapshot.video!, { readyState: 4 });
    f.engine.step();
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('accepts a fresh video/player for a new episode without a page reload', () => {
    const f = fixture();
    f.engine.step();
    f.snapshot.player!.remove();
    f.snapshot = player('episode-two');
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('retains a navigation load boundary that arrives before the scheduled DOM step', () => {
    const f = fixture();
    f.engine.step();
    f.snapshot.episodeId = 'episode-two';
    const click = vi.spyOn(f.add('intro'), 'click');
    // A debounced MutationObserver can run after both navigation and loadstart.
    f.snapshot.video!.dispatchEvent(new Event('loadstart'));
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('releases a quarantined episode when its video is subsequently replaced', () => {
    const f = fixture();
    f.engine.step();
    f.snapshot.episodeId = 'episode-two';
    f.engine.step();
    const oldVideo = f.snapshot.video!;
    const video = document.createElement('video');
    media(video, { readyState: 4, seeking: false, ended: false, paused: false });
    oldVideo.replaceWith(video);
    f.snapshot.video = video;
    const replacement = vi.spyOn(f.add('intro'), 'click');
    f.engine.step();
    expect(replacement).toHaveBeenCalledOnce();
  });

  it('does not let a transient unsupported route erase the old playback identity', () => {
    const f = fixture();
    f.engine.step();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.snapshot.episodeId = null;
    f.engine.step();
    f.snapshot.episodeId = 'episode-two';
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
  });

  it('does not click stale controls after navigation between inspection and action', () => {
    const f = fixture();
    const old = f.snapshot;
    const next = { ...old, episodeId: 'episode-two' };
    const click = vi.spyOn(old.candidates.intro!, 'click');
    vi.mocked(f.adapter.inspect).mockReturnValueOnce(old).mockReturnValue(next);
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
  });

  it('rechecks the control identity immediately before clicking', () => {
    const f = fixture();
    const first = f.snapshot;
    const replacement = document.createElement('button');
    first.player!.append(replacement);
    const next = { ...first, candidates: { intro: replacement } };
    const oldClick = vi.spyOn(first.candidates.intro!, 'click');
    const newClick = vi.spyOn(replacement, 'click');
    vi.mocked(f.adapter.inspect).mockReturnValueOnce(first).mockReturnValue(next);
    f.engine.step();
    expect(oldClick).not.toHaveBeenCalled();
    expect(newClick).not.toHaveBeenCalled();
    f.engine.step();
    expect(newClick).toHaveBeenCalledOnce();
  });

  it('honors settings disabled during reinspection', () => {
    const f = fixture();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    let inspections = 0;
    vi.mocked(f.adapter.inspect).mockImplementation(() => {
      if (++inspections === 2) f.state.settings.enabled = false;
      return f.snapshot;
    });
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
  });

  it.each(['crunchyroll', 'hbomax'] as const)('honors %s disabled during reinspection', service => {
    const f = fixture(service);
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    let inspections = 0;
    vi.mocked(f.adapter.inspect).mockImplementation(() => {
      if (++inspections === 2) f.state.settings.platforms[service] = false;
      return f.snapshot;
    });
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.state.settings.platforms[service] = true;
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('keeps a disabled HBO platform inactive across episode navigation', () => {
    const f = fixture('hbomax');
    f.engine.step();
    f.state.settings.platforms.hbomax = false;
    f.snapshot.player!.remove();
    f.snapshot = player('episode-two');
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.step();
    f.engine.resume();
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.state.settings.platforms.hbomax = true;
    f.engine.step();
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('carries suppression of manually declined controls through a media change', () => {
    const f = fixture();
    const click = vi.spyOn(f.snapshot.candidates.intro!, 'click');
    f.engine.manualInteraction();
    f.snapshot.episodeId = 'episode-two';
    f.engine.step();
    expect(f.engine.manualHold).toBe(false);
    f.snapshot.video!.dispatchEvent(new Event('loadedmetadata'));
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
    f.snapshot.candidates.intro!.hidden = true;
    f.engine.step();
    f.snapshot.candidates.intro!.hidden = false;
    f.engine.step();
    expect(click).toHaveBeenCalledOnce();
  });

  it('remembers a previously visited episode across navigation and fullscreen-style moves', () => {
    const f = fixture();
    f.engine.step();
    const first = f.snapshot;
    f.snapshot = player('episode-two');
    f.engine.step();
    f.snapshot = first;
    const click = vi.spyOn(first.candidates.intro!, 'click');
    const fullscreen = document.createElement('section');
    document.body.append(fullscreen);
    fullscreen.append(first.player!);
    f.engine.step();
    expect(click).not.toHaveBeenCalled();
  });
});

describe('production visibility checks', () => {
  it('checks ancestor opacity and aria-hidden in addition to button geometry', () => {
    const snapshot = player();
    const button = snapshot.candidates.intro!;
    Object.defineProperty(button, 'getClientRects', { value: () => [{ width: 120, height: 40 }] });
    expect(isControlVisible(button)).toBe(true);
    snapshot.player!.style.opacity = '0';
    expect(isControlVisible(button)).toBe(false);
    snapshot.player!.style.opacity = '1';
    snapshot.player!.setAttribute('aria-hidden', 'true');
    expect(isControlVisible(button)).toBe(false);
    snapshot.player!.removeAttribute('aria-hidden');
    snapshot.player!.style.display = 'none';
    expect(isControlVisible(button)).toBe(false);
  });

  it('rejects controls with no rendered geometry', () => {
    expect(isControlVisible(player().candidates.intro!)).toBe(false);
  });
});
