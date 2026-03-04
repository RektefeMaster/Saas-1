import { create } from "zustand";
import type { SortingState } from "@tanstack/react-table";

interface TenantsStore {
  search: string;
  setSearch: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  sorting: SortingState;
  setSorting: (s: SortingState | ((prev: SortingState) => SortingState)) => void;
}

export const useTenantsStore = create<TenantsStore>((set) => ({
  search: "",
  setSearch: (s) => set({ search: s }),
  statusFilter: "",
  setStatusFilter: (s) => set({ statusFilter: s }),
  sorting: [],
  setSorting: (s) => set((state) => ({ sorting: typeof s === "function" ? s(state.sorting) : s })),
}));
