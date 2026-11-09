const SETTINGS_KEY = 'taiwa.settings.v1';

const DEFAULTS = {
  provider: 'gemini', // 'gemini' | 'custom'
  gemini: { apiKey: '', model: 'gemini-3.5-flash-lite' },
  custom: { baseUrl: '', apiKey: '', model: '' },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    return {
      provider: saved.provider === 'custom' ? 'custom' : 'gemini',
      gemini: { ...DEFAULTS.gemini, ...saved.gemini },
      custom: { ...DEFAULTS.custom, ...saved.custom },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function isAiConfigured(settings) {
  return settings.provider === 'custom'
    ? Boolean(settings.custom.baseUrl && settings.custom.apiKey && settings.custom.model)
    : Boolean(settings.gemini.apiKey);
}

/** Asks the browser not to delete our data when storage is under pressure */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // not supported, ignore
  }
  return false;
}