"""SQLAlchemy engine + simple upsert helpers."""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterable

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def get_engine() -> Engine:
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://ly:ly_dev_pw@localhost:55432/ly_dashboard",
    )
    return create_engine(url, future=True, pool_pre_ping=True)


@contextmanager
def conn_scope(engine: Engine):
    with engine.begin() as conn:
        yield conn


def upsert(conn, table: str, rows: Iterable[dict], conflict_cols: list[str]) -> int:
    rows = list(rows)
    if not rows:
        return 0
    cols = list(rows[0].keys())
    placeholders = ", ".join(f":{c}" for c in cols)
    cols_csv = ", ".join(cols)
    update_cols = [c for c in cols if c not in conflict_cols]
    do_update = (
        "DO UPDATE SET " + ", ".join(f"{c}=EXCLUDED.{c}" for c in update_cols)
        if update_cols
        else "DO NOTHING"
    )
    sql = text(
        f"INSERT INTO {table} ({cols_csv}) VALUES ({placeholders}) "
        f"ON CONFLICT ({', '.join(conflict_cols)}) {do_update}"
    )
    # Convert dict / list -> JSON for JSONB columns
    import json
    norm: list[dict] = []
    for r in rows:
        nr = {}
        for k, v in r.items():
            if isinstance(v, (dict, list)):
                nr[k] = json.dumps(v, ensure_ascii=False)
            else:
                nr[k] = v
        norm.append(nr)
    conn.execute(sql, norm)
    return len(norm)
