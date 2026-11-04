export function clampVolume(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

export function loadVolume(storage: Pick<Storage, 'getItem'> | undefined, key: string, fallback: number): number {
  try {
    const saved = storage?.getItem(key);
    if (saved == null || saved.trim() === '') return fallback;
    return clampVolume(Number(saved), fallback);
  } catch { return fallback; }
}

/** Retired on/off controls become a visible zero on the volume slider, once. */
export function loadVolumeOnlyPreference(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  volumeKey: string, legacyEnabledKey: string, fallback: number): number {
  let wasMuted = false;
  try { wasMuted = storage?.getItem(legacyEnabledKey) === 'false'; } catch { /* Use the volume preference. */ }
  if (!wasMuted) return loadVolume(storage, volumeKey, fallback);
  try {
    storage?.setItem(volumeKey, '0');
    storage?.setItem(legacyEnabledKey, 'true');
  } catch { /* The migrated setting still applies for this session. */ }
  return 0;
}
