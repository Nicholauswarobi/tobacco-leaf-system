/**
 * Global app state with Zustand.
 *
 * Holds:
 *  - the latest prediction (so result page can render after navigation)
 *  - upload progress / loading status
 *  - simple in-memory history mirror
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PredictionResponse } from "@/types";

interface AppState {
  latest: PredictionResponse | null;
  isPredicting: boolean;
  error: string | null;

  setLatest: (p: PredictionResponse | null) => void;
  setPredicting: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      latest: null,
      isPredicting: false,
      error: null,

      setLatest: (p) => set({ latest: p, error: null }),
      setPredicting: (v) => set({ isPredicting: v }),
      setError: (msg) => set({ error: msg, isPredicting: false }),
      reset: () => set({ latest: null, isPredicting: false, error: null }),
    }),
    {
      name: "folium-app-store",
      partialize: (state) => ({ latest: state.latest }),
    }
  )
);
