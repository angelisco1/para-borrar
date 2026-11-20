---
name: implement-plan
description: Implementa el plan publicado como comentario de una issue de GitHub (generado con plan-feature), recuperándolo con `gh`. Trabaja en worktrees aislados (uno principal y uno por agente si se paraleliza por secciones), con TDD estricto y un commit por tarea, integra todo en el worktree principal, actualiza la documentación OpenAPI si cambia la API y deja la PR lista para revisión. Úsala cuando el usuario pida implementar, ejecutar o desarrollar el plan de una issue.
argument-hint: "<num_issue> (la issue cuyo comentario contiene el plan)"
---

# implement-plan

Recupera el plan del comentario de la issue indicada, lo implementa con TDD estricto en worktrees aislados y deja una PR lista para revisión.

Vocabulario:

- **Rama del plan**: la rama indicada en "Rama sugerida" del plan (p. ej. `feat/12-paginar-listado`). Es la que acabará en la PR.
- **Worktree principal**: worktree donde vive la rama del plan y donde se integra todo.
- **Worktree de sección**: worktree de un agente, con su rama `<rama del plan>-<sección>` (p. ej. `feat/12-paginar-listado-api`). Solo existen si varios agentes trabajan en paralelo.

Los worktrees se crean en `.claude/worktrees/` del repo, con la rama cambiando `/` por `-` (`feat/12-x` → `.claude/worktrees/feat-12-x`, sección → `.claude/worktrees/feat-12-x--api`).

## Proceso

### 1. Recupera el plan de la issue

1. Usa el argumento como número de issue. Si no viene, pídeselo al usuario (puedes ayudarle con `gh issue list`).
2. Comprueba `gh auth status` y que el repo tiene remoto. Si no, para y avisa.
3. Busca el plan: es el **último comentario** cuyo cuerpo empieza por `<!-- resttek-plan -->`:
   ```bash
   gh issue view <num> --json number,title,url,state,comments \
     --jq '{number, title, url, state, plan: ([.comments[] | select(.body | startswith("<!-- resttek-plan -->"))] | last)}'
   ```
   Si no hay ningún comentario con la marca, para y dile al usuario que ejecute antes `plan-feature` para esa issue.
4. Guarda el cuerpo del plan en un fichero temporal fuera del repo (`mktemp -d`) y apunta el **id numérico del comentario** (es el número tras `#issuecomment-` en su `url`). Esa copia es la que irás marcando; **nunca se commitea**.
5. Lee los comentarios posteriores al plan: pueden contener respuestas a las dudas abiertas o correcciones.
6. Lee el plan completo: metadatos, contrato compartido, secciones y dependencias, tareas, criterios de aceptación, dudas abiertas y decisiones.
7. Si hay **dudas abiertas** sin responder (`_Respuesta:_` vacío en el plan y sin respuesta en los comentarios) que afecten a la implementación, pregúntaselas al usuario antes de empezar.
8. Lee también `CLAUDE.md` y respeta sus convenciones (arquitectura de cada paquete, funciones en `snake_case`, sin `;` salvo cuando sea necesario, documentación en español).
9. Si el estado del plan ya es `Implementado`, avisa al usuario y pregunta si continuar.

### 2. Prepara la rama y el worktree principal

1. Comprueba si existe la rama `development` (`git branch --list development`, y en remoto con `git branch -r`).
   - **Si no existe**, créala a partir de `main` o, si no existe `main`, de `master`: `git branch development main` (o `master`). No la subas al remoto.
   - **Si existe**, úsala tal cual.
2. Si la rama del plan ya existe (local o remota), no la recrees ni la sobrescribas: pregunta al usuario si continuar sobre ella.
3. Crea el **worktree principal** con la rama del plan a partir de `development`:
   ```bash
   git worktree add .claude/worktrees/<rama-con-guiones> -b <rama> development
   ```
   A partir de aquí, **toda la implementación ocurre en worktrees**: no edites ni hagas commits en el checkout desde el que se lanzó la skill, y no mezcles sus cambios sin commitear (los archivos sin relación, p. ej. `.DS_Store`, `*.db`, `.angular/`, `dist/`, no se añaden nunca a los commits).
4. Instala dependencias en cada worktree que crees (los worktrees no comparten `node_modules`): `npm install` desde su raíz.
5. Cambia el estado del plan a `En curso` en la copia temporal y actualiza el comentario de la issue (ver "Actualizar el comentario del plan").

### 3. Decide cómo repartir el trabajo

Según las secciones del plan:

- **Una sola sección** (o tareas muy acopladas): un único agente, que es esta misma sesión, trabaja directamente en el worktree principal.
- **Varias secciones**: un agente por sección, cada uno en su worktree de sección. Crea cada uno a partir de la rama del plan:
  ```bash
  git worktree add .claude/worktrees/<rama-con-guiones>--<seccion> -b <rama>-<seccion> <rama>
  ```
  - Las secciones sin dependencias entre sí se lanzan **a la vez**: una sola respuesta con varias llamadas a `Agent` (`subagent_type: general-purpose`), para que corran en paralelo.
  - Una sección con "Depende de" no se lanza hasta que la sección de la que depende esté **integrada** en la rama del plan (paso 5); su worktree se crea entonces, ya con esos cambios.
  - No pongas más agentes que secciones. Si dos secciones tocan los mismos archivos (el plan está mal dividido), para y consúltalo con el usuario en vez de paralelizarlas.

### 4. Implementa las tareas (ciclo TDD)

Lo hace cada agente (o esta sesión si hay uno solo) en **su** worktree. Si delegas, el prompt de cada agente debe ser autocontenido e incluir: la ruta absoluta de su worktree y su rama, el contexto del plan (objetivo, contrato compartido, decisiones, respuestas a las dudas), el texto literal de **sus** tareas, las convenciones de `CLAUDE.md` relevantes y las reglas de este apartado y de "Restricciones". Debe trabajar solo con rutas absolutas dentro de su worktree (`git -C <ruta>`, `npm ... --prefix`/`-w`), sin tocar archivos fuera del ámbito de su sección.

Para **cada** tarea sin hacer de su sección, en orden, completa el ciclo antes de pasar a la siguiente:

1. 🔴 **Test primero.** Escribe solo los tests que describe la tarea, junto al código (`*.test.ts`) o donde indique el plan. No escribas código de producción todavía.
2. 🔴 **Ejecútalo y comprueba que falla.** Tiene que salir **rojo por la razón correcta** (la funcionalidad no existe o no se comporta como se espera), no por un error de sintaxis o de import en el propio test. Si sale verde, el test no sirve: revísalo. Nunca continúes sin haber visto el rojo.
3. 🟢 **Código mínimo.** Escribe solo el código necesario para que pasen esos tests, en la capa que indica la tarea.
4. 🟢 **Ejecútalo de nuevo** y comprueba que **toda** la suite del paquete está en verde, no solo los tests nuevos. Si falla, corrige el código (no debilites los tests para que pasen) y repite.
5. **Commit de la tarea**, con tests y código juntos. Sigue el formato de Conventional Commits de [.claude/commands/commit.md](../../commands/commit.md) (tipo y scope adecuados, descripción en español, minúsculas, imperativo y sin punto final), añade el pie `Tarea: <ID>` (p. ej. `Tarea: API-2`) y termina con el pie de co-autoría que indiquen las instrucciones de la sesión. **No pidas confirmación al usuario** (en esta skill se salta el paso de confirmación de ese comando). Añade solo los archivos de la tarea con `git add <archivos>` (nunca `git add -A`).

Comandos de test por paquete (desde la raíz del worktree): API `npm run test -w @resttek/api`; web-admin `npm run test:admin`; un test concreto: `npm run test -w @resttek/api -- src/ruta/archivo.test.ts`. `web-empleados` y `web-clientes` no tienen tests unitarios: si una tarea de esas secciones pide tests, sigue el plan y, si no es posible ejecutarlos, déjalo indicado en el informe en lugar de saltarte el rojo en silencio.

Reglas del ciclo:

- Una tarea = un commit. No mezcles tareas ni dejes una tarea a medias entre commits.
- No adelantes código de tareas futuras ni refactorices fuera del alcance de la tarea.
- **Los agentes no editan el plan ni el comentario de la issue**: solo quien coordina lo marca (paso 5).
- Si una tarea resulta demasiado grande, el plan es incorrecto/incompleto o falta información, el agente **para y lo comunica** en su informe final (no improvisa). Si toma una decisión por su cuenta, la anota en su informe para añadirla a "Decisiones tomadas".
- Si el paquete no queda en verde tras una tarea, no se pasa a la siguiente.
- Informe final de cada agente: tareas completadas (ID + commit), tareas pendientes o bloqueadas y por qué, decisiones tomadas, y resultado de la última ejecución de tests.

### 5. Integra todo en el worktree principal

Esta sesión coordina. A medida que cada agente termina (y siempre antes de lanzar las secciones que dependan de ella):

1. Revisa su informe y comprueba en su rama que hay un commit por cada tarea declarada (`git log <rama>..<rama>-<seccion> --oneline`) y que no hay cambios sin commitear.
2. En el **worktree principal**, integra su rama:
   ```bash
   git -C <worktree-principal> merge --no-ff <rama>-<seccion> -m "chore: integrar la sección <seccion> del plan #<num>"
   ```
   Sigue el mismo formato de Conventional Commits y el pie de co-autoría. Si hay conflictos, resuélvelos conservando la intención de ambos lados; si el conflicto implica una decisión de diseño, consúltalo con el usuario.
3. Ejecuta `npm test` en el worktree principal y comprueba que la suite completa está en verde tras la integración. Si falla, corrígelo con el mismo ciclo TDD en el worktree principal (nuevo commit, sin `--amend`).
4. Marca en la copia temporal del plan las tareas de esa sección como `- [x]` y actualiza el comentario de la issue (ver "Actualizar el comentario del plan").
5. Cuando una sección ya esté integrada, retira su worktree y su rama (ya mergeada): `git worktree remove .claude/worktrees/<...>--<seccion>` y `git branch -d <rama>-<seccion>`.

Cuando estén todas integradas, comprueba que las secciones encajan entre sí (el contrato compartido se cumple de verdad: p. ej. peticiones de prueba a la API desde lo que consume el frontend), no solo que cada suite pase por separado.

### 6. Actualiza la documentación OpenAPI (si cambia la API)

Si el diff de la rama del plan contra `development` toca `packages/api`, ejecuta la skill `update-openapi` en el worktree principal: actualiza (o genera, si no existe) los specs de `docs/api/` y el HTML con Redocly, y hace su commit `docs(api): ...`. Si la API no cambia, sáltate este paso.

### 7. Comprueba los criterios de aceptación

1. Recorre los criterios de aceptación uno a uno y **verifícalos de verdad** en el worktree principal (ejecuta `npm test`, revisa el código, haz peticiones de prueba si procede, comprueba que existe la documentación pedida, etc.). No los marques por suposición.
2. Marca con `- [x]` solo los que se cumplan. Si alguno no se cumple, corrígelo (con el mismo ciclo TDD y su commit) o, si no es posible, déjalo sin marcar y explica el motivo al usuario.
3. Cuando todos estén marcados (y todas las tareas), cambia el estado del plan a `Implementado`; si queda algo pendiente, déjalo en `En curso`.
4. Actualiza el comentario de la issue con el estado final, los criterios marcados y las decisiones tomadas añadidas a "Decisiones tomadas".

### 8. Deja la PR lista para revisión

1. Comprueba que el worktree principal está limpio (`git status`) y que `npm test` está en verde.
2. Sube **solo la rama del plan**, sin force: `git -C <worktree-principal> push -u origin <rama>`.
3. Elige la base de la PR: `development` si existe en el remoto (`git ls-remote --heads origin development`); si no, la rama por defecto del repo (`gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`).
4. Crea la PR **lista para revisión (no draft)**, con el cuerpo en un fichero temporal:
   ```bash
   gh pr create --base <base> --head <rama> --title "<tipo>: <descripción en español> (#<num>)" --body-file <fichero>
   ```
   Cuerpo de la PR, en español:
   - `Closes #<num>` y enlace al comentario con el plan.
   - **Resumen** de qué cambia y por qué.
   - **Cambios por sección** (api, web-admin…) con las tareas hechas.
   - **Cómo probarlo** (comandos, rutas, credenciales de prueba si hacen falta).
   - **Criterios de aceptación** con su estado y, si queda algo sin cumplir, el motivo.
   - **Decisiones tomadas** y puntos que el revisor debería mirar con más atención.
   - Al final, la línea de atribución que indiquen las instrucciones de la sesión para las PR.
5. Verifica con `gh pr view <rama> --json url,isDraft,baseRefName,mergeable` que la PR existe, no es draft y apunta a la base correcta. Si no se puede crear la PR (sin permisos, sin remoto, rama rechazada…), no reintentes en bucle: explica el motivo y deja la rama local lista.
6. No pidas reviewers ni mergees: eso lo decide el usuario.

### 9. Informa al usuario

Resume: URL de la PR, ruta del worktree principal (se conserva para revisar/corregir) y rama, reparto en secciones/agentes, tareas completadas (con sus commits), resultado de los criterios de aceptación, documentación OpenAPI actualizada, y cualquier punto pendiente o decisión que hayas tomado.

### 10. Avisa por Slack

Al terminar, avisa al canal `curso-claude` (ID `C0CHB9C0CGK`) con la herramienta `mcp__slack__slack_post_message` (si no está cargada, cárgala antes con ToolSearch). Mensaje corto en español con: la issue, la rama, la URL de la PR, tareas completadas sobre el total y si todos los criterios de aceptación se cumplen. Ejemplo: `✅ Plan de la issue #12 implementado en feat/12-paginar-listado (6/6 tareas, criterios OK). PR lista para revisión: <url>`. Si la implementación se detuvo antes de terminar (duda abierta, tarea bloqueada, criterio sin cumplir), avisa igualmente indicando el motivo. Si el envío falla, no reintentes en bucle: dilo al usuario en el informe.

## Actualizar el comentario del plan

Edita la copia temporal (solo checkboxes, estado y "Decisiones tomadas") y súbela al **mismo comentario** (no crees otro):

```bash
gh api repos/{owner}/{repo}/issues/comments/<comment_id> -X PATCH -F body=@<fichero_temporal>
```

Hazlo al empezar (`En curso`), tras integrar cada sección y al terminar. Antes de cada actualización, vuelve a leer el comentario por si el usuario lo ha editado (respuestas a dudas) y no pises sus cambios. Mantén intacta la primera línea `<!-- resttek-plan -->`.

## Restricciones

- Solo se hace `git push` de la **rama del plan** y solo se abre la PR de esa rama (el usuario lo pide al usar esta skill). Nunca subas a `main`, `master` ni `development`, ni mergees la PR.
- No uses `--amend`, `--no-verify`, `git reset --hard`, `git push --force` ni `git worktree remove --force`.
- No modifiques el contenido de las tareas del plan: en el comentario solo cambian checkboxes, estado y "Decisiones tomadas".
- Los worktrees de sección se eliminan al integrarlos; el principal se conserva.
- Si un hook de pre-commit falla, corrige el problema y crea un commit nuevo.
