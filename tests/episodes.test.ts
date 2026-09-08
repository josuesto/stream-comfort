import {describe, expect, it} from 'vitest';
import {episodeIdFromLink} from '../src/shared/episodes';

describe('playback episode identity', () => {
  it('accepts observed public watch routes and extracts their stable identity', () => {
    expect(episodeIdFromLink('crunchyroll','https://www.crunchyroll.com/es-es/watch/EPISODE01/title?queue=2#x')).toBe('EPISODE01');
  });

  it.each(['javascript:alert(1)','https://www.crunchyroll.com.evil.test/watch/EPISODE01','https://user@www.crunchyroll.com/watch/EPISODE01','https://www.crunchyroll.com:444/watch/EPISODE01','https://www.crunchyroll.com/series/EPISODE01','https://www.crunchyroll.com/watch/EPISODE01/title/extra','http://www.crunchyroll.com/watch/EPISODE01'])(
    'rejects malformed or unrelated episode link %s', url => {
      expect(episodeIdFromLink('crunchyroll',url)).toBeNull();
    },
  );

});
