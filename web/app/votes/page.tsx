import { apiGet } from "@/lib/api";
import Link from "next/link";

type Vote = {
  id: number;
  vote_date: string | null;
  vote_time: string | null;
  vote_type: string | null;
  vote_issue: string | null;
  meeting_name: string | null;
  presence: number | null;
  agree: number | null;
  against: number | null;
  abstain: number | null;
};

type ByParty = { party: string; choice: string; count: number | string };

const PARTY_COLORS: Record<string, string> = {
  民主進步黨: "bg-emerald-500",
  中國國民黨: "bg-sky-500",
  台灣民眾黨: "bg-cyan-500",
  無黨籍: "bg-slate-500",
  未知: "bg-slate-300",
};

const CHOICE_LABEL: Record<string, string> = {
  agree: "贊成",
  against: "反對",
  abstain: "棄權",
};
const CHOICE_COLOR: Record<string, string> = {
  agree: "text-emerald-700 bg-emerald-50",
  against: "text-rose-700 bg-rose-50",
  abstain: "text-amber-700 bg-amber-50",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return s.slice(0, 10);
}

export default async function VotesPage() {
  let recent: Vote[] = [];
  let byParty: ByParty[] = [];
  let error: string | null = null;
  try {
    [recent, byParty] = await Promise.all([
      apiGet<Vote[]>("/votes/recent?limit=40"),
      apiGet<ByParty[]>("/votes/by_party?limit=30"),
    ]);
  } catch (e: any) {
    error = e.message;
  }

  // Pivot byParty into matrix party -> {agree, against, abstain}
  const partyMatrix: Record<string, Record<string, number>> = {};
  for (const r of byParty) {
    const p = r.party || "未知";
    partyMatrix[p] = partyMatrix[p] || { agree: 0, against: 0, abstain: 0 };
    partyMatrix[p][r.choice] = Number(r.count);
  }
  const parties = Object.keys(partyMatrix).sort((a, b) => {
    const sum = (k: string) =>
      (partyMatrix[k].agree || 0) +
      (partyMatrix[k].against || 0) +
      (partyMatrix[k].abstain || 0);
    return sum(b) - sum(a);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">院會表決紀錄</h1>
          <p className="text-slate-500 mt-1">第 11 屆 · 來源：立法院開放資料 (id=370)</p>
        </div>
        <Link href="/" className="text-sm text-slate-600 hover:underline">← 回總覽</Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">{error}</div>
      )}

      {/* 近 30 場各黨投票傾向 */}
      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-1">近 30 場表決 · 各黨投票傾向</h2>
        <p className="text-xs text-slate-500 mb-4">每列為一黨，條長為比例</p>
        <div className="space-y-3">
          {parties.map((p) => {
            const row = partyMatrix[p];
            const total = (row.agree || 0) + (row.against || 0) + (row.abstain || 0);
            const pct = (n: number) => (total ? (n / total) * 100 : 0);
            return (
              <div key={p}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{p}</span>
                  <span className="text-xs text-slate-500">
                    贊成 {row.agree || 0} · 反對 {row.against || 0} · 棄權 {row.abstain || 0}
                  </span>
                </div>
                <div className="h-3 flex rounded overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${pct(row.agree || 0)}%` }} />
                  <div className="bg-rose-500" style={{ width: `${pct(row.against || 0)}%` }} />
                  <div className="bg-amber-400" style={{ width: `${pct(row.abstain || 0)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-slate-500 mt-4">
          <span><span className="inline-block w-3 h-3 bg-emerald-500 rounded-sm align-middle mr-1"/>贊成</span>
          <span><span className="inline-block w-3 h-3 bg-rose-500 rounded-sm align-middle mr-1"/>反對</span>
          <span><span className="inline-block w-3 h-3 bg-amber-400 rounded-sm align-middle mr-1"/>棄權</span>
        </div>
      </section>

      {/* 最新表決列表 */}
      <section className="bg-white border rounded-lg overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">最新表決</h2>
          <p className="text-xs text-slate-500 mt-1">點擊可查看誰投了什麼票</p>
        </div>
        <div className="divide-y">
          {recent.map((v) => (
            <Link
              key={v.id}
              href={`/votes/${v.id}`}
              className="block p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 font-medium line-clamp-2">
                    {v.vote_issue || "（無議題）"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {fmtDate(v.vote_date)} {v.vote_time} · {v.meeting_name}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">贊 {v.agree ?? 0}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700">反 {v.against ?? 0}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">棄 {v.abstain ?? 0}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
