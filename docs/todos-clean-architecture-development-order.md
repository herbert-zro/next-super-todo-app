# Guía Senior → Junior: Orden de Desarrollo del Feature `todos` con Clean Architecture

> Mentoría práctica para construir, paso a paso, el feature [src/features/todos/](../src/features/todos/) de esta aplicación Next.js + TypeScript + Prisma, respetando Clean Architecture, SOLID y la separación de responsabilidades.
>
> No es una descripción del código: es la **secuencia de creación** y la **forma de validar** cada capa antes de avanzar a la siguiente.

---

## Tabla de contenidos

1. [Objetivo del feature](#1-objetivo-del-feature)
2. [Mapa arquitectónico](#2-mapa-arquitectónico-del-feature)
3. [Las tres reglas de oro](#3-las-tres-reglas-de-oro)
4. [Paso 1 — Capa de Dominio](#4-paso-1--capa-de-dominio)
5. [Paso 2 — Capa de Aplicación (Casos de Uso)](#5-paso-2--capa-de-aplicación-casos-de-uso)
6. [Paso 3 — Capa de Infraestructura](#6-paso-3--capa-de-infraestructura)
7. [Paso 4 — API Routes (puerto HTTP opcional)](#7-paso-4--api-routes-puerto-http-opcional)
8. [Paso 5 — Composition Root (Server Actions)](#8-paso-5--composition-root-server-actions)
9. [Paso 6 — Componentes UI (Client Components)](#9-paso-6--componentes-ui-client-components)
10. [Paso 7 — Página Next.js (Server Component)](#10-paso-7--página-nextjs-server-component)
11. [Errores comunes a evitar](#11-errores-comunes-a-evitar)
12. [Cuándo usar mocks y cuándo conectar a la DB real](#12-cuándo-usar-mocks-y-cuándo-conectar-a-la-db-real)
13. [Recomendaciones de mejora detectadas](#13-recomendaciones-de-mejora-detectadas)
14. [Ruta mental del flujo de datos: "Crear un todo"](#14-ruta-mental-del-flujo-de-datos-crear-un-todo)

---

## 1. Objetivo del feature

El feature `todos` permite a un usuario **gestionar tareas** (Todo). Cada tarea tiene:

- Un **título** (mínimo 8 caracteres, regla de negocio).
- Una **descripción** (mínimo 8 caracteres, regla de negocio).
- Un estado **completado** (booleano).
- **Fechas** de creación y modificación (ISO strings).

Operaciones disponibles desde la UI:

- Listar todas las tareas.
- Agregar una nueva tarea.
- Marcar una tarea como completada o pendiente.

Operaciones disponibles en código (no expuestas todavía en la UI):

- Buscar por id.
- Actualizar título/descripción.
- Eliminar una tarea.

**¿Por qué este feature es buen ejemplo didáctico?**
Tiene las cinco capas clásicas de Clean Architecture/Hexagonal en muy pocos archivos: dominio, aplicación, infraestructura, composition root (acciones de servidor + ruta API) y presentación (componentes + página). Si entiendes este feature, puedes replicar el patrón en cualquier otro.

**Stack involucrado:**

- Next.js 16 (App Router) + React 19
- TypeScript con `paths` `@/*` → `./src/*`
- Prisma 7 + PostgreSQL (vía `@prisma/adapter-pg`)
- Tailwind v4 + shadcn/ui (estilo `new-york`)

---

## 2. Mapa arquitectónico del feature

```
                              ┌──────────────────────┐
                              │   app/todos/page.tsx │  ← Server Component
                              │   (Composition Root) │
                              └──────────┬───────────┘
                                         │ ejecuta + inyecta acciones por props
                                         ▼
        ┌────────────────────────────────────────────────────┐
  UI    │  components/TodoInput.tsx   components/TodoItem.tsx │  ← Client Components
        └─────────────────┬──────────────────┬────────────────┘
                          │ onAdd (prop)     │ onToggle (prop)
                          ▼                  ▼
        ┌──────────────────────────────────────────────────────┐
 ACTION │             actions/todos.actions.ts                  │  ← Composition Root
        │             "use server" + revalidatePath             │     (Server Actions)
        └─────────────────┬─────────────────────────────────────┘
                          │ new AddTodo(TodoPrismaRepository).execute(...)
                          ▼
        ┌──────────────────────────────────────────────────────┐
  APP   │   application/use-cases/                              │  ← Casos de uso
        │   GetTodos · AddTodo · UpdateTodo · DeleteTodo ·      │     (orquestan)
        │   FindById · ToggleTodoCompletion                     │
        │                                                       │
        │   application/schemas/todoFormSchema.ts (Zod)         │  ← Adapter de validación
        │   application/validation/createTodo.ts  (factory)     │
        └─────────────────┬─────────────────────────────────────┘
                          │ this.todoRepository.xxx(...)
                          ▼
        ┌──────────────────────────────────────────────────────┐
DOMAIN  │   domain/entities/Todo.ts        (solo interface)     │  ← Núcleo
        │   domain/repositories/TodoRepository.ts  (interface)  │     (cero deps)
        │   domain/errors/TodoValidationError.ts                │
        └─────────────────▲─────────────────────────────────────┘
                          │ implementa
        ┌─────────────────┴─────────────────────────────────────┐
 INFRA  │   infrastructure/repositories/TodoPrismaRepository.ts │  ← Adapter
        │   ↳ usa prisma (singleton compartido)                 │
        └───────────────────────────────────────────────────────┘
```

### Tabla de archivos por capa

| #   | Archivo                                                                                                                                             | Capa                                     | Existe   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------- |
| 1   | [src/features/todos/domain/entities/Todo.ts](../src/features/todos/domain/entities/Todo.ts)                                                         | Dominio (Entidad)                        | ✅       |
| 2   | [src/features/todos/domain/repositories/TodoRepository.ts](../src/features/todos/domain/repositories/TodoRepository.ts)                             | Dominio (Puerto)                         | ✅       |
| 3   | [src/features/todos/domain/errors/TodoValidationError.ts](../src/features/todos/domain/errors/TodoValidationError.ts)                               | Dominio (Error)                          | ✅       |
| 4   | [src/features/todos/application/schemas/todoFormSchema.ts](../src/features/todos/application/schemas/todoFormSchema.ts)                             | Aplicación (Schema Zod)                  | ✅       |
| 5   | [src/features/todos/application/validation/createTodo.ts](../src/features/todos/application/validation/createTodo.ts)                               | Aplicación (Factory)                     | ✅       |
| 6   | [src/features/todos/application/use-cases/GetTodos.ts](../src/features/todos/application/use-cases/GetTodos.ts)                                     | Aplicación                               | ✅       |
| 7   | [src/features/todos/application/use-cases/FindById.ts](../src/features/todos/application/use-cases/FindById.ts)                                     | Aplicación                               | ✅       |
| 8   | [src/features/todos/application/use-cases/AddTodo.ts](../src/features/todos/application/use-cases/AddTodo.ts)                                       | Aplicación                               | ✅       |
| 9   | [src/features/todos/application/use-cases/UpdateTodo.ts](../src/features/todos/application/use-cases/UpdateTodo.ts)                                 | Aplicación                               | ✅       |
| 10  | [src/features/todos/application/use-cases/DeleteTodo.ts](../src/features/todos/application/use-cases/DeleteTodo.ts)                                 | Aplicación                               | ✅       |
| 11  | [src/features/todos/application/use-cases/ToggleTodoCompletion.ts](../src/features/todos/application/use-cases/ToggleTodoCompletion.ts)             | Aplicación                               | ✅       |
| 12  | [prisma/schema.prisma](../prisma/schema.prisma)                                                                                                     | Infraestructura (esquema DB)             | ✅       |
| 13  | [src/shared/infrastructure/database/prisma/prisma.client.ts](../src/shared/infrastructure/database/prisma/prisma.client.ts)                         | Infraestructura (cliente DB compartido)  | ✅       |
| 14  | [src/features/todos/infrastructure/repositories/TodoPrismaRepository.ts](../src/features/todos/infrastructure/repositories/TodoPrismaRepository.ts) | Infraestructura (Adapter)                | ✅       |
| 15  | [src/app/api/todos/route.ts](../src/app/api/todos/route.ts)                                                                                         | Composition Root (Route Handler)         | ✅       |
| 16  | [src/features/todos/actions/todos.actions.ts](../src/features/todos/actions/todos.actions.ts)                                                       | Composition Root (Server Action)         | ✅       |
| 17  | [src/features/todos/components/TodoInput.tsx](../src/features/todos/components/TodoInput.tsx)                                                       | Presentación (Client)                    | ✅       |
| 18  | [src/features/todos/components/TodoItem.tsx](../src/features/todos/components/TodoItem.tsx)                                                         | Presentación (Client)                    | ✅       |
| 19  | [src/features/todos/components/TodoActions.tsx](../src/features/todos/components/TodoActions.tsx)                                                   | Presentación (Client)                    | ⚠️ vacío |
| 20  | [src/app/todos/page.tsx](../src/app/todos/page.tsx)                                                                                                 | Presentación (Server) + Composition Root | ✅       |

---

## 3. Las tres reglas de oro

Antes de tocar un archivo, internaliza esto. Si dudas en el diseño, vuelve a estas tres reglas.

1. **Las dependencias siempre apuntan hacia adentro.**
   UI → Aplicación → Dominio. Nunca al revés. El dominio jamás debería importar de `react`, `next`, `prisma`, `@prisma/...`, ni de tus propios componentes UI.

2. **El dominio no sabe nada del mundo exterior.**
   No conoce React, Next, Prisma, HTTP, fetch, ni el reloj del sistema. Si tu entidad necesita un `id` o `createdAt`, esos valores deben ser **inyectados** por capas exteriores.

3. **La aplicación no conoce Prisma.**
   Solo conoce la _interfaz_ `TodoRepository`. Esto se llama **Dependency Inversion** y es la clave que te permite testear casos de uso sin base de datos.

> **SOLID en una mirada**
>
> - **S**ingle Responsibility: cada archivo tiene una sola razón para cambiar.
> - **O**pen/Closed: agregamos funcionalidad con archivos nuevos, no modificando existentes.
> - **L**iskov: cualquier implementación de `TodoRepository` (Prisma, in-memory, mock) es intercambiable.
> - **I**nterface Segregation: `TodoRepository` expone solo lo necesario, sin métodos de más.
> - **D**ependency Inversion: la aplicación depende de abstracciones (interfaz), no de detalles (Prisma).

---

## 4. Paso 1 — Capa de Dominio

> **Mantra del paso:** "Defino el qué, no el cómo."

Aquí construyes el corazón del feature: la entidad y su contrato de persistencia. Nadie depende de capas más externas, y todo lo demás dependerá de estas dos piezas.

### 4.1 `src/features/todos/domain/entities/Todo.ts`

**Responsabilidad:** Modelar qué es un Todo. Nada más. Es un **tipo plano** sin comportamiento.

**Por qué primero:** Es el núcleo. Tiene cero dependencias. Cualquier cambio aquí se propaga a todo el sistema, así que conviene cerrarlo bien antes de seguir.

**Capa hexagonal:** Entidad de Dominio (las "Enterprise Business Rules" de Uncle Bob).

**Reglas SOLID aplicadas:**

- **SRP:** solo describe la forma de un Todo. La validación vive en `application/validation/createTodo.ts`; el error de validación vive en `domain/errors/TodoValidationError.ts`. **Cada archivo tiene una sola razón para cambiar.**
- **DIP:** si mañana cambias la librería de validación (Zod → Valibot → Yup), no tocas este archivo.

**Conexiones:** ninguna. Cero `import` desde otros archivos. Tampoco importa `zod`.

**Código actual:**

```typescript
// src/features/todos/domain/entities/Todo.ts
export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Detalles clave que un Junior debe ver:**

- Las fechas son `string` (ISO 8601), no `Date`. Esto evita problemas de serialización entre servidor y cliente en React (los objetos `Date` no sobreviven al puente RSC/Client).
- **No hay `createTodo` aquí.** Antes existía dentro de este archivo, pero al introducir Zod + React Hook Form se separó. La razón: si la regla "título mínimo 8 caracteres" estuviera definida con `z.string().min(8)` _aquí_, el dominio importaría Zod — y un cambio de librería tocaría el dominio. **El dominio no debe saber qué librería se usa para validar.**
- **No hay `TodoValidationError` aquí tampoco.** Vive en [`domain/errors/TodoValidationError.ts`](../src/features/todos/domain/errors/TodoValidationError.ts) — sigue siendo dominio (no depende de framework), pero está en su propio archivo (SRP).
- El `id` lo recibe la entidad; **el dominio no genera identificadores**. Eso es responsabilidad de capas externas (composition root).

> #### ✅ Checkpoint 4.1 — Verificar que el dominio compila
>
> Como la entidad ahora es solo un tipo, no hay nada que ejecutar. La validación es estática:
>
> ```bash
> pnpm tsc --noEmit
> ```
>
> Si compila, avanza al 4.2. La factory `createTodo` aparece en **5.2**, después de la capa de aplicación.

---

### 4.2 `src/features/todos/domain/repositories/TodoRepository.ts`

**Responsabilidad:** Declarar el **contrato** que cualquier implementación de persistencia debe cumplir.

**Por qué ahora:** Es la abstracción que permitirá invertir la dependencia. La capa de aplicación va a programar **contra esta interfaz**, no contra Prisma. Esto es lo que te da la libertad de cambiar de base de datos sin tocar la lógica.

**Capa hexagonal:** Puerto (Port) de Dominio.

**Reglas SOLID aplicadas:**

- **DIP:** los casos de uso dependerán de esta interfaz, no de Prisma. La dirección de dependencia queda invertida (la infraestructura depende del dominio, no al revés).
- **ISP:** expone solo cinco métodos atómicos. No tiene métodos "rellenos" ni opcionales.
- **LSP:** cualquier implementación válida (Prisma, in-memory, Mongo, mock) puede sustituir a otra sin romper la aplicación.

**Conexiones:** importa solo el tipo `Todo` de la misma capa de dominio.

**Código actual:**

```typescript
// src/features/todos/domain/repositories/TodoRepository.ts
import { Todo } from "../entities/Todo";

export interface TodoRepository {
  getTodos: () => Promise<Todo[]>;
  findById: (id: Todo["id"]) => Promise<Todo | null>;
  addTodo: (todo: Todo) => Promise<void>;
  updateTodo: (todo: Todo) => Promise<void>;
  deleteTodo: (id: Todo["id"]) => Promise<void>;
}
```

**Detalles clave:**

- `Todo["id"]` extrae el tipo del id desde la entidad. Si mañana cambias `id` a `number`, todas las firmas se ajustan automáticamente.
- Todos los métodos son `Promise<...>` porque la persistencia real será asíncrona. Esto es una **concesión necesaria** al mundo real (en estricta teoría hexagonal, podrías esconder el async, pero en TypeScript moderno el costo no compensa).
- No hay `try/catch` aquí. La interfaz no decide cómo se manejan errores: cada implementación lanza lo que tenga sentido.

> #### ✅ Checkpoint 4.2 — Verificar que la interfaz compila
>
> Una interfaz no tiene comportamiento ejecutable. La validación es estática:
>
> ```bash
> pnpm tsc --noEmit
> ```
>
> Si no hay errores, la interfaz está bien escrita. **Avanza al 4.3.**

---

### 4.3 `src/features/todos/domain/errors/TodoValidationError.ts`

**Responsabilidad:** Modelar el error que se lanza cuando un `Todo` no cumple sus reglas de validación, con un mapa de errores por campo.

**Por qué está en `domain/` y no en `application/`:** El error representa una **violación de invariante de negocio** ("este título no es aceptable"). No depende de ninguna librería (ni Zod, ni React, ni Next). Cualquier capa puede atraparlo. Vive en el dominio porque ahí es donde se origina conceptualmente, aunque el momento físico del `throw` ocurre en la factory de `application/validation/createTodo.ts`.

**Capa hexagonal:** Error de Dominio.

**Reglas SOLID aplicadas:**

- **SRP:** una sola razón para cambiar — el shape del mapa de errores.
- **OCP:** el genérico `<TField extends string>` permite que distintos casos de uso lo tipen con sus propios campos sin tocar este archivo.

**Conexiones:** ninguna. Cero imports.

**Código actual:**

```typescript
// src/features/todos/domain/errors/TodoValidationError.ts
export class TodoValidationError<TField extends string = string> extends Error {
  constructor(
    public readonly fieldErrors: Partial<Record<TField, string>>,
  ) {
    super("Todo validation failed");
    this.name = "TodoValidationError";
  }
}
```

**Detalles clave que un Junior debe ver:**

- **`<TField extends string = string>`** permite que el caller especifique qué campos puede contener el mapa. La factory de la app lo instancia como `TodoValidationError<TodoField>` (donde `TodoField = "title" | "description"`), pero al atraparlo en otra capa, TypeScript lo verá como `TodoValidationError<string>` (el default). Esto evita acoplar el dominio a los campos del formulario.
- **`Partial<Record<...>>`** porque no todos los campos siempre fallan a la vez. Si solo el `title` es corto, el mapa será `{ title: "Title must be at least 8 characters" }`.
- **Extiende `Error` nativo** para que `instanceof TodoValidationError` funcione y para que stack traces se preserven.

> #### ✅ Checkpoint 4.3 — Verificar tipos
>
> ```bash
> pnpm tsc --noEmit
> ```
>
> Si compila, **avanza al Paso 2.**

---

## 5. Paso 2 — Capa de Aplicación (Schemas, Validación y Casos de Uso)

> **Mantra del paso:** "Orquesto, no implemento. Y traduzco el mundo (formularios, schemas) a entidades de dominio."

La capa de aplicación contiene tres tipos de archivos:

1. **Schemas (`application/schemas/`)** — definen cómo se valida la **entrada** del mundo exterior (formularios, body de HTTP). Es un detalle de implementación (hoy Zod, mañana podría ser otra cosa).
2. **Validación (`application/validation/`)** — la **factory** que usa el schema y produce una entidad de dominio válida (o lanza un `TodoValidationError` del dominio).
3. **Casos de uso (`application/use-cases/`)** — orquestan las llamadas al repositorio y a la factory.

> **¿Por qué la factory `createTodo` vive en `application/` y no en `domain/`?**
>
> Porque la implementación más cómoda usa Zod para parsear y mapear errores. Si la dejáramos en `domain/`, el dominio importaría Zod — y un cambio de librería tocaría el núcleo. Al ponerla aquí, el dominio queda **puramente declarativo** (solo tipos + errores) y la "decisión técnica de cómo validar" queda contenida en una sola capa.

### 5.1 `src/features/todos/application/schemas/todoFormSchema.ts`

**Responsabilidad:** Definir el contrato de validación de un Todo en términos de un schema Zod, y exportar los tipos derivados que la UI y el composition root pueden tipar contra él.

**Por qué primero dentro de la app:** Es lo que `createTodo` (5.2) consumirá. También es lo que el formulario en `TodoInput` consume vía `zodResolver`. Ambos comparten **una sola fuente de verdad para las reglas de validación**.

**Capa hexagonal:** Adapter de validación (driving side). Es un detalle de la capa de aplicación.

**Reglas SOLID aplicadas:**

- **SRP:** este archivo solo describe "qué hace que la entrada sea aceptable".
- **DRY:** la regla "mínimo 8 caracteres" está aquí una sola vez. La UI la ve vía `zodResolver`; el servidor la ve vía `createTodo`.

**Conexiones:** importa `zod`. Cero imports del dominio (las reglas del schema deben replicar — no derivar — los invariantes del dominio cuando aplican; si la entidad del dominio define una constante como `TODO_MIN_LENGTH` en el futuro, este archivo podría importarla).

**Código actual:**

```typescript
// src/features/todos/application/schemas/todoFormSchema.ts
import { z } from "zod";

const MIN_LENGTH = 8;

export const todoFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(MIN_LENGTH, `Title must be at least ${MIN_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .min(MIN_LENGTH, `Description must be at least ${MIN_LENGTH} characters`),
});

export type TodoFormValues = z.infer<typeof todoFormSchema>;
export type TodoField = keyof TodoFormValues;
```

**Detalles clave:**

- **`z.infer<typeof todoFormSchema>`** deriva el tipo de los valores del formulario directamente del schema. Si añades un campo `dueDate`, el tipo se actualiza solo — y TS te marcará dónde falta manejarlo.
- **`TodoField`** es la unión de las llaves (`"title" | "description"`). Se usa para tipar el mapa de errores en `createTodo` (5.2) y en la Server Action (Paso 5).
- **`.trim()` dentro del schema** garantiza que tanto la UI como el servidor reciban valores normalizados, sin tener que repetir `.trim()` manualmente en cada handler.

### 5.2 `src/features/todos/application/validation/createTodo.ts`

**Responsabilidad:** Tomar un `Todo` (potencialmente sucio, recién armado por el composition root) y devolverlo **validado y normalizado**, o lanzar `TodoValidationError` con el mapa de errores por campo.

**Capa hexagonal:** Factory de la capa de aplicación. Es el puente entre "datos crudos del mundo" y "entidad de dominio válida".

**Reglas SOLID aplicadas:**

- **SRP:** una sola responsabilidad — traducir el resultado de Zod a un `Todo` válido o a un error de dominio.
- **DIP:** depende de la **abstracción** (el error del dominio + el schema como contrato) — si cambias el schema, esta función sigue funcionando mientras el schema siga exponiendo `title` y `description`.

**Conexiones:** importa el tipo `Todo` (dominio), `TodoValidationError` (dominio) y `todoFormSchema` + `TodoField` (application/schemas).

**Código actual:**

```typescript
// src/features/todos/application/validation/createTodo.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoValidationError } from "../../domain/errors/TodoValidationError";
import { todoFormSchema, type TodoField } from "../schemas/todoFormSchema";

export function createTodo(input: Todo): Todo {
  const parsed = todoFormSchema.safeParse({
    title: input.title,
    description: input.description,
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<TodoField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as TodoField;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    throw new TodoValidationError<TodoField>(fieldErrors);
  }

  return { ...input, ...parsed.data };
}
```

**Detalles clave:**

- **`safeParse` (no `parse`):** evita que Zod lance su propio `ZodError`. Queremos lanzar el error **del dominio**, no un error de la librería de validación.
- **Solo se acumula el primer issue por campo:** `if (!fieldErrors[field])`. Si Zod genera varios issues para el mismo campo, mostramos solo el primero. Es una decisión de UX para no abrumar al usuario.
- **`return { ...input, ...parsed.data }`** preserva `id`, `completed`, `createdAt`, `updatedAt` del input original, pero sobrescribe `title` y `description` con las versiones **trimmed** que Zod produjo. Esto es la "normalización" en la práctica.
- **El throw usa `TodoValidationError<TodoField>`** para que el caller pueda tipar el mapa con seguridad.

> #### ✅ Checkpoint 5.1+5.2 — Validar el factory sin DB
>
> ```ts
> // scratch-factory.ts
> import { createTodo } from "./src/features/todos/application/validation/createTodo";
> import { TodoValidationError } from "./src/features/todos/domain/errors/TodoValidationError";
>
> const now = new Date().toISOString();
>
> // Caso feliz
> const ok = createTodo({
>   id: "1",
>   title: "Comprar pan integral",
>   description: "Pasar por la panadería de la esquina",
>   completed: false,
>   createdAt: now,
>   updatedAt: now,
> });
> console.log("✅ Todo válido:", ok);
>
> // Caso de error
> try {
>   createTodo({
>     id: "2",
>     title: "Hi",
>     description: "short",
>     completed: false,
>     createdAt: now,
>     updatedAt: now,
>   });
> } catch (e) {
>   if (e instanceof TodoValidationError) {
>     console.log("✅ Rechazado con field errors:", e.fieldErrors);
>     // Esperado: { title: "Title must...", description: "Description must..." }
>   }
> }
> ```
>
> `pnpm tsx scratch-factory.ts` debe mostrar el mapa con dos campos en error. Si funciona, **avanza a los casos de uso (5.3)**.

---

> Las siguientes subsecciones describen los casos de uso. Cada uno responde a **una intención del usuario** ("crear", "listar", "marcar completado") y orquesta llamadas al repositorio. Usan **inyección de dependencia por constructor**: reciben un `TodoRepository` y lo guardan como `private readonly`.

El patrón es muy uniforme:

```typescript
export class NombreDelCasoDeUso {
  constructor(private readonly todoRepository: TodoRepository) {}
  async execute(/* input */): Promise<Resultado> {
    /* ... */
  }
}
```

Esta uniformidad facilita el reconocimiento de patrones y abre la puerta a un futuro [Command Bus](https://martinfowler.com/eaaCatalog/commandPattern.html) si la app crece.

### Orden recomendado de creación (de más simple a más complejo)

Aquí no importa empezar por el "más útil", sino por el **más simple** para internalizar el patrón.

### 5.3 `GetTodos.ts` (el más simple, empieza aquí)

```typescript
// src/features/todos/application/use-cases/GetTodos.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class GetTodos {
  constructor(private readonly todoRepository: TodoRepository) {}

  execute(): Promise<Todo[]> {
    return this.todoRepository.getTodos();
  }
}
```

**Responsabilidad:** delegar la lectura al repositorio. Nada más.

**SOLID:** SRP (una intención: leer todos) + DIP (depende de la interfaz).

### 5.4 `FindById.ts`

```typescript
// src/features/todos/application/use-cases/FindById.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class FindById {
  constructor(private readonly todoRepository: TodoRepository) {}

  execute(id: Todo["id"]): Promise<Todo | null> {
    return this.todoRepository.findById(id);
  }
}
```

**Por qué crearlo ahora:** Otros casos de uso (`DeleteTodo`, `UpdateTodo`, `ToggleTodoCompletion`) verifican existencia antes de mutar. Tenerlo disponible te ahorra duplicar lógica.

### 5.5 `AddTodo.ts`

```typescript
// src/features/todos/application/use-cases/AddTodo.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";
import { createTodo } from "../validation/createTodo";

export class AddTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  execute(todo: Todo): Promise<void> {
    return this.todoRepository.addTodo(createTodo(todo));
  }
}
```

**Detalle clave:** `createTodo(todo)` (importado desde `../validation/createTodo`) aplica las validaciones **antes** de tocar el repositorio. Si el título es inválido, lanza `TodoValidationError` y la persistencia nunca ocurre.

**Quién genera el id y los timestamps:** el composition root. El caso de uso solo recibe un `Todo` ya completo. Cuando lleguemos al Paso 5 (Server Actions), verás esto en acción.

### 5.6 `UpdateTodo.ts`

```typescript
// src/features/todos/application/use-cases/UpdateTodo.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";
import { createTodo } from "../validation/createTodo";

type UpdateTodoInput = Pick<Todo, "id" | "title" | "description">;

export class UpdateTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(input: UpdateTodoInput): Promise<void> {
    const existing = await this.todoRepository.findById(input.id);
    if (!existing) {
      throw new Error(`Todo with id ${input.id} not found`);
    }
    const updated = createTodo({
      ...existing,
      title: input.title,
      description: input.description,
      updatedAt: new Date().toISOString(),
    });
    await this.todoRepository.updateTodo(updated);
  }
}
```

**Detalle clave 1:** `UpdateTodoInput = Pick<Todo, "id" | "title" | "description">` declara explícitamente qué campos se pueden modificar por esta vía. Si alguien intenta cambiar `completed` por aquí, TypeScript lo rechaza en compilación.

**Detalle clave 2:** Se verifica existencia primero (`findById`) y se vuelve a validar la entidad completa con `createTodo`. Es la **trinidad defensiva**: existe → válido → persiste.

> **Nota del Senior:** este caso de uso _sí_ genera `updatedAt: new Date().toISOString()` dentro del propio caso de uso. Es un caso límite: el reloj es un detalle del mundo. Idealmente se inyectaría como dependencia (`clock: () => string`). En esta aplicación se acepta esta simplificación porque el costo de inyectarlo no compensa al tamaño actual. Cuando crezca, vale la pena refactorizarlo.

### 5.7 `DeleteTodo.ts`

```typescript
// src/features/todos/application/use-cases/DeleteTodo.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class DeleteTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(id: Todo["id"]): Promise<void> {
    const existing = await this.todoRepository.findById(id);
    if (!existing) {
      throw new Error(`Todo with id ${id} not found`);
    }
    await this.todoRepository.deleteTodo(id);
  }
}
```

**Por qué el check previo:** si simplemente llamáramos a `deleteTodo(id)` con un id inexistente, Prisma lanzaría `P2025` ("Record to delete does not exist"). El check explícito te permite **traducir** ese caso a un mensaje de dominio claro.

### 5.8 `ToggleTodoCompletion.ts`

```typescript
// src/features/todos/application/use-cases/ToggleTodoCompletion.ts
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class ToggleTodoCompletion {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(id: Todo["id"]): Promise<void> {
    const existing = await this.todoRepository.findById(id);
    if (!existing) {
      throw new Error(`Todo with id ${id} not found`);
    }
    await this.todoRepository.updateTodo({
      ...existing,
      completed: !existing.completed,
      updatedAt: new Date().toISOString(),
    });
  }
}
```

**Detalle clave:** la operación es "leer → modificar en memoria → escribir". Es lo más cercano a una transacción atómica que tenemos a este nivel.

> #### ✅ Checkpoint 5 — Probar TODA la capa de aplicación sin base de datos
>
> Esta es la prueba más importante de Clean Architecture. Vas a verificar que los casos de uso funcionan **sin tocar Prisma ni Postgres**. Lo logras inyectando un **mock repository** en memoria. Los casos de uso seguirán llamando a `createTodo` desde `application/validation/`, así que las reglas de Zod siguen vigentes — solo que la persistencia está mockeada.
>
> Crea un archivo temporal `scratch-app.ts` y pega esto:
>
> ```ts
> import { Todo } from "./src/features/todos/domain/entities/Todo";
> import { TodoRepository } from "./src/features/todos/domain/repositories/TodoRepository";
> import { AddTodo } from "./src/features/todos/application/use-cases/AddTodo";
> import { GetTodos } from "./src/features/todos/application/use-cases/GetTodos";
> import { ToggleTodoCompletion } from "./src/features/todos/application/use-cases/ToggleTodoCompletion";
>
> // Mock repository en memoria (10 líneas y listo)
> const data: Todo[] = [];
> const mockRepo: TodoRepository = {
>   getTodos: async () => [...data],
>   findById: async (id) => data.find((t) => t.id === id) ?? null,
>   addTodo: async (todo) => void data.push(todo),
>   updateTodo: async (todo) => {
>     const i = data.findIndex((t) => t.id === todo.id);
>     if (i >= 0) data[i] = todo;
>   },
>   deleteTodo: async (id) => {
>     const i = data.findIndex((t) => t.id === id);
>     if (i >= 0) data.splice(i, 1);
>   },
> };
>
> async function main() {
>   const now = new Date().toISOString();
>   await new AddTodo(mockRepo).execute({
>     id: crypto.randomUUID(),
>     title: "Aprender Clean Architecture",
>     description: "Empezar por la capa de dominio",
>     completed: false,
>     createdAt: now,
>     updatedAt: now,
>   });
>
>   console.log("Después de AddTodo:", await new GetTodos(mockRepo).execute());
>
>   const [first] = await new GetTodos(mockRepo).execute();
>   await new ToggleTodoCompletion(mockRepo).execute(first.id);
>
>   console.log("Después de Toggle:", await new GetTodos(mockRepo).execute());
> }
> main();
> ```
>
> Ejecuta:
>
> ```bash
> pnpm tsx scratch-app.ts
> ```
>
> **Deberías ver** el todo recién creado, y luego el mismo todo con `completed: true`. Si esto funciona, **toda la lógica de negocio está validada sin base de datos**. Avanza al Paso 3.

---

## 6. Paso 3 — Capa de Infraestructura

> **Mantra del paso:** "Implemento el contrato del dominio usando un detalle concreto."

Aquí conectamos la lógica con el mundo real (PostgreSQL vía Prisma). Crearemos tres archivos en orden:

1. El esquema de la base de datos.
2. El cliente Prisma compartido.
3. El adaptador que implementa `TodoRepository`.

### 6.1 `prisma/schema.prisma`

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/shared/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Todo {
  id          String   @id @default(cuid())
  title       String
  description String   @default("")
  completed   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now()) @updatedAt
}
```

**Detalles clave:**

- `output = "../src/shared/generated/prisma"` ⇒ el cliente generado vive **dentro del repositorio**, no en `node_modules/@prisma/client`. Esto es intencional y se importa como `@/shared/generated/prisma/client`.
- El modelo `Todo` usa `DateTime` (tipo Prisma) mientras que la entidad de dominio usa `string`. Esa **traducción** es responsabilidad del adapter (lo verás en 6.3).
- `@id @default(cuid())` permite a Prisma generar el id si no lo provees. Aunque la app actual lo genera externamente (en el composition root), tener el default es defensivo.

**Aplica el esquema a la base de datos:**

```bash
# 1) Sincroniza el schema con la DB y regenera el cliente
pnpm prisma db push

# 2) (Opcional) Visualiza la tabla recién creada
pnpm prisma studio
```

> **Recordatorio:** en este proyecto se prefiere `db push` por sobre `migrate dev` para el flujo de desarrollo. Consulta [CLAUDE.md](../CLAUDE.md) si tienes dudas.

### 6.2 `src/shared/infrastructure/database/prisma/prisma.client.ts`

**Responsabilidad:** Crear y exportar **una sola instancia** del cliente Prisma para toda la aplicación.

**Por qué está en `shared/` y no en `features/todos/`:** Mañana habrá más features (`users`, etc.) que también querrán acceder a la base de datos. El cliente es transversal, no exclusivo de Todos.

```typescript
// src/shared/infrastructure/database/prisma/prisma.client.ts
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/shared/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });
}

type PrismaPrismaSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaPrismaSingleton;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Detalles clave que un Junior debe entender:**

- `import "server-only";` ⇒ si alguien intenta importar este archivo desde un Client Component, **el build de Next falla**. Esto es deliberado: previene fugas accidentales del cliente DB al navegador.
- **Patrón singleton con `globalThis`:** durante desarrollo, Next aplica hot-reload. Sin este patrón, cada reload crearía un nuevo `PrismaClient`, saturando conexiones. En producción no se aplica para evitar memoria fantasma.
- `PrismaPg` ⇒ adapter específico para PostgreSQL. Necesario porque este proyecto usa el adapter explícito en lugar del driver por defecto.
- Logs verbosos en desarrollo, solo errores en producción. Sin esto, te perderías queries SQL útiles al depurar.

### 6.3 `src/features/todos/infrastructure/repositories/TodoPrismaRepository.ts`

**Responsabilidad:** Implementar la interfaz `TodoRepository` usando Prisma + PostgreSQL.

**Por qué ahora:** Ya tienes el esquema en DB, el cliente listo y la interfaz que cumplir. Es el momento de "cerrar" la capa.

**Capa hexagonal:** Adapter (Infraestructura).

**Reglas SOLID aplicadas:**

- **LSP:** este adapter es 100% intercambiable con cualquier otro `TodoRepository`.
- **DIP cumplido:** la dirección de la flecha de dependencia está invertida — el dominio define la interfaz; la infraestructura la implementa.

**Código actual:**

```typescript
// src/features/todos/infrastructure/repositories/TodoPrismaRepository.ts
import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

type TodoRow = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const toDomain = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const TodoPrismaRepository: TodoRepository = {
  getTodos: async () => {
    const rows = await prisma.todo.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  },

  findById: async (id) => {
    const row = await prisma.todo.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  addTodo: async (todo) => {
    await prisma.todo.create({
      data: {
        id: todo.id,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt),
      },
    });
  },

  updateTodo: async ({ id, title, description, completed }) => {
    await prisma.todo.update({
      where: { id },
      data: { title, description, completed },
    });
  },

  deleteTodo: async (id) => {
    await prisma.todo.delete({ where: { id } });
  },
};
```

**El patrón anti-fuga: `toDomain()`**

Esta función es **la frontera técnica** entre Prisma y el dominio. Prisma devuelve `Date` (objeto JS); el dominio espera `string` ISO. Si no tuvieras `toDomain`, el `Date` de Prisma se filtraría hacia los casos de uso y al cliente React, causando bugs sutiles.

```typescript
const toDomain = (row: TodoRow): Todo => ({
  // ...
  createdAt: row.createdAt.toISOString(), // ← conversión clave
  updatedAt: row.updatedAt.toISOString(),
});
```

Y al insertar/actualizar, el adapter convierte de vuelta:

```typescript
createdAt: new Date(todo.createdAt), // string ISO → Date
```

> #### ✅ Checkpoint 6 — Validar la persistencia real
>
> 1. Asegúrate de que tu `.env` tiene `DATABASE_URL=postgresql://...` apuntando a una DB válida.
> 2. Aplica el schema: `pnpm prisma db push`.
> 3. Crea `scratch-infra.ts`:
>
>    ```ts
>    import { TodoPrismaRepository } from "./src/features/todos/infrastructure/repositories/TodoPrismaRepository";
>    import { AddTodo } from "./src/features/todos/application/use-cases/AddTodo";
>    import { GetTodos } from "./src/features/todos/application/use-cases/GetTodos";
>
>    async function main() {
>      const now = new Date().toISOString();
>      await new AddTodo(TodoPrismaRepository).execute({
>        id: crypto.randomUUID(),
>        title: "Mi primer todo persistido",
>        description: "Probando que el adapter funciona end-to-end",
>        completed: false,
>        createdAt: now,
>        updatedAt: now,
>      });
>
>      const todos = await new GetTodos(TodoPrismaRepository).execute();
>      console.log("Todos en la DB:", todos);
>    }
>    main();
>    ```
>
> 4. Ejecuta: `pnpm tsx scratch-infra.ts`.
> 5. Abre `pnpm prisma studio` y confirma visualmente que la fila aparece en la tabla `Todo`.
>
> **Aquí es la primera vez que tocamos PostgreSQL real.** Si esto funciona, ya tienes el feature funcional sin UI ni HTTP — toda la lógica está validada. Avanza al Paso 4.

---

## 7. Paso 4 — API Routes (puerto HTTP opcional)

> **Mantra del paso:** "Mismo dominio, otro puerto."

### 7.1 `src/app/api/todos/route.ts`

**¿Es obligatorio?** No. Esta app **no consume el endpoint HTTP** desde su propio frontend (usa Server Actions). Pero está aquí como **referencia educativa** y para cuando aparezca un consumidor externo (app móvil, webhook, integración OAuth, script externo).

Si tienes dudas sobre cuándo usar Route Handler vs Server Action, consulta la guía dedicada: [docs/composition-roots.md](composition-roots.md).

**Capa hexagonal:** Composition Root (igual que las Server Actions, pero expuesto vía HTTP).

**Código actual:**

```typescript
// src/app/api/todos/route.ts
import { NextResponse } from "next/server";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { AddTodo } from "@/features/todos/application/use-cases/AddTodo";

export async function GET() {
  const todos = await new GetTodos(TodoPrismaRepository).execute();
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const todo = await req.json();
  await new AddTodo(TodoPrismaRepository).execute(todo);
  return NextResponse.json({ message: "Todo added" });
}
```

**Lo que estás viendo:**

- **El mismo patrón** que las Server Actions: instanciar el caso de uso con la implementación concreta del repositorio.
- Doctrina hexagonal demostrada: ni el caso de uso ni el dominio cambiaron por exponer HTTP. Solo se agregó otro **adapter de entrada** (driving adapter).

**Reglas SOLID aplicadas:**

- **SRP:** cada función HTTP responde a un único verbo + recurso.
- **DIP:** la elección concreta (`TodoPrismaRepository`) vive solo aquí, no escapa al dominio.

> #### ✅ Checkpoint 7 — Probar el endpoint con Postman/Thunder Client/curl
>
> Arranca el dev server:
>
> ```bash
> pnpm dev
> ```
>
> Y prueba:
>
> ```bash
> # GET todos los todos
> curl http://localhost:3000/api/todos
>
> # POST un todo nuevo
> curl -X POST http://localhost:3000/api/todos \
>   -H "Content-Type: application/json" \
>   -d '{
>     "id":"abc-123",
>     "title":"Probando desde curl",
>     "description":"Descripción suficientemente larga",
>     "completed":false,
>     "createdAt":"2025-01-01T00:00:00.000Z",
>     "updatedAt":"2025-01-01T00:00:00.000Z"
>   }'
> ```
>
> O equivalente en Thunder Client / Postman.
>
> **Aquí ya podemos probar GET/POST sin tener UI todavía.**

> ⚠️ **Limitación actual:** el handler no valida el body. Si alguien envía un JSON malformado, el error que verá es feo. Para un endpoint público real, usa [`zod`](https://zod.dev/) para validar antes de pasar al caso de uso. Esto se menciona en la sección 13 (Recomendaciones).

---

## 8. Paso 5 — Composition Root (Server Actions)

> **Mantra del paso:** "Aquí elijo concretos. Aquí proveo el reloj y el UUID."

### 8.1 `src/features/todos/actions/todos.actions.ts`

**Responsabilidad:** Componer todo el feature para ser consumido por la UI de Next, traduciendo entradas serializables a entidades de dominio, ejecutando el caso de uso correspondiente, y revalidando la cache de la página al terminar.

**Por qué se llama "Composition Root":** Es el único lugar en todo el feature donde se decide qué implementación concreta del repositorio se usa (`TodoPrismaRepository`). Si mañana cambias a Mongo, solo cambias aquí.

**Capa hexagonal:** Composition Root (driving adapter para la UI Next.js).

**Reglas SOLID aplicadas:**

- **SRP:** cada `xxxAction` exportada hace una sola cosa.
- **DIP:** "se rompe" intencionalmente la inversión — aquí _sí_ sabemos quién es `TodoPrismaRepository`, porque alguien tiene que decidirlo. Pero esa decisión está **aislada en este archivo**.

**Código actual:**

```typescript
// src/features/todos/actions/todos.actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { AddTodo } from "../application/use-cases/AddTodo";
import { ToggleTodoCompletion } from "../application/use-cases/ToggleTodoCompletion";
import { TodoPrismaRepository } from "../infrastructure/repositories/TodoPrismaRepository";
import { TodoValidationError } from "../domain/errors/TodoValidationError";
import {
  type TodoField,
  type TodoFormValues,
} from "../application/schemas/todoFormSchema";

export type AddTodoResult =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<keyof TodoFormValues | "form", string>>;
    };

export async function addTodoAction(
  title: string,
  description: string,
): Promise<AddTodoResult> {
  const now = new Date().toISOString();
  try {
    await new AddTodo(TodoPrismaRepository).execute({
      id: crypto.randomUUID(),
      title,
      description,
      completed: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    if (e instanceof TodoValidationError) {
      return {
        ok: false,
        errors: e.fieldErrors as Partial<Record<TodoField, string>>,
      };
    }
    return { ok: false, errors: { form: "Could not add todo. Try again." } };
  }

  revalidatePath("/todos");
  return { ok: true };
}

export async function toggleTodoAction(id: string): Promise<void> {
  await new ToggleTodoCompletion(TodoPrismaRepository).execute(id);
  revalidatePath("/todos");
}
```

**Detalles clave:**

- **`"use server"` en la primera línea:** marca el archivo como Server Action. Solo las funciones exportadas pueden invocarse desde el cliente vía RPC mágico de Next.
- **El composition root provee los "servicios del mundo":**
  - `crypto.randomUUID()` → el id.
  - `new Date().toISOString()` → el reloj.
  - El dominio nunca pidió estos servicios; los recibe ya resueltos.
- **Retorna `AddTodoResult` discriminado por `ok`:** en lugar de `Promise<void>`, la acción devuelve un objeto con un discriminante. Eso permite a la UI (`TodoInput`) decidir si limpiar el formulario o pintar errores **sin lanzar excepciones a través del puente RPC** — los errores viajan como datos, no como throws.
- **Atrapa `TodoValidationError` de la capa de dominio:** la capa de aplicación lanza el error con el shape `{ fieldErrors: Partial<Record<TodoField, string>> }`. El composition root **traduce** ese shape al contrato que la UI espera (`errors.title`, `errors.description`, `errors.form`).
- **`as Partial<Record<TodoField, string>>`:** el error de dominio es genérico (`<string>` por default). Al saber que `AddTodo` solo valida `title` y `description`, la action puede estrechar el tipo con seguridad.
- **`revalidatePath("/todos")` solo se llama si la mutación fue exitosa.** No tiene sentido invalidar la cache si la inserción falló por validación.

> #### ✅ Checkpoint 8 — Verificar Server Actions sin UI todavía
>
> En este punto no tenemos UI, pero podemos confirmar que el dev server arranca sin errores:
>
> ```bash
> pnpm dev
> ```
>
> Y opcionalmente, crear una página de prueba mínima `src/app/_test-actions/page.tsx`:
>
> ```tsx
> import { addTodoAction } from "@/features/todos/actions/todos.actions";
>
> export default function TestActionsPage() {
>   return (
>     <form
>       action={async () => {
>         "use server";
>         await addTodoAction(
>           "Probando Server Action",
>           "Sin ningún client component",
>         );
>       }}
>     >
>       <button type="submit">Crear todo de prueba</button>
>     </form>
>   );
> }
> ```
>
> Abre `http://localhost:3000/_test-actions`, presiona el botón, y verifica con Prisma Studio que el todo se creó. **Borra este archivo después** — es solo para validar.

---

## 9. Paso 6 — Componentes UI (Client Components)

> **Mantra del paso:** "El componente recibe sus dependencias, no las construye."

Los componentes deben ser **agnósticos** de qué Server Action concreta los respalda. Reciben funciones como props y las llaman. Esto los hace testeables con cualquier handler (mock, Storybook, e2e).

### 9.1 `src/features/todos/components/TodoInput.tsx`

**Responsabilidad:** Capturar título y descripción del usuario, validar **en cliente** vía Zod (UX rápida), llamar a `onAdd` y proyectar los errores que devuelva la action a los campos del formulario.

**Reglas SOLID aplicadas:**

- **SRP:** solo maneja el formulario, su estado de validación y la transición pending.
- **DIP (en versión UI):** depende de la **prop `onAdd`** (abstracción tipada por `AddTodoResult`), no de la Server Action concreta.

**Stack de validación:**

- **`react-hook-form`** maneja el estado del formulario.
- **`@hookform/resolvers/zod`** + `todoFormSchema` validan en cliente al hacer submit (`mode: "onSubmit"`).
- **Mismo schema que el servidor:** la regla "mínimo 8" no se duplica — se importa desde `application/schemas/todoFormSchema.ts`.

**Código actual:**

```tsx
// src/features/todos/components/TodoInput.tsx
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  todoFormSchema,
  type TodoFormValues,
} from "../application/schemas/todoFormSchema";
import type { AddTodoResult } from "../actions/todos.actions";

type Props = {
  onAdd: (title: string, description: string) => Promise<AddTodoResult>;
};

const TodoInput: React.FC<Props> = ({ onAdd }) => {
  const [isPending, startTransition] = useTransition();
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: { title: "", description: "" },
    mode: "onSubmit",
  });

  const onSubmit = (data: TodoFormValues) => {
    startTransition(async () => {
      const result = await onAdd(data.title, data.description);
      if (result.ok) {
        form.reset();
        return;
      }
      if (result.errors.title) {
        form.setError("title", { message: result.errors.title });
      }
      if (result.errors.description) {
        form.setError("description", { message: result.errors.description });
      }
      if (result.errors.form) {
        form.setError("root", { message: result.errors.form });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-3"
        noValidate
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Task title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Task title..." disabled={isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Task description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Description" rows={3} disabled={isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
};
export default TodoInput;
```

**Detalles clave:**

- **`"use client"`** porque usa estado de RHF y eventos del DOM.
- **Validación en dos capas que comparten schema:**
  1. **Cliente:** `zodResolver(todoFormSchema)` valida al submit. Si falla, los errores se pintan vía `<FormMessage />` sin nunca llegar al servidor.
  2. **Servidor:** si el cliente fue burlado (alguien deshabilitó JS, mandó la action por DevTools, etc.), `createTodo` en `application/validation/` vuelve a aplicar el mismo schema y lanza `TodoValidationError`. La action lo atrapa y devuelve `result.errors` que se proyectan a `form.setError(...)`.
- **Una sola fuente de verdad para las reglas:** ambos lados importan `todoFormSchema` desde `application/schemas/`. Si mañana subes el mínimo a 12, lo cambias en un solo archivo y los dos extremos quedan alineados.
- **`useTransition()`** marca el envío como una transición no urgente y expone `isPending`, evitando que tengas que manejar `loading` a mano.
- **El componente NO importa `addTodoAction`.** Eso lo hace la página y le pasa la función como prop. Esto es lo que mantiene al componente reutilizable y testeable.

### 9.2 `src/features/todos/components/TodoItem.tsx`

```tsx
// src/features/todos/components/TodoItem.tsx
"use client";

import { useTransition } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Todo } from "../domain/entities/Todo";

type Props = {
  todo: Todo;
  onToggle?: (id: string) => Promise<void>;
};

const TodoItem: React.FC<Props> = ({ todo, onToggle }) => {
  const [isPending, startTransition] = useTransition();

  const handleChange = () => {
    if (!onToggle) return;
    startTransition(() => onToggle(todo.id));
  };

  return (
    <label
      htmlFor={`todo-${todo.id}`}
      className={
        isPending
          ? "flex cursor-wait items-start gap-3 px-4 py-3 opacity-60 transition-colors"
          : "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      }
    >
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.completed}
        onCheckedChange={handleChange}
        disabled={isPending}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={
            todo.completed
              ? "text-sm text-muted-foreground line-through"
              : "text-sm text-foreground"
          }
        >
          {todo.title}
        </span>
        {todo.description && (
          <p
            className={
              todo.completed
                ? "whitespace-pre-wrap wrap-break-word text-xs text-muted-foreground/70 line-through"
                : "whitespace-pre-wrap wrap-break-word text-xs text-muted-foreground"
            }
          >
            {todo.description}
          </p>
        )}
      </div>
    </label>
  );
};
export default TodoItem;
```

**Detalles clave:**

- **Importa el tipo `Todo` desde el dominio.** Esto te da type safety end-to-end: si mañana agregas un campo a la entidad, TypeScript te avisa en este componente.
- `onToggle` es opcional. Útil para escenarios de solo-lectura (ej. un dashboard que muestra todos pero no permite cambiarlos).
- Usa `<label>` envolvente para que clickear cualquier parte (texto, checkbox) marque/desmarque — buena práctica de accesibilidad.

### 9.3 `src/features/todos/components/TodoActions.tsx`

```tsx
// src/features/todos/components/TodoActions.tsx
// (Archivo actualmente vacío — placeholder)
```

**Estado actual:** vacío. Pensado como ubicación futura para botones de "editar" y "eliminar" en cada tarea.

**Cuando lo implementes:** sigue el mismo patrón de props injection. Recibe `onDelete`, `onEdit`, etc. y deja que la página decida qué Server Action conectar.

> #### ✅ Checkpoint 9 — Renderizar los componentes con handlers mock
>
> Aún no necesitamos las Server Actions reales para ver los componentes en pantalla. Crea `src/app/_demo/page.tsx` temporal:
>
> ```tsx
> "use client";
>
> import TodoInput from "@/features/todos/components/TodoInput";
> import TodoItem from "@/features/todos/components/TodoItem";
>
> export default function DemoPage() {
>   const fakeTodo = {
>     id: "demo-1",
>     title: "Demo todo",
>     description: "Descripción de demo lo suficientemente larga",
>     completed: false,
>     createdAt: new Date().toISOString(),
>     updatedAt: new Date().toISOString(),
>   };
>
>   return (
>     <main className="p-8 max-w-xl mx-auto">
>       <TodoInput onAdd={async (t, d) => alert(`Mock add: ${t} / ${d}`)} />
>       <hr className="my-4" />
>       <TodoItem
>         todo={fakeTodo}
>         onToggle={async (id) => alert(`Mock toggle: ${id}`)}
>       />
>     </main>
>   );
> }
> ```
>
> Abre `http://localhost:3000/_demo`. Si los componentes se ven y los alerts disparan, los componentes están listos. **Borra el archivo después.**

---

## 10. Paso 7 — Página Next.js (Server Component)

> **Mantra del paso:** "La página ensambla todo. Es donde se encuentran los mundos servidor y cliente."

### 10.1 `src/app/todos/page.tsx`

**Responsabilidad:**

1. Ejecutar `GetTodos` para obtener los datos.
2. Renderizar la estructura visual.
3. Pasar las Server Actions como props a los Client Components.

**Capa hexagonal:** Presentación (Server Component) + Composition Root secundario (también ensambla `GetTodos`).

**Reglas SOLID aplicadas:**

- **SRP:** Lee → calcula stats → renderiza. Si crece más, divide en sub-componentes.
- **DIP:** Sigue dependiendo de los casos de uso, no de Prisma directamente.

**Código actual:**

```tsx
// src/app/todos/page.tsx
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import {
  addTodoAction,
  toggleTodoAction,
} from "@/features/todos/actions/todos.actions";
import TodoInput from "@/features/todos/components/TodoInput";
import TodoItem from "@/features/todos/components/TodoItem";

const TodosPage = async () => {
  const todos = await new GetTodos(TodoPrismaRepository).execute();
  const remaining = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Todo List
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your tasks in one place.
          </p>
        </header>

        <div className="mb-6">
          <TodoInput onAdd={addTodoAction} />
        </div>

        <ul className="divide-y divide-border rounded-lg border bg-card text-card-foreground shadow-sm">
          {todos.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No todos yet. Add one above to get started.
            </li>
          ) : (
            todos.map((todo) => (
              <li key={todo.id}>
                <TodoItem todo={todo} onToggle={toggleTodoAction} />
              </li>
            ))
          )}
        </ul>

        {todos.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {remaining} of {todos.length} remaining
          </p>
        )}
      </div>
    </main>
  );
};
export default TodosPage;
```

**Detalles clave que un Junior debe ver:**

- **Es `async`.** Server Components pueden esperar promesas directamente, sin `useEffect`.
- **No tiene `"use client"`.** Se ejecuta solo en el servidor, en cada request (o cuando se revalida la cache).
- **Pasa Server Actions como props:** `onAdd={addTodoAction}`. Esto funciona porque Server Actions son serializables como "referencias" que React Server Components saben mover entre servidor y cliente.
- **`remaining` se calcula en servidor.** No es estado del cliente. Si añadimos filtros más complejos en el futuro, los implementamos como casos de uso (`GetRemainingCount`) en lugar de aquí.

> #### ✅ Checkpoint 10 — Validación end-to-end final
>
> Esta es la prueba que cierra todo el feature.
>
> 1. **Arranca el server:** `pnpm dev`
> 2. **Abre:** `http://localhost:3000/todos`
> 3. **Escribe** un título y descripción (recuerda: mínimo 8 caracteres cada uno) y presiona "Add".
>    - Espera ver: el formulario se limpia, el nuevo todo aparece en la lista.
> 4. **Marca como completado** uno de los todos.
>    - Espera ver: el texto se tacha y `remaining` baja en 1.
> 5. **Recarga la página** (`Cmd/Ctrl + R`).
>    - Espera ver: el estado se mantuvo (persistencia confirmada).
> 6. **Abre Prisma Studio** (`pnpm prisma studio`) y confirma que las filas existen con los valores correctos.
>
> Si los 6 pasos pasan, **el feature está completo de extremo a extremo.**
>
> 💡 Si el paso 3 falla con "Title must be at least 8 characters", recuerda: la validación está en el dominio. Es feedback **bueno** — significa que la regla se está aplicando en backend, no solo en UI.

---

## 11. Errores comunes a evitar

Cada uno con un ejemplo malo y su versión buena.

### 11.1 Definir reglas de validación dentro del componente

❌ **Mal:**

```tsx
const TodoInput = ({ onAdd }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (title.length < 8) {
      // ← regla hardcodeada en UI, duplicada respecto al servidor
      alert("Title too short");
      return;
    }
    onAdd(title, description);
  };
  // ...
};
```

✅ **Bien:** la regla vive **una sola vez** en `todoFormSchema` (en `application/schemas/`). El componente la consume vía `zodResolver(todoFormSchema)` (UX rápida), y `createTodo` en `application/validation/` la reaplica en el servidor como autoridad final. Si alguien burla el cliente, el `TodoValidationError` viaja de vuelta como `AddTodoResult` y se proyecta a los mismos campos del formulario.

> **Por qué Zod va en `application/schemas/` y no en `domain/`:** así, cambiar de Zod a Valibot/Yup no toca al dominio. El dominio solo conoce el tipo `Todo`, el error `TodoValidationError` y la interfaz del repositorio.

### 11.2 Acoplar un caso de uso a Prisma

❌ **Mal:**

```typescript
// AddTodo.ts
import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";

export class AddTodo {
  async execute(todo: Todo) {
    await prisma.todo.create({ data: todo }); // ← caso de uso atado a Prisma
  }
}
```

✅ **Bien:** el caso de uso recibe un `TodoRepository` por constructor. La inversión de dependencia te permite testear con mock repo sin levantar PostgreSQL.

### 11.3 Validar solo en la UI

❌ **Mal:** el formulario impide enviar títulos cortos, pero `addTodoAction` confía ciegamente en el cliente. Resultado: `curl -X POST /api/todos -d '{"title":""}'` inserta basura.

✅ **Bien:** `createTodo()` (en `application/validation/`) revalida el mismo schema al entrar al caso de uso `AddTodo`. La UI valida para UX rápida; el servidor valida porque es la autoridad. **Ambos comparten el mismo `todoFormSchema`**, así que las reglas no se desincronizan.

### 11.4 Mezclar DTOs de API con entidades del dominio

❌ **Mal:** exponer `Todo` (con `createdAt: string`) como el shape del JSON de la API. Si mañana cambias la entidad, rompes los consumidores externos.

✅ **Bien:** dentro del Route Handler, mapear de `Todo` a un `TodoApiDto` (camelCase, formatos específicos). La entidad de dominio queda libre de evolucionar.

> En el código actual `api/todos/route.ts` devuelve `Todo` directamente. Es **aceptable mientras no haya consumidores externos**, pero cuando llegue el primero, agrega la separación.

### 11.5 Páginas con demasiadas responsabilidades

❌ **Mal:**

```tsx
const TodosPage = async () => {
  const todos = await prisma.todo.findMany({ ... });   // ← persistencia en página
  const filtered = todos.filter(...);                  // ← filtrado en página
  const sorted = filtered.sort(...);                   // ← orden en página
  const paginated = sorted.slice(0, 20);               // ← paginación en página
  return <ul>{paginated.map(...)}</ul>;
};
```

✅ **Bien:** cada operación se vuelve su propio caso de uso. La página solo orquesta: `await new GetTodosFiltered(...).execute()`.

### 11.6 Importar el cliente Prisma en componentes cliente

❌ **Mal:**

```tsx
"use client";
import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";
// ↑ ¡el build fallará gracias a `import "server-only"`!
```

✅ **Bien:** los Client Components reciben los datos como props o llaman a Server Actions. Nunca importan el cliente DB.

### 11.7 Generar IDs o leer el reloj dentro del dominio

❌ **Mal:**

```typescript
// AddTodo.ts
async execute(input: { title: string; description: string }) {
  const todo = createTodo({
    id: crypto.randomUUID(),                  // ← efecto del mundo
    createdAt: new Date().toISOString(),      // ← efecto del mundo
    // ...
  });
}
```

✅ **Bien:** el composition root (Server Action) genera estos valores y los pasa al caso de uso ya resueltos. Esto deja la lógica de negocio puramente determinística y trivial de testear.

---

## 12. Cuándo usar mocks y cuándo conectar a la DB real

| Situación                                                | Recomendación                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Test unitario de un caso de uso                          | **Mock repo** en memoria                                                    |
| Probar reglas de dominio (`createTodo`)                  | Sin repositorio, llamada directa a la función pura                          |
| Test de integración del adapter (`TodoPrismaRepository`) | **DB real** (idealmente test DB aislada)                                    |
| Desarrollo cuando Postgres aún no está listo             | Mock repo temporal — implementa `TodoRepository` con un `Todo[]` en memoria |
| Smoke test end-to-end                                    | DB real, ejecutar `pnpm prisma db push` antes                               |
| CI/CD                                                    | DB temporal en Docker (Postgres) o adapter de prueba                        |
| Producción                                               | DB real, naturalmente                                                       |

**Regla práctica:** mientras más lejos estás del dominio (más en la capa exterior), más necesitas DB real. El dominio puro nunca la necesita.

---

## 13. Recomendaciones de mejora detectadas

> Nota: **no se está pidiendo refactorizar ahora.** Son ideas para sesiones futuras.

1. **`TodoActions.tsx` está vacío.** Decisión: implementarlo (con botones de delete/edit) o eliminarlo. Tener archivos vacíos confunde al lector.

2. **`api/todos/route.ts` no valida el body.** Si se decide exponer este endpoint públicamente, reutilizar `todoFormSchema` (o un schema más estricto del body completo) y parsear con `safeParse` antes de pasar al caso de uso:

   ```ts
   import { todoFormSchema } from "@/features/todos/application/schemas/todoFormSchema";

   const parsed = todoFormSchema.safeParse(await req.json());
   if (!parsed.success) {
     return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
   }
   ```

   También conviene atrapar `TodoValidationError` igual que hace la Server Action y devolver `400` con el `fieldErrors` en lugar de un `500` genérico.

3. **`AddTodo.execute()` recibe el `Todo` completo incluyendo id/timestamps.** Hoy depende del composition root para proveerlos. Una opción más explícita: aceptar `AddTodoInput = { title, description }` y delegar la generación de id/timestamps a un colaborador (`IdGenerator`, `Clock`) inyectado por constructor. Esto alinea el patrón con `UpdateTodo` y abre la puerta a testear con un reloj determinístico.

4. **Falta cobertura de tests automáticos.** El feature está exquisitamente preparado para tests unitarios (todos los casos de uso son inyectables, y `createTodo` en `application/validation/` es una función pura fácil de testear). Agregar [`vitest`](https://vitest.dev/) y escribir tests con el mock repo del Checkpoint 5 costaría muy poco. Primeros candidatos: tests de `createTodo` con casos felices + cada rama de error + verificar shape de `TodoValidationError.fieldErrors`.

5. **`DeleteTodo` y otros use cases con `findById` previo duplican el patrón.** Si crece, podría extraerse un decorador `EnsureExists` o un helper.

6. **El `as` en `todos.actions.ts` al estrechar `e.fieldErrors`.** El cast `e.fieldErrors as Partial<Record<TodoField, string>>` es seguro hoy (sabemos que `AddTodo` solo valida `title`/`description`), pero es una conexión por convención. Si quieres eliminarlo, `TodoValidationError` puede dejar de ser genérico y vivir como `TodoValidationError<TodoField>` específico de la app — pero eso lo movería fuera de `domain/`. La decisión actual prioriza pureza del dominio sobre eliminar un cast localizado.

---

## 14. Ruta mental del flujo de datos: "Crear un todo"

> Esta sección es el "video en cámara lenta" de lo que pasa al hacer click en "Add". Útil cuando algo falla y necesitas saber dónde buscar.

**Escenario:** el usuario está en `http://localhost:3000/todos`. Escribe título "Aprender Clean Architecture" y descripción "Empezar por la capa de dominio". Hace click en el botón "Add".

### Cliente

1. **Evento DOM:** el browser dispara `submit` en el `<form>` de [TodoInput.tsx](../src/features/todos/components/TodoInput.tsx).
2. **`form.handleSubmit(onSubmit)`** se ejecuta. Antes de invocar `onSubmit`, React Hook Form ejecuta `zodResolver(todoFormSchema)`:
   - Aplica `.trim()` y `.min(8)` a cada campo.
   - Si falla, popula `form.formState.errors` y los `<FormMessage />` muestran el mensaje **sin tocar el servidor**. El flujo termina aquí.
   - Si pasa, llama a `onSubmit({ title, description })` con los valores ya trimmed.
3. **`onSubmit` ejecuta:**
   - `startTransition(async () => { const result = await onAdd(data.title, data.description); ... })`.
   - **`onAdd` es la prop inyectada por [src/app/todos/page.tsx](../src/app/todos/page.tsx) (`onAdd={addTodoAction}`).** Aunque parezca una función local, internamente React/Next sabe que es una **referencia a una Server Action** y la invoca vía un fetch interno (POST a un endpoint generado por Next).

### Cruce Cliente → Servidor

4. **Serialización:** Next serializa los argumentos (`title`, `description`) y los envía al servidor.
5. **`useTransition` activa el flag `isPending`:** los inputs y el botón se deshabilitan.

### Servidor — Composition Root

6. **Entra en `addTodoAction` de [todos.actions.ts](../src/features/todos/actions/todos.actions.ts):**
   - Genera `id = crypto.randomUUID()` → `"a1b2c3d4-..."`.
   - Genera `now = new Date().toISOString()` → `"2026-05-24T14:32:01.234Z"`.
   - Instancia: `new AddTodo(TodoPrismaRepository)`. **Aquí se concreta el adapter.**
   - Ejecuta dentro de `try`: `.execute({ id, title, description, completed: false, createdAt: now, updatedAt: now })`.

### Servidor — Caso de uso + Validación

7. **Entra en `AddTodo.execute(todo)` de [AddTodo.ts](../src/features/todos/application/use-cases/AddTodo.ts):**
   - Llama a `createTodo(todo)` desde [createTodo.ts](../src/features/todos/application/validation/createTodo.ts).
   - **`createTodo` reaplica el mismo `todoFormSchema` que usó el cliente** (vía `safeParse`):
     - `title.trim().length >= 8` ✅ ("Aprender Clean Architecture" = 28 chars).
     - `description.trim().length >= 8` ✅.
     - Devuelve el `Todo` ya válido y normalizado.
   - Si hubiese fallado (cliente burlado / petición directa al endpoint): `throw new TodoValidationError<TodoField>({ title: "...", description: "..." })`. El control sube al `catch` de la action.
   - Llama: `this.todoRepository.addTodo(validatedTodo)`.

### Servidor — Infraestructura

8. **Entra en `TodoPrismaRepository.addTodo` de [TodoPrismaRepository.ts](../src/features/todos/infrastructure/repositories/TodoPrismaRepository.ts):**
   - Convierte `createdAt: string` → `new Date(todo.createdAt)`.
   - Convierte `updatedAt: string` → `new Date(todo.updatedAt)`.
   - Ejecuta: `prisma.todo.create({ data: {...} })`.

9. **Prisma + adapter PostgreSQL:**
   - Prisma traduce a SQL: `INSERT INTO "Todo" (id, title, description, completed, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)`.
   - `@prisma/adapter-pg` ejecuta vía conexión `pg` directa.
   - PostgreSQL responde OK.

### Servidor — Vuelta a Composition Root

10. **La promesa resuelve.** `addTodoAction` sale del `try` sin errores.
11. **Llama `revalidatePath("/todos")`:** Next marca la cache de la ruta `/todos` como obsoleta y programa un re-render.
12. **`addTodoAction` retorna `{ ok: true }`.** Next serializa el resultado y lo envía al cliente.

### Cliente — Recepción

13. **React/Next detecta fin de la transición:**
    - El callback de `startTransition` continúa: `if (result.ok) form.reset();`.
    - `isPending` vuelve a `false` → form habilitado de nuevo.
14. **Re-render del Server Component:** Next vuelve a ejecutar [page.tsx](../src/app/todos/page.tsx) en el servidor (porque la ruta fue invalidada):
    - `new GetTodos(TodoPrismaRepository).execute()` → ahora retorna la lista incluyendo el todo recién creado.
    - Recalcula `remaining`.
    - Renderiza el nuevo HTML.
15. **Next envía el nuevo HTML al cliente.** React reconcilia.
16. **El usuario ve:** el nuevo `<TodoItem>` aparece en la lista, el formulario está vacío y listo para otro.

### Caso alterno: validación falla en el servidor

Si el cliente fue burlado y el servidor recibe `title = "Hi"`:

- Paso 7 falla: `createTodo` lanza `TodoValidationError<TodoField>({ title: "Title must be at least 8 characters" })`.
- El `catch` de `addTodoAction` detecta `e instanceof TodoValidationError`, retorna `{ ok: false, errors: e.fieldErrors as Partial<Record<TodoField, string>> }`.
- `revalidatePath` **no** se llama (no hubo mutación).
- En el cliente, `result.ok === false` → se ejecuta `form.setError("title", { message: result.errors.title })`. El `<FormMessage />` correspondiente lo pinta.

### Tiempos típicos en local

| Tramo                        | Duración aprox. |
| ---------------------------- | --------------- |
| Cliente → servidor (RPC)     | 5-15ms          |
| Validación + Prisma INSERT   | 20-80ms         |
| `revalidatePath` + re-render | 30-100ms        |
| Cliente → render final       | 10-30ms         |
| **Total percibido**          | **~80-300ms**   |

---

## Cierre

Si llegaste hasta aquí siguiendo los checkpoints, ya tienes:

- ✅ Un dominio puro, validado, sin dependencias.
- ✅ Casos de uso testeables con cualquier repositorio.
- ✅ Una implementación real con PostgreSQL via Prisma.
- ✅ Dos puertos de entrada: Server Actions (UI interna) + Route Handler HTTP (futuros consumidores externos).
- ✅ Una UI accesible que delega las acciones al servidor sin acoplarse a la implementación.
- ✅ Una página Next.js que orquesta todo sin acumular responsabilidades.

El siguiente paso natural es agregar **tests unitarios** (capítulo 13.5) y luego implementar funciones que faltan en la UI: eliminar tareas, editar tareas, filtrar por estado. Para cada una, repite la misma escalera: dominio → aplicación → adapter → composition root → componente → página.

**Cualquier feature nuevo en este proyecto se construye con esta misma receta.** Te lo prometo.
