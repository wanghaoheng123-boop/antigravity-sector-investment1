<!-- AGENT HOOK v1 -->
## Agent Hook (Claude Code)
Read AGENT.md fully before any action. All six rules are defined there.
Hooks directory for enforcement: .claude/hooks/ (PreToolUse, PostToolUse, Stop).
Use Stop hook to block task completion unless VERIFY A-F all pass.
Use PreToolUse to block writes to *.env, secrets/, *credential*, *token* paths.
