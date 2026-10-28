// Progress and settings, saved on the phone only.

const KEY = 'cube-away-save-v1';

const defaults = () => ({ unlocked: 1, stars: {}, sound: true, vibrate: true, seenHelp: false });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    return defaults();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the game still works, it just won't remember.
  }
}

export function reset() {
  const fresh = defaults();
  save(fresh);
  return fresh;
}
