import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings, updateSetting } from '../src/shared/settings';

describe('local preferences', () => {
  it('defaults to intro/recap skipping, with both forms of advancement off', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      enabled: true,
      services: { crunchyroll: { intro: true, recap: true, credits: false, nextEpisode: false } },
    });
    expect(normalizeSettings(undefined)).toEqual(defaultSettings());
  });

  it('keeps independent valid choices and fills missing settings', () => {
    expect(normalizeSettings({
      version: 1, enabled: false, ignored: true,
      services: { crunchyroll: { intro: false, nextEpisode: true, foreign: true }, other: {} },
    })).toEqual({
      version: 1, enabled: false,
      services: { crunchyroll: { intro: false, recap: true, credits: false, nextEpisode: true } },
    });
  });

  it('does not coerce strings/numbers into enabled advancement', () => {
    const settings = normalizeSettings({
      version: 1, enabled: 'yes', services: { crunchyroll: { credits: 'true', nextEpisode: 1 } },
    });
    expect(settings.services.crunchyroll.credits).toBe(false);
    expect(settings.services.crunchyroll.nextEpisode).toBe(false);
  });

  it.each([null, true, [], 'bad', { version: 2 }, { version: 0 }, {}])('fails closed for invalid schema %j', value => {
    expect(normalizeSettings(value).enabled).toBe(false);
    expect(normalizeSettings(value).services.crunchyroll.nextEpisode).toBe(false);
  });

  it('does not accept inherited preferences', () => {
    const settings = normalizeSettings({
      version: 1, services: { crunchyroll: Object.create({ credits: true, nextEpisode: true }) },
    });
    expect(settings.services.crunchyroll.credits).toBe(false);
    expect(settings.services.crunchyroll.nextEpisode).toBe(false);
  });

  it('updates one field immutably without sharing defaults', () => {
    const original = defaultSettings();
    const next = updateSetting(original, 'credits', true);
    expect(next.services.crunchyroll.credits).toBe(true);
    expect(original.services.crunchyroll.credits).toBe(false);
    expect(defaultSettings().services.crunchyroll.credits).toBe(false);
    expect(updateSetting(next, 'enabled', false).services.crunchyroll.credits).toBe(true);
  });
});
