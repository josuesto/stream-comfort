import type { ServiceId } from './types';

export const MAX_SELECTED_EPISODES = 100;

export function validEpisodeId(service: ServiceId, value: unknown): value is string {
  return typeof value === 'string' && (service === 'crunchyroll'
    ? /^[A-Z0-9]{1,64}$/.test(value)
    : /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value));
}

/** Public watch routes observed in the players. Never inspect catalog ordering. */
export function episodeIdFromLink(service: ServiceId, value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    const id = service === 'crunchyroll'
      ? url.origin === 'https://www.crunchyroll.com'
        ? url.pathname.match(/^\/(?:[a-z]{2}-[a-z]{2}\/)?watch\/([A-Z0-9]{1,64})(?:\/[^/]*)?$/)?.[1] : null
      : url.origin === 'https://play.hbomax.com'
        ? url.pathname.match(/^\/video\/watch\/([a-f0-9-]+)\/?$/i)?.[1]?.toLowerCase() : null;
    return validEpisodeId(service, id) ? id : null;
  } catch { return null; }
}

export function episodeLink(service: ServiceId, id: string): string {
  if (!validEpisodeId(service, id)) throw new TypeError('Invalid episode ID');
  return service === 'crunchyroll' ? `https://www.crunchyroll.com/watch/${id}`
    : `https://play.hbomax.com/video/watch/${id}`;
}

/** Reject the entire malformed list; never silently save a partial selection. */
export function validateEpisodeList(service: ServiceId, value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_SELECTED_EPISODES || !value.every(id => validEpisodeId(service, id))) return null;
  return [...new Set(value)];
}
