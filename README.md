# LY Dashboard PoC

立法委員追蹤 Dashboard。Seed 對象：**葛如鈞**（KO JU-CHUN，第 11 屆中國國民黨不分區）。

## 架構

```
┌─────────────┐     ┌──────────┐     ┌──────────┐
│ Next.js 14  │ ──▶ │ FastAPI  │ ──▶ │ Postgres │
│  (web:3000) │     │(api:8000)│     │ (55432)  │
└─────────────┘     └──────────┘     └────▲─────┘
                                          │
                                    ┌─────┴────┐
                                    │  sync    │  (Python)
                                    └──────────┘
                                          │
              ┌───────────────┬───────────┴─────┬───────────────┐
              ▼               ▼                 ▼               ▼
       ly.govapi.tw   data.ly.gov.tw   Google News RSS    (其他)
```

技術棧：

- **DB**: PostgreSQL 16 (alpine)
- **Sync**: Python 3.11 + httpx + SQLAlchemy + feedparser
- **API**: FastAPI + uvicorn
- **Web**: Next.js 14 (app router) + TypeScript + Tailwind + Recharts
- **Container**: docker-compose

## 一鍵啟動

```bash
cd projects/ly-dashboard
cp .env.example .env       # 視需要改密碼
docker compose up -d       # 起 postgres + api + web
docker compose run --rm sync   # 第一次抓資料；之後可重複跑（idempotent upsert）
```

開瀏覽器：

- Web: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- Postgres: `localhost:55432` (user/pw/db = ly / ly_dev_pw / ly_dashboard)

## 加入新立委

只要修改 `sync/src/config.py`：

```python
TARGETS: list[Target] = [
    Target(term=11, name="葛如鈞"),
    Target(term=11, name="王婉諭"),   # 新加一筆
]
```

然後 `docker compose run --rm sync` 即可（會跑全部 targets，已存在的 idempotent 更新）。

API、Web 完全不用動 — `/legislators` 端點會自動列出 DB 裡所有人。

## 資料來源

| 來源 | 用途 | 端點/說明 |
|---|---|---|
| **ly.govapi.tw** v2 | 主要 — 立委基本資料、出席會議、主提案、連署、IVOD | `/legislators/{term}/{name}/{...}`、`/ivods?屆=&委員名稱=` |
| **data.ly.gov.tw** OData | 備用 — 質詢 | `ID42Action.action`（fallback） |
| **Google News RSS** | 新聞聲量 | `news.google.com/rss/search?q=` |

## Dashboard Widgets

1. 立委基本資料卡（照片、黨籍、選區、委員會、學歷）
2. KPI 數字卡（出席、主提案、連署、質詢、IVOD、新聞）
3. 出席時序折線圖（按會期）
4. 主提案狀態分佈圓餅圖
5. 委員會/會議分類橫向 bar chart（簡化版熱力圖）
6. 新聞聲量時序面積圖（近 30 天）
7. 近期主提案列表
8. 最新質詢列表
9. 最新 IVOD 影片牆（前 12 個，連結到立院影片）
10. 最新新聞列表

## Seed 資料量（葛如鈞，2026-05-13 sync）

| 類別 | 筆數 |
|---|---|
| 出席會議 | 105 |
| 主提案 | 54 |
| 連署提案 | 697 |
| 質詢 | 0（見 Known Limitations） |
| IVOD 影片 | 173 |
| 新聞 | 100 |

## 結構

```
projects/ly-dashboard/
├── docker-compose.yml         # postgres / api / web / sync
├── .env.example
├── README.md
├── db/init.sql                # schema
├── sync/                      # Python 同步
│   ├── Dockerfile, pyproject.toml
│   └── src/
│       ├── main.py            # 入口
│       ├── config.py          # TARGETS 名單
│       ├── db.py              # SQLAlchemy + upsert
│       └── sources/
│           ├── ly_govapi.py
│           ├── ly_official.py
│           └── google_news.py
├── api/                       # FastAPI
│   ├── Dockerfile, pyproject.toml
│   └── src/main.py            # 所有 endpoints（單檔，PoC）
├── web/                       # Next.js
│   ├── Dockerfile, package.json, tsconfig.json
│   ├── tailwind.config.js, next.config.js
│   ├── app/
│   │   ├── layout.tsx, globals.css
│   │   ├── page.tsx                       # 立委列表
│   │   └── legislators/[name]/page.tsx    # 個人 dashboard
│   ├── components/
│   │   ├── KPICards.tsx
│   │   ├── AttendanceChart.tsx
│   │   ├── BillStatusPie.tsx
│   │   ├── CommitteeHeatmap.tsx        # 用 bar chart 替代
│   │   ├── InterpellationCloud.tsx     # 用 list 替代
│   │   ├── NewsTimeline.tsx
│   │   └── IvodGallery.tsx
│   └── lib/api.ts
└── screenshots/
    ├── home.png
    ├── legislator-koju-chun.png
    └── take.js                # Playwright 截圖腳本
```

## API Endpoints

```
GET /health
GET /legislators
GET /legislators/{name}?term=11
GET /legislators/{name}/summary?term=11
GET /legislators/{name}/meets?term=11&limit=200
GET /legislators/{name}/meets/timeline?term=11
GET /legislators/{name}/meets/by_committee?term=11
GET /legislators/{name}/bills?term=11&role=propose|cosign
GET /legislators/{name}/bills/status_breakdown?term=11&role=propose
GET /legislators/{name}/interpellations?term=11
GET /legislators/{name}/ivods?term=11&limit=24
GET /legislators/{name}/news?limit=50
GET /legislators/{name}/news/timeline?days=30
```

互動式文件：<http://localhost:8000/docs>

## Known Limitations

1. **質詢資料 = 0**：`ly.govapi.tw` 對葛如鈞的 `/interpellations` 回 0 筆；`data.ly.gov.tw` 的 OData 在我們的 IP 回 **403 Forbidden**（疑似有 IP/Referer 限制）。後續可改用：
   - 院會 IVOD 字幕（`ai-transcript`）抽質詢段落
   - 立院議事直播逐字稿
2. **記名表決（850 筆）**：未實作。`ly.govapi.tw` 沒有公開個人投票紀錄端點；可從 `g0v/ly-stats` 或 `/v2/votes`（若上線）補。
3. **委員會「熱力圖」** 用 bar chart（按會議種類分組）替代；要做真正按會期 × 委員會的 heatmap 需要更乾淨的標籤。
4. **質詢「詞雲」** 用列表替代（質詢資料抓不到，詞雲也沒料可雲）。
5. **無認證**：PoC 純內網；任何能到 :3000 的人都能看。
6. **同步排程**：sync 目前是手動 `docker compose run --rm sync`；上 production 可加 cron container 或 Airflow。
7. **資料新鮮度**：DB 不會自動更新，跑一次 sync 抓一次。

## 驗證紀錄

- `docker compose up -d`：postgres / api / web 三個 container 全部 healthy。
- `docker compose run --rm sync`：寫入 105 meets / 751 bills / 173 ivods / 100 news（見上）。
- API：所有 11 個端點回 HTTP 200。
- Web：`/` 與 `/legislators/葛如鈞?term=11` 回 HTTP 200，包含「葛如鈞 / 出席會議 / 提案狀態 / IVOD / 新聞聲量」等關鍵字，recharts SVG 已 render。
- 截圖：`screenshots/home.png` (1400×900)、`screenshots/legislator-koju-chun.png` (1400×3253，full page)。

## 下一步

- 多人 seed：把整個第 11 屆 113 位立委灌進去。
- Sync 排程：每天凌晨自動跑一次。
- 質詢補抓：抓 IVOD AI transcript 抽質詢段落。
- 比較模式：兩位立委並排比較。
- 個股化趨勢：追蹤關鍵字（如「AI、加密貨幣、自駕」）出現頻率。
- 上 prod：加 nginx + HTTPS + 簡易帳號管控。
