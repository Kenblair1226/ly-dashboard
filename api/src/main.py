"""FastAPI app exposing legislator data."""
from __future__ import annotations

import os
from collections import Counter
from datetime import date
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://ly:ly_dev_pw@localhost:55432/ly_dashboard",
)
engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)

app = FastAPI(title="LY Dashboard API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _rows(sql: str, **params) -> list[dict]:
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        return [dict(r._mapping) for r in result]


@app.get("/health")
def health() -> dict:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ---------- overview (全體立委總覽) ----------

@app.get("/overview/stats")
def overview_stats() -> dict:
    def _scalar(sql: str) -> int:
        with engine.connect() as conn:
            return int(conn.execute(text(sql)).scalar() or 0)

    return {
        "legislators": _scalar("SELECT COUNT(*) FROM legislators"),
        "meets": _scalar("SELECT COUNT(*) FROM meets"),
        "propose_bills": _scalar("SELECT COUNT(*) FROM bills WHERE role='propose'"),
        "cosign_bills": _scalar("SELECT COUNT(*) FROM bills WHERE role='cosign'"),
        "interpellations": _scalar("SELECT COUNT(*) FROM interpellations"),
        "ivods": _scalar("SELECT COUNT(*) FROM ivods"),
        "news": _scalar("SELECT COUNT(*) FROM news"),
    }


@app.get("/overview/activity")
def overview_activity(days: int = 90, limit: int = 20) -> list[dict]:
    """近 N 天會議參與度排行（出席代理指標）。"""
    return _rows(
        "SELECT m.legislator_term AS term, m.legislator_name AS name, "
        "       l.party, l.constituency, l.photo_url, COUNT(*) AS meet_count "
        "FROM meets m "
        "LEFT JOIN legislators l ON l.term=m.legislator_term AND l.name=m.legislator_name "
        "WHERE m.first_date IS NOT NULL "
        "  AND m.first_date >= CURRENT_DATE - (:days || ' days')::interval "
        "GROUP BY m.legislator_term, m.legislator_name, l.party, l.constituency, l.photo_url "
        "ORDER BY meet_count DESC LIMIT :limit",
        days=days, limit=limit,
    )


@app.get("/overview/top_proposers")
def overview_top_proposers(limit: int = 20) -> list[dict]:
    return _rows(
        "SELECT b.legislator_term AS term, b.legislator_name AS name, "
        "       l.party, l.photo_url, COUNT(*) AS bill_count "
        "FROM bills b "
        "LEFT JOIN legislators l ON l.term=b.legislator_term AND l.name=b.legislator_name "
        "WHERE b.role='propose' "
        "GROUP BY b.legislator_term, b.legislator_name, l.party, l.photo_url "
        "ORDER BY bill_count DESC LIMIT :limit",
        limit=limit,
    )


@app.get("/overview/party_distribution")
def overview_party() -> list[dict]:
    return _rows(
        "SELECT COALESCE(party,'未知') AS party, COUNT(*) AS count "
        "FROM legislators GROUP BY party ORDER BY count DESC"
    )


@app.get("/overview/recent_news")
def overview_recent_news(limit: int = 30) -> list[dict]:
    return _rows(
        "SELECT DISTINCT ON (link) legislator_name, title, link, source, pub_date "
        "FROM news WHERE pub_date IS NOT NULL "
        "ORDER BY link, pub_date DESC"
    )[: max(1, limit)] if False else _rows(
        "SELECT legislator_name, title, link, source, pub_date FROM news "
        "WHERE pub_date IS NOT NULL "
        "ORDER BY pub_date DESC LIMIT :limit",
        limit=limit,
    )


@app.get("/overview/bills_status")
def overview_bills_status() -> list[dict]:
    return _rows(
        "SELECT COALESCE(status,'未知') AS status, COUNT(*) AS count "
        "FROM bills WHERE role='propose' GROUP BY status ORDER BY count DESC LIMIT 12"
    )


# ---------- votes ----------

@app.get("/votes/recent")
def votes_recent(limit: int = 30) -> list[dict]:
    return _rows(
        "SELECT id, vote_date, vote_time, vote_type, vote_issue, meeting_name, "
        "       presence, agree, against, abstain "
        "FROM votes ORDER BY vote_date DESC NULLS LAST, vote_time DESC LIMIT :limit",
        limit=limit,
    )


@app.get("/votes/by_party")
def votes_by_party(limit: int = 30) -> list[dict]:
    """近 N 場表決中各黨的贊成率。"""
    return _rows(
        """
        WITH recent AS (
          SELECT id FROM votes ORDER BY vote_date DESC NULLS LAST LIMIT :limit
        )
        SELECT COALESCE(l.party,'未知') AS party, vr.choice, COUNT(*) AS count
        FROM vote_records vr
        JOIN recent r ON r.id = vr.vote_id
        LEFT JOIN legislators l ON l.term=11 AND l.name=vr.legislator_name
        GROUP BY l.party, vr.choice
        ORDER BY l.party, vr.choice
        """,
        limit=limit,
    )


@app.get("/votes/{vote_id}")
def vote_detail(vote_id: int) -> dict:
    rows = _rows("SELECT * FROM votes WHERE id=:id", id=vote_id)
    if not rows:
        raise HTTPException(404, "not found")
    v = rows[0]
    v["records"] = _rows(
        "SELECT vr.legislator_name, vr.legislator_no, vr.choice, l.party, l.photo_url "
        "FROM vote_records vr LEFT JOIN legislators l ON l.term=11 AND l.name=vr.legislator_name "
        "WHERE vr.vote_id=:id ORDER BY vr.choice, l.party NULLS LAST, vr.legislator_name",
        id=vote_id,
    )
    return v


@app.get("/legislators/{name}/votes")
def legislator_votes(name: str, limit: int = 50) -> dict:
    summary = _rows(
        "SELECT choice, COUNT(*) AS count FROM vote_records "
        "WHERE legislator_name=:name GROUP BY choice",
        name=name,
    )
    recent = _rows(
        "SELECT v.id, v.vote_date, v.vote_issue, v.meeting_name, vr.choice "
        "FROM vote_records vr JOIN votes v ON v.id=vr.vote_id "
        "WHERE vr.legislator_name=:name "
        "ORDER BY v.vote_date DESC NULLS LAST LIMIT :limit",
        name=name, limit=limit,
    )
    return {"summary": summary, "recent": recent}


# ---------- party comparison ----------

@app.get("/parties/compare")
def parties_compare() -> list[dict]:
    """黨團聚合指標。"""
    rows = _rows(
        """
        WITH base AS (
          SELECT term, name, COALESCE(party,'未知') AS party FROM legislators WHERE term=11
        ),
        bcount AS (
          SELECT legislator_term AS term, legislator_name AS name,
                 COUNT(*) FILTER (WHERE role='propose') AS propose,
                 COUNT(*) FILTER (WHERE role='cosign') AS cosign
          FROM bills GROUP BY legislator_term, legislator_name
        ),
        mcount AS (
          SELECT legislator_term AS term, legislator_name AS name, COUNT(*) AS meets
          FROM meets GROUP BY legislator_term, legislator_name
        ),
        icount AS (
          SELECT legislator_term AS term, legislator_name AS name, COUNT(*) AS ivods
          FROM ivods GROUP BY legislator_term, legislator_name
        ),
        ncount AS (
          SELECT legislator_name AS name, COUNT(*) AS news FROM news GROUP BY legislator_name
        )
        SELECT b.party,
               COUNT(*) AS members,
               COALESCE(SUM(bc.propose),0) AS propose_bills,
               COALESCE(SUM(bc.cosign),0)  AS cosign_bills,
               COALESCE(SUM(mc.meets),0)   AS meets,
               COALESCE(SUM(ic.ivods),0)   AS ivods,
               COALESCE(SUM(nc.news),0)    AS news,
               ROUND(COALESCE(AVG(bc.propose),0)::numeric, 1) AS avg_propose,
               ROUND(COALESCE(AVG(mc.meets),0)::numeric, 1)   AS avg_meets,
               ROUND(COALESCE(AVG(ic.ivods),0)::numeric, 1)   AS avg_ivods
        FROM base b
        LEFT JOIN bcount bc ON bc.term=b.term AND bc.name=b.name
        LEFT JOIN mcount mc ON mc.term=b.term AND mc.name=b.name
        LEFT JOIN icount ic ON ic.term=b.term AND ic.name=b.name
        LEFT JOIN ncount nc ON nc.name=b.name
        GROUP BY b.party
        ORDER BY members DESC
        """
    )
    return rows


@app.get("/parties/{party}/legislators")
def party_legislators(party: str) -> list[dict]:
    return _rows(
        """
        SELECT l.term, l.name, l.party, l.constituency, l.photo_url,
               COALESCE(SUM(CASE WHEN b.role='propose' THEN 1 ELSE 0 END),0) AS propose_bills,
               COALESCE(SUM(CASE WHEN b.role='cosign'  THEN 1 ELSE 0 END),0) AS cosign_bills
        FROM legislators l
        LEFT JOIN bills b ON b.legislator_term=l.term AND b.legislator_name=l.name
        WHERE l.term=11 AND l.party=:party
        GROUP BY l.term, l.name, l.party, l.constituency, l.photo_url
        ORDER BY propose_bills DESC
        """,
        party=party,
    )


# ---------- legislators ----------

@app.get("/legislators")
def list_legislators() -> list[dict]:
    return _rows(
        "SELECT term, name, name_en, party, caucus, constituency, photo_url FROM legislators ORDER BY term DESC, name"
    )


@app.get("/legislators/{name}")
def get_legislator(name: str, term: int = 11) -> dict:
    rows = _rows(
        "SELECT * FROM legislators WHERE term=:term AND name=:name",
        term=term, name=name,
    )
    if not rows:
        raise HTTPException(404, "not found")
    return rows[0]


@app.get("/legislators/{name}/summary")
def summary(name: str, term: int = 11) -> dict:
    def _scalar(sql: str) -> int:
        with engine.connect() as conn:
            return int(conn.execute(text(sql), {"term": term, "name": name}).scalar() or 0)

    return {
        "term": term,
        "name": name,
        "meets": _scalar("SELECT COUNT(*) FROM meets WHERE legislator_term=:term AND legislator_name=:name"),
        "propose_bills": _scalar("SELECT COUNT(*) FROM bills WHERE legislator_term=:term AND legislator_name=:name AND role='propose'"),
        "cosign_bills": _scalar("SELECT COUNT(*) FROM bills WHERE legislator_term=:term AND legislator_name=:name AND role='cosign'"),
        "interpellations": _scalar("SELECT COUNT(*) FROM interpellations WHERE legislator_term=:term AND legislator_name=:name"),
        "ivods": _scalar("SELECT COUNT(*) FROM ivods WHERE legislator_term=:term AND legislator_name=:name"),
        "news": _scalar("SELECT COUNT(*) FROM news WHERE legislator_name=:name"),
    }


# ---------- meets ----------

@app.get("/legislators/{name}/meets")
def meets(name: str, term: int = 11, limit: int = 200) -> list[dict]:
    return _rows(
        "SELECT meet_code, meet_type, session_period, title, first_date, dates "
        "FROM meets WHERE legislator_term=:term AND legislator_name=:name "
        "ORDER BY first_date DESC NULLS LAST LIMIT :limit",
        term=term, name=name, limit=limit,
    )


@app.get("/legislators/{name}/meets/timeline")
def meets_timeline(name: str, term: int = 11) -> list[dict]:
    rows = _rows(
        "SELECT session_period, COUNT(*) AS count "
        "FROM meets WHERE legislator_term=:term AND legislator_name=:name AND session_period IS NOT NULL "
        "GROUP BY session_period ORDER BY session_period",
        term=term, name=name,
    )
    return rows


@app.get("/legislators/{name}/meets/by_committee")
def meets_by_committee(name: str, term: int = 11) -> list[dict]:
    # meet_type is too coarse; use raw->'會議單位' / committee field if any. Use meet_type as proxy.
    return _rows(
        "SELECT COALESCE(meet_type,'未分類') AS committee, COUNT(*) AS count "
        "FROM meets WHERE legislator_term=:term AND legislator_name=:name "
        "GROUP BY meet_type ORDER BY count DESC",
        term=term, name=name,
    )


# ---------- bills ----------

@app.get("/legislators/{name}/bills")
def bills(name: str, term: int = 11, role: str | None = Query(None), limit: int = 200) -> list[dict]:
    if role:
        return _rows(
            "SELECT bill_no, role, name, status, bill_type, session_period, last_progress_date, url "
            "FROM bills WHERE legislator_term=:term AND legislator_name=:name AND role=:role "
            "ORDER BY last_progress_date DESC NULLS LAST LIMIT :limit",
            term=term, name=name, role=role, limit=limit,
        )
    return _rows(
        "SELECT bill_no, role, name, status, bill_type, session_period, last_progress_date, url "
        "FROM bills WHERE legislator_term=:term AND legislator_name=:name "
        "ORDER BY last_progress_date DESC NULLS LAST LIMIT :limit",
        term=term, name=name, limit=limit,
    )


@app.get("/legislators/{name}/bills/status_breakdown")
def bills_status(name: str, term: int = 11, role: str = "propose") -> list[dict]:
    return _rows(
        "SELECT COALESCE(status,'未知') AS status, COUNT(*) AS count "
        "FROM bills WHERE legislator_term=:term AND legislator_name=:name AND role=:role "
        "GROUP BY status ORDER BY count DESC",
        term=term, name=name, role=role,
    )


# ---------- interpellations ----------

@app.get("/legislators/{name}/interpellations")
def interpellations(name: str, term: int = 11, limit: int = 50) -> list[dict]:
    return _rows(
        "SELECT interp_id, title, meet_code, session_period, date "
        "FROM interpellations WHERE legislator_term=:term AND legislator_name=:name "
        "ORDER BY date DESC NULLS LAST LIMIT :limit",
        term=term, name=name, limit=limit,
    )


# ---------- ivods ----------

@app.get("/legislators/{name}/ivods")
def ivods(name: str, term: int = 11, limit: int = 24) -> list[dict]:
    return _rows(
        "SELECT ivod_id, ivod_url, video_url, date, duration, meet_name, speech_time "
        "FROM ivods WHERE legislator_term=:term AND legislator_name=:name "
        "ORDER BY date DESC NULLS LAST, ivod_id DESC LIMIT :limit",
        term=term, name=name, limit=limit,
    )


# ---------- news ----------

@app.get("/legislators/{name}/news")
def news(name: str, limit: int = 50) -> list[dict]:
    return _rows(
        "SELECT title, link, source, pub_date FROM news WHERE legislator_name=:name "
        "ORDER BY pub_date DESC NULLS LAST LIMIT :limit",
        name=name, limit=limit,
    )


@app.get("/legislators/{name}/news/timeline")
def news_timeline(name: str, days: int = 30) -> list[dict]:
    return _rows(
        "SELECT DATE(pub_date) AS day, COUNT(*) AS count FROM news "
        "WHERE legislator_name=:name AND pub_date IS NOT NULL "
        "  AND pub_date >= NOW() - (:days || ' days')::interval "
        "GROUP BY DATE(pub_date) ORDER BY day",
        name=name, days=days,
    )
