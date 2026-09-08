// @vitest-environment jsdom
import {beforeEach, describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createCrunchyrollAdapter, episodeIdFromUrl} from '../src/services/crunchyroll';

const fixture=readFileSync('fixtures/player-es.html','utf8');
const recapFixture=readFileSync('fixtures/player-recap-es.html','utf8');
const url='https://www.crunchyroll.com/es-es/watch/EPISODE01/title';
const visible=(e:HTMLElement)=>!e.closest('[hidden],[aria-hidden="true"]');
const adapter=()=>createCrunchyrollAdapter(document,()=>url,visible);
beforeEach(()=>{document.documentElement.lang='es';document.body.innerHTML=fixture;});
describe('observed Crunchyroll DOM',()=>{
  it('recognizes the exact observed intro button',()=>{
    const result=adapter().inspect();
    expect(result.candidates.intro?.getAttribute('aria-label')).toBe('Saltar intro');
    expect(result.candidates.credits).toBeUndefined();
    expect(result.candidates.nextEpisode).toBeUndefined();
  });
  it('does not act on the persistent hidden skip button',()=>{
    document.querySelector('button')!.setAttribute('aria-hidden','true');
    expect(adapter().inspect().candidates).toEqual({});
  });
  it('requires text and accessible name to agree',()=>{
    document.querySelector('button')!.setAttribute('aria-label','Saltar créditos');
    expect(adapter().inspect().candidates).toEqual({});
  });
  it('uses an explicit credits prompt as signal and normal next button as action',()=>{
    const skip=document.querySelector('button')!;
    skip.setAttribute('aria-label','Saltar créditos');
    skip.querySelector('span')!.textContent='Saltar créditos';
    expect(adapter().inspect().candidates.credits).toBe(document.querySelector('[data-testid="next-episode-button"]'));
    expect(adapter().inspect().candidates.intro).toBeUndefined();
  });
  it('ignores credits text when its actual prompt is hidden',()=>{
    const skip=document.querySelector('button')!;
    skip.setAttribute('aria-label','Saltar créditos');
    skip.querySelector('span')!.textContent='Saltar créditos';
    skip.setAttribute('aria-hidden','true');
    expect(adapter().inspect().candidates.credits).toBeUndefined();
  });
  it('requires actual ended state for episode advancement',()=>{
    const video=document.querySelector('video')!;
    Object.defineProperty(video,'currentTime',{value:999999});
    expect(adapter().inspect().candidates.nextEpisode).toBeUndefined();
    Object.defineProperty(video,'ended',{value:true});
    expect(adapter().inspect().candidates.nextEpisode).toBe(document.querySelector('[data-testid="next-episode-button"]'));
  });
  it('fails closed with multiple players, videos or icons',()=>{
    document.body.insertAdjacentHTML('beforeend',fixture);
    expect(adapter().inspect().player).toBeNull();
    document.body.innerHTML=fixture;
    document.querySelector('video')!.insertAdjacentHTML('afterend','<video></video>');
    expect(adapter().inspect().player).toBeNull();
    document.body.innerHTML=fixture;
    document.querySelector('svg')!.insertAdjacentHTML('afterend','<svg data-testid="skip-intro-icon"></svg>');
    expect(adapter().inspect().candidates.intro).toBeUndefined();
  });
  it('does not use next or skip controls outside the player',()=>{
    document.body.append(document.querySelector('[data-testid="next-episode-button"]')!);
    Object.defineProperty(document.querySelector('video'),'ended',{value:true});
    expect(adapter().inspect().candidates.nextEpisode).toBeUndefined();
  });
  it('supports recap detection without treating an intro as a recap',()=>{
    expect(adapter().inspect().capabilities.recap.supported).toBe(true);
    expect(adapter().inspect().candidates.recap).toBeUndefined();
  });
  it('clearly marks unverified language labels unsupported',()=>{
    document.documentElement.lang='en';
    expect(adapter().inspect().capabilities.intro.supported).toBe(false);
    expect(adapter().inspect().capabilities.recap.supported).toBe(false);
    expect(adapter().inspect().capabilities.credits.supported).toBe(false);
    expect(adapter().inspect().candidates.intro).toBeUndefined();
  });
  it('leaves an open player menu undisturbed',()=>{
    document.querySelector('[data-testid="player-controls-root"]')!.insertAdjacentHTML('beforeend','<div role="menu">Ajustes</div>');
    expect(adapter().inspect().candidates).toEqual({});
  });
  it('rejects guessed labels, disabled buttons, or another player variant',()=>{
    const button=document.querySelector('button')!;
    button.setAttribute('aria-label','Skip Intro');
    button.querySelector('span')!.textContent='Skip Intro';
    expect(adapter().inspect().candidates.intro).toBeUndefined();
    document.body.innerHTML=fixture;
    document.querySelector('button')!.disabled=true;
    expect(adapter().inspect().candidates.intro).toBeUndefined();
    document.querySelector('[data-testid="player-controls-root"]')!.removeAttribute('data-testid');
    expect(adapter().inspect().player).toBeNull();
  });
});

describe('observed Crunchyroll recap control',()=>{
  beforeEach(()=>{document.body.innerHTML=recapFixture;});
  it('recognizes the native recap independently from intro and advancement',()=>{
    expect(adapter().inspect().candidates).toEqual({recap:document.querySelector('button')});
  });
  it.each(['aria-label','text'])('rejects a mismatched recap %s',field=>{
    const button=document.querySelector('button')!;
    if(field==='aria-label') button.setAttribute('aria-label','Saltar intro');
    else button.querySelector('span')!.textContent='Saltar intro';
    expect(adapter().inspect().candidates).toEqual({});
  });
  it.each(['hidden','disabled','hidden ancestor','ambiguous icon','outside controls','menu','unverified label','unverified locale'])('rejects an unsafe recap: %s',state=>{
    const button=document.querySelector('button')!;
    const controls=document.querySelector('[data-testid="player-controls-root"]')!;
    if(state==='hidden') button.setAttribute('aria-hidden','true');
    if(state==='disabled') button.disabled=true;
    if(state==='hidden ancestor') controls.setAttribute('aria-hidden','true');
    if(state==='ambiguous icon') button.append(document.querySelector('svg')!.cloneNode(true));
    if(state==='outside controls') document.body.append(button);
    if(state==='menu') controls.insertAdjacentHTML('beforeend','<div role="menu">Ajustes</div>');
    if(state==='unverified label') {
      button.setAttribute('aria-label','Skip Recap');
      button.querySelector('span')!.textContent='Skip Recap';
    }
    if(state==='unverified locale') document.documentElement.lang='en';
    expect(adapter().inspect().candidates).toEqual({});
  });
});
describe('episode identity',()=>{
  it('extracts stable ID, ignoring slug/query/hash changes',()=>{
    expect(episodeIdFromUrl(url)).toBe('EPISODE01');
    expect(episodeIdFromUrl(url+'?queue=1#x')).toBe('EPISODE01');
    expect(episodeIdFromUrl('https://www.crunchyroll.com/watch/EPISODE02/another')).toBe('EPISODE02');
  });
  it.each(['https://evil.test/watch/EPISODE01','https://www.crunchyroll.com.evil.test/watch/EPISODE01',
    'http://www.crunchyroll.com/watch/EPISODE01','https://www.crunchyroll.com/es-es/series/EPISODE01/title',
    'https://www.crunchyroll.com/es-es/watch/','invalid'])('rejects unsupported URLs: %s',value=>{
    expect(episodeIdFromUrl(value)).toBeNull();
  });
});
