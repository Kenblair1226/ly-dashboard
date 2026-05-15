import { apiGet } from "@/lib/api";
import Link from "next/link";

type Legislator = {
  term: number;
  name: string;
  name_en?: string;
  party?: string;
  caucus?: string;
  constituency?: string;
  photo_url?: string;
};

const PARTY_COLORS: Record<string, string> = {
  民主進步黨: "bg-emerald-100 text-emerald-800",
  中國國民黨: "bg-sky-100 text-sky-800",
  台灣民眾黨: "bg-cyan-100 text-cyan-800",
  時代力量: "bg-amber-100 text-amber-800",
  無黨籍: "bg-slate-100 text-slate-700",
};

export default async function LegislatorsPage({
  searchParams,
}: {
  searchParams?: { party?: string; q?: string };
}) {
  let legislators: Legislator[] = [];
  let error: string | null = null;
  try {
    legislators = await apiGet<Legislator[]>("/legislators");
  } catch (e: any) {
    error = e.message;
  }

  const partyFilter = searchParams?.party;
  const q = (searchParams?.q || "").trim();

  const parties = Array.from(
    new Set(legislators.map((l) => l.party || "未知"))
  );

  let filtered = legislators.filter((l) => l.term === 11);
  if (partyFilter) filtered = filtered.filter((l) => l.party === partyFilter);
  if (q) {
    const lq = q.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.name.includes(q) ||
        (l.name_en || "").toLowerCase().includes(lq) ||
        (l.constituency || "").includes(q)
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">立委個人檔案</h1>
          <p className="text-slate-500 mt-1">
            點選卡片進入個人 dashboard，共 {filtered.length} 位
          </p>
        </div>
        <Link href="/" className="text-sm text-slate-600 hover:underline">
          ← 回總覽
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/legislators"
          className={`text-xs px-3 py-1 rounded-full border ${
            !partyFilter
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          全部
        </Link>
        {parties.map((p) => (
          <Link
            key={p}
            href={`/legislators?party=${encodeURIComponent(p)}`}
            className={`text-xs px-3 py-1 rounded-full border ${
              partyFilter === p
                ? "bg-slate-900 text-white border-slate-900"
                : `${PARTY_COLORS[p] || "bg-white text-slate-700"} hover:opacity-80`
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((l) => (
          <Link
            key={`${l.term}-${l.name}`}
            href={`/legislators/${encodeURIComponent(l.name)}?term=${l.term}`}
            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition p-5 flex gap-4"
          >
            {l.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.photo_url}
                alt={l.name}
                className="w-20 h-24 object-cover rounded"
              />
            )}
            <div className="min-w-0">
              <div className="text-lg font-semibold">{l.name}</div>
              <div className="text-xs text-slate-500 truncate">{l.name_en}</div>
              <div className="mt-2">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    PARTY_COLORS[l.party || ""] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {l.party || "未知"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {l.constituency}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
