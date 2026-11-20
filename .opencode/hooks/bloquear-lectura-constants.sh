#!/bin/bash
# PreToolUse (Read|Grep|Glob|Bash): bloquea leer el archivo CONSTANTS.js
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name')

case "$tool" in
  Read) target=$(echo "$input" | jq -r '.tool_input.file_path // empty') ;;
  Grep|Glob) target=$(echo "$input" | jq -r '[.tool_input.path, .tool_input.glob, .tool_input.pattern] | map(select(. != null)) | join(" ")') ;;
  Bash) target=$(echo "$input" | jq -r '.tool_input.command // empty') ;;
  *) exit 0 ;;
esac

if echo "$target" | grep -q 'CONSTANTS\.js'; then
  echo "Bloqueado: no se permite leer el archivo CONSTANTS.js." >&2
  exit 2
fi
exit 0
