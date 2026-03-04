import { create } from "zustand";

interface CrmStore {
  search: string;
  setSearch: (s: string) => void;
  selectedPhone: string;
  setSelectedPhone: (p: string) => void;
}

export const useCrmStore = create<CrmStore>((set) => ({
  search: "",
  setSearch: (s) => set({ search: s }),
  selectedPhone: "",
  setSelectedPhone: (p) => set({ selectedPhone: p }),
}));
