import {describe, expect, it} from 'vitest';
import {episodeIdFromLink, episodeLink, validateEpisodeList} from '../src/shared/episodes';
import {defaultSettings, normalizeSettings, updateEpisodeList, updateSetting} from '../src/shared/settings';

describe('explicit episode preferences', () => {
  it('accepts observed public watch routes and stores only their stable identity', () => {
    expect(episodeIdFromLink('crunchyroll','https://www.crunchyroll.com/es-es/watch/EPISODE01/title?queue=2#x')).toBe('EPISODE01');
    expect(episodeLink('crunchyroll','EPISODE01')).toBe('https://www.crunchyroll.com/watch/EPISODE01');
    expect(validateEpisodeList('crunchyroll',['EPISODE01','EPISODE01','EPISODE02'])).toEqual(['EPISODE01','EPISODE02']);
  });

  it.each(['javascript:alert(1)','https://www.crunchyroll.com.evil.test/watch/EPISODE01','https://user@www.crunchyroll.com/watch/EPISODE01','https://www.crunchyroll.com:444/watch/EPISODE01','https://www.crunchyroll.com/series/EPISODE01','https://www.crunchyroll.com/watch/EPISODE01/title/extra','http://www.crunchyroll.com/watch/EPISODE01'])(
    'rejects malformed or unrelated episode link %s', url => {
      expect(episodeIdFromLink('crunchyroll',url)).toBeNull();
    },
  );

  it('rejects partial, invalid, oversized or inherited stored lists and disables selection', () => {
    for (const list of [null, 'EPISODE01', ['EPISODE01',null], Array(101).fill('EPISODE01'), ['EPISODE01','<script>']]) {
      expect(validateEpisodeList('crunchyroll',list)).toBeNull();
      const settings = defaultSettings();
      settings.services.crunchyroll.selectedEpisode = true;
      const normalized = normalizeSettings({...settings,episodeLists:{crunchyroll:list}});
      expect(normalized.episodeLists.crunchyroll).toEqual([]);
      expect(normalized.services.crunchyroll.selectedEpisode).toBe(false);
    }
  });

  it('adds the new fields to previous releases without enabling advancement', () => {
    const migrated = normalizeSettings({version:1,enabled:true,services:{crunchyroll:{intro:false,credits:true,nextEpisode:false}}});
    expect(migrated.services.crunchyroll).toEqual({intro:false,recap:true,credits:true,nextEpisode:false,selectedEpisode:false});
    expect(migrated.episodeLists).toEqual({crunchyroll:[],hbomax:[]});
  });

  it('preserves independent choices and disables selection when the list is cleared', () => {
    const original = defaultSettings();
    const saved = updateEpisodeList(original,'crunchyroll',['EPISODE01']);
    expect(saved.services.crunchyroll.selectedEpisode).toBe(false);
    expect(original.episodeLists.crunchyroll).toEqual([]);
    const enabled = updateSetting(saved,'selectedEpisode',true,'crunchyroll');
    expect(normalizeSettings(enabled).services.crunchyroll.selectedEpisode).toBe(true);
    expect(updateEpisodeList(enabled,'crunchyroll',[]).services.crunchyroll.selectedEpisode).toBe(false);
    expect(() => updateEpisodeList(saved,'crunchyroll',['bad id'])).toThrow();
    expect(saved.episodeLists.hbomax).toEqual([]);
  });
});
