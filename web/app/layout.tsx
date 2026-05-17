import "./globals.css";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ly.neorex.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "立法委員 Dashboard | 立委動態追蹤",
    template: "%s | 立委 Dashboard",
  },
  description: "追蹤台灣立法院第11屆立法委員的提案、質詢、表決、出席與新聞動態，資料來源 ly.govapi.tw / data.ly.gov.tw。",
  keywords: [
    "立法委員",
    "立法院",
    "立委",
    "質詢",
    "表決",
    "提案",
    "黨團",
    "Taiwan Legislator",
    "Legislative Yuan",
  ],
  applicationName: "立委 Dashboard",
  authors: [{ name: "ly.neorex.xyz" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "立委 Dashboard",
    title: "立法委員 Dashboard",
    description: "立委提案、質詢、表決、出席、新聞動態追蹤",
    url: SITE_URL,
    locale: "zh_TW",
  },
  twitter: {
    card: "summary_large_image",
    title: "立法委員 Dashboard",
    description: "立委提案、質詢、表決、出席、新聞動態追蹤",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "立委 Dashboard",
    url: SITE_URL,
    inLanguage: "zh-Hant",
    description: "立委動態追蹤：提案、質詢、表決、出席、新聞",
  };
  return (
    <html lang="zh-Hant">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <header className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="font-bold text-xl">🏛 立委 Dashboard</a>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/" className="text-slate-700 hover:text-slate-900">總覽</a>
              <a href="/legislators" className="text-slate-700 hover:text-slate-900">立委</a>
              <a href="/parties" className="text-slate-700 hover:text-slate-900">黨團比較</a>
              <a href="/votes" className="text-slate-700 hover:text-slate-900">表決紀錄</a>
              <span className="text-xs text-slate-400">ly.govapi.tw</span>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="text-center text-xs text-slate-400 py-6">
          資料來源：ly.govapi.tw · data.ly.gov.tw · Google News
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
