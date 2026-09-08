import { ACTIONS, SERVICES, CAPABILITY_REASONS, isServiceId, isUiLanguage, type UiLanguage, type Action, type Request, type ServiceId, type Settings, type TabStatus } from '../shared/types';
import { translate, type MessageKey, type MessageParams } from './i18n';
import { validEpisodeId } from '../shared/episodes';

type PopupChrome = Pick<typeof chrome, 'tabs' | 'runtime' | 'storage'>;
type SettingKey = 'enabled' | Action;
type SettingsResponse = { ok: true; settings: Settings };

const serviceNames: Record<ServiceId, string> = { crunchyroll: 'Crunchyroll', hbomax: 'HBO Max' };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSettingsResponse(value: unknown): value is SettingsResponse {
  if (!isObject(value) || value.ok !== true || !isObject(value.settings)) return false;
  const settings = value.settings;
  if (settings.version !== 1 || !isUiLanguage(settings.language) || typeof settings.enabled !== 'boolean' || !isObject(settings.services) || !isObject(settings.platforms)) return false;
  const services = settings.services;
  const platforms = settings.platforms;
  return SERVICES.every(service => {
    const actions = services[service];
    return typeof platforms[service] === 'boolean'
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
      return isObject(capability) && typeof capability.supported === 'boolean' && typeof capability.detail === 'string'
        && (capability.reason === undefined || CAPABILITY_REASONS.includes(capability.reason as never));
    });
}

function sameStatus(a: TabStatus | null, b: TabStatus | null): boolean {
  if (!a || !b) return a === b;
  return a.service === b.service && a.episodeId === b.episodeId
    && a.pageSupported === b.pageSupported && a.playerReady === b.playerReady
    && a.paused === b.paused && a.manualHold === b.manualHold && a.lastAction === b.lastAction
    && ACTIONS.every(action => a.capabilities[action].supported === b.capabilities[action].supported
      && a.capabilities[action].detail === b.capabilities[action].detail
      && a.capabilities[action].reason === b.capabilities[action].reason);
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
  const languageInput = element<HTMLSelectElement>('language');
  let languageSaving: UiLanguage | null = null;
  let renderedLanguage: UiLanguage | null = null;
  let error: { key: MessageKey; params: MessageParams } | null = null;
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

  const send = (message: Request): Promise<unknown> => api.runtime.sendMessage(message);
  const language = (): UiLanguage => languageSaving ?? settings?.language ?? 'en';
  const t = (key: MessageKey, params?: MessageParams) => translate(language(), key, params);
  function renderError() {
    if (disposed) return;
    element('error').textContent = error ? t(error.key, error.params) : '';
    element('error-panel').hidden = !error;
  }
  function setError(key: MessageKey | null, params: MessageParams = {}) {
    error = key ? { key, params } : null;
    renderError();
  }

  function render() {
    if (disposed) return;
    const locale = language();
    if (renderedLanguage !== locale) {
      doc.documentElement.lang = locale;
      for (const node of doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
        node.textContent = t(node.dataset.i18n as MessageKey);
      }
      element('tab-controls').setAttribute('aria-label', t('tabControls'));
      renderedLanguage = locale;
      renderError();
    }
    languageInput.value = locale;
    languageInput.disabled = !settings || saving !== null || platformSaving !== null || languageSaving !== null;
    switches.enabled.checked = saving?.key === 'enabled' ? saving.value : settings?.enabled ?? false;
    switches.enabled.disabled = !settings || saving !== null || platformSaving !== null || languageSaving !== null;
    element('playback-settings').hidden = platformsOpen;
    element('platforms-panel').hidden = !platformsOpen;
    platformsButton.textContent = platformsOpen ? t('back') : t('platforms');
    platformsButton.setAttribute('aria-expanded', String(platformsOpen));
    for (const platform of SERVICES) {
      platformSwitches[platform].checked = platformSaving?.service === platform ? platformSaving.enabled : settings?.platforms[platform] ?? false;
      platformSwitches[platform].disabled = !settings || saving !== null || platformSaving !== null || languageSaving !== null;
    }
    const service = status?.service;
    element('service-heading').textContent = service ? serviceNames[service] : t('thisTab');
    element('autoplay-note').textContent = t('autoplayNote', { service: service ? serviceNames[service] : t('eachPlatform') });
    for (const action of ACTIONS) {
      const capability = status?.pageSupported ? status.capabilities[action] : undefined;
      switches[action].checked = !capability?.supported || !service ? false
        : saving?.key === action && saving.service === service ? saving.value : settings?.services[service][action] ?? false;
      switches[action].disabled = !settings || saving !== null || platformSaving !== null || languageSaving !== null || !capability?.supported;
      element(`${action}-detail`).textContent = capability
        ? capability.supported
          ? action === 'intro' && service === 'hbomax' ? t('hboIntroDetail') : t(`${action}Detail`)
          : capability.reason ? t(capability.reason) : locale === 'es' ? capability.detail : t('featureUnavailable')
        : t('unavailable');
    }
    const lastAction = status?.lastAction;
    element('last-action').hidden = !lastAction;
    element('last-action').textContent = lastAction ? t('lastAction', { action: t(`${lastAction}Name`) }) : '';

    let state = 'waiting';
    let headline = t('waiting');
    let detail = t('waitingDetail');
    if (!statusLoaded) {
      state = 'loading';
      headline = t('loading');
      detail = t('loadingDetail');
    } else if (!status?.pageSupported) {
      state = 'unsupported';
      headline = t('unsupported');
      detail = t('unsupportedDetail');
    } else if (!settings) {
      headline = t('settingsUnavailable');
      detail = t('settingsUnavailableDetail');
    } else if (!settings.enabled) {
      state = 'off';
      headline = t('off');
      detail = t('offDetail');
    } else if (!settings.platforms[status.service]) {
      state = 'off';
      headline = t('platformOff');
      detail = t('platformOffDetail', { service: serviceNames[status.service] });
    } else if (status.paused || status.manualHold) {
      state = 'paused';
      headline = status.paused ? t('paused') : t('manualPaused');
      detail = t('pausedDetail');
    } else if (status.playerReady) {
      state = 'active';
      headline = t('ready');
      detail = t('readyDetail');
    }
    element('page-state').dataset.state = state;
    element('status').textContent = headline;
    element('status-detail').textContent = detail;
    element('manual-hold').hidden = !status?.manualHold;
    pauseButton.disabled = !status?.pageSupported || tabId === null || pauseSaving;
    pauseButton.textContent = pauseSaving ? t('saving')
      : status?.paused || status?.manualHold ? t('resumeTab') : t('pauseTab');
    element('tab-note').textContent = status?.paused || status?.manualHold
      ? t('resumeNote')
      : t('pauseNote');
  }

  async function loadSettings() {
    try {
      const response = await send({ type: 'GET_SETTINGS' });
      if (!isSettingsResponse(response)) throw new Error('Invalid settings response');
      if (!disposed) settings = response.settings;
      setError(null);
    } catch {
      if (!disposed) settings = null;
      setError('loadError');
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
    if (saving || platformSaving || languageSaving || !settings || (key !== 'enabled' && (!service || !status?.pageSupported || !status.capabilities[key].supported))) {
      render();
      return;
    }
    saving = key === 'enabled' ? { key, value } : { key, value, service };
    setError(null);
    render();
    try {
      const response = await send(key === 'enabled'
        ? { type: 'SET_SETTING', key, value }
        : { type: 'SET_SETTING', key, value, service });
      if (!isSettingsResponse(response)) throw new Error('Save failed');
      if (!disposed) settings = response.settings;
    } catch {
      setError('saveError');
    } finally {
      saving = null;
      render();
    }
  }

  async function savePlatform(service: ServiceId, enabled: boolean) {
    if (saving || platformSaving || languageSaving || !settings) {
      render();
      return;
    }
    platformSaving = { service, enabled };
    setError(null);
    render();
    try {
      const response = await send({ type: 'SET_PLATFORM', service, enabled });
      if (!isSettingsResponse(response)) throw new Error('Save failed');
      if (!disposed) settings = response.settings;
    } catch {
      setError('saveError');
    } finally {
      platformSaving = null;
      render();
    }
  }

  async function saveLanguage(value: unknown) {
    if (!isUiLanguage(value) || !settings || saving || platformSaving || languageSaving) {
      render();
      return;
    }
    if (value === settings.language) return;
    languageSaving = value;
    if (error?.key === 'saveError') setError(null);
    render();
    try {
      const response = await send({ type: 'SET_LANGUAGE', language: value });
      if (!isSettingsResponse(response)) throw new Error('Save failed');
      if (!disposed) settings = response.settings;
    } catch {
      setError('saveError');
    } finally {
      languageSaving = null;
      render();
    }
  }

  async function togglePause() {
    if (tabId === null || !status?.pageSupported || pauseSaving) return;
    const paused = !(status.paused || status.manualHold);
    statusRevision += 1;
    pauseSaving = true;
    setError(null);
    render();
    try {
      const response = await send({ type: 'SET_TAB_PAUSE', tabId, paused });
      if (!isObject(response) || response.ok !== true || typeof response.paused !== 'boolean') throw new Error('Pause failed');
      if (!disposed && status) status = { ...status, paused: response.paused, manualHold: response.paused ? status.manualHold : false };
    } catch {
      setError('pauseError');
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
    if (area === 'local' && !saving && !platformSaving && !languageSaving) void loadSettings();
  };
  const languageHandler = () => { void saveLanguage(languageInput.value); };
  languageInput.addEventListener('change', languageHandler);
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
    languageInput.removeEventListener('change', languageHandler);
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
