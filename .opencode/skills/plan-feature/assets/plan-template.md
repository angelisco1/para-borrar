<!-- resttek-plan -->
# Plan: {{TITULO_DE_LA_FEATURE}}

## Metadatos

| Campo | Valor |
| --- | --- |
| Issue | #{{NUM_ISSUE}} — {{TITULO_ISSUE}} |
| Fecha | {{YYYY-MM-DD}} |
| Autor | {{AUTOR}} |
| Estado | Borrador |
| Rama sugerida | `feat/{{NUM_ISSUE}}-{{breve-descripcion}}` |

## Objetivo y alcance

### Objetivo

{{Una o dos frases con lo que se quiere conseguir y por qué.}}

### Dentro del alcance

- {{Qué se incluye}}

### Fuera del alcance

- {{Qué NO se incluye en este plan}}

## Contexto

{{Situación actual del código y del dominio relevante para la feature: archivos, capas (routes, controllers, services, repositories), endpoints o tablas afectadas, convenciones del proyecto que aplican, enlaces a docs relevantes (por ejemplo `docs/arquitectura/arquitectura-api.md`).}}

## Contrato compartido

> Solo si hay más de una sección que depende de la misma interfaz (endpoint, DTO, evento, componente de `web-shared`). Es lo que permite que las secciones se implementen en paralelo sin esperarse. Si hay una sola sección, escribe "No aplica".

- {{Ej.: `GET /api/v1/restaurants/:id/dishes?page=1&limit=10` → `200 { data: Dish[], total: number }`}}

## Secciones y dependencias

> Cada sección es una unidad de trabajo para **un agente**, en su propio worktree y su propia rama (`<rama sugerida>-<sección>`). Las secciones no deben tocar los mismos archivos.

| Sección | Ámbito (paquete / carpetas) | Depende de | Tareas |
| --- | --- | --- | --- |
| `{{api}}` | `packages/api` | — | {{API-1 … API-n}} |
| `{{web-admin}}` | `packages/web-admin` | — (usa el contrato compartido) | {{ADMIN-1 … ADMIN-n}} |

## Tareas

> Cada tarea dura entre 5 y 10 minutos e incluye los tests (TDD: primero el test en rojo) y el código mínimo para que pasen. El checkbox lo marca quien coordina la implementación al integrar la sección. Las tareas de una sección van en orden; las de secciones distintas son independientes entre sí salvo lo indicado en "Depende de".

### Sección `{{api}}` — {{API}} (`packages/api`)

- [ ] **API-1: {{título corto}}**
  - Tests: {{qué casos se escriben primero y en qué archivo `*.test.ts`}}
  - Código: {{qué se implementa para que pasen, y en qué archivo/capa}}
- [ ] **API-2: {{título corto}}**
  - Tests: {{...}}
  - Código: {{...}}

### Sección `{{web-admin}}` — {{Web admin}} (`packages/web-admin`)

- [ ] **ADMIN-1: {{título corto}}**
  - Tests: {{...}}
  - Código: {{...}}

## Criterios de aceptación

- [ ] {{Criterio verificable 1}}
- [ ] {{Criterio verificable 2}}
- [ ] Todos los tests pasan con `npm test`
- [ ] Todas las tareas del plan están marcadas
- [ ] Si se modifica la API, la documentación OpenAPI de `docs/api/` está actualizada y generada con Redocly

## Dudas abiertas

> Preguntas que necesito que respondas antes o durante la implementación. Responde con un comentario en la issue o edita este comentario.

- [ ] **D1:** {{Pregunta}} — _Respuesta:_

## Decisiones tomadas

> Decisiones que he tomado por mi cuenta. Corrígeme si alguna no te encaja.

- **DEC1:** {{Decisión}} — _Motivo:_ {{por qué}}
