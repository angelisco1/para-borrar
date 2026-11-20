---
name: update-openapi
description: Actualiza (o genera si no existe) la documentación OpenAPI de la API de Resttek en `docs/api/` y construye el HTML con Redocly. Úsala siempre que se cree, modifique o elimine un endpoint, un DTO, un código de respuesta o la autenticación de la API (`packages/api`), y cuando el usuario pida documentar la API.
argument-hint: "[recurso(s) afectado(s), ej. dishes orders] (opcional: por defecto se deduce del diff)"
---

# update-openapi

Mantiene sincronizados el código de `packages/api` y los specs OpenAPI de `docs/api/`, y genera el HTML con **Redocly** mediante el script de esta skill.

- Specs: `docs/api/<recurso>.openapi.yml` (un fichero por recurso, OpenAPI 3.1, **en español**).
- HTML generado: `docs/api/html/<recurso>.html`.
- Script: [scripts/generate-openapi-docs.sh](scripts/generate-openapi-docs.sh) (lint + `build-docs` con `npx @redocly/cli`, requiere Node 22+ y red la primera vez).

## Cuándo se ejecuta

Cada vez que cambie la API: rutas (`routes/`, `contexts/*/infrastructure/http/`), controladores, modelos/DTOs, validaciones, errores de dominio, roles (`authorize`) o códigos de estado. `implement-plan` la invoca antes de dejar la PR lista si el diff toca `packages/api`.

## Proceso

### 1. Averigua qué ha cambiado

- Con rama de trabajo: `git diff <base>...HEAD --name-only -- packages/api/src` (base = `development`, o `main` si no existe). Sin cambios en la API, **para**: no hay nada que documentar.
- Si el usuario pasa recursos como argumento, úsalos en lugar de deducirlos.
- Mapea cada fichero cambiado a su recurso (`dish`, `ingredient`, `restaurant`, `order`, `employee`/`auth`) y a los endpoints afectados.

### 2. Detecta si ya hay documentación

Lista `docs/api/*.openapi.yml` y compáralos con las rutas reales (`grep` de `router.get|post|put|patch|delete` en `routes/` y en `contexts/employee/infrastructure/http/`; el prefijo es `/api/v1`).

- **Hay spec del recurso afectado** → actualízalo (paso 3).
- **No hay spec de ese recurso** → créalo.
- **No hay ningún spec en `docs/api/`** → aprovecha el cambio para generar **la documentación completa de toda la API**, un fichero por recurso: `auth`, `employees`, `restaurants`, `dishes`, `ingredients`, `orders`. Hazlo recurso a recurso y no inventes: documenta solo lo que hace el código.

Usa como modelo de estructura y tono los specs existentes (p. ej. `docs/api/dishes.openapi.yml`): `info.description` con autenticación, formato de errores y "consideraciones generales (comportamiento real del código)", `servers` con `http://localhost:3000/api/v1`, `tags` y `components` reutilizables.

### 3. Escribe o actualiza el spec

Fuente de verdad: **el código**, no la documentación previa. Lee rutas → controladores → servicios/modelos para cada endpoint y refleja:

- Método, ruta (con el prefijo `/api/v1` en `servers`, no repetido en cada path), `operationId`, `tags`, `summary`.
- Seguridad: `bearerAuth` en los privados con los **roles** exigidos por `authorize`; sin seguridad en las rutas `*.public.routes.ts`.
- Parámetros de ruta/query y `requestBody` con su schema (campos obligatorios, tipos, normalización de `normalizeX()`).
- Respuestas con **todos** los códigos reales (200/201/204, 400, 401, 403, 404, 500) y sus schemas de error (`AppError` → `{ error, message }`; middlewares de auth → `{ error }`).
- Ejemplos realistas en request y response.
- Si hay comportamientos sorprendentes del código (validaciones ausentes, errores 500 por FK…), recógelos en "Consideraciones generales" tal cual son, sin corregirlos ni maquillarlos.

Al actualizar un spec existente, cambia solo lo afectado: no reescribas ni reordenes el resto. Eleva `info.version` (semver: *major* si hay cambio incompatible, *minor* si añade, *patch* si corrige documentación).

### 4. Genera la documentación con Redocly

```bash
.claude/skills/update-openapi/scripts/generate-openapi-docs.sh                 # todos los specs de docs/api
.claude/skills/update-openapi/scripts/generate-openapi-docs.sh docs/api/dishes.openapi.yml   # solo uno
```

El script hace `redocly lint` y `redocly build-docs` de cada spec y deja el HTML en `docs/api/html/`. Opciones `-d <dir_specs>` y `-o <dir_html>`; versión de Redocly con `REDOCLY_VERSION` (por defecto 2).

- Si el **lint da errores** (exit 1), corrige el spec y repite. Los *warnings* `info-license` y `no-server-example.com` son esperables y se ignoran; el resto de warnings, corrígelos si son razonables.
- No edites a mano los HTML: se regeneran siempre con el script.

### 5. Commit

Un único commit `docs(api): ...` (formato Conventional Commits de [.claude/commands/commit.md](../../commands/commit.md), descripción en español, minúsculas, imperativo, sin punto final) con los specs y el HTML, añadiendo solo esos archivos con `git add docs/api` (nunca `git add -A`) y el pie de co-autoría de la sesión. Si la skill la invoca `implement-plan`, hazlo en el worktree principal; si la usa el usuario directamente, sobre la rama actual.

### 6. Informa

Resume: specs creados/actualizados (y por qué endpoints), resultado del lint y ruta del HTML generado.

## Restricciones

- No modifiques código de `packages/api` desde esta skill; si la documentación revela un bug, anótalo en las consideraciones del spec y avisa al usuario.
- No hagas `git push` ni abras PR (de eso se encarga `implement-plan` o el usuario).
- No uses `--amend`, `--no-verify` ni `git reset --hard`.
