"""Official LY OData (interpellation list). Filter param `interpellationMember`
is unreliable, but kept as supplementary source. We filter client-side too."""
from __future__ import annotations

import httpx

from ..config import LY_OFFICIAL_INTERPELLATION, HTTP_TIMEOUT


def fetch_interpellations(term: int, name: str) -> list[dict]:
    params = {
        "term": term,
        "interpellationMember": name,
        "fileType": "json",
    }
    try:
        r = httpx.get(LY_OFFICIAL_INTERPELLATION, params=params, timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return []
    items = data.get("dataList", [])
    # Server-side filter not reliable; do client-side membership check on attendLegislator
    out = []
    for it in items:
        att = it.get("attendLegislator", "") or ""
        if name in att:
            out.append(it)
    return out
