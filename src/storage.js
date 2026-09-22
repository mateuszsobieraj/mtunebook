// Preferences must never prevent browsing or playback when storage is unavailable.
export function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writePreference(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* Private browsing, quota limits, and blocked storage are supported. */ }
}
