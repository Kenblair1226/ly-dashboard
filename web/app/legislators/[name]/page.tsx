import { apiGet } from "@/lib/api";
import KPICards from "@/components/KPICards";
import AttendanceChart from "@/components/AttendanceChart";
import BillStatusPie from "@/components/BillStatusPie";
import CommitteeBar from "@/components/CommitteeHeatmap";
import NewsTimeline from "@/components/NewsTimeline";
import IvodGallery from "@/components/IvodGallery";
import InterpellationList from "@/components/InterpellationCloud";

interface Props {
  params: { name: string };
  searchParams: { term?: string };
}

export default async function LegislatorPage({ params, searchParams }: Props) {
  const name = decodeURIComponent(params.name);
  const term = Number(searchParams?.term || 11);
  const q = `?term=${term}`;

  const [info, summary, timeline, byCommittee, billsBreakdown, interps, ivods, news, newsTimeline, recentBills, votes] =
    await Promise.all([
      apiGet(`/legislators/${encodeURIComponent(name)}${q}`),
      apiGet(`/legislators/${encodeURIComponent(name)}/summary${q}`),
      apiGet(`/legislators/${encodeURIComponent(name)}/meets/timeline${q}`),
      apiGet(`/legislators/${encodeURIComponent(name)}/meets/by_committee${q}`),
      apiGet(`/legislators/${encodeURIComponent(name)}/bills/status_breakdown${q}&role=propose`),
      apiGet(`/legislators/${encodeURIComponent(name)}/interpellations${q}&limit=20`),
      apiGet(`/legislators/${encodeURIComponent(name)}/ivods${q}&limit=12`),
      apiGet(`/legislators/${encodeURIComponent(name)}/news?limit=10`),
      apiGet(`/legislators/${encodeURIComponent(name)}/news/timeline?days=30`),
      apiGet(`/legislators/${encodeURIComponent(name)}/bills${q}&role=propose&limit=10`),
      apiGet(`/legislators/${encodeURIComponent(name)}/votes?limit=15`).catch(() => ({ summary: [], recent: [] })),
    ]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="bg-white rounded-lg border p-6 flex gap-6">
        {info.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.photo_url} alt={info.name} className="w-32 h-40 object-cover rounded" />
        )}
        <div className="flex-1">
          <div className="text-sm text-slate-500">第 {info.term} 屆 · {info.name_en}</div>
          <h1 className="text-3xl font-bold">{info.name}</h1>
          <div className="mt-2 text-sm text-slate-700">
            <div>🏛 {info.party} · {info.caucus}</div>
            <div>📍 {info.constituency}</div>
            <div>📅 到職：{info.onboard_date}</div>
          </div>
          {Array.isArray(info.education) && info.education.length > 0 && (
            <div className="text-xs text-slate-600 mt-2">🎓 {(info.education as string[]).join(" / ")}</div>
          )}
          {Array.isArray(info.committees) && info.committees.length > 0 && (
            <div className="text-xs text-slate-600 mt-1">📋 {(info.committees as string[]).slice(0, 4).join("、")}…</div>
          )}
        </div>
      </section>

      {/* KPI */}
      <section>
        <h2 className="text-lg font-semibold mb-3">數字概覽</h2>
        <KPICards summary={summary} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">出席會議時序（按會期）</h3>
          <AttendanceChart data={timeline} />
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">提案狀態分佈</h3>
          <BillStatusPie data={billsBreakdown} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">出席會議分類（按會議種類）</h3>
          <CommitteeBar data={byCommittee} />
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">新聞聲量（近 30 天）</h3>
          <NewsTimeline data={newsTimeline} />
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">近期主提案</h3>
        <ul className="bg-white border rounded divide-y">
          {recentBills.map((b: any) => (
            <li key={b.bill_no} className="p-3">
              <div className="text-xs text-slate-500">{b.last_progress_date} · {b.status}</div>
              <a href={b.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                {b.name}
              </a>
            </li>
          ))}
          {recentBills.length === 0 && <li className="p-3 text-slate-500 text-sm">無</li>}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold mb-2">表決紀錄</h3>
        {(() => {
          const v = votes as any;
          const sum: Record<string, number> = { agree: 0, against: 0, abstain: 0 };
          for (const r of (v.summary || [])) sum[r.choice] = Number(r.count);
          const total = sum.agree + sum.against + sum.abstain;
          return (
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <div className="flex gap-2 text-sm">
                <span className="px-3 py-1 rounded bg-emerald-50 text-emerald-800">贊成 {sum.agree}</span>
                <span className="px-3 py-1 rounded bg-rose-50 text-rose-800">反對 {sum.against}</span>
                <span className="px-3 py-1 rounded bg-amber-50 text-amber-800">棄權 {sum.abstain}</span>
                <span className="px-3 py-1 rounded bg-slate-100 text-slate-600 ml-auto">總計 {total}</span>
              </div>
              {total > 0 && (
                <div className="h-3 flex rounded overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${(sum.agree/total)*100}%` }} />
                  <div className="bg-rose-500" style={{ width: `${(sum.against/total)*100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(sum.abstain/total)*100}%` }} />
                </div>
              )}
              <ul className="divide-y">
                {(v.recent || []).map((r: any) => (
                  <li key={r.id} className="py-2 flex items-start gap-3">
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded ${
                      r.choice === 'agree' ? 'bg-emerald-50 text-emerald-700' :
                      r.choice === 'against' ? 'bg-rose-50 text-rose-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>{r.choice === 'agree' ? '贊' : r.choice === 'against' ? '反' : '棄'}</span>
                    <div className="flex-1 min-w-0">
                      <a href={`/votes/${r.id}`} className="text-sm hover:underline line-clamp-2">{r.vote_issue}</a>
                      <div className="text-xs text-slate-500 mt-0.5">{r.vote_date?.slice(0,10)} · {r.meeting_name}</div>
                    </div>
                  </li>
                ))}
                {(v.recent || []).length === 0 && <li className="py-3 text-slate-500 text-sm">無表決紀錄</li>}
              </ul>
            </div>
          );
        })()}
      </section>

      <section>
        <h3 className="font-semibold mb-2">最新質詢（前 20）</h3>
        <InterpellationList items={interps} />
      </section>

      <section>
        <h3 className="font-semibold mb-2">最新 IVOD 影片</h3>
        <IvodGallery ivods={ivods} />
      </section>

      <section>
        <h3 className="font-semibold mb-2">最新新聞</h3>
        <ul className="bg-white border rounded divide-y">
          {news.map((n: any, i: number) => (
            <li key={i} className="p-3">
              <div className="text-xs text-slate-500">{n.pub_date ? new Date(n.pub_date).toLocaleString("zh-TW") : ""} · {n.source}</div>
              <a href={n.link} target="_blank" rel="noreferrer" className="text-sm hover:underline">{n.title}</a>
            </li>
          ))}
          {news.length === 0 && <li className="p-3 text-slate-500 text-sm">無</li>}
        </ul>
      </section>
    </div>
  );
}
