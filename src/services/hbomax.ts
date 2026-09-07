import { isControlVisible } from '../core/engine';
import type { Capabilities, PlaybackSnapshot, ServiceAdapter } from '../shared/types';

/** Observed on play.hbomax.com, es-419, 2026-09-07. See fixtures/hbomax/README.md. */
export const HBO_SELECTORS = {
  player: '[data-testid="playerContainer"]',
  overlay: '[data-testid="overlay-root"][role="group"][aria-label="video player"]',
  video: 'video[data-testid="VideoElement"]',
  skip: 'button[data-testid="player-ux-skip-button"]',
} as const;

export function hboEpisodeIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://play.hbomax.com') return null;
    return url.pathname.match(/^\/video\/watch\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i)?.[1].toLowerCase() ?? null;
  } catch { return null; }
}

function unique<T extends Element>(root: ParentNode, selector: string): T | null {
  const matches = root.querySelectorAll<T>(selector);
  return matches.length === 1 ? matches[0] : null;
}

export function createHboMaxAdapter(
  doc: Document = document,
  getUrl: () => string = () => location.href,
  visible: (element: HTMLElement) => boolean = isControlVisible,
): ServiceAdapter {
  return {
    id: 'hbomax',
    inspect(): PlaybackSnapshot {
      const spanish = doc.documentElement.lang.toLowerCase().split('-')[0] === 'es';
      const capabilities: Capabilities = {
        intro: {supported:spanish, detail:spanish ? 'Activa el control «Omitir intro».' : 'El control de intro solo está verificado en español.'},
        recap: {supported:spanish, detail:spanish ? 'Activa el control «Omitir resumen».' : 'El control de resumen solo está verificado en español.'},
        credits: {supported:false, detail:'Aún no se ha verificado una señal segura para avanzar durante los créditos de HBO Max.'},
        nextEpisode: {supported:false, detail:'El control de siguiente episodio de HBO Max aún no se ha verificado.'},
      };
      const episodeId = hboEpisodeIdFromUrl(getUrl());
      const empty: PlaybackSnapshot = {episodeId, player:null, video:null, candidates:{}, capabilities};
      if (!episodeId) return empty;
      const player = unique<HTMLElement>(doc, HBO_SELECTORS.player);
      if (!player) return empty;
      const overlay = unique<HTMLElement>(player, HBO_SELECTORS.overlay);
      const video = unique<HTMLVideoElement>(player, HBO_SELECTORS.video);
      if (!overlay || !video) return empty;
      const result: PlaybackSnapshot = {...empty, player, video};
      // Both menus stay mounted while concealed. Only visible panels block actions.
      if ([...overlay.querySelectorAll<HTMLElement>('[data-testid="player-ux-track-dismiss-button"],[data-testid="player-ux-ipd-dismiss"]')].some(visible)) return result;
      const skip = unique<HTMLButtonElement>(overlay, HBO_SELECTORS.skip);
      if (!spanish || !skip || skip.disabled || skip.getAttribute('aria-disabled') === 'true' || !visible(skip)) return result;
      const label = skip.getAttribute('aria-label')?.trim();
      const text = skip.textContent?.trim();
      if (label !== text) return result;
      if (label === 'Omitir intro') result.candidates.intro = skip;
      if (label === 'Omitir resumen') result.candidates.recap = skip;
      // Generic "Saltar" belongs to a promotional preview and is deliberately ignored.
      return result;
    },
  };
}
