"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Manager = { id: number; display_name: string };

export default function ManagerPicker({
  managers,
  currentManagerId,
}: {
  managers: Manager[];
  currentManagerId: number | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentManager = managers.find((m) => m.id === currentManagerId);
  const pendingManager = managers.find((m) => m.id === pendingId);

  async function selectManager(id: number) {
    setError("");
    setPin("");
    setConfirmPin("");
    setPendingId(id);
    setHasPin(null);
    const res = await fetch(`/api/identity/status?managerId=${id}`);
    const data = await res.json();
    setHasPin(Boolean(data.hasPin));
  }

  async function submitPin() {
    if (pendingId == null) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter a 4-digit PIN.");
      return;
    }
    if (hasPin === false && pin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/identity/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        managerId: pendingId,
        pin,
        confirmPin: hasPin === false ? confirmPin : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setPendingId(null);
    setHasPin(null);
    setPin("");
    setConfirmPin("");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/identity/logout", { method: "POST" });
    router.refresh();
  }

  if (pendingId != null) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-accent bg-surface px-2 py-1">
        <span className="text-xs text-muted">{pendingManager?.display_name}:</span>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder={hasPin === false ? "New PIN" : "PIN"}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && hasPin !== null && submitPin()}
          className="w-16 rounded border border-border-color bg-background px-1.5 py-1 text-sm"
          autoFocus
        />
        {hasPin === false && (
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Confirm"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submitPin()}
            className="w-16 rounded border border-border-color bg-background px-1.5 py-1 text-sm"
          />
        )}
        <button
          onClick={submitPin}
          disabled={hasPin === null || loading}
          className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
        >
          Go
        </button>
        <button
          onClick={() => {
            setPendingId(null);
            setError("");
          }}
          className="text-xs text-muted hover:text-foreground"
        >
          ✕
        </button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentManagerId ?? ""}
        onChange={(e) => selectManager(Number(e.target.value))}
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
      {currentManager && (
        <button onClick={logout} className="text-xs text-muted hover:text-foreground">
          Log out
        </button>
      )}
    </div>
  );
}
