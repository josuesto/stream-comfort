export const ACTIONS = ['intro', 'recap', 'credits', 'nextEpisode'] as const;
export type Action = typeof ACTIONS[number];
export const SERVICES = ['crunchyroll', 'hbomax'] as const;
export type ServiceId = typeof SERVICES[number];
export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === 'string' && SERVICES.includes(value as ServiceId);
}
export type ActionSettings = Record<Action, boolean>;
export interface Settings {
  version: 1;
  enabled: boolean;
  platforms: Record<ServiceId, boolean>;
  services: Record<ServiceId, ActionSettings>;
}
export interface Capability { supported: boolean; detail: string }
export type Capabilities = Record<Action, Capability>;
export interface PlaybackSnapshot {
  episodeId: string | null;
  player: HTMLElement | null;
  video: HTMLVideoElement | null;
  candidates: Partial<Record<Action, HTMLElement>>;
  capabilities: Capabilities;
}
export interface ServiceAdapter {
  id: ServiceId;
  inspect(): PlaybackSnapshot;
}
export interface TabStatus {
  service: ServiceId;
  pageSupported: boolean;
  playerReady: boolean;
  paused: boolean;
  manualHold: boolean;
  capabilities: Capabilities;
  lastAction: Action | null;
}
export type Request =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTING'; key: 'enabled' | Action; value: boolean; service?: ServiceId }
  | { type: 'SET_PLATFORM'; service: ServiceId; enabled: boolean }
  | { type: 'GET_TAB_PAUSE' }
  | { type: 'SET_TAB_PAUSE'; tabId: number; paused: boolean }
  | { type: 'TAB_PAUSE_CHANGED'; paused: boolean }
  | { type: 'GET_STATUS' };
