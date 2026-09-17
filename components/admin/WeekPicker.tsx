"use client";

import { useRouter } from "next/navigation";

export default function WeekPicker({ weeks, selected }: { weeks: number[]; selected: number }) {
  const router = useRouter();
  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/admin/weekly?week=${e.target.value}`)}
      className="rounded border border-border-color bg-surface px-3 py-1.5 text-sm font-medium"
    >
      {weeks.map((w) => (
        <option key={w} value={w}>
          Week {w}
        </option>
      ))}
    </select>
  );
}
