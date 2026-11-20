---
name: plan-feature
description: Lee una issue del repositorio remoto con GitHub CLI (`gh`), genera un plan de implementación (tareas TDD de 5-10 min separadas por secciones/aplicaciones para poder paralelizarlas, criterios de aceptación, dudas y decisiones) y lo publica como comentario de la issue. Úsala cuando el usuario pida planificar, diseñar o preparar la implementación de una feature, issue o cambio antes de programarlo.
argument-hint: "<num_issue> [indicaciones adicionales]"
---

# plan-feature

Lee la issue indicada con `gh`, genera un plan siguiendo la plantilla [assets/plan-template.md](assets/plan-template.md) y lo publica **como comentario de esa issue**. El plan ya no se guarda en el repositorio: la issue es su fuente de verdad (`implement-plan` lo recuperará de ahí).

## Proceso

1. **Obtén el número de issue.** Usa los argumentos si vienen; si falta, pregúntaselo al usuario. Comprueba que `gh` está instalado y autenticado (`gh auth status`) y que el repo tiene remoto (`gh repo view --json nameWithOwner`). Si algo de esto falla, avisa al usuario y para: sin issue remota no hay plan.
2. **Lee la issue del remoto** con `gh`:
   ```bash
   gh issue view <num> --json number,title,body,state,labels,assignees,comments,url
   ```
   - Extrae título, descripción, etiquetas y los comentarios (pueden contener aclaraciones o decisiones).
   - Si la issue está cerrada, díselo al usuario y pregunta si continuar.
   - Busca entre los comentarios uno que empiece por `<!-- resttek-plan -->`: es un plan anterior. Si existe, no lo dupliques ni lo sobrescribas sin preguntar (ver paso 7).
3. **Explora el código** antes de planificar: lee `CLAUDE.md`, la arquitectura afectada (API: hexagonal en `contexts/employee/` o por capas routes → controllers → services → repositories; frontends: feature-based con `models/ pages/ services/ store/`), los tests existentes junto al código (`*.test.ts`) y los docs de `docs/` que apliquen (`docs/arquitectura/`, `docs/dominio/`, `docs/api/`).
4. **Lee la plantilla** `assets/plan-template.md` y respeta su estructura y orden de secciones. No quites ni renombres secciones (si no hay contrato compartido, deja "No aplica"). Conserva la primera línea `<!-- resttek-plan -->`: es la marca con la que se localiza el plan.
5. **Divide el trabajo en secciones** (ver reglas abajo) y **rellena el plan** en un fichero temporal fuera del repo (`mktemp -d`); no escribas nada en el árbol de trabajo.
6. **Revisa el plan** antes de publicarlo: tareas de 5-10 min, secciones sin solapes de archivos, dependencias coherentes, metadatos completos.
7. **Publícalo como comentario de la issue**:
   ```bash
   gh issue comment <num> --body-file <fichero_temporal>
   ```
   Si ya existía un comentario con la marca `<!-- resttek-plan -->` y el usuario confirma reemplazarlo, edítalo en lugar de crear otro (`gh api` con el `id` del comentario):
   ```bash
   gh api repos/{owner}/{repo}/issues/comments/<comment_id> -X PATCH -F body=@<fichero_temporal>
   ```
   Guarda la URL del comentario que devuelve `gh`. Si la publicación falla, no reintentes en bucle: dile al usuario el motivo y deja el fichero temporal para que no se pierda el plan.
8. **Responde al usuario** con el enlace al comentario, un resumen muy breve (secciones, nº de tareas) y las dudas abiertas más importantes para que las conteste.
9. **Avisa por Slack** al canal `curso-claude` (ID `C0CHB9C0CGK`) con la herramienta `mcp__slack__slack_post_message` (si no está cargada, cárgala antes con ToolSearch). Mensaje corto en español con: el enlace al plan, el número de issue, el número de secciones y de tareas y cuántas dudas abiertas quedan. Ejemplo: `📝 Plan listo en la issue #12 (api + web-admin, 6 tareas, 2 dudas abiertas): <url del comentario>`. Si el envío falla, no reintentes en bucle: dilo al usuario en tu respuesta.

## Reglas de contenido

- **Idioma**: todo el plan en español.
- **Metadatos**: issue (con su título real), fecha (de hoy), autor (usuario de git: `git config user.name`), estado `Borrador` y rama sugerida (`feat/<num_issue>-<breve-descripcion>`, descripción en minúsculas, sin tildes, con guiones y de 2 a 5 palabras).
- **Objetivo y alcance**: objetivo breve, y listas explícitas de dentro y fuera del alcance.
- **Contexto**: solo lo relevante para implementar (archivos, capas y convenciones afectadas), no un volcado del repo.
- **Secciones (para trabajo en paralelo)**:
  - Agrupa las tareas por **sección = aplicación o paquete** del monorepo: `api` (`packages/api`), `web-admin`, `web-empleados`, `web-clientes`, `web-shared`. Una sección es lo que implementará **un solo agente** en su propio worktree.
  - Solo crea las secciones que hagan falta. Una feature que solo toca la API tiene una sección.
  - **Sin solapes**: dos secciones nunca modifican el mismo archivo. Si dos apps necesitan algo común, va a `web-shared` como sección propia, y las demás la declaran en "Depende de".
  - **Desacopla con un contrato**: si una sección consume lo que produce otra (p. ej. un frontend y el endpoint que usa), define en "Contrato compartido" la interfaz exacta (ruta, método, payload, respuesta, errores) para que ambas puedan avanzar a la vez, y deja "Depende de: —". Solo declara dependencia dura cuando sea imposible avanzar sin que la otra termine.
  - Si una sección es muy grande, divídela por carpetas/features que no se pisen en lugar de crear una sección gigante.
  - La documentación OpenAPI **no** es una sección: la actualiza quien coordina al integrar (skill `update-openapi`), y se refleja como criterio de aceptación si la API cambia.
- **Tareas**:
  - Con checkbox `- [ ]` e identificador por sección (`API-1`, `ADMIN-1`, `EMPLEADOS-1`, `CLIENTES-1`, `SHARED-1`), numeradas dentro de su sección.
  - Cada tarea debe poder hacerse en **5-10 minutos**. Si es más grande, divídela.
  - Cada tarea incluye **tests (TDD, primero en rojo) + el código mínimo para que pasen**. Nunca separes los tests en una tarea aparte.
  - Dentro de cada sección, ordénalas de forma que cada una deje el proyecto en verde y siga la arquitectura de esa app (en la API: repository → service → controller → route).
  - Respeta las convenciones del proyecto: funciones en `snake_case` y sin `;` salvo cuando sea necesario.
- **Criterios de aceptación**: checkboxes verificables y objetivos que indiquen cuándo el plan está terminado. Incluye siempre que `npm test` pasa y que todas las tareas están marcadas, y la documentación OpenAPI si se toca la API.
- **Dudas abiertas**: preguntas reales que no puedas resolver con el código o la issue, con hueco `_Respuesta:_` para que el usuario conteste. Si no hay, indica "Ninguna".
- **Decisiones tomadas**: toda suposición o elección que hagas por tu cuenta (incluida la división en secciones), con su motivo, para que el usuario pueda corregirte.

## Importante

- Esta skill solo **planifica**: no implementes código, no crees tests, no crees ramas, no hagas commits y no dejes archivos del plan en el repo.
- Lo único que se escribe en el remoto es el comentario del plan en la issue (no cambies título, cuerpo, etiquetas ni estado de la issue).
- No inventes información de la issue: si algo no está claro, va a "Dudas abiertas".
