import { ACTIONS, SERVICES, isServiceId, type Action, type Request, type ServiceId, type Settings, type TabStatus } from '../shared/types';

type PopupChrome = Pick<typeof chrome, 'tabs' | 'runtime' | 'storage'>;
type SettingKey = 'enabled' | Action;
type SettingsResponse = { ok: true; settings: Settings };

const descriptions: Record<Action, string> = {
  intro: 'Activa el botón «Saltar intro».',
  recap: 'Activa el botón de resumen.',
  credits: 'Avanza durante los créditos. Puede omitir escenas finales.',
  nextEpisode: 'Avanza cuando termine el vídeo.',
};
const unavailable = 'Abre un episodio compatible para configurar esta función.';
const serviceNames: Record<ServiceId, string> = { crunchyroll: 'Crunchyroll', hbomax: 'HBO Max' };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSettingsResponse(value: unknown): value is SettingsResponse {
  if (!isObject(value) || value.ok !== true || !isObject(value.settings)) return false;
  const settings = value.settings;
  if (settings.version !== 1 || typeof settings.enabled !== 'boolean' || !isObject(settings.services) || !isObject(settings.platforms)) return false;
  const services = settings.services;
  const platforms = settings.platforms;
  return SERVICES.every(service => {
    const actions = services[service];
    return typeof platforms[service] === 'boolean' && isObject(actions) && ACTIONS.every(action => typeof actions[action] === 'boolean');
  });
}

function isTabStatus(value: unknown): value is TabStatus {
  if (!isObject(value) || !isServiceId(value.service) || !isObject(value.capabilities)) return false;
  const capabilities = value.capabilities;
  return ['pageSupported', 'playerReady', 'paused', 'manualHold'].every(key => typeof value[key] === 'boolean')
    && (value.lastAction === null || ACTIONS.includes(value.lastAction as Action))
    && ACTIONS.every(action => {
      const capability = capabilities[action];
      return isObject(capability) && typeof capability.supported === 'boolean' && typeof capability.detail === 'string';
    });
}

/** The popup polls only while open. It never reads a tab URL or page content. */
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
  let disposed = false;

  const send = (message: Request): Promise<unknown> => api.runtime.sendMessage(message);
  function setError(message: string) {
    element('error').textContent = message;
    element('error-panel').hidden = !message;
  }

  function render() {
    if (disposed) return;
    switches.enabled.checked = saving?.key === 'enabled' ? saving.value : settings?.enabled ?? false;
    switches.enabled.disabled = !settings || saving !== null || platformSaving !== null;
    element('playback-settings').hidden = platformsOpen;
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
    try {
      const response: unknown = tabId === null ? null : await api.tabs.sendMessage(tabId, { type: 'GET_STATUS' } satisfies Request);
      if (!disposed) status = isTabStatus(response) ? response : null;
    } catch {
      if (!disposed) status = null;
    } finally {
      polling = false;
      statusLoaded = true;
      render();
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
  const platformsHandler = () => { platformsOpen = !platformsOpen; render(); };
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
