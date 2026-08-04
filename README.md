# PaginaNueva

Panel de administración de catálogo para e-commerce (perfumes, vapes, etc.): categorías, marcas,
atributos y productos, con precios calculados en vivo (USD y bolívares) y variantes con precio
propio (ej. distintos tamaños de un mismo perfume).

Monorepo con **pnpm workspaces** + **Turborepo**.

## Stack

- **Backend** (`apps/api`): NestJS 11, Prisma 6 sobre PostgreSQL, JWT, class-validator, Swagger.
- **Frontend** (`apps/web`): Next.js 16 (App Router, Turbopack), React 19, CSS plano (sin librería de UI).
- **Base de datos** (`packages/database`): esquema y migraciones de Prisma, cliente compartido.
- **Compartido** (`packages/shared`): utilidades comunes entre `api` y `web`.

## Estructura

```
apps/
  api/       API REST (NestJS) — módulos auth, catalog (category/brand/attribute/product/browse), settings
  web/       Panel (Next.js) — /login, /dashboard/{categories,brands,attributes,products}
packages/
  database/  schema.prisma, migraciones, seed
  shared/    helpers compartidos (paginación, etc.)
```

## Funcionalidad principal

- **Categorías**: árbol (categoría raíz → subcategorías), con costos heredados (logística, envío,
  seguridad) definidos por subcategoría.
- **Marcas**: se asignan solo a subcategorías (no a categorías raíz).
- **Atributos**: por categoría, tipos `TEXT` / `NUMBER` / `BOOLEAN` / `SELECT`, y para los `SELECT`
  un modo de variante:
  - `NONE`: valor único de siempre.
  - `MULTI_VALUE`: el producto admite 1 o más valores, no afecta el precio (ej. sabores).
  - `PRICED_VARIANT`: cada valor genera una variante propia con su propio precio (ej. tamaño).
- **Productos**: código autogenerado, imagen, atributos dinámicos según categoría, y precio
  calculado en vivo:
  - `Precio $ = Precio de compra + costos de la subcategoría + Utilidad`
  - `Precio May Bs = Precio $ × Tipo de cambio del sistema`
  - `Precio Final Bs = (Precio Min Bs si se cargó, si no Precio May Bs) − Descuento`
  - Si la categoría tiene atributos `PRICED_VARIANT`, estos precios (compra, utilidad, min Bs,
    descuento) se cargan por variante en lugar del producto base.
- **Tipo de cambio**: valor único ($ → Bs) configurable desde el Dashboard, usado para calcular los
  precios en bolívares de todo el catálogo.

## Requisitos

- Node.js 20+
- pnpm 10 (`packageManager` fijado en `package.json`)
- PostgreSQL corriendo localmente (o accesible por `DATABASE_URL`)

## Configuración

Instalar dependencias:

```bash
pnpm install
```

Variables de entorno (crear los siguientes archivos, no versionados):

**`apps/api/.env`**
```
DATABASE_URL=postgresql://usuario:password@localhost:5432/nuevo_proyecto
JWT_SECRET=un-secreto-largo
WEB_ORIGIN=http://localhost:3100
PORT=4100
```

**`packages/database/.env`**
```
DATABASE_URL=postgresql://usuario:password@localhost:5432/nuevo_proyecto
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:4100
```

Preparar la base de datos:

```bash
pnpm db:migrate     # aplica las migraciones de Prisma
pnpm db:generate     # genera el cliente de Prisma
pnpm db:seed         # crea el usuario admin y datos de ejemplo
```

El seed crea el usuario **admin@gmail.com / Admin1.**

## Desarrollo

```bash
pnpm dev
```

Levanta API y web en paralelo vía Turborepo:

- Web: http://localhost:3100
- API: http://localhost:4100/api (Swagger en `/docs`)

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | API + web en modo desarrollo (watch) |
| `pnpm build` | Build de producción de todos los paquetes |
| `pnpm lint` | Lint de todos los paquetes |
| `pnpm typecheck` | Chequeo de tipos de todos los paquetes |
| `pnpm db:migrate` | Aplica migraciones de Prisma |
| `pnpm db:generate` | Regenera el cliente de Prisma |
| `pnpm db:seed` | Corre el seed (usuario admin + catálogo de ejemplo) |

## Notas para desarrollo en Windows

`nest start --watch` deja el `.dll` del query engine de Prisma bloqueado mientras corre. Si vas a
correr `prisma migrate` o `prisma generate` con `pnpm dev` activo, primero hay que cortar el
proceso de `nest` (matarlo mata todo el árbol de `pnpm dev`, así que después hay que volver a
levantarlo con `pnpm dev`).
