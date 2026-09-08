export const ACTIONS = ['intro', 'recap', 'credits', 'nextEpisode', 'selectedEpisode'] as const;
export type Action = typeof ACTIONS[number];
export const SERVICES = ['crunchyroll', 'hbomax'] as const;
export type ServiceId = typeof SERVICES[number];
export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === 'string' && SERVICES.includes(value as ServiceId);
}
export type ActionSettings = Record<Action, boolean>;
export const UI_LANGUAGES = ['en', 'es'] as const;
export type UiLanguage = typeof UI_LANGUAGES[number];
export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'en' || value === 'es';
}
export interface Settings {
  version: 1;
  language: UiLanguage;
  enabled: boolean;
  platforms: Record<ServiceId, boolean>;
  services: Record<ServiceId, ActionSettings>;
  episodeLists: Record<ServiceId, string[]>;
}
export const CAPABILITY_REASONS = ['crRecapUnavailable', 'hboEpisodeListUnavailable', 'spanishPlayerRequired'] as const;
export type CapabilityReason = typeof CAPABILITY_REASONS[number];
export interface Capability { supported: boolean; detail: string; reason?: CapabilityReason }
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
  episodeId: string | null;
  pageSupported: boolean;
  playerReady: boolean;
  paused: boolean;
  manualHold: boolean;
  capabilities: Capabilities;
  lastAction: Action | null;
}
export type Request =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_LANGUAGE'; language: UiLanguage }
  | { type: 'SET_SETTING'; key: 'enabled' | Action; value: boolean; service?: ServiceId }
  | { type: 'SET_PLATFORM'; service: ServiceId; enabled: boolean }
  | { type: 'SET_EPISODE_LIST'; service: ServiceId; episodeIds: string[] }
  | { type: 'GET_TAB_PAUSE' }
  | { type: 'SET_TAB_PAUSE'; tabId: number; paused: boolean }
  | { type: 'TAB_PAUSE_CHANGED'; paused: boolean }
  | { type: 'GET_STATUS' };
