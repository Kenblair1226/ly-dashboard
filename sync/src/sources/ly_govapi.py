"""ly.govapi.tw client for legislator-related endpoints."""
from __future__ import annotations

import time
from typing import Any, Iterator
from urllib.parse import quote

import httpx

from ..config import LY_GOVAPI_BASE, HTTP_TIMEOUT, PAGE_LIMIT


def _get(client: httpx.Client, path: str, params: dict | None = None) -> dict:
    url = f"{LY_GOVAPI_BASE}{path}"
    r = client.get(url, params=params, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()


def fetch_legislator(term: int, name: str) -> dict:
    with httpx.Client() as client:
        path = f"/legislators/{term}/{quote(name)}"
        data = _get(client, path)
        return data["data"]


def _paginate(client: httpx.Client, path: str, items_key: str) -> Iterator[dict]:
    page = 1
    while True:
        data = _get(client, path, params={"page": page, "limit": PAGE_LIMIT})
        items = data.get(items_key, [])
        for it in items:
            yield it
        total_page = data.get("total_page", 1) or 1
        if page >= total_page or not items:
            break
        page += 1
        time.sleep(0.2)  # be polite


def fetch_meets(term: int, name: str) -> list[dict]:
    with httpx.Client() as client:
        path = f"/legislators/{term}/{quote(name)}/meets"
        return list(_paginate(client, path, "meets"))


def fetch_propose_bills(term: int, name: str) -> list[dict]:
    with httpx.Client() as client:
        path = f"/legislators/{term}/{quote(name)}/propose_bills"
        return list(_paginate(client, path, "bills"))


def fetch_cosign_bills(term: int, name: str) -> list[dict]:
    with httpx.Client() as client:
        path = f"/legislators/{term}/{quote(name)}/cosign_bills"
        return list(_paginate(client, path, "bills"))


def fetch_interpellations(term: int, name: str) -> list[dict]:
    with httpx.Client() as client:
        path = f"/legislators/{term}/{quote(name)}/interpellations"
        return list(_paginate(client, path, "interpellations"))


def fetch_ivods(term: int, name: str) -> list[dict]:
    """Use /v2/ivods?屆=...&委員名稱=..."""
    with httpx.Client() as client:
        page = 1
        out: list[dict] = []
        while True:
            params = {
                "屆": term,
                "委員名稱": name,
                "page": page,
                "limit": PAGE_LIMIT,
            }
            data = _get(client, "/ivods", params=params)
            items = data.get("ivods", [])
            out.extend(items)
            total_page = data.get("total_page", 1) or 1
            if page >= total_page or not items:
                break
            page += 1
            time.sleep(0.2)
        return out
