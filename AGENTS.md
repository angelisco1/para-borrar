# AGENTS.md

## Proyecto

Resttek: plataforma de gestión de restaurantes. Monorepo con **npm workspaces** (`packages/*`): una API (`@resttek/api`, Express 5 + TypeScript + SQLite) y tres apps Angular 21 (`web-admin`, `web-empleados`, `web-clientes`) más una librería compartida (`web-shared`). Node 22+, npm 10+. La documentación del proyecto está en español; docs detallados en [docs/](docs) (`arquitectura/` y `dominio/`).

## Comandos

Todo se ejecuta desde la raíz:

```bash
npm install                # instala todos los paquetes
npm run seed               # puebla SQLite (INSERT OR IGNORE, idempotente)
npm run dev:api            # API en :3000 (tsx watch); health: /health
npm run dev:admin          # web-admin :4200
npm run dev:empleados      # web-empleados :4201
npm run dev:clientes       # web-clientes :4202
npm test                   # tests de la API (vitest run) + unitarios de web-admin, web-empleados y web-clientes
npm run test:admin         # solo los unitarios de web-admin (@angular/build:unit-test + Vitest + jsdom)
```

Un solo test de la API:

```bash
npm run test -w @resttek/api -- src/services/order.service.test.ts
npm run test -w @resttek/api -- -t "nombre del test"
```

Los tres frontends tienen tests unitarios (`*.test.ts` junto al código, `@angular/build:unit-test` + Vitest + jsdom; `npm run test -w @resttek/web-empleados`, etc.); no hay script de lint; `ng build` está disponible con `npm run build -w @resttek/web-admin` (etc.). Los frontends hacen proxy de `/api` a `localhost:3000` vía `proxy.conf.json`.

Credenciales de prueba tras el seed: la contraseña es el propio email (p. ej. `admin@resttek.com`, `gerente1@resttek.com`, `cocinero1@resttek.com`, `camarero1@resttek.com`, `cliente1@resttek.com`).

`scripts/seed-issues.sh` crea issues de GitHub desde `scripts/issues.json` (ver `scripts/README.md`; soporta `--dry-run`).

## Arquitectura de la API (`packages/api/src`)

Conviven **dos estilos**; identifica cuál aplica antes de tocar código:

- **Hexagonal + DDD solo en `contexts/employee/`** (domain → application → infrastructure). Es la única entidad de dominio real (`Employee`: constructor privado + `create()`), con casos de uso de un método `execute()` (`LoginUseCase`, `CreateEmployeeUseCase`, `RegisterClientUseCase`) e interfaces con prefijo `I` (`IEmployeeRepository`). Los controladores/rutas HTTP y el cableado de dependencias están en `infrastructure/http/`. `contexts/shared/` contiene el value object `Email` y middlewares/`errorHandler` de Express.
- **Por capas para `restaurant`, `dish`, `ingredient`, `order`**: carpetas transversales `models/` (interfaces planas + funciones `normalizeX()` que hacen trim/lowercase y lanzan error de dominio), `repositories/` (interfaz sin prefijo `I` + implementación `Sqlite*` en el mismo fichero), `services/` (lógica de negocio), `controllers/`, `routes/` (composición de dependencias). Existen rutas `*.public.routes.ts` para endpoints sin autenticación.

Otros puntos: errores en `errors/` (`AppError`, `DomainErrors`); BD en `config/database.ts` (tablas creadas en código al arrancar; archivo `packages/api/resttek.db`; con `NODE_ENV=test` usa `:memory:`); auth con JWT (middleware `authenticate` + `authorize` por roles; roles: admin, manager, camarero, cocinero, cliente); API bajo `/api/v1`. Los tests (vitest, `globals: true`) conviven junto al código (`*.test.ts`) y usan mocks de repositorio en `repositories/mocks` y `application/mocks`.

## Arquitectura del frontend

- Angular 21 con componentes standalone y signals, organización feature-based. `web-admin` y `web-empleados` agrupan cada feature en `models/ pages/ services/ store/`; `web-clientes` centraliza modelos y servicios en `core/` y apenas usa el patrón Store.
- `@resttek/web-shared` es la única dependencia entre paquetes frontend: auth (AuthStore basado en signals, AuthService, AuthGuard), interceptors HTTP (auth y error), inyección de `API_URL`, componentes comunes y design tokens/estilos. Los frontends no dependen entre sí.
- Lazy loading de rutas; `web-empleados` filtra rutas por rol.

Detalle en [docs/arquitectura/arquitectura-frontend.md](docs/arquitectura/arquitectura-frontend.md) y [docs/arquitectura/arquitectura-api.md](docs/arquitectura/arquitectura-api.md); esquema de datos en [docs/dominio/modelo-datos.md](docs/dominio/modelo-datos.md).
