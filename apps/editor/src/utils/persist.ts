const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounce localStorage writes; immediate flush on manual persist. */
export function debouncedStorageSet(key: string, value: string, delayMs = 800): void {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      try {
        localStorage.setItem(key, value);
      } catch {
        /* quota */
      }
    }, delayMs)
  );
}

export function flushDebouncedStorage(key: string, value: string): void {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.delete(key);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}
