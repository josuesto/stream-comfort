import { ACTIONS, SERVICES, isServiceId, isUiLanguage, type Action, type ServiceId, type Settings, type UiLanguage } from './types';

export const SETTINGS_KEY = 'settings';
export type SettingKey = 'enabled' | Action;

/** One set of playback preferences applies to every enabled platform. */
export function defaultSettings(): Settings {
  return {
    version: 2,
    language: 'en',
    enabled: true,
    platforms: { crunchyroll: true, hbomax: true },
    actions: { intro: true, recap: true, credits: false, nextEpisode: false },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export function needsSettingsMigration(value: unknown): boolean {
  return isRecord(value) && own(value, 'version') === 1;
}

/** Unknown schemas fail closed. Only explicit booleans can enable advancement. */
export function normalizeSettings(value: unknown): Settings {
  const settings = defaultSettings();
  if (value === undefined) return settings;
  if (!isRecord(value) || (own(value, 'version') !== 1 && own(value, 'version') !== 2)) {
    settings.enabled = false;
    return settings;
  }
  const enabled = own(value, 'enabled');
  const language = own(value, 'language');
  if (isUiLanguage(language)) settings.language = language;
  if (typeof enabled === 'boolean') settings.enabled = enabled;
  const platforms = own(value, 'platforms');
  for (const service of SERVICES) {
    const platform = isRecord(platforms) ? own(platforms, service) : undefined;
    if (typeof platform === 'boolean') settings.platforms[service] = platform;
  }

  if (own(value, 'version') === 1) {
    const services = own(value, 'services');
    for (const action of ACTIONS) {
      // A disabled choice on either old platform wins. Do not broaden an old
      // advancement opt-in to a platform where it had been off (even if disabled).
      settings.actions[action] = SERVICES.every(id => {
        const service = isRecord(services) ? own(services, id) : undefined;
        const previous = isRecord(service) ? own(service, action) : undefined;
        return typeof previous === 'boolean' ? previous : settings.actions[action];
      });
    }
  } else {
    const actions = own(value, 'actions');
    for (const action of ACTIONS) {
      const next = isRecord(actions) ? own(actions, action) : undefined;
      if (typeof next === 'boolean') settings.actions[action] = next;
    }
  }
  // Only current fields are returned, discarding retired episode lists and overrides.
  return settings;
}

export function updateSetting(settings: Settings, key: SettingKey, value: boolean): Settings {
  if (typeof value !== 'boolean' || (key !== 'enabled' && !ACTIONS.includes(key))) throw new TypeError('Invalid setting');
  const next = normalizeSettings(settings);
  if (key === 'enabled') next.enabled = value;
  else next.actions[key] = value;
  return next;
}

/** Platform switches never change the shared action preferences. */
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
