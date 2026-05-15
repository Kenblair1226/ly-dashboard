import { apiGet } from "@/lib/api";
import Link from "next/link";

type VoteRecord = {
  legislator_name: string;
  legislator_no: string | null;
  choice: string;
  party: string | null;
  photo_url: string | null;
};
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
  records: VoteRecord[];
};

const PARTY_CHIP: Record<string, string> = {
  民主進步黨: "bg-emerald-100 text-emerald-800",
  中國國民黨: "bg-sky-100 text-sky-800",
  台灣民眾黨: "bg-cyan-100 text-cyan-800",
  無黨籍: "bg-slate-100 text-slate-700",
};
const CHOICE: Record<string, { label: string; bar: string; chip: string }> = {
  agree:   { label: "贊成", bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800" },
  against: { label: "反對", bar: "bg-rose-500",    chip: "bg-rose-50 text-rose-800" },
  abstain: { label: "棄權", bar: "bg-amber-400",   chip: "bg-amber-50 text-amber-800" },
};

export default async function VoteDetail({ params }: { params: { id: string } }) {
  let v: Vote;
  try {
    v = await apiGet<Vote>(`/votes/${params.id}`);
  } catch (e: any) {
    return <div className="text-red-700">{e.message}</div>;
  }

  // group records by choice + party
  const groups: Record<string, VoteRecord[]> = { agree: [], against: [], abstain: [] };
  for (const r of v.records) {
    (groups[r.choice] ||= []).push(r);
  }

  return (
    <div className="space-y-6">
      <Link href="/votes" className="text-sm text-slate-600 hover:underline">← 回表決列表</Link>
      <header className="bg-white border rounded-lg p-6">
        <div className="text-xs text-slate-500">
          {v.vote_date?.slice(0, 10)} {v.vote_time} · {v.meeting_name} · {v.vote_type}
        </div>
        <h1 className="text-xl font-semibold mt-2">{v.vote_issue}</h1>
        <div className="flex gap-2 mt-4 text-sm">
          <span className="px-3 py-1 rounded bg-emerald-50 text-emerald-800">贊成 {v.agree ?? 0}</span>
          <span className="px-3 py-1 rounded bg-rose-50 text-rose-800">反對 {v.against ?? 0}</span>
          <span className="px-3 py-1 rounded bg-amber-50 text-amber-800">棄權 {v.abstain ?? 0}</span>
          <span className="px-3 py-1 rounded bg-slate-100 text-slate-700 ml-auto">出席 {v.presence ?? 0}</span>
        </div>
      </header>

      {(["agree","against","abstain"] as const).map((c) => {
        const list = groups[c] || [];
        if (!list.length) return null;
        const meta = CHOICE[c];
        // sub-group by party
        const byParty: Record<string, VoteRecord[]> = {};
        for (const r of list) {
          (byParty[r.party || "未知"] ||= []).push(r);
        }
        const parties = Object.keys(byParty).sort((a,b) => byParty[b].length - byParty[a].length);
        return (
          <section key={c} className="bg-white border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-sm font-semibold px-3 py-1 rounded ${meta.chip}`}>
                {meta.label} · {list.length}
              </span>
            </div>
            <div className="space-y-4">
              {parties.map((p) => (
                <div key={p}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PARTY_CHIP[p] || "bg-slate-100 text-slate-700"}`}>
                      {p}
                    </span>
                    <span className="text-xs text-slate-500">{byParty[p].length} 人</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {byParty[p].map((r) => (
                      <Link
                        key={r.legislator_name}
                        href={`/legislators/${encodeURIComponent(r.legislator_name)}`}
                        className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                      >
                        {r.legislator_name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
