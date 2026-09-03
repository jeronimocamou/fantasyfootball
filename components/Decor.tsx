type Item = {
  side: "left" | "right";
  top: string;
  offset: string;
  size: number;
  rotate: number;
  opacity: number;
  kind: "ball" | "dollar";
};

// Hand-placed, not a grid — varied offsets/rotation/opacity read as
// scattered rather than a repeating pattern.
const ITEMS: Item[] = [
  { side: "left", top: "6%", offset: "22px", size: 30, rotate: -16, opacity: 0.16, kind: "dollar" },
  { side: "left", top: "19%", offset: "52px", size: 42, rotate: 14, opacity: 0.1, kind: "ball" },
  { side: "left", top: "35%", offset: "14px", size: 24, rotate: 6, opacity: 0.13, kind: "dollar" },
  { side: "left", top: "52%", offset: "48px", size: 48, rotate: -12, opacity: 0.09, kind: "ball" },
  { side: "left", top: "69%", offset: "20px", size: 34, rotate: 22, opacity: 0.14, kind: "dollar" },
  { side: "left", top: "86%", offset: "54px", size: 30, rotate: -8, opacity: 0.1, kind: "ball" },

  { side: "right", top: "10%", offset: "48px", size: 32, rotate: 16, opacity: 0.11, kind: "ball" },
  { side: "right", top: "26%", offset: "16px", size: 44, rotate: -15, opacity: 0.15, kind: "dollar" },
  { side: "right", top: "44%", offset: "50px", size: 26, rotate: 9, opacity: 0.1, kind: "ball" },
  { side: "right", top: "61%", offset: "12px", size: 38, rotate: -20, opacity: 0.16, kind: "dollar" },
  { side: "right", top: "78%", offset: "46px", size: 30, rotate: 7, opacity: 0.1, kind: "ball" },
  { side: "right", top: "93%", offset: "18px", size: 22, rotate: -6, opacity: 0.13, kind: "dollar" },
];

function Football({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={(size * 28) / 48}
      viewBox="0 0 48 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 14 Q24 -4 46 14 Q24 32 2 14 Z" />
      <line x1="24" y1="9" x2="24" y2="19" />
      <line x1="20.5" y1="11.5" x2="27.5" y2="11.5" />
      <line x1="20.5" y1="16.5" x2="27.5" y2="16.5" />
    </svg>
  );
}

function DollarSign({ size }: { size: number }) {
  return (
    <span
      className="select-none font-display font-semibold leading-none"
      style={{ fontSize: size }}
    >
      $
    </span>
  );
}

export default function Decor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* faint full-page watermarks, visible at every width */}
      <div
        className="absolute text-accent"
        style={{ top: "14%", left: "50%", transform: "translateX(-50%) rotate(-8deg)", opacity: 0.045 }}
      >
        <Football size={260} />
      </div>
      <div
        className="absolute text-accent"
        style={{ bottom: "2%", left: "50%", transform: "translateX(-50%) rotate(6deg)", opacity: 0.05 }}
      >
        <DollarSign size={220} />
      </div>

      {/* scattered marks in the side gutters — only where there's room */}
      <div className="absolute inset-0 hidden xl:block">
        {ITEMS.map((item, i) => (
          <div
            key={i}
            className="absolute text-accent"
            style={{
              top: item.top,
              [item.side]: item.offset,
              opacity: item.opacity,
              transform: `rotate(${item.rotate}deg)`,
            }}
          >
            {item.kind === "ball" ? <Football size={item.size} /> : <DollarSign size={item.size} />}
          </div>
        ))}
      </div>
    </div>
  );
}
