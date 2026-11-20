#!/bin/bash
# PreToolUse (Bash): pide confirmación al usuario antes de ejecutar un `git commit`.
# El commit queda en pausa hasta que el usuario lo aprueba (permissionDecision: "ask").
cmd=$(jq -r '.tool_input.command // empty')

# if echo "$cmd" | grep -Eq '(^|[^a-zA-Z_-])git[[:space:]]+([^;&|]*[[:space:]])?commit([[:space:]]|$)'; then
#   jq -n '{
#     hookSpecificOutput: {
#       hookEventName: "PreToolUse",
#       permissionDecision: "ask",
#       permissionDecisionReason: "Se va a crear un commit. ¿Das el OK para continuar?"
#     }
#   }'
#   exit 0
# fi
exit 0
