#!/usr/bin/env bash
# Valida (lint) y genera la documentación HTML de los OpenAPI del proyecto con Redocly.
#
# Uso:
#   .claude/skills/update-openapi/scripts/generate-openapi-docs.sh [-d <dir_specs>] [-o <dir_html>] [fichero.openapi.yml ...]
#
#   -d  Carpeta con los specs (por defecto: docs/api, en la raíz del repo)
#   -o  Carpeta de salida del HTML (por defecto: <dir_specs>/html)
#   Si se pasan ficheros, solo se procesan esos; si no, todos los `*.openapi.yml` de la carpeta.
#
# Variables de entorno:
#   REDOCLY_VERSION  Versión de @redocly/cli a usar con npx (por defecto: 2)
#
# Códigos de salida: 0 todo OK · 1 el lint ha encontrado errores · 2 uso incorrecto / sin specs

set -euo pipefail

REDOCLY_VERSION="${REDOCLY_VERSION:-2}"
REDOCLY="npx --yes @redocly/cli@${REDOCLY_VERSION}"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
specs_dir="${repo_root}/docs/api"
out_dir=""

while getopts "d:o:h" opt; do
  case "$opt" in
    d) specs_dir="$OPTARG" ;;
    o) out_dir="$OPTARG" ;;
    h) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Opción no válida. Usa -h para ver la ayuda." >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

out_dir="${out_dir:-${specs_dir}/html}"

if [ "$#" -gt 0 ]; then
  specs=("$@")
else
  shopt -s nullglob
  specs=("${specs_dir}"/*.openapi.yml "${specs_dir}"/*.openapi.yaml)
  shopt -u nullglob
fi

if [ "${#specs[@]}" -eq 0 ]; then
  echo "No hay specs OpenAPI en ${specs_dir}. Genera primero los *.openapi.yml (ver SKILL.md)." >&2
  exit 2
fi

mkdir -p "$out_dir"
failed=0

for spec in "${specs[@]}"; do
  nombre="$(basename "$spec")"
  nombre="${nombre%.openapi.yml}"
  nombre="${nombre%.openapi.yaml}"

  echo "▶ ${nombre}: lint"
  # Sin redocly.yaml se aplica la configuración "recommended" (los warnings de info-license y localhost son esperables)
  if ! $REDOCLY lint "$spec" --format=stylish; then
    echo "✖ ${nombre}: el lint ha fallado" >&2
    failed=1
    continue
  fi

  echo "▶ ${nombre}: build-docs → ${out_dir}/${nombre}.html"
  $REDOCLY build-docs "$spec" --output "${out_dir}/${nombre}.html"
done

if [ "$failed" -ne 0 ]; then
  echo "Hay specs con errores de lint: corrígelos y vuelve a ejecutar." >&2
  exit 1
fi

echo "✔ Documentación generada en ${out_dir}"
