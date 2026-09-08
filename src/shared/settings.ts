import { ACTIONS, SERVICES, isServiceId, type Action, type ServiceId, type Settings } from './types';
import { validateEpisodeList } from './episodes';

export const SETTINGS_KEY = 'settings';
export type SettingKey = 'enabled' | Action;

/** Return fresh objects so callers cannot mutate shared defaults. */
export function defaultSettings(): Settings {
  return {
    version: 1,
    enabled: true,
    platforms: { crunchyroll: true, hbomax: true },
    episodeLists: { crunchyroll: [], hbomax: [] },
    services: {
      crunchyroll: { intro: true, recap: true, credits: false, nextEpisode: false, selectedEpisode: false },
      hbomax: { intro: true, recap: true, credits: false, nextEpisode: false, selectedEpisode: false },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/** Unknown schemas fail closed. Only explicit booleans can enable an action. */
export function normalizeSettings(value: unknown): Settings {
  const settings = defaultSettings();
  if (value === undefined) return settings;
  if (!isRecord(value) || own(value, 'version') !== 1) {
    settings.enabled = false;
    return settings;
  }
  const enabled = own(value, 'enabled');
  if (typeof enabled === 'boolean') settings.enabled = enabled;
  const services = own(value, 'services');
  const platforms = own(value, 'platforms');
  const lists = own(value, 'episodeLists');
  for (const serviceId of SERVICES) {
    const list = isRecord(lists) ? validateEpisodeList(serviceId, own(lists, serviceId)) : null;
    if (list) settings.episodeLists[serviceId] = list;
    const platformValue = isRecord(platforms) ? own(platforms, serviceId) : undefined;
    if (typeof platformValue === 'boolean') settings.platforms[serviceId] = platformValue;
    const service = isRecord(services) ? own(services, serviceId) : undefined;
    if (!isRecord(service)) continue;
    for (const action of ACTIONS) {
      const actionValue = own(service, action);
      if (typeof actionValue === 'boolean') settings.services[serviceId][action] = actionValue;
    }
    if (!list) settings.services[serviceId].selectedEpisode = false;
  }
  return settings;
}

export function updateEpisodeList(settings: Settings, service: ServiceId, episodeIds: unknown): Settings {
  if (!isServiceId(service)) throw new TypeError('Invalid service');
  const list = validateEpisodeList(service, episodeIds);
  if (!list) throw new TypeError('Invalid episode selection');
  const next = normalizeSettings(settings);
  next.episodeLists[service] = list;
  if (!list.length) next.services[service].selectedEpisode = false;
  return next;
}

/** Apply one validated setting without mutating the caller's object. */
export function updateSetting(settings: Settings, key: SettingKey, value: boolean, service: ServiceId = 'crunchyroll'): Settings {
  if (typeof value !== 'boolean' || (key !== 'enabled' && (!ACTIONS.includes(key) || !isServiceId(service)))) {
    throw new TypeError('Invalid setting');
  }
  const next = normalizeSettings(settings);
  if (key === 'enabled') next.enabled = value;
  else next.services[service][key] = value;
  return next;
}

/** Enable or disable a service without resetting any of its action choices. */
export function updatePlatform(settings: Settings, service: ServiceId, enabled: boolean): Settings {
  if (!isServiceId(service) || typeof enabled !== 'boolean') throw new TypeError('Invalid platform setting');
  const next = normalizeSettings(settings);
  next.platforms[service] = enabled;
  return next;
}
