import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings, needsSettingsMigration, updatePlatform, updateSetting, updateLanguage } from '../src/shared/settings';

describe('shared local preferences', () => {
  it('defaults to one action set, English, enabled platforms, and no episode advancement', () => {
    expect(defaultSettings()).toEqual({
      version: 2, language: 'en', enabled: true,
      platforms: { crunchyroll: true, hbomax: true },
      actions: { intro: true, recap: true, credits: false, nextEpisode: false },
    });
    expect(normalizeSettings(undefined)).toEqual(defaultSettings());
  });

  it('migrates matching old choices and removes old lists and overrides', () => {
    const actions = { intro: false, recap: true, credits: true, nextEpisode: false };
    const legacy = { version: 1, language: 'es', enabled: false,
      platforms: { crunchyroll: false, hbomax: true },
      services: { crunchyroll: { ...actions, selectedEpisode: true }, hbomax: actions },
      episodeLists: { crunchyroll: ['EPISODE01'] },
    };
    const next = normalizeSettings(legacy);
    expect(next).toEqual({ version: 2, language: 'es', enabled: false, platforms: legacy.platforms, actions });
    expect(needsSettingsMigration(legacy)).toBe(true);
    expect(needsSettingsMigration(next)).toBe(false);
    expect(legacy).toHaveProperty('episodeLists');
  });

  it('keeps conflicting old choices off, even if one platform is disabled', () => {
    const next = normalizeSettings({ version: 1, platforms: { hbomax: false }, services: {
      crunchyroll: { intro: true, recap: false, credits: true, nextEpisode: false },
      hbomax: { intro: false, recap: true, credits: false, nextEpisode: true },
    } });
    expect(next.actions).toEqual({ intro: false, recap: false, credits: false, nextEpisode: false });
    expect(next.platforms.hbomax).toBe(false);
    expect(updatePlatform(next, 'hbomax', true).actions).toEqual(next.actions);
  });

  it('fills missing old services conservatively without broadening advancement', () => {
    const next = normalizeSettings({ version: 1, enabled: false, services: {
      crunchyroll: { intro: false, credits: true, nextEpisode: true },
    } });
    expect(next.enabled).toBe(false);
    expect(next.actions).toEqual({ intro: false, recap: true, credits: false, nextEpisode: false });
    expect(next.language).toBe('en');
  });

  it('validates current action booleans and fills missing fields without coercion', () => {
    const next = normalizeSettings({ version: 2, enabled: false, actions: {
      intro: false, credits: 'true', nextEpisode: 1, selectedEpisode: true,
    } });
    expect(next.actions).toEqual({ intro: false, recap: true, credits: false, nextEpisode: false });
    expect(next.enabled).toBe(false);
  });

  it('does not accept inherited action, platform, or language choices', () => {
    const next = normalizeSettings(Object.assign(Object.create({ language: 'es' }), {
      version: 2, actions: Object.create({ credits: true, nextEpisode: true }),
      platforms: Object.create({ hbomax: false }),
    }));
    expect(next).toEqual(defaultSettings());
    expect(normalizeSettings({ version: 1, services: Object.create({ hbomax: { credits: true } }) }).actions.credits).toBe(false);
    expect(normalizeSettings({ version: 1, services: { crunchyroll: Object.create({ credits: true }), hbomax: { credits: true } } }).actions.credits).toBe(false);
  });

  it.each([null, true, [], 'bad', { version: 3 }, { version: 0 }, {}])('fails closed for invalid schema %j', value => {
    expect(normalizeSettings(value).enabled).toBe(false);
    expect(normalizeSettings(value).actions.nextEpisode).toBe(false);
    expect(needsSettingsMigration(value)).toBe(false);
  });

  it('updates shared choices immutably and retains them across global and platform toggles', () => {
    const original = defaultSettings();
    const next = updateSetting(original, 'credits', true);
    expect(next.actions.credits).toBe(true);
    expect(original.actions.credits).toBe(false);
    expect(defaultSettings().actions.credits).toBe(false);
    const off = updatePlatform(updateSetting(next, 'enabled', false), 'hbomax', false);
    expect(off.actions).toEqual(next.actions);
    expect(off.platforms).toEqual({ crunchyroll: true, hbomax: false });
    expect(updatePlatform(updateSetting(off, 'enabled', true), 'hbomax', true).actions).toEqual(next.actions);
  });

  it('preserves language independently and rejects invalid language mutations', () => {
    const previous = defaultSettings();
    const spanish = updateLanguage(previous, 'es');
    expect(spanish).toEqual({ ...previous, language: 'es' });
    expect(previous.language).toBe('en');
    expect(updateLanguage(spanish, 'en')).toEqual(previous);
    for (const language of ['fr', '', 'ES', null, true, {}]) {
      expect(normalizeSettings({ ...spanish, language }).language).toBe('en');
      expect(() => updateLanguage(spanish, language as never)).toThrow('Invalid language');
    }
  });

  it('normalizes independent platform switches without coercing malformed values', () => {
    expect(normalizeSettings({ version: 2, platforms: { crunchyroll: false, hbomax: 'false' } }).platforms)
      .toEqual({ crunchyroll: false, hbomax: true });
  });

  it('rejects unknown action keys, retired selections, and invalid switches', () => {
    expect(() => updateSetting(defaultSettings(), 'selectedEpisode' as never, true)).toThrow('Invalid setting');
    expect(() => updateSetting(defaultSettings(), '__proto__' as never, true)).toThrow('Invalid setting');
    expect(() => updateSetting(defaultSettings(), 'credits', 'true' as never)).toThrow('Invalid setting');
    expect(() => updatePlatform(defaultSettings(), 'unknown' as never, false)).toThrow('Invalid platform setting');
    expect(() => updatePlatform(defaultSettings(), 'hbomax', 'false' as never)).toThrow('Invalid platform setting');
  });
});
