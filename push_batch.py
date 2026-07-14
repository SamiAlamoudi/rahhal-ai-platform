#!/usr/bin/env python3
"""Push multiple files to a GitHub repo in a single commit.

This replicates the behavior of the GitHub MCP `push_files` tool:
1. Get the current commit SHA of the target branch.
2. Create a blob for each file.
3. Build a new tree (based on the branch's base tree) referencing all blobs.
4. Create a commit with the new tree, parent = current commit SHA.
5. Update the branch ref to point to the new commit.
"""

import json
import os
import sys
import urllib.request
import urllib.error

OWNER = "SamiAlamudi"
REPO = "rahhal-ai-platform"
BRANCH = "main"
MESSAGE = "Add project files batch 1"
BATCH_FILE = "/tmp/cc-agent/68821807/project/batch_1_work.json"

TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
if not TOKEN:
    print("ERROR: No GITHUB_TOKEN or GH_TOKEN environment variable found.", file=sys.stderr)
    sys.exit(1)

API = "https://api.github.com"


def api_call(method, path, body=None):
    url = f"{API}/repos/{OWNER}/{REPO}/{path}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        print(f"HTTP {e.code} on {method} {path}", file=sys.stderr)
        print(raw[:2000], file=sys.stderr)
        sys.exit(2)


def main():
    # Load batch
    with open(BATCH_FILE, "r", encoding="utf-8") as f:
        files = json.load(f)
    print(f"Loaded {len(files)} files from batch.")

    # 1. Get current branch ref -> latest commit SHA
    status, ref = api_call("GET", f"git/refs/heads/{BRANCH}")
    parent_sha = ref["object"]["sha"]
    print(f"Branch '{BRANCH}' head commit: {parent_sha}")

    # Get the base tree of that commit
    status, commit_obj = api_call("GET", f"git/commits/{parent_sha}")
    base_tree = commit_obj["tree"]["sha"]
    print(f"Base tree: {base_tree}")

    # 2. Create a blob for each file
    tree_entries = []
    for obj in files:
        path = obj["path"]
        content = obj["content"]
        status, blob = api_call("POST", "git/blobs", {"content": content, "encoding": "utf-8"})
        blob_sha = blob["sha"]
        tree_entries.append({
            "path": path,
            "mode": "100644",
            "type": "blob",
            "sha": blob_sha,
        })
        print(f"  Created blob for {path} -> {blob_sha[:12]}...")

    # 3. Create the new tree
    status, tree = api_call("POST", "git/trees", {
        "base_tree": base_tree,
        "tree": tree_entries,
    })
    new_tree_sha = tree["sha"]
    print(f"New tree created: {new_tree_sha}")

    # 4. Create the commit
    status, new_commit = api_call("POST", "git/commits", {
        "message": MESSAGE,
        "tree": new_tree_sha,
        "parents": [parent_sha],
    })
    new_commit_sha = new_commit["sha"]
    print(f"New commit created: {new_commit_sha}")
    print(f"  Author: {new_commit.get('author', {})}")
    print(f"  HTML URL: {new_commit.get('html_url')}")

    # 5. Update the branch ref
    status, updated_ref = api_call("PATCH", f"git/refs/heads/{BRANCH}", {
        "sha": new_commit_sha,
        "force": False,
    })
    print(f"Branch '{BRANCH}' updated to {updated_ref['object']['sha']}")

    # Summary (mimic push_files result shape)
    result = {
        "owner": OWNER,
        "repo": REPO,
        "branch": BRANCH,
        "commit_sha": new_commit_sha,
        "commit_url": new_commit.get("html_url"),
        "message": MESSAGE,
        "files_pushed": len(files),
        "files": [obj["path"] for obj in files],
    }
    print("\n===== push_files RESULT =====")
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
