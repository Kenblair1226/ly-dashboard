export default function InterpellationList({ items }: { items: any[] }) {
  if (!items?.length) return <div className="text-slate-500 text-sm">尚無質詢資料</div>;
  return (
    <ul className="divide-y bg-white border rounded">
      {items.map((it) => (
        <li key={it.interp_id} className="p-3">
          <div className="text-xs text-slate-500">{it.date} · 第 {it.session_period} 會期</div>
          <div className="text-sm mt-1">{it.title || "(無標題)"}</div>
        </li>
      ))}
    </ul>
  );
}
