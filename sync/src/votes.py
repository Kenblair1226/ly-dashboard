"""Ingest 院會表決資料 (dataset id=370) → votes + vote_records."""
import json
import os
import re
import sys
from datetime import date

import httpx
import psycopg

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://ly:ly_dev_pw@localhost:55432/ly_dashboard",
)
# psycopg accepts the postgres:// form; strip +psycopg if present
DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")

URL = "https://data.ly.gov.tw/odw/openDatasetJson.action"


def parse_date(s):
    if not s:
        return None
    # roc year/month/day, e.g. 113/04/09
    m = re.match(r"(\d+)[/-](\d+)[/-](\d+)", str(s))
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 1911:
        y += 1911
    try:
        return date(y, mo, d)
    except Exception:
        return None


def parse_names(blob):
    """Parse '004陳秀寳；006莊瑞雄；…' → [(no, name), …]"""
    if not blob:
        return []
    out = []
    for chunk in re.split(r"[；;]", blob):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.match(r"^(\d+)?\s*(.+)$", chunk)
        if not m:
            continue
        no = (m.group(1) or "").strip() or None
        name = re.sub(r"\s+", "", m.group(2) or "")
        if name:
            out.append((no, name))
    return out


def main_for(term: int = 11):
    print(f"Fetching votes for term {term}…")

    items = []
    page = 1
    with httpx.Client(timeout=60.0, headers={"Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0 ly-dashboard"}) as cx:
        while True:
            r = cx.get(URL, params={"id": 370, "selectTerm": term, "page": page})
            r.raise_for_status()
            data = r.json()
            chunk = data.get("jsonList") or []
            if not chunk:
                break
            items.extend(chunk)
            print(f"  page {page}: +{len(chunk)} (total {len(items)})")
            page += 1
            if page > 50:
                break

    print(f"Total votes: {len(items)}")

    conn = psycopg.connect(DATABASE_URL)
    n_votes = 0
    n_records = 0
    with conn:
        with conn.cursor() as cur:
            for it in items:
                vd = parse_date(it.get("voteDate"))
                vt = (it.get("voteTime") or "").strip()
                issue = (it.get("voteIssue") or "").strip()
                sp = int(it["sessionPeriod"]) if str(it.get("sessionPeriod", "")).strip().isdigit() else None
                st = int(it["sessionTimes"]) if str(it.get("sessionTimes", "")).strip().isdigit() else None
                supp = parse_names(it.get("supporter"))
                opp = parse_names(it.get("opposer"))
                abst = parse_names(it.get("abstainer"))

                cur.execute(
                    """
                    INSERT INTO votes
                      (term, session_period, session_times, meeting_name,
                       vote_date, vote_time, vote_type, vote_issue,
                       presence, agree, against, abstain,
                       supporters, opposers, abstainers, raw)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (term, session_period, session_times, vote_date, vote_time, vote_issue)
                    DO UPDATE SET
                      meeting_name=EXCLUDED.meeting_name,
                      presence=EXCLUDED.presence,
                      agree=EXCLUDED.agree,
                      against=EXCLUDED.against,
                      abstain=EXCLUDED.abstain,
                      supporters=EXCLUDED.supporters,
                      opposers=EXCLUDED.opposers,
                      abstainers=EXCLUDED.abstainers,
                      raw=EXCLUDED.raw
                    RETURNING id
                    """,
                    (
                        int(it.get("term") or term),
                        sp, st,
                        it.get("meetingName"),
                        vd, vt,
                        it.get("voteType"),
                        issue,
                        int(it["votePresence"]) if str(it.get("votePresence", "")).strip().isdigit() else None,
                        int(it["voteAgree"]) if str(it.get("voteAgree", "")).strip().isdigit() else None,
                        int(it["voteAgainst"]) if str(it.get("voteAgainst", "")).strip().isdigit() else None,
                        int(it["voteAbstain"]) if str(it.get("voteAbstain", "")).strip().isdigit() else None,
                        json.dumps([n for _, n in supp], ensure_ascii=False),
                        json.dumps([n for _, n in opp], ensure_ascii=False),
                        json.dumps([n for _, n in abst], ensure_ascii=False),
                        json.dumps(it, ensure_ascii=False),
                    ),
                )
                vote_id = cur.fetchone()[0]
                n_votes += 1

                # records
                cur.execute("DELETE FROM vote_records WHERE vote_id=%s", (vote_id,))
                for choice, lst in (("agree", supp), ("against", opp), ("abstain", abst)):
                    for no, name in lst:
                        cur.execute(
                            """
                            INSERT INTO vote_records (vote_id, legislator_name, legislator_no, choice)
                            VALUES (%s,%s,%s,%s)
                            ON CONFLICT (vote_id, legislator_name) DO NOTHING
                            """,
                            (vote_id, name, no, choice),
                        )
                        n_records += 1

    print(f"Upserted {n_votes} votes, {n_records} records")


if __name__ == "__main__":
    main_for(int(sys.argv[1]) if len(sys.argv) > 1 else 11)
