import { getCurrentWeek, getManagerWeekMoney } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import SlotMachine from "@/components/SlotMachine";

const SEASON = 2026;

export default async function SlotsPage() {
  const managerId = await getCurrentManagerId();

  if (!managerId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Slots</h1>
        <p className="text-sm text-muted">Pick your name in the top right to play.</p>
      </div>
    );
  }

  const week = await getCurrentWeek(SEASON);
  if (!week) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Slots</h1>
        <p className="text-sm text-muted">No week open yet — check back once the board is live.</p>
      </div>
    );
  }

  const money = await getManagerWeekMoney(managerId, SEASON, week);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">🎰 Crackyard Slots</h1>
        <p className="mt-1 text-sm text-muted">
          Same weekly credit as the board. Win big or lose it to the house.
        </p>
      </div>
      <SlotMachine initialCredit={money.credit} />
    </div>
  );
}
