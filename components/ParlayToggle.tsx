"use client";

import { useParlay, type ParlayLeg } from "./ParlayContext";

export default function ParlayToggle({ leg }: { leg: ParlayLeg }) {
  const { isSelected, toggleLeg } = useParlay();
  const selected = isSelected(leg.lineId, leg.sideManagerId);

  return (
    <button
      onClick={() => toggleLeg(leg)}
      className={`w-fit rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border-color text-muted hover:border-accent hover:text-accent"
      }`}
    >
      {selected ? "✓ In parlay" : "+ Add to parlay"}
    </button>
  );
}
