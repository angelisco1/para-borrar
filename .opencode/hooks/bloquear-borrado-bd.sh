#!/bin/bash
# PreToolUse (Bash): bloquea comandos que borren la BBDD vendehumos.db
cmd=$(jq -r '.tool_input.command // empty')

if echo "$cmd" | grep -q 'vendehumos\.db' && echo "$cmd" | grep -Eq '(^|[^a-zA-Z_-])(rm|unlink|rmdir|trash|shred|truncate|mv|find)([^a-zA-Z_-]|$)|>[[:space:]]*[^ ]*vendehumos\.db'; then
  echo "Bloqueado: no se permite borrar ni modificar destructivamente la BBDD vendehumos.db." >&2
  exit 2
fi
exit 0
