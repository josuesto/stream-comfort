import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings, updatePlatform, updateSetting } from '../src/shared/settings';

describe('local preferences', () => {
  it('defaults to intro/recap skipping, with both forms of advancement off', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      enabled: true,
      platforms: { crunchyroll: true, hbomax: true },
      episodeLists: { crunchyroll: [], hbomax: [] },
      services: {
        crunchyroll: { intro: true, recap: true, credits: false, nextEpisode: false, selectedEpisode: false },
        hbomax: { intro: true, recap: true, credits: false, nextEpisode: false, selectedEpisode: false },
      },
    });
    expect(normalizeSettings(undefined)).toEqual(defaultSettings());
  });

  it('keeps independent valid choices and fills missing settings', () => {
    expect(normalizeSettings({
      version: 1, enabled: false, ignored: true,
      services: { crunchyroll: { intro: false, nextEpisode: true, foreign: true }, other: {} },
    })).toEqual({
      version: 1, enabled: false,
      platforms: { crunchyroll: true, hbomax: true },
      episodeLists: { crunchyroll: [], hbomax: [] },
      services: {
        crunchyroll: { intro: false, recap: true, credits: false, nextEpisode: true, selectedEpisode: false },
        hbomax: { intro: true, recap: true, credits: false, nextEpisode: false, selectedEpisode: false },
      },
    });
  });

  it('does not coerce strings/numbers into enabled advancement', () => {
    const settings = normalizeSettings({
      version: 1, enabled: 'yes', services: { crunchyroll: { credits: 'true', nextEpisode: 1 } },
    });
    expect(settings.services.crunchyroll.credits).toBe(false);
    expect(settings.services.crunchyroll.nextEpisode).toBe(false);
  });

  it('migrates existing version 1 preferences without changing the original service or global switch', () => {
    const previous = {
      version: 1, enabled: false,
      services: { crunchyroll: { intro: false, recap: false, credits: true, nextEpisode: true, selectedEpisode: false } },
    };
    const next = normalizeSettings(previous);
    expect(next.version).toBe(1);
    expect(next.enabled).toBe(false);
    expect(next.services.crunchyroll).toEqual(previous.services.crunchyroll);
    expect(next.services.hbomax).toEqual({ intro: true, recap: true, credits: false, nextEpisode: false, selectedEpisode: false });
    expect(next.platforms).toEqual({ crunchyroll: true, hbomax: true });
    expect(previous.services).not.toHaveProperty('hbomax');
  });

  it('preserves independently configured HBO preferences', () => {
    const next = normalizeSettings({
      version: 1, enabled: true,
      services: {
        crunchyroll: { intro: false, recap: true, credits: true, nextEpisode: false, selectedEpisode: false },
        hbomax: { intro: true, recap: false, credits: false, nextEpisode: true, selectedEpisode: false },
      },
    });
    expect(next.services.crunchyroll).toEqual({ intro: false, recap: true, credits: true, nextEpisode: false, selectedEpisode: false });
    expect(next.services.hbomax).toEqual({ intro: true, recap: false, credits: false, nextEpisode: true, selectedEpisode: false });
  });

  it('rejects inherited service objects as well as inherited action values', () => {
    const next = normalizeSettings({
      version: 1, enabled: true,
      services: Object.create({ hbomax: { credits: true, nextEpisode: true, selectedEpisode: false } }),
    });
    expect(next.services.hbomax).toEqual(defaultSettings().services.hbomax);
  });

  it.each([null, true, [], 'bad', { version: 2 }, { version: 0 }, {}])('fails closed for invalid schema %j', value => {
    expect(normalizeSettings(value).enabled).toBe(false);
    expect(normalizeSettings(value).services.crunchyroll.nextEpisode).toBe(false);
  });

  it('does not accept inherited preferences', () => {
    const settings = normalizeSettings({
      version: 1, services: { crunchyroll: Object.create({ credits: true, nextEpisode: true, selectedEpisode: false }) },
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

  it('updates HBO alone and does not share action objects between services', () => {
    const original = defaultSettings();
    const next = updateSetting(original, 'credits', true, 'hbomax');
    expect(next.services.hbomax.credits).toBe(true);
    expect(next.services.crunchyroll.credits).toBe(false);
    expect(original.services.hbomax.credits).toBe(false);
    next.services.crunchyroll.intro = false;
    expect(next.services.hbomax.intro).toBe(true);
    expect(original.services.crunchyroll.intro).toBe(true);
  });

  it('rejects an unknown service instead of writing to a fallback service', () => {
    const original = defaultSettings();
    expect(() => updateSetting(original, 'credits', true, 'unknown' as never)).toThrow('Invalid setting');
    expect(original).toEqual(defaultSettings());
  });

  it('normalizes independent platform switches without coercing malformed values', () => {
    const settings = normalizeSettings({
      version: 1, enabled: true, platforms: { crunchyroll: false, hbomax: 'false', unknown: false },
    });
    expect(settings.platforms).toEqual({ crunchyroll: false, hbomax: true });
    expect(normalizeSettings({ version: 1, platforms: Object.create({ hbomax: false }) }).platforms.hbomax).toBe(true);
  });

  it('toggles one platform immutably while preserving action choices and the global switch', () => {
    const original = updateSetting(updateSetting(defaultSettings(), 'credits', true, 'hbomax'), 'enabled', false);
    const next = updatePlatform(original, 'hbomax', false);
    expect(next.platforms).toEqual({ crunchyroll: true, hbomax: false });
    expect(original.platforms.hbomax).toBe(true);
    expect(next.enabled).toBe(false);
    expect(next.services).toEqual(original.services);
    expect(updatePlatform(next, 'hbomax', true).services.hbomax.credits).toBe(true);
  });

  it('rejects invalid platform mutation arguments', () => {
    expect(() => updatePlatform(defaultSettings(), 'unknown' as never, false)).toThrow('Invalid platform setting');
    expect(() => updatePlatform(defaultSettings(), 'hbomax', 'false' as never)).toThrow('Invalid platform setting');
  });
});
