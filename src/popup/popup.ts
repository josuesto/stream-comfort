import { ACTIONS, SERVICES, isServiceId, type Action, type Request, type ServiceId, type Settings, type TabStatus } from '../shared/types';
import { episodeIdFromLink, episodeLink, validEpisodeId, validateEpisodeList } from '../shared/episodes';

type PopupChrome = Pick<typeof chrome, 'tabs' | 'runtime' | 'storage'>;
type SettingKey = 'enabled' | Action;
type SettingsResponse = { ok: true; settings: Settings };

const descriptions: Record<Action, string> = {
  intro: 'Activa el botón «Saltar intro».',
  recap: 'Activa el botón de resumen.',
  credits: 'Avanza durante los créditos. Puede omitir escenas finales.',
  nextEpisode: 'Avanza cuando termine el vídeo.',
  selectedEpisode: 'Omite solo los episodios de tu lista.',
};
const unavailable = 'Abre un episodio compatible para configurar esta función.';
const serviceNames: Record<ServiceId, string> = { crunchyroll: 'Crunchyroll', hbomax: 'HBO Max' };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSettingsResponse(value: unknown): value is SettingsResponse {
  if (!isObject(value) || value.ok !== true || !isObject(value.settings)) return false;
  const settings = value.settings;
  if (settings.version !== 1 || typeof settings.enabled !== 'boolean' || !isObject(settings.services) || !isObject(settings.platforms) || !isObject(settings.episodeLists)) return false;
  const services = settings.services;
  const platforms = settings.platforms;
  const lists = settings.episodeLists;
  return SERVICES.every(service => {
    const actions = services[service];
    return typeof platforms[service] === 'boolean' && validateEpisodeList(service, lists[service]) !== null
      && isObject(actions) && ACTIONS.every(action => typeof actions[action] === 'boolean');
  });
}

function isTabStatus(value: unknown): value is TabStatus {
  if (!isObject(value) || !isServiceId(value.service) || !isObject(value.capabilities)) return false;
  const capabilities = value.capabilities;
  return ['pageSupported', 'playerReady', 'paused', 'manualHold'].every(key => typeof value[key] === 'boolean')
    && (value.episodeId === null || validEpisodeId(value.service, value.episodeId))
    && (value.lastAction === null || ACTIONS.includes(value.lastAction as Action))
    && ACTIONS.every(action => {
      const capability = capabilities[action];
      return isObject(capability) && typeof capability.supported === 'boolean' && typeof capability.detail === 'string';
    });
}

function sameStatus(a: TabStatus | null, b: TabStatus | null): boolean {
  if (!a || !b) return a === b;
  return a.service === b.service && a.episodeId === b.episodeId
    && a.pageSupported === b.pageSupported && a.playerReady === b.playerReady
    && a.paused === b.paused && a.manualHold === b.manualHold && a.lastAction === b.lastAction
    && ACTIONS.every(action => a.capabilities[action].supported === b.capabilities[action].supported
      && a.capabilities[action].detail === b.capabilities[action].detail);
}

/** Poll only while open. Request the adapter's current ID; never scan browsing history. */
export async function mountPopup(doc: Document, api: PopupChrome) {
  function element<T extends HTMLElement>(id: string): T {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`Missing popup element: ${id}`);
    return found as T;
  }
  const switches = Object.fromEntries(['enabled', ...ACTIONS].map(key => [key, element<HTMLInputElement>(key)])) as Record<SettingKey, HTMLInputElement>;
  const platformSwitches = Object.fromEntries(SERVICES.map(service => [service, element<HTMLInputElement>(`platform-${service}`)])) as Record<ServiceId, HTMLInputElement>;
  const pauseButton = element<HTMLButtonElement>('tab-pause');
  const platformsButton = element<HTMLButtonElement>('platforms-button');
  let settings: Settings | null = null;
  let status: TabStatus | null = null;
  let tabId: number | null = null;
  let statusLoaded = false;
  let saving: { key: SettingKey; value: boolean; service?: ServiceId } | null = null;
  let platformSaving: { service: ServiceId; enabled: boolean } | null = null;
  let platformsOpen = false;
  let pauseSaving = false;
  let polling = false;
  let statusRevision = 0;
  let disposed = false;
  let editorService: ServiceId | null = null;
  let editorEpisode: string | null = null;
  let listSaving = false;
  const linksInput = element<HTMLTextAreaElement>('episode-links');

  const send = (message: Request): Promise<unknown> => api.runtime.sendMessage(message);
  function setError(message: string) {
    element('error').textContent = message;
    element('error-panel').hidden = !message;
  }

  function render() {
    if (disposed) return;
    switches.enabled.checked = saving?.key === 'enabled' ? saving.value : settings?.enabled ?? false;
    switches.enabled.disabled = !settings || saving !== null || platformSaving !== null;
    element('playback-settings').hidden = platformsOpen || editorService !== null;
    element('episodes-panel').hidden = editorService === null;
    platformsButton.disabled = listSaving;
    linksInput.disabled = listSaving;
    element<HTMLButtonElement>('save-episodes').disabled = listSaving;
    element<HTMLButtonElement>('cancel-episodes').disabled = listSaving;
    element<HTMLButtonElement>('add-current-episode').disabled = listSaving || !editorEpisode || status?.episodeId !== editorEpisode || status.service !== editorService;
    element('platforms-panel').hidden = !platformsOpen;
    platformsButton.textContent = platformsOpen ? 'Volver' : 'Plataformas';
    platformsButton.setAttribute('aria-expanded', String(platformsOpen));
    for (const platform of SERVICES) {
      platformSwitches[platform].checked = platformSaving?.service === platform ? platformSaving.enabled : settings?.platforms[platform] ?? false;
      platformSwitches[platform].disabled = !settings || saving !== null || platformSaving !== null;
    }
    const service = status?.service;
    element('service-heading').textContent = service ? serviceNames[service] : 'Esta pestaña';
    element('autoplay-note').textContent = `El avance propio de ${service ? serviceNames[service] : 'cada plataforma'} se controla en su reproductor.`;
    for (const action of ACTIONS) {
      const capability = status?.pageSupported ? status.capabilities[action] : undefined;
      switches[action].checked = !capability?.supported || !service ? false
        : saving?.key === action && saving.service === service ? saving.value : settings?.services[service][action] ?? false;
      switches[action].disabled = !settings || saving !== null || platformSaving !== null || !capability?.supported;
      element(`${action}-detail`).textContent = capability
        ? capability.supported
          ? action === 'intro' && service === 'hbomax' ? 'Activa el botón «Omitir intro».' : descriptions[action]
          : capability.detail
        : unavailable;
    }
    const selectedSupported = Boolean(status?.pageSupported && status.capabilities.selectedEpisode.supported);
    const count = service && settings ? settings.episodeLists[service].length : 0;
    element<HTMLButtonElement>('edit-episodes').disabled = !settings || !selectedSupported || saving !== null || platformSaving !== null;
    element('edit-episodes').hidden = !selectedSupported;
    element('edit-episodes').textContent = count ? `Editar lista (${count})` : 'Elegir episodios';
    if (selectedSupported) {
      element('selectedEpisode-detail').textContent = count ? `${count} episodios elegidos. Usa el botón siguiente visible.` : 'Elige episodios para activar esta opción.';
      if (!count) switches.selectedEpisode.disabled = true;
    }
    const lastAction = status?.lastAction;
    const actionNames: Record<Action, string> = {intro:'intro', recap:'resumen', credits:'créditos', nextEpisode:'siguiente episodio', selectedEpisode:'episodio elegido'};
    element('last-action').hidden = !lastAction;
    element('last-action').textContent = lastAction ? `Última acción: ${actionNames[lastAction]}.` : '';

    let state = 'waiting';
    let headline = 'Esperando al reproductor';
    let detail = 'La automatización empezará cuando esté listo el reproductor.';
    if (!statusLoaded) {
      state = 'loading';
      headline = 'Comprobando esta pestaña…';
      detail = 'Los saltos usan los controles del reproductor.';
    } else if (!status?.pageSupported) {
      state = 'unsupported';
      headline = 'Esta página no es compatible';
      detail = 'Abre un episodio de Crunchyroll o HBO Max. Si acabas de instalar o actualizar la extensión, recarga su página.';
    } else if (!settings) {
      headline = 'No se pudieron cargar los ajustes';
      detail = 'Usa «Volver a intentar» para recuperar tus preferencias.';
    } else if (!settings.enabled) {
      state = 'off';
      headline = 'Extensión desactivada';
      detail = 'Tus opciones siguen guardadas. Actívala cuando quieras.';
    } else if (!settings.platforms[status.service]) {
      state = 'off';
      headline = 'Plataforma desactivada';
      detail = `Activa ${serviceNames[status.service]} en «Plataformas» para automatizar sus controles. Tus opciones siguen guardadas.`;
    } else if (status.paused || status.manualHold) {
      state = 'paused';
      headline = status.paused ? 'En pausa en esta pestaña' : 'En pausa por control manual';
      detail = 'No se realizarán saltos hasta que reanudes la automatización.';
    } else if (status.playerReady) {
      state = 'active';
      headline = 'Lista en esta pestaña';
      detail = 'Solo se activan las opciones que elijas cuando aparezca un control compatible.';
    }
    element('page-state').dataset.state = state;
    element('status').textContent = headline;
    element('status-detail').textContent = detail;
    element('manual-hold').hidden = !status?.manualHold;
    pauseButton.disabled = !status?.pageSupported || tabId === null || pauseSaving;
    pauseButton.textContent = pauseSaving ? 'Guardando…'
      : status?.paused || status?.manualHold ? 'Reanudar en esta pestaña' : 'Pausar en esta pestaña';
    element('tab-note').textContent = status?.paused || status?.manualHold
      ? 'Reanudar no cambia tus preferencias ni activa la extensión si está apagada.'
      : 'La pausa dura hasta que la reanudes o cierres la pestaña.';
  }

  async function loadSettings() {
    try {
      const response = await send({ type: 'GET_SETTINGS' });
      if (!isSettingsResponse(response)) throw new Error('Invalid settings response');
      if (!disposed) settings = response.settings;
      setError('');
    } catch {
      if (!disposed) settings = null;
      setError('No se pudieron cargar tus preferencias. Vuelve a intentarlo.');
    }
    render();
  }

  async function refreshStatus() {
    if (disposed || polling || pauseSaving) return;
    polling = true;
    const revision = statusRevision;
    let next: TabStatus | null = null;
    try {
      const response: unknown = tabId === null ? null : await api.tabs.sendMessage(tabId, { type: 'GET_STATUS' } satisfies Request);
      next = isTabStatus(response) ? response : null;
    } catch { /* A missing receiver is an unsupported page. */ }
    finally {
      polling = false;
      if (!disposed && revision === statusRevision) {
        const changed = !statusLoaded || !sameStatus(status, next);
        status = next;
        statusLoaded = true;
        // Chrome sizes its native popup from the document. Rewriting identical
        // text/attributes every second creates needless layout/resize work and
        // can make an open popup jump. Leave its DOM completely still when idle.
        if (changed) render();
      }
    }
  }

  async function saveSetting(key: SettingKey, value: boolean) {
    const service = status?.service;
    if (saving || platformSaving || !settings || (key !== 'enabled' && (!service || !status?.pageSupported || !status.capabilities[key].supported))) {
      render();
      return;
    }
    saving = key === 'enabled' ? { key, value } : { key, value, service };
    setError('');
    render();
    try {
      const response = await send(key === 'enabled'
        ? { type: 'SET_SETTING', key, value }
        : { type: 'SET_SETTING', key, value, service });
      if (!isSettingsResponse(response)) throw new Error('Save failed');
      if (!disposed) settings = response.settings;
    } catch {
      setError('No se pudo guardar el cambio. Se conserva tu preferencia anterior.');
    } finally {
      saving = null;
      render();
    }
  }

  async function savePlatform(service: ServiceId, enabled: boolean) {
    if (saving || platformSaving || !settings) {
      render();
      return;
    }
    platformSaving = { service, enabled };
    setError('');
    render();
    try {
      const response = await send({ type: 'SET_PLATFORM', service, enabled });
      if (!isSettingsResponse(response)) throw new Error('Save failed');
      if (!disposed) settings = response.settings;
    } catch {
      setError('No se pudo guardar el cambio. Se conserva tu preferencia anterior.');
    } finally {
      platformSaving = null;
      render();
    }
  }

  async function togglePause() {
    if (tabId === null || !status?.pageSupported || pauseSaving) return;
    const paused = !(status.paused || status.manualHold);
    statusRevision += 1;
    pauseSaving = true;
    setError('');
    render();
    try {
      const response = await send({ type: 'SET_TAB_PAUSE', tabId, paused });
      if (!isObject(response) || response.ok !== true || typeof response.paused !== 'boolean') throw new Error('Pause failed');
      if (!disposed && status) status = { ...status, paused: response.paused, manualHold: response.paused ? status.manualHold : false };
    } catch {
      setError('No se pudo cambiar la pausa de esta pestaña. Vuelve a intentarlo.');
    } finally {
      pauseSaving = false;
      render();
      await refreshStatus();
    }
  }

  function openEpisodes() {
    if (!settings || !status?.pageSupported || !status.capabilities.selectedEpisode.supported || saving || platformSaving) return;
    editorService = status.service;
    editorEpisode = status.episodeId;
    linksInput.value = settings.episodeLists[editorService].map(id => episodeLink(editorService!, id)).join('\n');
    element('episodes-heading').textContent = `Episodios de ${serviceNames[editorService]}`;
    setError('');
    render();
    linksInput.focus();
  }

  async function saveEpisodes() {
    if (!editorService || listSaving || !settings) return;
    const service = editorService;
    const links = linksInput.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const ids = links.map(link => episodeIdFromLink(service, link));
    const episodeIds = validateEpisodeList(service, ids);
    if (!episodeIds) {
      setError(`Usa hasta 100 enlaces válidos de episodios de ${serviceNames[service]}, uno por línea. No se ha guardado ningún cambio.`);
      return;
    }
    listSaving = true;
    setError('');
    render();
    try {
      const response = await send({type:'SET_EPISODE_LIST', service, episodeIds});
      if (!isSettingsResponse(response)) throw new Error('Save failed');
      if (!disposed) { settings = response.settings; editorService = null; }
    } catch { setError('No se pudo guardar la lista. Tus cambios siguen aquí para volver a intentarlo.'); }
    finally { listSaving = false; render(); }
  }

  const editHandler = () => openEpisodes();
  const saveListHandler = () => { void saveEpisodes(); };
  const cancelListHandler = () => { if (!listSaving) { editorService = null; setError(''); render(); } };
  const addCurrentHandler = () => {
    if (!editorService || !editorEpisode || listSaving || status?.episodeId !== editorEpisode || status.service !== editorService) return;
    const link = episodeLink(editorService, editorEpisode);
    const lines = linksInput.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.some(line => episodeIdFromLink(editorService!, line) === editorEpisode)) lines.push(link);
    linksInput.value = lines.join('\n');
  };
  const editorHandlers = [['edit-episodes',editHandler], ['save-episodes',saveListHandler], ['cancel-episodes',cancelListHandler], ['add-current-episode',addCurrentHandler]] as const;
  for (const [id, handler] of editorHandlers) element(id).addEventListener('click',handler);

  const handlers = new Map<HTMLInputElement, () => void>();
  for (const key of ['enabled', ...ACTIONS] as const) {
    const input = switches[key];
    const handler = () => { void saveSetting(key, input.checked); };
    handlers.set(input, handler);
    input.addEventListener('change', handler);
  }
  for (const service of SERVICES) {
    const input = platformSwitches[service];
    const handler = () => { void savePlatform(service, input.checked); };
    handlers.set(input, handler);
    input.addEventListener('change', handler);
  }
  const platformsHandler = () => { if (listSaving) return; editorService = null; platformsOpen = !platformsOpen; render(); };
  const pauseHandler = () => { void togglePause(); };
  const retryHandler = () => { void loadSettings(); void refreshStatus(); };
  const storageHandler = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && !saving && !platformSaving) void loadSettings();
  };
  platformsButton.addEventListener('click', platformsHandler);
  pauseButton.addEventListener('click', pauseHandler);
  element('retry').addEventListener('click', retryHandler);
  api.storage.onChanged.addListener(storageHandler);
  render();
  await Promise.all([
    loadSettings(),
    (async () => {
      try {
        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id ?? null;
      } catch { tabId = null; }
      await refreshStatus();
    })(),
  ]);
  const interval = setInterval(() => { void refreshStatus(); }, 1000);
  function dispose() {
    disposed = true;
    clearInterval(interval);
    for (const [input, handler] of handlers) input.removeEventListener('change', handler);
    for (const [id, handler] of editorHandlers) element(id).removeEventListener('click', handler);
    platformsButton.removeEventListener('click', platformsHandler);
    pauseButton.removeEventListener('click', pauseHandler);
    element('retry').removeEventListener('click', retryHandler);
    api.storage.onChanged.removeListener(storageHandler);
    doc.defaultView?.removeEventListener('pagehide', dispose);
  }
  doc.defaultView?.addEventListener('pagehide', dispose);
  return { refreshStatus, dispose };
}

if (typeof chrome !== 'undefined' && typeof document !== 'undefined' && document.getElementById('stream-comfort')) {
  void mountPopup(document, chrome);
}
