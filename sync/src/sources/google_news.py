"""Google News RSS for press volume."""
from __future__ import annotations

from datetime import datetime, timezone

import feedparser
import httpx

from ..config import GOOGLE_NEWS_RSS, HTTP_TIMEOUT


def fetch_news(name: str) -> list[dict]:
    params = {"q": name, "hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant"}
    r = httpx.get(GOOGLE_NEWS_RSS, params=params, timeout=HTTP_TIMEOUT,
                  headers={"User-Agent": "Mozilla/5.0 ly-dashboard"})
    r.raise_for_status()
    feed = feedparser.parse(r.text)
    out = []
    for e in feed.entries:
        pub = None
        if getattr(e, "published_parsed", None):
            try:
                pub = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)
            except Exception:
                pub = None
        source = ""
        if getattr(e, "source", None):
            source = getattr(e.source, "title", "") or e.source.get("title", "") if isinstance(e.source, dict) else getattr(e.source, "title", "")
        out.append({
            "guid": getattr(e, "id", e.link),
            "title": e.title,
            "link": e.link,
            "source": source,
            "pub_date": pub,
        })
    return out
