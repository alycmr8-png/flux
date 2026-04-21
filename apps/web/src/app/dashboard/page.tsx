import { auth } from "@clerk/nextjs/server";

export default async function DashboardHome() {
  const { userId } = await auth();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif italic text-3xl mb-1">Dashboard</h1>
        <p className="text-[#555] text-sm">Your study activity at a glance</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Lectures recorded", value: "—" },
          { label: "Avg quiz score", value: "—" },
          { label: "Day streak", value: "—" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
            <div className="font-serif text-4xl text-white mb-1">{s.value}</div>
            <div className="text-[#555] text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
          <div className="text-xs text-[#444] uppercase tracking-widest mb-4">Recent lectures</div>
          <p className="text-[#444] text-sm">No lectures yet. Record your first one →</p>
        </div>
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
          <div className="text-xs text-[#444] uppercase tracking-widest mb-4">Upcoming reviews</div>
          <p className="text-[#444] text-sm">Connect Google Calendar to see your schedule.</p>
        </div>
      </div>
    </div>
  );
}
