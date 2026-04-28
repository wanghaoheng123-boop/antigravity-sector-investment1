<!-- AGENT HOOK v1 -->
# Workspace Agent Hook

Read this file and `AGENTS.md` before any action.

## Boot sequence
1. Read `workspace/SESSION_STATE.json`
2. Read `workspace/MEMORY_LOG.md`
3. Read `workspace/USAGE_MONITOR.json`

## Core rules
- Never write secrets inline.
- Never edit `.env` files or secrets directories.
- Keep progress and verification evidence in `workspace/` files.
- Do not stop at partial implementation when an end-to-end request is provided.
