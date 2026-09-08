import { episodeIdFromLink } from '../shared/episodes';
import { isControlVisible } from '../core/engine';
import type { Capabilities, PlaybackSnapshot, ServiceAdapter } from '../shared/types';

/** All selectors and Spanish labels below were observed on the live player.
 * See fixtures/README.md. No legacy/iframe selectors are guessed. */
export const SELECTORS = {
  player: '#player-container',
  controls: '[data-testid="player-controls-root"]',
  skipIcon: '[data-testid="skip-intro-icon"]',
  next: 'button[data-testid="next-episode-button"]',
} as const;

export function episodeIdFromUrl(value: string): string | null {
  return episodeIdFromLink('crunchyroll', value);
}

const capabilities: Capabilities = {
  intro: { supported: true, detail: 'Control «Saltar intro» verificado en español.' },
  recap: { supported: false, reason: 'crRecapUnavailable', detail: 'Crunchyroll no ofrece un control de resumen en el reproductor inspeccionado.' },
  credits: { supported: true, detail: 'Requiere «Saltar créditos» y el botón siguiente visibles. Puede omitir escenas finales.' },
  nextEpisode: { supported: true, detail: 'Solo al finalizar realmente el vídeo y con el botón siguiente visible.' },
};

function unique<T extends Element>(root: ParentNode, selector: string): T | null {
  const nodes = root.querySelectorAll<T>(selector);
  return nodes.length === 1 ? nodes[0] : null;
}

export function createCrunchyrollAdapter(
  doc: Document = document,
  getUrl: () => string = () => location.href,
  visible: (element: HTMLElement) => boolean = isControlVisible,
): ServiceAdapter {
  return {
    id: 'crunchyroll',
    inspect(): PlaybackSnapshot {
      const episodeId = episodeIdFromUrl(getUrl());
      const spanish = doc.documentElement.lang.split('-')[0].toLowerCase() === 'es';
      const localCapabilities: Capabilities = spanish ? capabilities : {
        ...capabilities,
        intro: {supported:false, reason:'spanishPlayerRequired', detail:'Esta versión reconoce el botón de intro en español.'},
        credits: {supported:false, reason:'spanishPlayerRequired', detail:'Esta versión reconoce el aviso de créditos en español.'},
      };
      const empty: PlaybackSnapshot = { episodeId, player: null, video: null, candidates: {}, capabilities: localCapabilities };
      if (!episodeId) return empty;
      const player = unique<HTMLElement>(doc, SELECTORS.player);
      if (!player || !unique(player, SELECTORS.controls)) return empty;
      const controls = unique<HTMLElement>(player, SELECTORS.controls)!;
      const video = unique<HTMLVideoElement>(player, 'video');
      if (!video) return empty;
      const result: PlaybackSnapshot = { ...empty, player, video };
      // Leave open player menus undisturbed while a viewer changes settings.
      if ([...controls.querySelectorAll<HTMLElement>('[role="menu"]')].some(visible)) return result;
      const skip = unique<SVGElement>(controls, SELECTORS.skipIcon)?.closest('button') ?? null;
      const next = unique<HTMLButtonElement>(controls, SELECTORS.next);
      // The icon is reused for credits and remains mounted while hidden.
      // Require matching visible text AND explicit accessible name for each action.
      if (spanish && skip && controls.contains(skip) && !skip.disabled && skip.getAttribute('aria-hidden') === 'false' && visible(skip)) {
        const label = skip.getAttribute('aria-label')?.trim();
        const text = skip.textContent?.trim();
        if (label === 'Saltar intro' && text === label) result.candidates.intro = skip;
        if (label === 'Saltar créditos' && text === label && next && !video.ended) result.candidates.credits = next;
      }
      if (next && video.ended) result.candidates.nextEpisode = next;
      return result;
    },
  };
}
