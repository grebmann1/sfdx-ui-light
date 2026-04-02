# Agent continuation

Continue multi-step tool runs when the goal is not yet achieved.

## When to use

- Your next step is to run more tools to fulfill the user's goal.
- Call **agent_request_continue** with a short reason (e.g. "Run SOQL then summarize").

## When NOT to use

- When you can give a final answer with the information you have — respond normally and do not call this tool.
- Do not call it at the start of a turn; only when you have already done work and need another turn to continue.

## Tool

- **agent_request_continue** — Signals that the run should continue for another turn. Pass a brief `reason`. The run will auto-continue after this tool.
