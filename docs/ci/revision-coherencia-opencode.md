# Revisiones de PRs con opencode v2 en GitHub Actions

Guía para configurar las dos revisiones automáticas de PRs que usan **opencode v2** (sin la action oficial ni la GitHub App):

| Workflow / job | Qué hace |
| --- | --- |
| `docs-consistency` en [`ci.yml`](../../.github/workflows/ci.yml) | Compara los cambios con la documentación del proyecto (`AGENTS.md`, `README.md` y `docs/`) y, si encuentra incoherencias, publica un aviso en la PR. |
| [`opencode-code-review.yml`](../../.github/workflows/opencode-code-review.yml) | Revisa la PR (bugs, arquitectura, tests, seguridad, OpenAPI) y publica la revisión como comentario. |

Ninguna de las dos **bloquea el merge**. Las menciones `/oc` (`opencode.yml`) siguen en v1 con la GitHub App: ver [opencode-github-app.md](opencode-github-app.md).

## Cómo funciona (revisión de coherencia)

1. Al abrirse o actualizarse una PR (que no sea borrador ni venga de un fork), se descarga el binario de **opencode v2** desde las releases de GitHub.
2. Se calcula el diff contra la rama base (`git diff origin/<base>...HEAD`) y se lanza `opencode run` con el agente de solo lectura `ci-revisor`, adjuntando el diff.
3. La respuesta del modelo (salida estándar) se guarda como informe. Su primera línea es `RESULTADO: CONSISTENTE` o `RESULTADO: INCONSISTENTE`.
4. Un paso de shell publica el informe como comentario en la PR, o actualiza el comentario anterior en vez de crear otro:
   - `INCONSISTENTE`: publica o actualiza el aviso ⚠️.
   - `CONSISTENTE` y ya había un aviso: lo marca como resuelto ✅.
   - `CONSISTENTE` sin aviso previo: no publica nada.

> **¿Por qué no se usa la action `anomalyco/opencode/github`?** La action solo instala opencode **v1**, y v1 no tiene el subcomando `github` de v2. Además, v1 no entiende el formato de permisos V2 (`"permissions": [...]`). Este job no necesita la integración con GitHub de la action (el comentario lo publica el propio workflow), así que basta con instalar el binario y usar `opencode run`.

## Requisitos

- Una cuenta en [OpenCode Console](https://opencode.ai/console) con acceso al workspace.
- Permisos de administración en el repositorio de GitHub (para crear secretos).
- No hace falta instalar la GitHub App `opencode-agent`.

## Paso a paso

### 1. Crear la API key en OpenCode Console

1. Entra en <https://opencode.ai/console>.
2. Abre **Account** en el menú de la cuenta y, en **Personal API keys**, pulsa **Add API key**.
3. Rellena el formulario:
   - **Workspace**: el del equipo (p. ej. `PRONOIDE FORMACION SL`).
   - **Key name**: un nombre que la identifique, p. ej. `GitHub Actions <repo>`.
   - **Expiration**: p. ej. `90 days`. Cuando caduque, el job fallará y habrá que repetir los pasos 1 y 2.
   - **Permissions**: **Custom**, con **Models › Request** y todo lo demás en **None**. Así la key solo puede llamar a modelos.
4. Pulsa **Create** y **copia la key** (`oc_sk_...`). Solo se muestra una vez.

> Una key personal cuenta como uso tuyo. En proyectos compartidos es mejor una cuenta de servicio: **Settings › Service accounts › Add Service Account › Add API Key**, con los mismos permisos. Solo pueden crearla owners y admins.

### 2. Guardar la key como secreto del repositorio

1. En GitHub, abre el repositorio y entra en **Settings › Secrets and variables › Actions**.
2. Pulsa **New repository secret**, o edita el existente con el lápiz.
3. **Name**: `OPENCODE_API_KEY`. **Secret**: la key, sin espacios ni saltos de línea al final.
4. Pulsa **Add secret** o **Update secret**.

### 3. Configurar opencode en el repositorio

En `.opencode/` tiene que haber:

- **`.opencode/opencode.json`** con los permisos en formato **V1** (`"permission": {...}`). opencode v2 lo acepta y lo convierte a sus reglas, y es el único formato que entienden los workflows que siguen usando la action (v1). No uses `"permissions": [...]` (formato V2): hace fallar a v1 con `V2 permissions are not supported by OpenCode V1`.

  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "permission": {
      "bash": { "*": "allow", "git push*": "deny", "git * push*": "deny" },
      "edit": { "*": "allow", ".github/**": "deny" }
    }
  }
  ```

- **`.opencode/agents/ci-revisor.md`**, el agente de solo lectura que usa el job. Deniega todo salvo leer, buscar y los comandos `git diff`/`log`/`show`/`status`. Tiene `steps: 30` porque con menos pasos no le da tiempo a terminar el informe.

  ```yaml
  ---
  description: Revisa el código en el pipeline sin modificar nada
  mode: primary
  steps: 30
  permission:
    "*": deny
    external_directory: deny
    read: allow
    glob: allow
    grep: allow
    list: allow
    bash:
      "*": deny
      "git diff *": allow
      "git log *": allow
      "git show *": allow
      "git status*": allow
  ---
  ```

  El cuerpo del agente le indica que ejecute los comandos de uno en uno, sin `&&`, `;`, `|` ni `cd`. Si los encadena, el permiso los rechaza (`Permission denied: shell`).

### 4. Añadir el job al workflow

El job `docs-consistency` de `ci.yml` tiene estas piezas:

| Elemento | Para qué |
| --- | --- |
| `if: draft == false && head.repo == github.repository` | Los secretos no llegan a las PRs de forks y los borradores no se revisan. |
| `permissions: contents: read, pull-requests: write` | Leer el repo y publicar el comentario. No hace falta `id-token: write`. |
| `env.OPENCODE_VERSION` | Versión de opencode v2 fijada, para que no cambie sin avisar. |
| `actions/checkout` con `fetch-depth: 0` | Hace falta el historial completo para el diff contra la rama base. |
| Paso **Instalar opencode v2** | Descarga `opencode-linux-x64.tar.gz` de la release y lo añade al `PATH`. |
| Paso **Revisar coherencia** | `OPENCODE_API_KEY` sale del secreto. El prompt va en una variable de entorno y no dentro del script, porque incluye el título de la PR (texto que escribe quien la abre). |
| Paso **Publicar o actualizar comentario** | Usa `GITHUB_TOKEN` y un marcador HTML (`<!-- resttek-docs-consistency -->`) para reutilizar el mismo comentario. |

La instalación y la ejecución quedan así:

```yaml
- name: Instalar opencode v2
  run: |
    set -euo pipefail
    mkdir -p "$RUNNER_TEMP/opencode"
    curl -fsSL "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
      | tar -xz -C "$RUNNER_TEMP/opencode"
    echo "$RUNNER_TEMP/opencode" >> "$GITHUB_PATH"

- name: Revisar coherencia con opencode
  env:
    OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
    MODEL: opencode/deepseek-v4.1-flash-free
    BASE_REF: ${{ github.event.pull_request.base.ref }}
    PROMPT: |
      ...instrucciones de la revisión...
  run: |
    set -euo pipefail
    git diff "origin/${BASE_REF}...HEAD" > "$RUNNER_TEMP/pr.diff"
    opencode run --standalone --archived --auto --agent ci-revisor --model "$MODEL" \
      --file "$RUNNER_TEMP/pr.diff" "$PROMPT" > raw-report.md
    sed -n '/^RESULTADO:/,$p' raw-report.md > "$REPORT_FILE"
```

Flags de `opencode run`:

- `--standalone`: arranca un servidor propio, sin depender del servicio en segundo plano.
- `--archived`: la sesión no aparece en el listado de sesiones.
- `--auto`: aprueba automáticamente lo que no esté denegado (en CI nadie puede contestar a una pregunta).
- `--file`: adjunta el diff para que el agente no dependa de ejecutar git.

La salida estándar contiene solo la respuesta final. Los logs y las llamadas a herramientas van a stderr.

### 5. Revisión de código de PRs (`opencode-code-review.yml`)

Usa las mismas piezas que la revisión de coherencia (pasos 1 a 3 y la instalación del paso 4). Cambian el prompt y la publicación:

- **Disparador**: `pull_request` (`opened`, `synchronize`, `ready_for_review`, `reopened`), solo si la PR no viene de un fork.
- **`concurrency`** por número de PR con `cancel-in-progress`: si se sube otro commit, se cancela la revisión anterior.
- **`timeout-minutes: 15`** y `permissions: contents: read, pull-requests: write`. No necesita `id-token: write` ni la GitHub App.
- **Prompt**: bugs y casos límite, arquitectura según `AGENTS.md` y `docs/`, tests que faltan, seguridad y endpoints sin actualizar en `docs/api/*.openapi.yml`. Pide responder solo con la revisión en Markdown, porque se publica tal cual.
- **Ejecución**: igual que la de coherencia (`opencode run ... --agent ci-revisor --file pr.diff`), guardando la salida en `opencode-review.md`. Si sale vacía, el job falla.
- **Comentario**: lleva el marcador `<!-- resttek-opencode-review -->` y, en cada commit nuevo, **se actualiza el mismo comentario** en lugar de crear otro. Aparece como `github-actions[bot]`.

> En una PR grande, el agente puede agotar sus `steps: 30` leyendo ficheros. En ese caso opencode le obliga a dar la respuesta final, así que la revisión se publica igualmente. Si se queda corta, sube `steps` en `ci-revisor.md` (y el `timeout-minutes` si hace falta).

### 6. Probarlo

**En local** (con opencode v2 instalado), desde la raíz del repo:

```bash
git diff origin/main...HEAD > /tmp/pr.diff
opencode run --standalone --archived --auto --agent ci-revisor \
  --model opencode/deepseek-v4.1-flash-free --file /tmp/pr.diff \
  "Revisa si los cambios son coherentes con AGENTS.md y docs/. Empieza por RESULTADO: CONSISTENTE o RESULTADO: INCONSISTENTE."
```

Ojo: en local se usa tu sesión de opencode y no `OPENCODE_API_KEY`.

**En GitHub**: abre o actualiza una PR y comprueba que terminan en verde el job **Coherencia con la documentación (opencode)** (si hay incoherencias, aparece su aviso en la PR) y el workflow **opencode code review** (siempre publica o actualiza su comentario).

## Problemas frecuentes

| Error en el log | Causa | Solución |
| --- | --- | --- |
| `V2 permissions are not supported by OpenCode V1` | `opencode.json` o un agente usa `"permissions": [...]` (V2) y lo carga opencode v1 (la action). | Pasar a `"permission": {...}` (V1). |
| `Reconnect OpenCode Console to continue.` | La API rechaza la key (HTTP 401): caducada, revocada o mal copiada. | Crear una key nueva (paso 1) y actualizar el secreto (paso 2). |
| `Permission denied: shell` y no sale informe | El agente ha encadenado comandos o ha usado uno no permitido, y se ha quedado sin pasos. | Revisar las reglas y las instrucciones de `ci-revisor.md` o subir `steps`. |
| `::warning::opencode no ha devuelto un informe con el formato esperado` | La respuesta no contiene ninguna línea `RESULTADO: ...`. | Revisar el log del paso. No se publica comentario y el job no falla. |
| `invalid_grant` al intercambiar el token OIDC | Se intentó iniciar sesión en Console por OIDC sin la regla de confianza adecuada. | No usar OIDC; usar la API key del secreto. |

## Mantenimiento

- **Renovar la key** antes de que caduque (pasos 1 y 2).
- **Actualizar opencode**: cambiar `OPENCODE_VERSION` en `ci.yml` y en `opencode-code-review.yml` por una release `v2.x` publicada en <https://github.com/anomalyco/opencode/releases>.
- **Cambiar de modelo**: editar `MODEL`. Los modelos disponibles salen en `opencode models` o en <https://opencode.ai/zen/v1/models>.
