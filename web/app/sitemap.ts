import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ly.neorex.xyz";
const API_BASE = process.env.API_INTERNAL_URL || "http://localhost:8000";

type Legislator = { name: string; term: number };
type Vote = { id: number; vote_date?: string | null };

async function safeJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/legislators`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/parties`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/votes`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  const legislators = (await safeJson<Legislator[]>("/legislators?term=11&limit=200")) || [];
  const legEntries: MetadataRoute.Sitemap = legislators.map((l) => ({
    url: `${SITE_URL}/legislators/${encodeURIComponent(l.name)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const votes = (await safeJson<Vote[]>("/votes/recent?limit=100")) || [];
  const voteEntries: MetadataRoute.Sitemap = votes.map((v) => ({
    url: `${SITE_URL}/votes/${v.id}`,
    lastModified: v.vote_date ? new Date(v.vote_date) : now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...legEntries, ...voteEntries];
}
