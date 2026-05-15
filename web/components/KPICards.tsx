export default function KPICards({ summary }: { summary: Record<string, any> }) {
  const items = [
    { k: "meets", label: "出席會議" },
    { k: "propose_bills", label: "主提案" },
    { k: "cosign_bills", label: "連署" },
    { k: "interpellations", label: "質詢" },
    { k: "ivods", label: "IVOD 影片" },
    { k: "news", label: "新聞" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => (
        <div key={it.k} className="bg-white border rounded-lg p-4">
          <div className="text-xs text-slate-500">{it.label}</div>
          <div className="text-2xl font-bold mt-1">{summary[it.k] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}
