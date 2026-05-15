import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "立法委員 Dashboard",
  description: "立委動態追蹤 PoC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      </body>
    </html>
  );
}
