export interface UserSettings {
  newPerDay: number;
  reviewsPerDay: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  newPerDay: 20,
  reviewsPerDay: 200,
};

export function getUserSettings(): UserSettings {
  const saved = localStorage.getItem('aprovacard_settings');
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveUserSettings(settings: UserSettings) {
  localStorage.setItem('aprovacard_settings', JSON.stringify(settings));
}
