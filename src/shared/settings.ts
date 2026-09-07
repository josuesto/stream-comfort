import { ACTIONS, type Action, type Settings } from './types';

export const SETTINGS_KEY = 'settings';
export type SettingKey = 'enabled' | Action;

/** Return fresh objects so callers cannot mutate shared defaults. */
export function defaultSettings(): Settings {
  return {
    version: 1,
    enabled: true,
    services: {
      crunchyroll: { intro: true, recap: true, credits: false, nextEpisode: false },
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
  const service = isRecord(services) ? own(services, 'crunchyroll') : undefined;
  if (isRecord(service)) {
    for (const action of ACTIONS) {
      const actionValue = own(service, action);
      if (typeof actionValue === 'boolean') settings.services.crunchyroll[action] = actionValue;
    }
  }
  return settings;
}

/** Apply one validated setting without mutating the caller's object. */
export function updateSetting(settings: Settings, key: SettingKey, value: boolean): Settings {
  if (typeof value !== 'boolean' || (key !== 'enabled' && !ACTIONS.includes(key))) {
    throw new TypeError('Invalid setting');
  }
  const next = normalizeSettings(settings);
  if (key === 'enabled') next.enabled = value;
  else next.services.crunchyroll[key] = value;
  return next;
}
