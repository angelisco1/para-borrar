# opencode en GitHub: menciones con `/oc` (GitHub App, opencode v1)

Guía para configurar [`opencode.yml`](../../.github/workflows/opencode.yml), el único workflow que sigue usando la action oficial `anomalyco/opencode/github`, y por tanto **opencode v1**:

| Cuándo se ejecuta | Qué hace |
| --- | --- |
| Al escribir `/opencode` o `/oc` en un comentario de issue o PR, o en el título o cuerpo de una issue | Atiende lo que se le pide: responder, crear una rama o abrir una PR. |

La revisión de coherencia (`ci.yml`) y la revisión de código de PRs (`opencode-code-review.yml`) usan **opencode v2** sin la action y sin la app. Están documentadas en [revision-coherencia-opencode.md](revision-coherencia-opencode.md).

> **¿Por qué este sigue en v1?** opencode v2 no tiene integración con GitHub (no existe `opencode github run`). Para hacerlo con v2 habría que programar a mano la creación de ramas, commits, PRs y respuestas, y las PRs creadas con `GITHUB_TOKEN` no lanzarían el CI. Se mantendrá en v1 hasta que haya una action oficial para v2. Mientras tanto, `.opencode/` tiene que estar en formato de configuración **V1**.

## Las dos credenciales

Este workflow necesita **dos credenciales distintas**:

| Credencial | Para qué | Dónde se configura |
| --- | --- | --- |
| `OPENCODE_API_KEY` | Que opencode pueda llamar **al modelo**. | Secreto del repositorio (paso 2). |
| GitHub App `opencode-agent` | Que opencode pueda actuar **en GitHub**: comentar, crear ramas, hacer push y abrir PRs. | Instalación de la app en el repositorio (paso 1). |

La action pide a GitHub un token OIDC (por eso los jobs tienen `id-token: write`) y lo cambia por un token temporal de la app. Lo que hace opencode aparece como **`opencode-agent[bot]`** y, a diferencia de lo que se hace con `GITHUB_TOKEN`, **sí lanza otros workflows**. Por ejemplo, si opencode abre una PR, se ejecuta el CI sobre ella.

> Alternativa sin app: `use_github_token: true` con `GITHUB_TOKEN` y permisos `contents/pull-requests/issues: write`. Funciona, pero lo hecho por opencode aparece como `github-actions[bot]` y **no lanza otros workflows** (las PRs que abra no pasarán el CI automáticamente). En este repositorio se usa la app.

## Paso a paso

### 1. Instalar la GitHub App

1. Abre <https://github.com/apps/opencode-agent> y pulsa **Install** (o **Configure** si ya está instalada en otra cuenta).
2. Elige la cuenta u organización dueña del repositorio.
3. En **Repository access**, marca **Only select repositories** y añade el repositorio.
4. Revisa los permisos (contenido, issues y pull requests) y pulsa **Install** o **Save**.

Si la app no está instalada, el job falla en segundos con:

```text
App token exchange failed: 404 Not Found - The OpenCode GitHub App is not installed on <owner>/<repo>.
```

### 2. Crear la API key y guardarla como secreto

Es la misma key que usan las revisiones de `ci.yml` y `opencode-code-review.yml`. Si ya está creada, sáltate este paso.

1. En <https://opencode.ai/console>, abre **Account › Personal API keys › Add API key**.
2. Elige el workspace, un nombre y una caducidad. En **Permissions** elige **Custom**, con **Models › Request** y todo lo demás en **None**. Pulsa **Create** y copia la key (`oc_sk_...`).
3. En GitHub, en **Settings › Secrets and variables › Actions**, crea o actualiza el secreto **`OPENCODE_API_KEY`** con la key, sin espacios ni saltos de línea.

Con una key inválida o caducada, el modelo falla con un error 401 o de autenticación. En opencode v2 el mensaje es `Reconnect OpenCode Console to continue.`

### 3. Configurar opencode en el repositorio

La action instala **opencode v1**, así que la configuración tiene que estar en formato **V1** (`"permission": {...}`). Con el formato V2 (`"permissions": [...]`), el job falla con `V2 permissions are not supported by OpenCode V1`.

**`.opencode/opencode.json`**, con los permisos del agente por defecto (`build`), que es el que usa `opencode.yml`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": { "*": "allow", "git push*": "deny", "git * push*": "deny" },
    "edit": { "*": "allow", ".github/**": "deny" }
  }
}
```

- Con `git push*` y `git * push*` se bloquean `git push`, `git push origin main` y variantes como `git -C . push`. La última regla que coincide es la que se aplica, por eso los `deny` van después de `"*": "allow"`. Efecto secundario: también se bloquea cualquier comando git que contenga ` push` en sus argumentos (p. ej. `git commit -m "push fix"`).
- Con `.github/**` opencode no puede modificar los workflows.
- La action publica los cambios con su propio mecanismo (rama y PR), no con un `git push` del agente.

Los agentes de `.opencode/agents/` (p. ej. `ci-revisor.md`) también los carga v1 al arrancar, así que también tienen que estar en formato V1.

### 4. Workflow de menciones (`opencode.yml`)

Tiene dos jobs:

- **`opencode`**: comentarios en issues o PRs (`issue_comment`) y comentarios de revisión de código (`pull_request_review_comment`) que contienen `/opencode` o `/oc`. Sin `prompt`: opencode ejecuta lo que pide el comentario.
- **`opencode-issues`**: issues abiertas o asignadas con `/opencode` o `/oc` en el título o el cuerpo. Aquí el `prompt` es obligatorio porque no hay comentario del que sacarlo.

**Solo el propietario del repositorio puede lanzarlos:**

```yaml
opencode:
  if: |
    github.event.comment.author_association == 'OWNER' && (
    (github.event_name == 'issue_comment' && (contains(github.event.comment.body, '/opencode') || contains(github.event.comment.body, '/oc'))) ||
    (github.event_name == 'pull_request_review_comment' && (contains(github.event.comment.body, '/opencode') || contains(github.event.comment.body, '/oc'))))

opencode-issues:
  if: |
    github.event_name == 'issues' &&
    github.event.issue.author_association == 'OWNER' && (
      contains(github.event.issue.title, '/opencode') || ...
    )
```

> **Por qué es obligatorio:** los eventos `issue_comment` e `issues` se ejecutan en el repositorio base y **reciben los secretos aunque el comentario venga de alguien externo**, incluso en PRs de forks. Sin este filtro, cualquiera podría escribir `/oc ...` y hacer que opencode (con shell) ejecute comandos o intente sacar la `OPENCODE_API_KEY`. Si más personas tienen que poder usarlo, añade sus roles: `contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`.

**Tampoco se ejecuta sobre PRs de forks.** En una PR, opencode trabaja con el código de la PR y carga su `.opencode/` (permisos y agentes). Una PR de un fork podría abrirse todos los permisos y, en cuanto el propietario comentara `/oc`, ejecutarse con los secretos y el token de la app. El primer paso del job (**Rechazar PRs de forks**) consulta la PR con la API (el evento `issue_comment` no trae el repositorio de origen) y hace fallar el job si viene de un fork, antes del checkout. Necesita `pull-requests: read`.

El resto de la configuración:

- `permissions` del `GITHUB_TOKEN` del job: `id-token: write` (OIDC → token de la app), `contents: read` (checkout), `actions: read` (leer los resultados del CI de la PR), `pull-requests: read` (comprobar si la PR viene de un fork) e `issues: write` (para el `gh` del agente). La respuesta final, las ramas y las PRs las hace la app con sus propios permisos.
- `GH_TOKEN: ${{ github.token }}`: el agente no recibe el token de la app, así que sin esto `gh` no está autenticado. Las skills que usan `gh` (p. ej. `plan-feature`, que publica el plan como comentario de la issue) lo necesitan. Lo que publique así aparece como `github-actions[bot]`.
- `OPENCODE_CONFIG_CONTENT`: permisos **solo para CI**, que se suman a `.opencode/opencode.json` con más prioridad (en local no cambia nada):

  ```json
  {"permission": {"external_directory": "deny",
    "bash": {"git credential*": "deny", "git config --get*credential*": "deny", "gh auth token*": "deny"}}}
  ```

  `external_directory` vale `ask` por defecto: en cuanto el agente intenta leer algo fuera del repo (p. ej. `~/.config/gh`), se queda esperando una aprobación que nadie puede dar. Con `deny`, la herramienta falla y el agente sigue. Las reglas de `bash` impiden que vaya a buscar credenciales de git o gh si algo no le funciona.
- `actions/checkout` con `persist-credentials: false`.
- `OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}` en `env` y `model: opencode/deepseek-v4.1-flash-free`.
- `timeout-minutes: 20`. Si opencode pide una aprobación de permisos (`asking ...` en el log), en CI nadie puede darla y el job se quedaría colgado hasta las 6 h por defecto.

> **Importante:** los workflows de `issue_comment` e `issues` **siempre se ejecutan con la versión de la rama por defecto (`main`)**, nunca con la de una PR. Hasta que `opencode.yml` no esté en `main`, mencionar `/oc` no hace nada: lo recoge otro workflow o ninguno.

### 5. Probarlo

Con `opencode.yml` ya en `main`: con la cuenta propietaria, comenta en una issue `/oc resume esta issue`. Se ejecuta el job `opencode` y responde en la issue. Si comenta otra cuenta, el job debe aparecer como **skipped**.

## Problemas frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `App token exchange failed: 404 ... not installed` | Falta la GitHub App en el repositorio. | Paso 1. |
| `V2 permissions are not supported by OpenCode V1` | `opencode.json` o un agente usa `"permissions": [...]`. | Pasar a `"permission": {...}` (paso 3). |
| Error de autenticación del modelo (401) | `OPENCODE_API_KEY` inválida, caducada o mal copiada. | Paso 2. |
| El job no avanza y el último log es `asking { permission: ... }` | opencode espera una aprobación de permisos que en CI nadie puede dar. | Cancelar el run y añadir ese permiso como `deny` en `OPENCODE_CONFIG_CONTENT` (o en el agente). El `timeout-minutes` lo corta solo. |
| Una skill dice que `gh` no está autenticado, o el agente intenta buscar tokens | Falta `GH_TOKEN` en el paso de opencode. | Añadir `GH_TOKEN: ${{ github.token }}` y el permiso que necesite (`issues: write`). |
| El job sale **skipped** al mencionar `/oc` | Quien comenta no es `OWNER`, o el texto no contiene `/opencode` ni `/oc`. | Comentar con la cuenta propietaria o ampliar la lista de roles. |
| `La PR #N viene de un fork ...; opencode no se ejecuta sobre código externo.` | Se ha mencionado `/oc` en una PR de un fork. | Es intencionado. Para usar opencode con esos cambios, llévalos a una rama del propio repositorio. |
| Al mencionar `/oc` se ejecuta otro workflow (o ninguno) | `opencode.yml` todavía no está en `main`: los eventos de comentarios e issues usan los workflows de la rama por defecto. | Hacer merge a `main`. |

## Mantenimiento

- **Renovar la API key** antes de que caduque (paso 2). Es la misma para los tres workflows.
- **`@latest`**: la action se actualiza sola. Para evitar cambios inesperados, fíjala a un commit concreto (`anomalyco/opencode/github@<sha>`).
- **Modelo**: cambia `model` en cada workflow. Los disponibles salen en <https://opencode.ai/zen/v1/models>.
