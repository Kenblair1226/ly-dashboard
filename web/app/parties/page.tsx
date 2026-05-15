import { apiGet } from "@/lib/api";
import Link from "next/link";

type PartyRow = {
  party: string;
  members: number;
  propose_bills: number | string;
  cosign_bills: number | string;
  meets: number | string;
  ivods: number | string;
  news: number | string;
  avg_propose: number | string;
  avg_meets: number | string;
  avg_ivods: number | string;
};

const PARTY_COLORS: Record<string, { chip: string; bar: string }> = {
  民主進步黨: { chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  中國國民黨: { chip: "bg-sky-100 text-sky-800", bar: "bg-sky-500" },
  台灣民眾黨: { chip: "bg-cyan-100 text-cyan-800", bar: "bg-cyan-500" },
  時代力量: { chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  無黨籍: { chip: "bg-slate-100 text-slate-700", bar: "bg-slate-500" },
};

function n(v: any) {
  return Number(v || 0);
}

export default async function PartiesPage() {
  let rows: PartyRow[] = [];
  let error: string | null = null;
  try {
    rows = await apiGet<PartyRow[]>("/parties/compare");
  } catch (e: any) {
    error = e.message;
  }

  const metrics = [
    { k: "avg_propose", label: "人均主提法案" },
    { k: "avg_meets", label: "人均會議出席" },
    { k: "avg_ivods", label: "人均 IVOD 影片" },
  ] as const;

  const max = (k: string) =>
    Math.max(...rows.map((r) => n((r as any)[k])), 1);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">黨團對戰比較</h1>
          <p className="text-slate-500 mt-1">第 11 屆 · 各黨表現面向比較</p>
        </div>
        <Link href="/" className="text-sm text-slate-600 hover:underline">
          ← 回總覽
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
          {error}
        </div>
      )}

      {/* 總量表 */}
      <section className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left p-3">黨團</th>
              <th className="text-right p-3">席次</th>
              <th className="text-right p-3">主提</th>
              <th className="text-right p-3">連署</th>
              <th className="text-right p-3">會議</th>
              <th className="text-right p-3">IVOD</th>
              <th className="text-right p-3">新聞</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const c = PARTY_COLORS[r.party] || PARTY_COLORS["無黨籍"];
              return (
                <tr key={r.party} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link
                      href={`/legislators?party=${encodeURIComponent(r.party)}`}
                      className={`text-xs px-2 py-1 rounded-full ${c.chip} hover:opacity-80`}
                    >
                      {r.party}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-medium">{r.members}</td>
                  <td className="p-3 text-right">{n(r.propose_bills).toLocaleString()}</td>
                  <td className="p-3 text-right">{n(r.cosign_bills).toLocaleString()}</td>
                  <td className="p-3 text-right">{n(r.meets).toLocaleString()}</td>
                  <td className="p-3 text-right">{n(r.ivods).toLocaleString()}</td>
                  <td className="p-3 text-right">{n(r.news).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 人均比較條 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const mx = max(m.k);
          return (
            <section key={m.k} className="bg-white border rounded-lg p-5">
              <h2 className="font-semibold mb-1">{m.label}</h2>
              <p className="text-xs text-slate-500 mb-3">
                公平比較席次差異
              </p>
              <div className="space-y-3">
                {rows.map((r) => {
                  const v = n((r as any)[m.k]);
                  const c = PARTY_COLORS[r.party] || PARTY_COLORS["無黨籍"];
                  return (
                    <div key={r.party}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.chip}`}>
                          {r.party}
                        </span>
                        <span className="font-medium">{v.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded">
                        <div
                          className={`h-2 rounded ${c.bar}`}
                          style={{ width: `${(v / mx) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        說明：本頁僅統計第 11 屆現任立委於現有資料庫中的活動量；
        「人均」為該數值除以黨團席次，已排除規模差異。
      </p>
    </div>
  );
}
