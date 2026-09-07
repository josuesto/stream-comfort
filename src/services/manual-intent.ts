import type { PlaybackSnapshot } from '../shared/types';

export interface ManualControls {
  seek: string;
  skip: string;
  next?: string;
  playPause: string;
  quiet: string;
}

/** Classifies user input only; scripted media events are never treated as intent. */
export function isManualPlaybackIntent(event: Event, snapshot: PlaybackSnapshot, controls: ManualControls): boolean {
  if (!event.isTrusted || !(event.target instanceof Element)) return false;
  const {player, video} = snapshot;
  if (!player || !video) return false;
  const target = event.target;
  const inPlayer = player.contains(target);
  if (target.closest(controls.quiet)) return false;
  if (event instanceof KeyboardEvent) {
    if (target.matches('input:not([type="range"]),textarea,[contenteditable="true"]')) return false;
    // Native button activation produces a trusted click, captured separately.
    if (target.closest('button') && ['Enter', ' '].includes(event.key)) return false;
    if (![' ', 'k', 'K', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return false;
    const doc = player.ownerDocument;
    if (!inPlayer && target !== doc.body && target !== doc.documentElement) return false;
    return !([' ', 'k', 'K'].includes(event.key) && video.paused);
  }
  if (!inPlayer) return false;
  const seek = target.closest(controls.seek);
  const button = target.closest('button');
  const skip = button?.matches(controls.skip) || button?.querySelector(controls.skip);
  const next = controls.next && target.closest(controls.next);
  const navigation = target.closest('a[href]');
  const surface = !target.closest('button,input,a,[role="slider"],[role="menu"]');
  const pauseIntent = (target.closest(controls.playPause) || surface) && !video.paused;
  return Boolean(seek || skip || next || navigation || pauseIntent);
}
