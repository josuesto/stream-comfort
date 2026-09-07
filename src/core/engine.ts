import type { Action, PlaybackSnapshot, ServiceAdapter, Settings, TabStatus } from '../shared/types';

export interface AutomationState {
  settings: Settings;
  paused: boolean;
}

export interface EngineOptions {
  /** Tests may inject layout visibility; production always checks browser layout. */
  isVisible?: (element: HTMLElement) => boolean;
}

interface EpisodeContext {
  episodeId: string;
  player: HTMLElement | null;
  video: HTMLVideoElement | null;
  loadVersion: number;
  quarantined: boolean;
}

const PRIORITY: readonly Action[] = ['intro', 'recap', 'credits', 'nextEpisode'];
const MAX_EPISODES = 64;
type LedgerEntry = Action | 'advance';

/** Fail closed when a control, including any of its ancestors, is concealed. */
export function isControlVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.getClientRects().length === 0) return false;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.hidden || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert')) return false;
    const style = view.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
  }
  return true;
}

/**
 * Synchronous automation: the caller schedules step() after relevant DOM/media changes.
 * Call manualInteraction() only for genuine user intent, not every media event (a
 * service's scripted seek/pause also emits trusted media events). No timers or
 * promises can retain a stale control. Each attempt is recorded before .click().
 *
 * A new episode URL with the same player/video is quarantined until a subsequent
 * loadstart, emptied or loadedmetadata event. A real player/video replacement also
 * releases it. A URL alone is never proof that the old controls belong to new media.
 * If a service changes media without those signals, automation stays conservative.
 */
export class AutomationEngine {
  private readonly visible: (element: HTMLElement) => boolean;
  private readonly ledger = new Map<string, Set<LedgerEntry>>();
  private readonly manuallySuppressed = new Set<HTMLElement>();
  private context: EpisodeContext | null = null;
  private watchedVideo: HTMLVideoElement | null = null;
  private loadVersion = 0;
  private held = false;
  private previousAction: Action | null = null;
  private readonly onLoadBoundary = (): void => {
    // DOM/media events can be coalesced by the caller's scheduler. Capture the
    // route at the event itself so a real boundary after navigation is not lost
    // simply because the next scheduled step has not run yet.
    const current = this.adapter.inspect();
    if (current.video && current.video !== this.watchedVideo) return;
    this.reconcileEpisode(current);
    this.loadVersion += 1;
  };

  constructor(
    private readonly adapter: ServiceAdapter,
    private readonly getState: () => AutomationState,
    options: EngineOptions = {},
  ) {
    this.visible = options.isVisible ?? isControlVisible;
  }

  get manualHold(): boolean { return this.held; }
  get lastAction(): Action | null { return this.previousAction; }

  /** Explicit resume clears manual suppression, but never permits a duplicate action. */
  resume(): void {
    this.held = false;
    this.manuallySuppressed.clear();
  }

  /** The content script determines user intent; target is accepted for caller convenience. */
  manualInteraction(_target?: EventTarget | null): void {
    const snapshot = this.capture();
    this.held = true;
    for (const element of Object.values(snapshot.candidates)) {
      if (element && element.isConnected) this.manuallySuppressed.add(element);
    }
  }

  getStatus(): TabStatus {
    const snapshot = this.capture();
    const state = this.getState();
    return {
      service: this.adapter.id,
      pageSupported: Boolean(snapshot.episodeId && snapshot.player),
      playerReady: Boolean(snapshot.video && snapshot.video.readyState >= 2 && !this.context?.quarantined),
      paused: state.paused,
      manualHold: this.held,
      capabilities: snapshot.capabilities,
      lastAction: this.previousAction,
    };
  }

  step(): void {
    const first = this.capture();
    this.clearDisappearedSuppression(first);
    if (!this.canRun(first)) return;

    for (const action of PRIORITY) {
      const element = first.candidates[action];
      if (!element || !this.canAct(first, action, element)) continue;

      // Re-resolve immediately before the synchronous click: navigation, settings,
      // and DOM replacement can invalidate an adapter's earlier snapshot.
      const current = this.capture();
      if (!this.samePlayback(first, current) || current.candidates[action] !== element) return;
      if (!this.canRun(current) || !this.canAct(current, action, element)) return;

      const entries = this.entriesFor(current.episodeId!);
      entries.add(action);
      if (this.isAdvance(action)) entries.add('advance');
      try {
        element.click();
        this.previousAction = action;
      } catch {
        // Preserve the attempt ledger even when a page overrides click and throws.
        // Retrying an uncertain attempt could navigate through multiple episodes.
      }
      return;
    }
  }

  dispose(): void {
    this.watchVideo(null);
    this.manuallySuppressed.clear();
  }

  private capture(): PlaybackSnapshot {
    const snapshot = this.adapter.inspect();
    // Do not detach from the old video during a transient empty SPA render: its
    // load event may be the evidence that resolves the pending episode change.
    if (snapshot.video) this.watchVideo(snapshot.video);
    this.reconcileEpisode(snapshot);
    return snapshot;
  }

  private watchVideo(video: HTMLVideoElement | null): void {
    if (video === this.watchedVideo) return;
    for (const event of ['loadstart', 'emptied', 'loadedmetadata']) {
      this.watchedVideo?.removeEventListener(event, this.onLoadBoundary);
    }
    this.watchedVideo = video;
    this.loadVersion = 0;
    for (const event of ['loadstart', 'emptied', 'loadedmetadata']) {
      video?.addEventListener(event, this.onLoadBoundary);
    }
  }

  private reconcileEpisode(snapshot: PlaybackSnapshot): void {
    if (!snapshot.episodeId) return;
    const previous = this.context;
    const replaced = Boolean(previous && (
      (snapshot.player && previous.player && snapshot.player !== previous.player) ||
      (snapshot.video && previous.video && snapshot.video !== previous.video)
    ));
    if (!previous || previous.episodeId !== snapshot.episodeId) {
      this.context = {
        episodeId: snapshot.episodeId,
        player: snapshot.player ?? previous?.player ?? null,
        video: snapshot.video ?? previous?.video ?? null,
        loadVersion: this.loadVersion,
        quarantined: Boolean(previous && !replaced),
      };
      if (previous) this.held = false;
      return;
    }
    if (replaced || this.loadVersion > previous.loadVersion) previous.quarantined = false;
    if (snapshot.player) previous.player = snapshot.player;
    if (snapshot.video) previous.video = snapshot.video;
    if (replaced) previous.loadVersion = this.loadVersion;
  }

  private canRun(snapshot: PlaybackSnapshot): boolean {
    const { settings, paused } = this.getState();
    const { player, video } = snapshot;
    return Boolean(
      settings.enabled && settings.platforms[this.adapter.id] && !paused && !this.held &&
      snapshot.episodeId && !this.context?.quarantined &&
      player?.isConnected && video?.isConnected && player.contains(video) &&
      player.ownerDocument.visibilityState === 'visible' &&
      video.readyState >= 2 && !video.seeking
    );
  }

  private canAct(snapshot: PlaybackSnapshot, action: Action, element: HTMLElement): boolean {
    const { settings, paused } = this.getState();
    if (!settings.enabled || !settings.platforms[this.adapter.id] || paused || this.held || !settings.services[this.adapter.id][action]) return false;
    if (!snapshot.capabilities[action].supported || !snapshot.player?.contains(element)) return false;
    if (!element.isConnected || !this.visible(element) || this.manuallySuppressed.has(element)) return false;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      if (node.matches(':disabled') || node.getAttribute('aria-disabled') === 'true' || node.hasAttribute('inert')) return false;
    }
    const video = snapshot.video;
    if (!video || (action === 'nextEpisode' ? !video.ended : (video.paused || video.ended))) return false;
    const entries = this.ledger.get(snapshot.episodeId!);
    return !entries?.has(action) && !(this.isAdvance(action) && entries?.has('advance'));
  }

  private clearDisappearedSuppression(snapshot: PlaybackSnapshot): void {
    const candidates = new Set(Object.values(snapshot.candidates));
    for (const element of this.manuallySuppressed) {
      if (!candidates.has(element) || !element.isConnected || !this.visible(element)) {
        this.manuallySuppressed.delete(element);
      }
    }
  }

  private samePlayback(a: PlaybackSnapshot, b: PlaybackSnapshot): boolean {
    return a.episodeId === b.episodeId && a.player === b.player && a.video === b.video;
  }

  private isAdvance(action: Action): boolean {
    return action === 'credits' || action === 'nextEpisode';
  }

  private entriesFor(episodeId: string): Set<LedgerEntry> {
    const existing = this.ledger.get(episodeId);
    if (existing) return existing;
    const entries = new Set<LedgerEntry>();
    this.ledger.set(episodeId, entries);
    if (this.ledger.size > MAX_EPISODES) this.ledger.delete(this.ledger.keys().next().value!);
    return entries;
  }
}
