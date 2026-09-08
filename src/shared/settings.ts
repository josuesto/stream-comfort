import { ACTIONS, SERVICES, isServiceId, isUiLanguage, type Action, type ServiceId, type Settings, type UiLanguage } from './types';

export const SETTINGS_KEY = 'settings';
export type SettingKey = 'enabled' | Action;

/** Return fresh objects so callers cannot mutate shared defaults. */
export function defaultSettings(): Settings {
  return {
    version: 1,
    language: 'en',
    enabled: true,
    platforms: { crunchyroll: true, hbomax: true },
    services: {
      crunchyroll: { intro: true, recap: true, credits: false, nextEpisode: false },
      hbomax: { intro: true, recap: true, credits: false, nextEpisode: false },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/** Retired list preferences are discarded on normalization and removed on read. */
export function hasRetiredEpisodeSettings(value: unknown): boolean {
  if (!isRecord(value) || own(value, 'version') !== 1) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'episodeLists')) return true;
  const services = own(value, 'services');
  if (!isRecord(services)) return false;
  return SERVICES.some(id => {
    const service = own(services, id);
    return isRecord(service) && Object.prototype.hasOwnProperty.call(service, 'selectedEpisode');
  });
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
  const language = own(value, 'language');
  if (isUiLanguage(language)) settings.language = language;
  if (typeof enabled === 'boolean') settings.enabled = enabled;
  const services = own(value, 'services');
  const platforms = own(value, 'platforms');
  for (const serviceId of SERVICES) {
    const platformValue = isRecord(platforms) ? own(platforms, serviceId) : undefined;
    if (typeof platformValue === 'boolean') settings.platforms[serviceId] = platformValue;
    const service = isRecord(services) ? own(services, serviceId) : undefined;
    if (!isRecord(service)) continue;
    for (const action of ACTIONS) {
      const actionValue = own(service, action);
      if (typeof actionValue === 'boolean') settings.services[serviceId][action] = actionValue;
    }
  }
  return settings;
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

/** The popup language is independent of the streaming player's language. */
export function updateLanguage(settings: Settings, language: UiLanguage): Settings {
  if (!isUiLanguage(language)) throw new TypeError('Invalid language');
  const next = normalizeSettings(settings);
  next.language = language;
  return next;
}
