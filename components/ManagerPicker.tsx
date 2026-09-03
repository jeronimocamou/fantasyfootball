"use client";

import { useRouter } from "next/navigation";
import { IDENTITY_COOKIE } from "@/lib/identityCookie";

type Manager = { id: number; display_name: string };

export default function ManagerPicker({
  managers,
  currentManagerId,
}: {
  managers: Manager[];
  currentManagerId: number | null;
}) {
  const router = useRouter();

  return (
    <select
      value={currentManagerId ?? ""}
      onChange={(e) => {
        const value = e.target.value;
        document.cookie = `${IDENTITY_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
        router.refresh();
      }}
      className="rounded-md border border-border-color bg-surface px-2 py-1.5 text-sm"
    >
      <option value="" disabled>
        Betting as...
      </option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.display_name}
        </option>
      ))}
    </select>
  );
}
