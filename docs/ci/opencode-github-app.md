# opencode en GitHub: menciones y revisión de PRs (GitHub App)

Guía para configurar los dos workflows que usan la action oficial `anomalyco/opencode/github`:

| Workflow | Cuándo se ejecuta | Qué hace |
| --- | --- | --- |
| [`opencode-code-review.yml`](../../.github/workflows/opencode-code-review.yml) | Al abrir o actualizar una PR | Revisa la PR (bugs, arquitectura, tests, seguridad, OpenAPI) y publica la revisión como comentario. |
| [`opencode.yml`](../../.github/workflows/opencode.yml) | Al escribir `/opencode` o `/oc` en un comentario de issue o PR, o en el título o cuerpo de una issue | Atiende lo que se le pide: responder, crear una rama o abrir una PR. |

La revisión de coherencia con la documentación (job `docs-consistency` de `ci.yml`) funciona de otra forma (opencode v2 sin la action) y está documentada en [revision-coherencia-opencode.md](revision-coherencia-opencode.md).

## Las dos credenciales

Estos workflows necesitan **dos credenciales distintas**:

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

Es la misma key que usa la revisión de coherencia. Si ya está creada, sáltate este paso.

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

**`.opencode/agents/ci-revisor.md`**, el agente de solo lectura que usa la revisión de PRs (ver [revision-coherencia-opencode.md](revision-coherencia-opencode.md#3-configurar-opencode-en-el-repositorio)). Deniega todo (`"*": deny`, incluido `external_directory`) salvo leer, buscar y `git diff`/`log`/`show`/`status`.

### 4. Workflow de revisión de PRs (`opencode-code-review.yml`)

Puntos clave:

```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]

jobs:
  review:
    if: github.event.pull_request.head.repo.full_name == github.repository  # sin PRs de forks
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      id-token: write       # OIDC -> token de la GitHub App
      contents: read
      pull-requests: write
      issues: write         # los comentarios de PR van por la API de issues
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # para git diff contra la rama base
          persist-credentials: false
      - uses: anomalyco/opencode/github@latest
        env:
          OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
        with:
          model: opencode/deepseek-v4.1-flash-free
          agent: ci-revisor
          prompt: |
            Revisa el pull request #${{ github.event.pull_request.number }} ...
            Obtén los cambios con `git diff origin/<base>...HEAD`.
            Tu respuesta final se publicará automáticamente como comentario en la PR: no intentes
            publicarla tú, ni usar `gh`, ni buscar tokens o credenciales. ...
```

Por qué cada cosa:

- **`agent: ci-revisor`**: sin él se usa `build`, que tiene shell libre. En la primera prueba, el modelo intentó publicar el comentario por su cuenta, buscó tokens y quiso leer `~/.config/gh/hosts.yml`. Como está fuera del repo, opencode pidió permiso (`asking ... external_directory`) y el job se quedó colgado esperando una aprobación que en CI nadie puede dar.
- **El prompt aclara que la respuesta se publica sola**: la action publica la respuesta final como comentario. Si el prompt dice "publica la revisión", el modelo intenta hacerlo él.
- **`timeout-minutes`**: si vuelve a quedarse esperando, el job se corta en 15 minutos en lugar de las 6 horas por defecto de GitHub.
- **Filtro de forks**: las PRs de forks no reciben secretos.

### 5. Workflow de menciones (`opencode.yml`)

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

El resto de la configuración es igual que en la revisión: `id-token: write`, `persist-credentials: false`, `OPENCODE_API_KEY` en `env`, `model` y `timeout-minutes: 20`.

### 6. Probarlo

1. **Revisión de PRs**: abre una PR (o sube un commit a una abierta). En **Actions**, el workflow **opencode code review** debe terminar en verde en unos minutos y la PR debe tener un comentario de `opencode-agent[bot]`.
2. **Menciones**: con la cuenta propietaria, comenta en una issue `/oc resume esta issue`. Se ejecuta el job `opencode` y responde en la issue. Si comenta otra cuenta, el job debe aparecer como **skipped**.

## Problemas frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `App token exchange failed: 404 ... not installed` | Falta la GitHub App en el repositorio. | Paso 1. |
| `V2 permissions are not supported by OpenCode V1` | `opencode.json` o un agente usa `"permissions": [...]`. | Pasar a `"permission": {...}` (paso 3). |
| Error de autenticación del modelo (401) | `OPENCODE_API_KEY` inválida, caducada o mal copiada. | Paso 2. |
| El job no avanza y el último log es `asking { permission: ... }` | opencode espera una aprobación de permisos que en CI nadie puede dar. | Cancelar el run, usar un agente que **deniegue** (no `ask`) lo que no necesita y revisar el prompt. El `timeout-minutes` lo corta solo. |
| El job sale **skipped** al mencionar `/oc` | Quien comenta no es `OWNER`, o el texto no contiene `/opencode` ni `/oc`. | Comentar con la cuenta propietaria o ampliar la lista de roles. |

## Mantenimiento

- **Renovar la API key** antes de que caduque (paso 2). Sirve para los tres workflows.
- **`@latest`**: la action se actualiza sola. Para evitar cambios inesperados, fíjala a un commit concreto (`anomalyco/opencode/github@<sha>`).
- **Modelo**: cambia `model` en cada workflow. Los disponibles salen en <https://opencode.ai/zen/v1/models>.
