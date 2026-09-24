"""Verify asynchronous worker acceptance without downloading media."""

import argparse
import json
import os
import time
from urllib.request import Request, urlopen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Web/proxy base URL for an isolated smoke stack")
    arguments = parser.parse_args()
    base_url = arguments.url.rstrip("/")
    token = os.environ.get("CVN_AUTH_TOKEN", "")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(
        f"{base_url}/api/jobs/downloads/worker/start",
        data=json.dumps({"dry_run": True, "limit": 1}).encode(),
        headers=headers,
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        if response.status != 202:
            raise RuntimeError(f"Expected HTTP 202, received {response.status}")
        accepted = json.load(response)

    for _attempt in range(20):
        request = Request(
            f"{base_url}/api/jobs/downloads/worker/summary?run_id={accepted['id']}",
            headers=headers,
        )
        with urlopen(request, timeout=10) as response:
            summary = json.load(response)
        run = summary["run"]
        if run is not None and run["completed_at"] is not None:
            if not run["dry_run"] or run["started_count"] != 0 or run["status"] not in {"dry_run", "locked"}:
                raise RuntimeError(f"Unexpected dry-run outcome: {run['status']}")
            print(f"ok: HTTP 202 -> persisted run {run['id']} -> {run['status']}; no media transferred")
            return
        time.sleep(0.25)
    raise RuntimeError("Accepted worker pass did not reach a persisted terminal state")


if __name__ == "__main__":
    main()
