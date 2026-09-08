import {createCrunchyrollAdapter, SELECTORS} from './crunchyroll';
import {createHboMaxAdapter, HBO_SELECTORS} from './hbomax';
import type {ServiceAdapter} from '../shared/types';
import type {ManualControls} from './manual-intent';

export interface ServiceIntegration { adapter: ServiceAdapter; manual: ManualControls }

export function createServiceIntegration(doc:Document, getUrl:()=>string): ServiceIntegration | null {
  let origin:string;
  try {origin = new URL(getUrl()).origin;} catch {return null;}
  if (origin === 'https://www.crunchyroll.com') return {
    adapter:createCrunchyrollAdapter(doc,getUrl),
    manual:{
      seek:'input.timeline-slider,[data-testid="jump-backward-button"],[data-testid="jump-forward-button"]',
      skip:SELECTORS.skipIcon, next:SELECTORS.next,
      playPause:'[data-testid="play-pause-button"]',
      quiet:'[data-testid="volume-slider-container"]',
    },
  };
  if (origin === 'https://play.hbomax.com') return {
    adapter:createHboMaxAdapter(doc,getUrl),
    manual:{
      seek:'[data-testid="player-ux-scrubber-position"],[data-testid="player-ux-skip-back-button"],[data-testid="player-ux-skip-forward-button"]',
      skip:HBO_SELECTORS.skip,
      next:`${HBO_SELECTORS.next},${HBO_SELECTORS.cancelNext}`,
      playPause:'[data-testid="player-ux-play-pause-button"]',
      quiet:'[data-testid="player-ux-volume-button"]',
    },
  };
  return null;
}
