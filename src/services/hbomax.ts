import { episodeIdFromLink } from '../shared/episodes';
import { isControlVisible } from '../core/engine';
import type { Capabilities, PlaybackSnapshot, ServiceAdapter } from '../shared/types';

/** Observed on play.hbomax.com, es-419, 2026-09-07. See fixtures/hbomax/README.md. */
export const HBO_SELECTORS = {
  player: '[data-testid="playerContainer"]',
  overlay: '[data-testid="overlay-root"][role="group"][aria-label="video player"]',
  video: 'video[data-testid="VideoElement"]',
  skip: 'button[data-testid="player-ux-skip-button"]',
  upNext: '[data-testid="up_next"]',
  nextContainer: '[data-testid="player-ux-up-next-container"]',
  next: 'button[data-testid="player-ux-up-next-button"]',
  nextLabel: '[data-testid="player-ux-up-next-label"]',
  cancelNext: 'button[data-testid="player-ux-up-next-dismiss"]',
} as const;

export function hboEpisodeIdFromUrl(value: string): string | null {
  return episodeIdFromLink('hbomax', value);
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
        intro: {supported:spanish, ...(!spanish ? {reason: 'spanishPlayerRequired' as const} : {}), detail:spanish ? 'Activa el control «Omitir intro».' : 'El control de intro solo está verificado en español.'},
        recap: {supported:spanish, ...(!spanish ? {reason: 'spanishPlayerRequired' as const} : {}), detail:spanish ? 'Activa el control «Omitir resumen».' : 'El control de resumen solo está verificado en español.'},
        credits: {supported:spanish, ...(!spanish ? {reason: 'spanishPlayerRequired' as const} : {}), detail:spanish ? 'Avanza cuando HBO ofrece «Siguiente episodio» durante los créditos. Puede omitir escenas finales.' : 'El aviso de siguiente episodio solo está verificado en español.'},
        nextEpisode: {supported:spanish, ...(!spanish ? {reason: 'spanishPlayerRequired' as const} : {}), detail:spanish ? 'Activa «Siguiente episodio» en cuanto aparece el aviso. Puede omitir créditos y escenas finales.' : 'El aviso de siguiente episodio solo está verificado en español.'},
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
      if (!spanish) return result;
      const skip = unique<HTMLButtonElement>(overlay, HBO_SELECTORS.skip);
      if (skip && !skip.disabled && skip.getAttribute('aria-disabled') !== 'true' && visible(skip)) {
        const label = skip.getAttribute('aria-label')?.trim();
        if (label === skip.textContent?.trim()) {
          if (label === 'Omitir intro') result.candidates.intro = skip;
          if (label === 'Omitir resumen') result.candidates.recap = skip;
        }
      }
      // Generic "Saltar" belongs to a promotional preview and is deliberately ignored.
      // HBO's native up-next offer identifies the credits. Never infer them from
      // duration, countdown digits, season numbering, or a generic recommendation.
      const offer = unique<HTMLElement>(overlay, HBO_SELECTORS.upNext);
      const container = offer && unique<HTMLElement>(offer, HBO_SELECTORS.nextContainer);
      const next = container && unique<HTMLButtonElement>(container, HBO_SELECTORS.next);
      const nextLabel = next && unique<HTMLElement>(next, HBO_SELECTORS.nextLabel);
      const name = next?.getAttribute('aria-label')?.trim() ?? '';
      const recognized = /^Reproducir siguiente episodio, (?:Se reproducirá automáticamente en \d+ segundos|La reproducción automática está apagada)$/.test(name);
      if (next && !next.disabled && next.getAttribute('aria-disabled') !== 'true' && visible(next)
        && recognized && nextLabel?.textContent?.trim() === 'Siguiente episodio') {
        result.candidates.nextEpisode = next;
        if (!video.ended) result.candidates.credits = next;
      }
      return result;
    },
  };
}
