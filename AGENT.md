<!-- AGENT HOOK v1 -->
# UNIVERSAL AGENT HOOK v1.0
# Compatible with: Claude Code · Cursor · Windsurf · GitHub Copilot
#                  Codex CLI · Gemini CLI · Any AI agent
# This section was appended non-destructively. Existing content above is unchanged.

## PRIME DIRECTIVE
Read this section fully before any action in this workspace.
These rules apply to every task, every file, every session.

## BOOT SEQUENCE
At the start of every session, before doing anything else:
  1. Read  workspace/SESSION_STATE.json   → current tasks and progress
  2. Read  workspace/MEMORY_LOG.md        → project history and blockers
  3. Read  workspace/USAGE_MONITOR.json   → context window usage status
  If any of these files are missing, create them using the schemas in the APPENDIX below.

## RULE 1 · INSPECT
Before modifying any file, run all inspection steps and log results to
SESSION_STATE.json → "last_inspection":
  INSPECT-1  List workspace/ directory (2 levels deep)
  INSPECT-2  Confirm SESSION_STATE.json is current and not stale
  INSPECT-3  Search all source files: grep -rn "TODO\|FIXME\|BROKEN\|UNTESTED\|HACK"
  INSPECT-4  Confirm every secret the code uses appears in .env.template (names only)
  INSPECT-5  Check MEMORY_LOG.md for any unresolved BLOCKER entries
  INSPECT-6  Confirm last test-run result in SESSION_STATE.json

## RULE 2 · VERIFY
After every change, run all checks. Log PASS/FAIL + timestamp to MEMORY_LOG.md.
A task is NOT done until all six show PASS.
  VERIFY-A  Tests pass on all touched files         (pytest / jest / equivalent)
  VERIFY-B  Type checker passes                      (mypy / tsc / equivalent)
  VERIFY-C  No hardcoded secrets                     (grep -rE "(API_KEY|SECRET|TOKEN)\s*=\s*['\"][^'\"]{8}" src/)
  VERIFY-D  No raw credential strings                (grep -rn "sk-\|Bearer \|password\s*=" src/)
  VERIFY-E  Logic matches ARCHITECTURE.md            (manual review)
  VERIFY-F  No NaN or data leakage in pipelines      (assert / test fixtures)

## RULE 3 · NEVER STOP
Do not stop for any of these. Take the action listed and continue:
  Test fails              → fix it, continue
  Import or dep error     → resolve it, continue
  Unexpected result       → investigate, log finding, continue
  Uncertainty             → log assumption to MEMORY_LOG.md, continue
  Context window > 80%    → write CHECKPOINT to SESSION_STATE.json, continue
  Context window > 90%    → write HAND-OFF to MEMORY_LOG.md, finish current step
  Blocker                 → log it, work around it or move to next task, continue
  Task is DONE only when: all tasks in SESSION_STATE.json show "status":"DONE"
  AND VERIFY A-F all show PASS for that task.

## RULE 4 · SECRET SECURITY — ZERO TOLERANCE
  NEVER hardcode any key, token, password, or credential in source code.
  NEVER write a secret value to any log, memory, or state file.
  NEVER print or echo the contents of .env or any secrets folder.
  ALWAYS load secrets via:  os.environ.get("VAR")  or  dotenv / equivalent.
  ALWAYS add new secret variable names (only names, never values) to .env.template.
  NEVER commit .env — only commit .env.template.
  If a hardcoded secret is found:
    1. Stop editing that file.
    2. Log incident to MEMORY_LOG.md under "## SECURITY ALERTS".
    3. Replace the hardcoded value with os.environ.get("VARIABLE_NAME").
    4. Add the variable name to .env.template with value "your_value_here".
    5. Resume work.

## RULE 5 · MEMORY — update continuously
  workspace/SESSION_STATE.json   → update every task step
  workspace/MEMORY_LOG.md        → update every session; log every VERIFY result
  workspace/USAGE_MONITOR.json   → update every 10 agent actions
  Check USAGE_MONITOR.json every 10 actions.
  Thresholds: 60% context used = WARNING, 80% = write CHECKPOINT, 90% = write HAND-OFF.

  CHECKPOINT format (write to SESSION_STATE.json → "checkpoint" key at >80%):
  {
    "timestamp": "<ISO-8601>",
    "current_file": "<absolute path>",
    "current_line": <N>,
    "action_in_progress": "<what was being done>",
    "completed_this_session": ["<item>"],
    "remaining_tasks": ["<item>"],
    "verify_status": {"A":"PASS","B":"PASS","C":"FAIL","D":"PASS","E":"PASS","F":"PASS"},
    "blockers": [],
    "next_agent_instruction": "<exact first instruction for the next agent>"
  }

  HAND-OFF format (append to MEMORY_LOG.md at >90%):
  ## HAND-OFF [<ISO-8601>] — <agent model name>
  **Completed:** <bullet list>
  **Last file:** <path> line <N>
  **Action was:** <plain English>
  **Remaining:** <bullet list>
  **Verify:** A=? B=? C=? D=? E=? F=?
  **Blockers:** <none or description>
  **Next agent must:** <exact first instruction>
  ---

## RULE 6 · PORTABILITY
  All state, logs, specs, and configs must be inside workspace/.
  No state may exist only in the agent's context window.
  Any agent opening this workspace must be able to resume with zero human handoff.
  The workspace/ folder is the single source of truth for all agents on all platforms.

## RULE 7 · DEEPSEEK-FIRST ANALYSIS POLICY
  For AI-assisted analysis and optimization planning, prefer MCP server `user-deepseek`.
  Default analysis model: `deepseek-v4-pro` (use `deepseek-v4-flash` only for cheap drafts).
  Before major strategy/config changes, run a DeepSeek review pass and record conclusions in workspace/MEMORY_LOG.md.
  If DeepSeek is unavailable, log the blocker and continue with local deterministic checks.

## APPENDIX — schemas for workspace files

### workspace/SESSION_STATE.json
{
  "schema_version": "1.0",
  "project": "<project name>",
  "created": "<ISO-8601>",
  "last_updated": "<ISO-8601>",
  "active_agent": "<model name>",
  "last_inspection": { "timestamp": null, "results": {} },
  "tasks": [
    {
      "id": "TASK-001",
      "title": "<title>",
      "status": "PENDING",
      "priority": "HIGH",
      "files_touched": [],
      "verify_status": {"A":null,"B":null,"C":null,"D":null,"E":null,"F":null},
      "notes": ""
    }
  ],
  "blockers": [],
  "checkpoint": null
}

### workspace/USAGE_MONITOR.json
{
  "schema_version": "1.0",
  "action_count": 0,
  "thresholds": {"warning":0.60,"checkpoint":0.80,"handoff":0.90},
  "events": [
    {"timestamp":"<ISO-8601>","level":"INFO","context_pct":0.0,"message":"Initialised"}
  ]
}

### workspace/MEMORY_LOG.md
# Project Memory Log
Created: <date>

## SECURITY ALERTS
_None_

## Verification Log
| Timestamp | Task | A | B | C | D | E | F | Notes |
|---|---|---|---|---|---|---|---|---|

## Session History
### Session 1 — <date> — <agent>
Goal: <what was attempted>
Done: <what was completed>
Verify: A=? B=? C=? D=? E=? F=?
Blockers: none
---
