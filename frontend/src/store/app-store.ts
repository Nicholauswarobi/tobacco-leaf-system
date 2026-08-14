/**
 * Global app state with Zustand.
 *
 * Holds only what genuinely has to outlive a component:
 *  - the latest prediction, so the result page can render after navigation
 *  - a photo being handed from one analysis section to the other
 *
 * `isPredicting` and `error` used to live here too, and that was a bug. This
 * store is a module singleton: it is created once per page load and survives
 * every client-side navigation. A run that ended while the user was on another
 * page, or two runs overlapping, left those flags stale, and the upload panel
 * then showed a frozen progress bar with no way back. Nothing but a full page
 * reload cleared it, because only a reload re-creates the module. Both are now
 * local to the panel that owns them, so leaving the page always ends the run.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PredictionResponse } from "@/types";

interface AppState {
  latest: PredictionResponse | null;
  /**
   * A photo passed between the disease and quality sections.
   *
   * When the backend rejects a genuine leaf as belonging to the other section,
   * the user should not have to walk back out to the field and take the same
   * photo again. Never persisted: a File cannot survive JSON.
   */
  handoffFile: File | null;

  setLatest: (p: PredictionResponse | null) => void;
  setHandoffFile: (f: File | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      latest: null,
      handoffFile: null,

      setLatest: (p) => set({ latest: p }),
      setHandoffFile: (f) => set({ handoffFile: f }),
      reset: () => set({ latest: null, handoffFile: null }),
    }),
    {
      name: "tobaccoscan-app-store",
      partialize: (state) => ({ latest: state.latest }),
    }
  )
);
