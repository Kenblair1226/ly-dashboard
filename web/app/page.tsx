import { apiGet } from "@/lib/api";
import Link from "next/link";

type Stats = {
  legislators: number;
  meets: number;
  propose_bills: number;
  cosign_bills: number;
  interpellations: number;
  ivods: number;
  news: number;
};

type ActivityRow = {
  term: number;
  name: string;
  party?: string;
  constituency?: string;
  photo_url?: string;
  meet_count: number;
};

type ProposerRow = {
  term: number;
  name: string;
  party?: string;
  photo_url?: string;
  bill_count: number;
};

type PartyRow = { party: string; count: number };
type StatusRow = { status: string; count: number };

type NewsRow = {
  legislator_name: string;
  title: string;
  link: string;
  source: string;
  pub_date: string;
};

const PARTY_COLORS: Record<string, string> = {
  民主進步黨: "bg-emerald-100 text-emerald-800",
  中國國民黨: "bg-sky-100 text-sky-800",
  台灣民眾黨: "bg-cyan-100 text-cyan-800",
  時代力量: "bg-amber-100 text-amber-800",
  無黨籍: "bg-slate-100 text-slate-700",
};

function partyChip(p?: string) {
  const cls = PARTY_COLORS[p || ""] || "bg-slate-100 text-slate-700";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>
      {p || "未知"}
    </span>
  );
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function HomePage() {
  let stats: Stats | null = null;
  let activity: ActivityRow[] = [];
  let proposers: ProposerRow[] = [];
  let parties: PartyRow[] = [];
  let statuses: StatusRow[] = [];
  let news: NewsRow[] = [];
  let error: string | null = null;

  try {
    [stats, activity, proposers, parties, statuses, news] = await Promise.all([
      apiGet<Stats>("/overview/stats"),
      apiGet<ActivityRow[]>("/overview/activity?days=180&limit=15"),
      apiGet<ProposerRow[]>("/overview/top_proposers?limit=15"),
      apiGet<PartyRow[]>("/overview/party_distribution"),
      apiGet<StatusRow[]>("/overview/bills_status"),
      apiGet<NewsRow[]>("/overview/recent_news?limit=20"),
    ]);
  } catch (e: any) {
    error = e.message;
  }

  const totalParty = parties.reduce((a, b) => a + b.count, 0) || 1;
  const totalStatus = statuses.reduce((a, b) => a + b.count, 0) || 1;
  const maxActivity = activity[0]?.meet_count || 1;
  const maxProp = proposers[0]?.bill_count || 1;

  const kpi = [
    { k: "legislators", label: "立委人數" },
    { k: "meets", label: "會議紀錄" },
    { k: "propose_bills", label: "主提法案" },
    { k: "cosign_bills", label: "連署法案" },
    { k: "ivods", label: "IVOD 影片" },
    { k: "news", label: "新聞報導" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">第 11 屆立委總覽</h1>
          <p className="text-slate-500 mt-1">
            全體立委的會議參與、法案提案、新聞動態整合視圖。
          </p>
        </div>
        <Link
          href="/legislators"
          className="text-sm bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700"
        >
          看個別立委 →
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
          無法載入：{error}
        </div>
      )}

      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpi.map((it) => (
            <div key={it.k} className="bg-white border rounded-lg p-4">
              <div className="text-xs text-slate-500">{it.label}</div>
              <div className="text-2xl font-bold mt-1">
                {(stats as any)[it.k]?.toLocaleString() ?? 0}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 出席排行 */}
        <section className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-1">近 180 天會議參與排行</h2>
          <p className="text-xs text-slate-500 mb-4">
            ※ 以「會議出席紀錄筆數」作為參與度代理指標
          </p>
          <ol className="space-y-2">
            {activity.map((r, i) => (
              <li key={`${r.term}-${r.name}`}>
                <Link
                  href={`/legislators/${encodeURIComponent(r.name)}?term=${r.term}`}
                  className="flex items-center gap-3 group"
                >
                  <span className="w-6 text-right text-slate-400 text-sm">
                    {i + 1}
                  </span>
                  {r.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photo_url}
                      alt={r.name}
                      className="w-8 h-10 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium group-hover:underline">
                        {r.name}
                      </span>
                      {partyChip(r.party)}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {r.constituency}
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="h-2 bg-slate-100 rounded">
                      <div
                        className="h-2 bg-emerald-500 rounded"
                        style={{
                          width: `${(r.meet_count / maxActivity) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-right text-xs text-slate-500 mt-0.5">
                      {r.meet_count} 場
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* 提案王 */}
        <section className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-1">主提法案 Top 15</h2>
          <p className="text-xs text-slate-500 mb-4">本屆累計（不含連署）</p>
          <ol className="space-y-2">
            {proposers.map((r, i) => (
              <li key={`${r.term}-${r.name}`}>
                <Link
                  href={`/legislators/${encodeURIComponent(r.name)}?term=${r.term}`}
                  className="flex items-center gap-3 group"
                >
                  <span className="w-6 text-right text-slate-400 text-sm">
                    {i + 1}
                  </span>
                  {r.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photo_url}
                      alt={r.name}
                      className="w-8 h-10 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium group-hover:underline">
                        {r.name}
                      </span>
                      {partyChip(r.party)}
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="h-2 bg-slate-100 rounded">
                      <div
                        className="h-2 bg-indigo-500 rounded"
                        style={{
                          width: `${(r.bill_count / maxProp) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-right text-xs text-slate-500 mt-0.5">
                      {r.bill_count.toLocaleString()} 案
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* 黨團分布 */}
        <section className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-4">黨籍分布</h2>
          <div className="space-y-3">
            {parties.map((r) => (
              <div key={r.party}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    {partyChip(r.party)}
                  </div>
                  <span className="text-slate-500">
                    {r.count} 位 ·{" "}
                    {((r.count / totalParty) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded">
                  <div
                    className="h-2 bg-slate-700 rounded"
                    style={{ width: `${(r.count / totalParty) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 法案狀態 */}
        <section className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-4">主提法案狀態（全體）</h2>
          <div className="space-y-2">
            {statuses.map((r) => (
              <div key={r.status}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{r.status}</span>
                  <span className="text-slate-500">
                    {r.count.toLocaleString()} ·{" "}
                    {((r.count / totalStatus) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded">
                  <div
                    className="h-2 bg-amber-500 rounded"
                    style={{ width: `${(r.count / totalStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 新聞動態 */}
      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-lg mb-4">最新新聞動態</h2>
        <ul className="divide-y">
          {news.map((n) => (
            <li key={n.link} className="py-3 flex items-start gap-3">
              <Link
                href={`/legislators/${encodeURIComponent(n.legislator_name)}?term=11`}
                className="shrink-0 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
              >
                {n.legislator_name}
              </Link>
              <div className="flex-1 min-w-0">
                <a
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm hover:underline line-clamp-2"
                >
                  {n.title}
                </a>
                <div className="text-xs text-slate-500 mt-1">
                  {n.source} · {fmtTime(n.pub_date)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
