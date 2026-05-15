# Zeabur 部署指南

## 服務結構

| 服務 | 類型 | Root Dir | 對外 |
|---|---|---|---|
| postgres | Zeabur Prebuilt (PostgreSQL) | — | 內網 |
| api | Dockerfile (from GitHub) | `api/` | Public domain |
| web | Dockerfile (from GitHub) | `web/` | 自訂 domain |
| sync | Dockerfile (from GitHub) + Cron | `sync/` | 不對外 |

---

## Step 1：新建 Project

1. https://zeabur.com → New Project
2. 選 region（建議 Tokyo / Hong Kong，台灣訪問快）
3. 接 GitHub → 授權 `Kenblair1226/ly-dashboard`

---

## Step 2：部署 PostgreSQL

1. Add Service → Marketplace → **PostgreSQL**
2. 部署完會自動產生環境變數，記下這個（其他服務會用到）：
   - `POSTGRES_CONNECTION_STRING`（格式 `postgresql://user:pw@host:port/db`）
3. **重要**：跑一次 `db/init.sql` 初始化 schema
   - 在 Postgres 服務面板 → Connect → 用 `psql` 連進去
   - 或用 GUI（TablePlus / DBeaver）連 public host 跑 `db/init.sql`

---

## Step 3：部署 api

1. Add Service → Git → 選 repo → 設定 **Root Directory: `api`**
2. Zeabur 偵測到 Dockerfile 自動 build
3. Variables：
   ```
   DATABASE_URL = postgresql+psycopg://<user>:<pw>@<host>:<port>/<db>
   ```
   （注意：用 `postgresql+psycopg://` 開頭，不是純 `postgresql://`，因為 SQLAlchemy 用 psycopg3 driver）
   - 可以引用 Postgres 服務變數：`postgresql+psycopg://${postgres.PGUSER}:${postgres.PGPASSWORD}@${postgres.PGHOST}:${postgres.PGPORT}/${postgres.PGDATABASE}`
4. Networking → Generate Domain（取得 `api-xxx.zeabur.app`）

---

## Step 4：部署 web

1. Add Service → Git → 選同一個 repo → **Root Directory: `web`**
2. Variables：
   ```
   NEXT_PUBLIC_API_BASE = https://<api 服務的 public domain>
   ```
   ⚠️ 這是 **build-time** 變數，Dockerfile 已改成 ARG。改變數後要重 build。
3. Networking → Custom Domain → 加你的 domain → 跟 Zeabur 設 CNAME

---

## Step 5：部署 sync（Cron Job）

1. Add Service → Git → 同 repo → **Root Directory: `sync`**
2. Variables：
   ```
   DATABASE_URL = postgresql+psycopg://...（同 api）
   ```
3. Settings → **Cron** → 啟用，schedule 設：
   ```
   0 18 * * *
   ```
   （UTC 18:00 = 台灣時間 02:00 半夜）
4. **重要**：Zeabur Cron 模式會在排程時間啟動 container 跑完 CMD 然後關掉，正好符合 sync 的 "run once then exit" 邏輯。

---

## Step 6：第一次手動跑 sync

部署完 sync 後在 Zeabur 面板按 "Trigger Now"（或手動 redeploy）灌第一批資料，免得等到半夜才看得到 dashboard。

---

## 常見問題

- **api 連不到 db**：確認 `DATABASE_URL` 開頭是 `postgresql+psycopg://`（SQLAlchemy 需要 driver hint）
- **web 顯示 API 連線失敗**：檢查 `NEXT_PUBLIC_API_BASE` 是否包含 `https://` 前綴
- **CORS**：api FastAPI 目前沒設 CORS middleware，如果 web 跟 api 不同 domain 會被 blocked → 要在 `api/src/main.py` 加 `CORSMiddleware`（見下）

### CORS 修補（如果需要）
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
