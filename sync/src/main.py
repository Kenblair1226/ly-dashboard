"""Sync entrypoint. Iterates TARGETS and refreshes all data sources."""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from .config import TARGETS, Target
from .db import conn_scope, get_engine, upsert
from .sources import google_news, ly_govapi, ly_official

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("sync")


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    s = str(s).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            continue
    return None


def sync_legislator(target: Target) -> None:
    engine = get_engine()
    log.info("Fetching legislator %s/%s", target.term, target.name)
    info = ly_govapi.fetch_legislator(target.term, target.name)

    leg_row = {
        "term": target.term,
        "name": target.name,
        "name_en": info.get("委員英文姓名"),
        "party": info.get("黨籍"),
        "caucus": info.get("黨團"),
        "constituency": info.get("選區名稱"),
        "gender": info.get("性別"),
        "photo_url": info.get("照片位址"),
        "onboard_date": info.get("到職日"),
        "education": info.get("學歷") or [],
        "experience": info.get("經歷") or [],
        "committees": info.get("委員會") or [],
        "contact": {
            "phone": info.get("電話") or [],
            "fax": info.get("傳真") or [],
            "address": info.get("通訊處") or [],
        },
        "raw": info,
    }
    with conn_scope(engine) as conn:
        upsert(conn, "legislators", [leg_row], conflict_cols=["term", "name"])

    # Meets
    log.info("Fetching meets…")
    meets = ly_govapi.fetch_meets(target.term, target.name)
    meet_rows: list[dict] = []
    for m in meets:
        dates = m.get("日期") or []
        first = _parse_date(dates[0]) if dates else None
        meet_rows.append({
            "legislator_term": target.term,
            "legislator_name": target.name,
            "meet_code": m.get("會議代碼"),
            "meet_type": m.get("會議種類"),
            "session_period": m.get("會期"),
            "session_times": m.get("會次") if isinstance(m.get("會次"), int) else None,
            "title": m.get("會議標題"),
            "dates": dates,
            "first_date": first,
            "raw": m,
        })
    with conn_scope(engine) as conn:
        n = upsert(conn, "meets", meet_rows, conflict_cols=["legislator_term", "legislator_name", "meet_code"])
    log.info("  meets upserted: %d", n)

    # Bills (proposer + cosigner)
    log.info("Fetching propose bills…")
    propose = ly_govapi.fetch_propose_bills(target.term, target.name)
    log.info("Fetching cosign bills…")
    cosign = ly_govapi.fetch_cosign_bills(target.term, target.name)

    def bill_row(b: dict, role: str) -> dict:
        return {
            "legislator_term": target.term,
            "legislator_name": target.name,
            "role": role,
            "bill_no": str(b.get("議案編號") or b.get("提案編號") or ""),
            "name": b.get("議案名稱"),
            "status": b.get("議案狀態"),
            "bill_type": b.get("議案類別"),
            "proposal_source": b.get("提案來源"),
            "session_period": b.get("會期") if isinstance(b.get("會期"), int) else None,
            "proposers": b.get("提案人") or [],
            "cosigners": b.get("連署人") or [],
            "last_progress_date": _parse_date(b.get("最新進度日期")),
            "url": b.get("url"),
            "raw": b,
        }

    bill_rows = [bill_row(b, "propose") for b in propose if (b.get("議案編號") or b.get("提案編號"))]
    bill_rows += [bill_row(b, "cosign") for b in cosign if (b.get("議案編號") or b.get("提案編號"))]
    with conn_scope(engine) as conn:
        n = upsert(conn, "bills", bill_rows, conflict_cols=["legislator_term", "legislator_name", "role", "bill_no"])
    log.info("  bills upserted: %d (propose=%d cosign=%d)", n, len(propose), len(cosign))

    # Interpellations (govapi → fallback official)
    log.info("Fetching interpellations…")
    interps = ly_govapi.fetch_interpellations(target.term, target.name)
    if not interps:
        official = ly_official.fetch_interpellations(target.term, target.name)
        interp_rows = [{
            "legislator_term": target.term,
            "legislator_name": target.name,
            "interp_id": str(o.get("meetingNo") or "")[:64] or f"official-{i}",
            "title": o.get("meetingName"),
            "meet_code": o.get("meetingNo"),
            "session_period": int(o["sessionPeriod"]) if str(o.get("sessionPeriod","")).strip().isdigit() else None,
            "date": _parse_date((o.get("meetingDateDesc") or "").split(" ")[0].replace("/", "-")) ,
            "raw": o,
        } for i, o in enumerate(official)]
    else:
        interp_rows = []
        for i, it in enumerate(interps):
            iid = str(it.get("質詢編號") or it.get("id") or it.get("會議代碼") or f"gov-{i}")
            interp_rows.append({
                "legislator_term": target.term,
                "legislator_name": target.name,
                "interp_id": iid,
                "title": it.get("質詢事由") or it.get("會議標題") or it.get("議案名稱"),
                "meet_code": it.get("會議代碼"),
                "session_period": it.get("會期") if isinstance(it.get("會期"), int) else None,
                "date": _parse_date(it.get("日期")),
                "raw": it,
            })
    with conn_scope(engine) as conn:
        n = upsert(conn, "interpellations", interp_rows, conflict_cols=["legislator_term", "legislator_name", "interp_id"])
    log.info("  interpellations upserted: %d", n)

    # IVODs
    log.info("Fetching ivods…")
    ivods = ly_govapi.fetch_ivods(target.term, target.name)
    ivod_rows = []
    for iv in ivods:
        meet = iv.get("會議資料") or {}
        ivod_rows.append({
            "legislator_term": target.term,
            "legislator_name": target.name,
            "ivod_id": int(iv.get("IVOD_ID")),
            "ivod_url": iv.get("IVOD_URL"),
            "video_url": iv.get("video_url"),
            "date": _parse_date(iv.get("日期")),
            "duration": iv.get("影片長度"),
            "meet_code": meet.get("會議代碼") if isinstance(meet, dict) else None,
            "meet_name": iv.get("會議名稱"),
            "speech_time": iv.get("委員發言時間"),
            "raw": iv,
        })
    with conn_scope(engine) as conn:
        n = upsert(conn, "ivods", ivod_rows, conflict_cols=["legislator_term", "legislator_name", "ivod_id"])
    log.info("  ivods upserted: %d", n)

    # News
    log.info("Fetching news…")
    items = google_news.fetch_news(target.name)
    news_rows = [{
        "legislator_name": target.name,
        "guid": it["guid"],
        "title": it["title"],
        "link": it["link"],
        "source": it.get("source") or "",
        "pub_date": it.get("pub_date"),
    } for it in items]
    with conn_scope(engine) as conn:
        n = upsert(conn, "news", news_rows, conflict_cols=["legislator_name", "guid"])
    log.info("  news upserted: %d", n)


def sync_votes_all() -> None:
    """Sync 院會表決資料 (term-wide, not per-legislator)."""
    from . import votes as votes_mod
    log.info("Syncing votes for term 11…")
    try:
        votes_mod.main_for(11)
    except Exception as exc:
        log.exception("votes sync failed: %s", exc)


def sync_news_only() -> None:
    """Only refresh Google News for all targets (high-frequency)."""
    from .sources import google_news
    engine = get_engine()
    total = 0
    for t in TARGETS:
        try:
            log.info("[news] Fetching news for %s", t.name)
            items = google_news.fetch_news(t.name)
            news_rows = [{
                "legislator_name": t.name,
                "guid": it["guid"],
                "title": it["title"],
                "link": it["link"],
                "source": it.get("source") or "",
                "pub_date": it.get("pub_date"),
            } for it in items]
            with conn_scope(engine) as conn:
                n = upsert(conn, "news", news_rows, conflict_cols=["legislator_name", "guid"])
            total += n
        except Exception:
            log.exception("[news] sync failed for %s", t.name)
    log.info("[news] total upserted: %d", total)


def run_once() -> None:
    for t in TARGETS:
        try:
            sync_legislator(t)
        except Exception as exc:
            log.exception("Sync failed for %s: %s", t.name, exc)
    sync_votes_all()


def main() -> None:
    """Run sync.

    Modes:
      RUN_MODE=once   -> run a full sync once and exit
      RUN_MODE=news   -> run news-only sync once and exit
      RUN_MODE=loop   -> daily full sync at 18:00 UTC (02:00 Asia/Taipei),
                         plus hourly news-only sync in between
    """
    import os
    import time as _time
    from datetime import timedelta, timezone

    mode = os.environ.get("RUN_MODE", "once").lower()
    if mode == "news":
        sync_news_only()
        return
    if mode != "loop":
        run_once()
        return

    full_sync_hour_utc = int(os.environ.get("FULL_SYNC_HOUR_UTC", "18"))
    news_interval_min = int(os.environ.get("NEWS_INTERVAL_MIN", "60"))

    log.info(
        "Starting loop mode: full sync daily at %02d:00 UTC, news every %d min",
        full_sync_hour_utc, news_interval_min,
    )
    # First boot: do a full sync immediately
    run_once()
    last_full_date = datetime.now(timezone.utc).date()

    while True:
        now = datetime.now(timezone.utc)
        # Next full sync target
        next_full = now.replace(hour=full_sync_hour_utc, minute=0, second=0, microsecond=0)
        if next_full <= now or now.date() == last_full_date:
            next_full = next_full + timedelta(days=1)
        # Next news tick
        next_news = now + timedelta(minutes=news_interval_min)

        wake = min(next_full, next_news)
        sleep_s = max(1.0, (wake - now).total_seconds())
        log.info("Sleeping %.1f min (next_full=%s next_news=%s UTC)",
                 sleep_s / 60, next_full.isoformat(), next_news.isoformat())
        _time.sleep(sleep_s)

        now2 = datetime.now(timezone.utc)
        if now2 >= next_full:
            try:
                run_once()
                last_full_date = now2.date()
            except Exception:
                log.exception("Scheduled full sync failed; will retry tomorrow")
        else:
            try:
                sync_news_only()
            except Exception:
                log.exception("Scheduled news sync failed")


if __name__ == "__main__":
    main()
