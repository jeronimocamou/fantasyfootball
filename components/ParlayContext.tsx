"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type ParlayLeg = {
  lineId: number;
  sideManagerId: number;
  sideLabel: string;
  oppLabel: string;
  spreadDisplay: string;
  odds: number;
};

type ParlayContextValue = {
  legs: ParlayLeg[];
  isSelected: (lineId: number, sideManagerId: number) => boolean;
  toggleLeg: (leg: ParlayLeg) => void;
  removeLeg: (lineId: number) => void;
  clear: () => void;
};

const ParlayContext = createContext<ParlayContextValue | null>(null);

export function ParlayProvider({ children }: { children: React.ReactNode }) {
  const [legs, setLegs] = useState<ParlayLeg[]>([]);

  const isSelected = useCallback(
    (lineId: number, sideManagerId: number) =>
      legs.some((l) => l.lineId === lineId && l.sideManagerId === sideManagerId),
    [legs]
  );

  const toggleLeg = useCallback((leg: ParlayLeg) => {
    setLegs((prev) => {
      const exists = prev.some((l) => l.lineId === leg.lineId && l.sideManagerId === leg.sideManagerId);
      if (exists) return prev.filter((l) => l.lineId !== leg.lineId);
      // Selecting the other side of a matchup you already picked swaps it in.
      const withoutSameLine = prev.filter((l) => l.lineId !== leg.lineId);
      return [...withoutSameLine, leg];
    });
  }, []);

  const removeLeg = useCallback((lineId: number) => {
    setLegs((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLegs([]), []);

  return (
    <ParlayContext.Provider value={{ legs, isSelected, toggleLeg, removeLeg, clear }}>
      {children}
    </ParlayContext.Provider>
  );
}

export function useParlay(): ParlayContextValue {
  const ctx = useContext(ParlayContext);
  if (!ctx) throw new Error("useParlay must be used within a ParlayProvider");
  return ctx;
}
