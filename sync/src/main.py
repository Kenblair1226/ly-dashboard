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


def main() -> None:
    for t in TARGETS:
        try:
            sync_legislator(t)
        except Exception as exc:
            log.exception("Sync failed for %s: %s", t.name, exc)
    sync_votes_all()


if __name__ == "__main__":
    main()
