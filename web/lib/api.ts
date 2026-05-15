// Server-side fetch helper. Uses internal Docker URL when present.
const SERVER_BASE = process.env.API_INTERNAL_URL || "http://localhost:8000";

export async function apiGet<T = any>(path: string): Promise<T> {
  const url = `${SERVER_BASE}${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status} ${path}`);
  return res.json();
}

export const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
