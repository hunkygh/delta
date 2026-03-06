# API Contracts

## POST /api/chat-proposal

Input:

```json
{ "text": "Block gym every weekday at 6am" }
```

Output: `PlanObject`

## POST /api/plan-execute

Input: `PlanObject`

Output: `ExecutionResult`
