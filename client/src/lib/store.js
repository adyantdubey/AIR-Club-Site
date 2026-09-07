import { useSyncExternalStore } from 'react';

/**
 * Tiny store: React-reactive values + a non-reactive `frame` bag for per-frame data.
 *
 *   const store = createStore({ speed: 1 });
 *   store.set({ speed: 2 })          // re-renders subscribers
 *   store.get().speed
 *   store.frame.angle = 0.3          // read/write freely inside useFrame, no re-render
 *   const speed = useStore(store, s => s.speed);
 */
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  const store = {
    initial: { ...initial },
    frame: {},
    get: () => state,
    set: (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    reset: () => {
      state = { ...store.initial };
      store.frame = {};
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return store;
}

export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}
