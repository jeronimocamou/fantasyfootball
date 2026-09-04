import { getCurrentWeek, getManagerWeekMoney } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import SlotMachine from "@/components/SlotMachine";

const SEASON = 2026;

function FeltTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full flex-col items-center gap-6 rounded-[2.5rem] border-4 border-[#8a6a2f] px-6 py-10 shadow-inner"
      style={{
        background: "radial-gradient(ellipse at center, #1b6b45 0%, #0d3f2a 65%, #092e1e 100%)",
      }}
    >
      {children}
    </div>
  );
}

export default async function SlotsPage() {
  const managerId = await getCurrentManagerId();

  if (!managerId) {
    return (
      <FeltTable>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#f0ebdd]">Slots</h1>
        <p className="text-sm text-[#cfc2a8]">Pick your name in the top right to play.</p>
      </FeltTable>
    );
  }

  const week = await getCurrentWeek(SEASON);
  if (!week) {
    return (
      <FeltTable>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#f0ebdd]">Slots</h1>
        <p className="text-sm text-[#cfc2a8]">No week open yet — check back once the board is live.</p>
      </FeltTable>
    );
  }

  const money = await getManagerWeekMoney(managerId, SEASON, week);

  return (
    <FeltTable>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-[#f0ebdd]">
        🎰 Crackyard Slots
      </h1>
      <SlotMachine initialCredit={money.credit} />
    </FeltTable>
  );
}
