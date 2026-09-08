// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHboMaxAdapter, hboEpisodeIdFromUrl } from '../src/services/hbomax';

const fixture = readFileSync('fixtures/hbomax/player-es.html', 'utf8');
const upNextFixture = readFileSync('fixtures/hbomax/up-next-es.html', 'utf8');
const episodeA = '00000000-0000-4000-8000-000000000001';
const episodeB = '00000000-0000-4000-8000-000000000002';
const watchUrl = `https://play.hbomax.com/video/watch/${episodeA}`;
let currentUrl: string;

const adapter = () => createHboMaxAdapter(document, () => currentUrl);
const player = () => document.querySelector<HTMLElement>('[data-testid="playerContainer"]')!;
const overlay = () => document.querySelector<HTMLElement>('[data-testid="overlay-root"]')!;
const skipButton = () => document.querySelector<HTMLButtonElement>('[data-testid="player-ux-skip-button"]')!;
const skipRegion = () => document.querySelector<HTMLElement>('[data-testid="skip"]')!;

function setLabel(label: string): void {
  skipButton().setAttribute('aria-label', label);
  skipButton().querySelector('span')!.textContent = label;
}

beforeEach(() => {
  currentUrl = watchUrl;
  document.documentElement.lang = 'es-419';
  document.body.innerHTML = fixture;
  // jsdom has no layout engine. Supply geometry only; use production visibility
  // checks for connection, CSS visibility, hidden ancestors, and inert content.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
    [new DOMRect(0, 0, 80, 24)] as unknown as DOMRectList,
  );
});

afterEach(() => vi.restoreAllMocks());

describe('observed Spanish HBO Max player', () => {
  it('recognizes the observed intro within the unique player and overlay', () => {
    const snapshot = adapter().inspect();
    expect(snapshot.episodeId).toBe(episodeA);
    expect(snapshot.player).toBe(player());
    expect(snapshot.video).toBe(document.querySelector('video'));
    expect(snapshot.candidates).toEqual({ intro: skipButton() });
    expect(snapshot.capabilities.intro.supported).toBe(true);
    expect(snapshot.capabilities.recap.supported).toBe(true);
  });

  it('recognizes the observed recap state of the same skip control', () => {
    setLabel('Omitir resumen');
    expect(adapter().inspect().candidates).toEqual({ recap: skipButton() });
  });

  it.each(['Saltar', 'Skip intro', 'Omitir introducción', 'Omitir créditos', 'Siguiente episodio', 'omitir intro'])(
    'ignores generic, translated, or unobserved skip labels: %s', label => {
      setLabel(label);
      expect(adapter().inspect().candidates).toEqual({});
    },
  );

  it('requires the visible text and accessible name to identify the same action', () => {
    skipButton().setAttribute('aria-label', 'Omitir resumen');
    expect(adapter().inspect().candidates).toEqual({});
    skipButton().removeAttribute('aria-label');
    expect(adapter().inspect().candidates).toEqual({});
    skipButton().setAttribute('aria-label', 'Omitir intro');
    skipButton().querySelector('span')!.remove();
    expect(adapter().inspect().candidates).toEqual({});
  });

  it('tolerates only surrounding whitespace in the observed labels', () => {
    skipButton().setAttribute('aria-label', ' Omitir intro\n');
    skipButton().querySelector('span')!.textContent = '\nOmitir intro ';
    expect(adapter().inspect().candidates.intro).toBe(skipButton());
    setLabel('Omitir  intro');
    expect(adapter().inspect().candidates).toEqual({});
  });

  it.each(['es', 'es-419', 'es-MX', 'ES-es'])('accepts Spanish document locale %s', locale => {
    document.documentElement.lang = locale;
    expect(adapter().inspect().candidates.intro).toBe(skipButton());
  });

  it.each(['en', 'en-US', 'pt-BR', '', 'espanol'])('reports unverified document locale %s as unsupported', locale => {
    document.documentElement.lang = locale;
    const snapshot = adapter().inspect();
    expect(snapshot.capabilities.intro.supported).toBe(false);
    expect(snapshot.capabilities.recap.supported).toBe(false);
    expect(snapshot.candidates).toEqual({});
  });

  it.each([
    ['visibility', 'hidden'], ['visibility', 'collapse'], ['display', 'none'], ['opacity', '0'],
  ])('ignores a still-mounted skip region with CSS %s: %s', (property, value) => {
    skipRegion().style.setProperty(property, value);
    expect(adapter().inspect().candidates).toEqual({});
  });

  it.each(['hidden', 'aria-hidden', 'inert'])('respects concealed or inactive ancestors using %s', attribute => {
    player().setAttribute(attribute, attribute === 'aria-hidden' ? 'true' : '');
    expect(adapter().inspect().candidates).toEqual({});
  });

  it('requires layout geometry for the skip control', () => {
    vi.spyOn(skipButton(), 'getClientRects').mockReturnValue([] as unknown as DOMRectList);
    expect(adapter().inspect().candidates).toEqual({});
  });

  it.each(['disabled', 'aria-disabled'])('ignores an explicitly disabled skip control using %s', attribute => {
    skipButton().setAttribute(attribute, 'true');
    expect(adapter().inspect().candidates).toEqual({});
  });

  it('fails closed when multiple skip buttons remain mounted, even if one is hidden', () => {
    const duplicate = skipButton().cloneNode(true) as HTMLButtonElement;
    duplicate.hidden = true;
    overlay().append(duplicate);
    expect(adapter().inspect().candidates).toEqual({});
  });

  it('never reuses a detached control after DOM replacement', () => {
    const service = adapter();
    const previous = service.inspect().candidates.intro!;
    previous.remove();
    expect(service.inspect().candidates).toEqual({});
    document.body.innerHTML = fixture;
    const next = service.inspect().candidates.intro;
    expect(next).toBe(skipButton());
    expect(next).not.toBe(previous);
    expect(previous.isConnected).toBe(false);
  });

  it('does not recognize controls moved outside the verified overlay or player', () => {
    const button = skipButton();
    player().append(button);
    expect(adapter().inspect().candidates).toEqual({});
    document.body.append(button);
    expect(adapter().inspect().candidates).toEqual({});
  });

  it('does not confuse duplicate layout transport controls with duplicate players', () => {
    const transport = overlay().querySelector('[data-testid="player-ux-play-pause-button"]')!;
    overlay().append(transport.cloneNode(true));
    expect(adapter().inspect().candidates.intro).toBe(skipButton());
  });

  it.each(['player', 'video', 'overlay'])('fails closed when the required %s is ambiguous', target => {
    if (target === 'player') document.body.append(player().cloneNode(true));
    if (target === 'video') player().append(document.querySelector('video')!.cloneNode(true));
    if (target === 'overlay') player().append(overlay().cloneNode(true));
    const snapshot = adapter().inspect();
    expect(snapshot.player).toBeNull();
    expect(snapshot.video).toBeNull();
    expect(snapshot.candidates).toEqual({});
  });

  it.each(['player', 'video', 'overlay'])('fails closed when the required %s is missing', target => {
    if (target === 'player') player().removeAttribute('data-testid');
    if (target === 'video') document.querySelector('video')!.removeAttribute('data-testid');
    if (target === 'overlay') overlay().removeAttribute('role');
    expect(adapter().inspect().candidates).toEqual({});
    expect(adapter().inspect().player).toBeNull();
  });

  it.each(['player-ux-track-dismiss-button', 'player-ux-ipd-dismiss'])(
    'suppresses actions while the observed %s menu control is visible', testId => {
      const dismiss = document.createElement('button');
      dismiss.dataset.testid = testId;
      overlay().append(dismiss);
      expect(adapter().inspect().candidates).toEqual({});
      dismiss.hidden = true;
      expect(adapter().inspect().candidates.intro).toBe(skipButton());
      dismiss.hidden = false;
      dismiss.style.visibility = 'hidden';
      expect(adapter().inspect().candidates.intro).toBe(skipButton());
    },
  );

  it('rejects an unrecognized suggested-next control even after the video ends', () => {
    Object.defineProperty(document.querySelector('video'), 'ended', { value: true });
    const upNext = overlay().querySelector<HTMLElement>('[data-testid="up_next"]')!;
    upNext.style.visibility = 'visible';
    upNext.innerHTML = '<button aria-label="Siguiente episodio">Siguiente episodio</button>';
    const snapshot = adapter().inspect();
    expect(snapshot.capabilities.credits.supported).toBe(true);
    expect(snapshot.capabilities.nextEpisode.supported).toBe(true);
    expect(snapshot.candidates.credits).toBeUndefined();
    expect(snapshot.candidates.nextEpisode).toBeUndefined();
  });

  it('re-reads the episode route and drops stale player controls after navigation to a non-player page', () => {
    const service = adapter();
    expect(service.inspect().episodeId).toBe(episodeA);
    currentUrl = `https://play.hbomax.com/video/watch/${episodeB}`;
    expect(service.inspect().episodeId).toBe(episodeB);
    currentUrl = 'https://play.hbomax.com/';
    const snapshot = service.inspect();
    expect(snapshot.episodeId).toBeNull();
    expect(snapshot.player).toBeNull();
    expect(snapshot.candidates).toEqual({});
  });
});

describe('HBO Max episode URL identity', () => {
  it('extracts a stable UUID while ignoring queries, fragments, and one trailing slash', () => {
    expect(hboEpisodeIdFromUrl(watchUrl)).toBe(episodeA);
    expect(hboEpisodeIdFromUrl(`${watchUrl}/?queue=1#player`)).toBe(episodeA);
    expect(hboEpisodeIdFromUrl('https://play.hbomax.com/video/watch/ABCDEF01-2345-6789-ABCD-EF0123456789'))
      .toBe('abcdef01-2345-6789-abcd-ef0123456789');
  });

  it.each([
    `https://play.hbomax.com.evil.example/video/watch/${episodeA}`,
    `http://play.hbomax.com/video/watch/${episodeA}`,
    `https://www.hbomax.com/video/watch/${episodeA}`,
    `https://auth.hbomax.com/video/watch/${episodeA}`,
    `https://play.hbomax.com/title/${episodeA}`,
    `https://play.hbomax.com/video/watch/${episodeA}/extra`,
    'https://play.hbomax.com/video/watch/not-a-uuid',
    'https://play.hbomax.com/video/watch/00000000-0000-4000-8000-00000000000z',
    'https://play.hbomax.com/video/watch/',
    '/video/watch/00000000-0000-4000-8000-000000000001',
    'not a URL',
  ])('rejects unsupported origins, routes, and malformed IDs: %s', url => {
    expect(hboEpisodeIdFromUrl(url)).toBeNull();
  });
});

describe('observed HBO up-next offer', () => {
  function offer() {
    overlay().querySelector('[data-testid="up_next"]')!.outerHTML = upNextFixture;
    skipRegion().style.visibility = 'hidden';
    return overlay().querySelector<HTMLButtonElement>('[data-testid="player-ux-up-next-button"]')!;
  }

  it('uses the active credits offer, even when no skip button is mounted', () => {
    const next = offer();
    skipButton().remove();
    expect(adapter().inspect().candidates).toEqual({credits: next});
    Object.defineProperty(document.querySelector('video'), 'currentTime', {value:99999});
    expect(adapter().inspect().candidates.nextEpisode).toBeUndefined();
    Object.defineProperty(document.querySelector('video'), 'ended', {value:true});
    expect(adapter().inspect().candidates).toEqual({nextEpisode: next});
  });

  it('recognizes the observed autoplay-off offer without using the countdown for timing', () => {
    offer();
    overlay().querySelector('[data-testid="up_next"]')!.outerHTML = readFileSync('fixtures/hbomax/up-next-off-es.html','utf8');
    const next = overlay().querySelector<HTMLButtonElement>('[data-testid="player-ux-up-next-button"]')!;
    expect(adapter().inspect().candidates.credits).toBe(next);
  });

  it.each(['hidden','disabled','aria-disabled','inert','detached','duplicate','wrong-label','wrong-name','outside-offer','hidden-offer','menu'])(
    'rejects an unsafe next control: %s', reason => {
      const next = offer();
      if (reason === 'hidden') next.hidden = true;
      if (reason === 'disabled') next.disabled = true;
      if (reason === 'aria-disabled') next.setAttribute('aria-disabled','true');
      if (reason === 'inert') next.setAttribute('inert','');
      if (reason === 'detached') next.remove();
      if (reason === 'duplicate') next.after(next.cloneNode(true));
      if (reason === 'wrong-label') next.querySelector('[data-testid="player-ux-up-next-label"]')!.textContent = 'Ver tráiler';
      if (reason === 'wrong-name') next.setAttribute('aria-label','Reproducir recomendación');
      if (reason === 'outside-offer') overlay().append(next);
      if (reason === 'hidden-offer') overlay().querySelector<HTMLElement>('[data-testid="up_next"]')!.style.visibility = 'hidden';
      if (reason === 'menu') overlay().insertAdjacentHTML('beforeend','<button data-testid="player-ux-ipd-dismiss">Cerrar</button>');
      expect(adapter().inspect().candidates).toEqual({});
    },
  );

  it('fails closed in an unobserved locale and after leaving the episode', () => {
    offer();
    document.documentElement.lang = 'en';
    expect(adapter().inspect().capabilities.credits.supported).toBe(false);
    expect(adapter().inspect().candidates).toEqual({});
    document.documentElement.lang = 'es';
    currentUrl = 'https://play.hbomax.com/';
    expect(adapter().inspect().candidates).toEqual({});
  });
});
