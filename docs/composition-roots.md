# Composition Roots en Next.js App Router

Guía de cuándo usar **Server Actions** vs **API Routes (Route Handlers)** como puntos de entrada a los use cases del dominio en una arquitectura hexagonal.

## TL;DR

- **Server Actions** → cuando el consumidor es el frontend Next.js de esta misma app. Es lo idiomático en Next.js 13.4+.
- **API Routes (`route.ts`)** → cuando hay un consumidor que NO es tu frontend Next.js: app móvil, webhook entrante, script externo, cron job HTTP, OAuth callback, API pública.
- **Ambos pueden coexistir** en el mismo proyecto y compartir los mismos use cases y repositorios. El patrón hexagonal lo permite por diseño.

---

## Qué es un "composition root"

Un **composition root** es el lugar donde se **ensambla** la cadena de dependencias: instancia el repositorio concreto, lo inyecta en el use case, y dispara `.execute()`.

```
[Composition root]
   │
   ├─ instancia TodoPrismaRepository (infrastructure)
   │
   └─ inyecta en new AddTodo(repo) (application)
           │
           └─ ejecuta repo.addTodo(...) → Prisma → PostgreSQL
```

El dominio (`entities/`, `repositories/`) y la aplicación (`use-cases/`) **no saben** quién es la composition root. Esa ignorancia es lo que permite tener varios entry points sin tocar el código de negocio.

En Next.js App Router hay **dos** formas válidas de implementar una composition root:

| Forma | Archivo típico | Visible para el browser como |
|---|---|---|
| Server Action | `actions/foo.actions.ts` con `"use server"` | POST a un endpoint oculto generado por Next.js |
| Route Handler | `app/api/foo/route.ts` con `GET`/`POST`/... | URL pública estable (`/api/foo`) |

---

## Server Actions

### Cuándo usarlas

Cuando el único consumidor es el frontend Next.js de **esta misma app**.

### Ventajas

- **Tipos compartidos end-to-end.** El cliente recibe la función tipada; sin `JSON.parse` ni `as Foo` en el browser.
- **Sin serialización manual.** Pasas y recibes objetos JS directamente (Next.js los serializa por debajo).
- **Sin endpoint público expuesto.** La URL es ofuscada e impredecible — un atacante no puede "documentar" tu API contra ti.
- **`revalidatePath` / `revalidateTag` integrados.** Refrescas el Server Component que renderiza la página tras mutar, sin manejo manual de fetch + estado.
- **Progressive enhancement.** Si las atas a `<form action={...}>`, funcionan sin JS.

### Ejemplo en este proyecto

[src/features/todos/actions/todos.actions.ts](../src/features/todos/actions/todos.actions.ts):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { AddTodo } from "../application/use-cases/AddTodo";
import { TodoPrismaRepository } from "../infrastructure/repositories/TodoPrismaRepository";

export async function addTodoAction(title: string): Promise<void> {
  await new AddTodo(TodoPrismaRepository).execute({
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
  });
  revalidatePath("/todos");
}
```

Se consume desde un Server Component como prop a un Client Component:

```tsx
// page.tsx (Server Component)
import { addTodoAction } from "@/features/todos/actions/todos.actions";
import TodoInput from "@/features/todos/components/TodoInput";

export default async function TodosPage() {
  return <TodoInput onAdd={addTodoAction} />;
}
```

### Limitaciones

- **Same-origin only.** No las puedes consumir desde otro dominio.
- **URLs no estables.** El endpoint oculto cambia entre builds — no es un contrato público.
- **Streaming limitado.** No soportan `ReadableStream` de forma natural.
- **Solo Next.js.** Si mañana migras a Remix/Astro/SPA pura, las pierdes.

---

## API Routes (Route Handlers)

### Cuándo usarlas

Cuando el consumidor **no** es tu frontend Next.js. Casos concretos:

| Caso | Ejemplo |
|---|---|
| App móvil nativa | React Native / Flutter / iOS Swift consume `GET /api/todos` |
| Webhook entrante | Stripe POSTea a `/api/webhooks/stripe` cuando se completa un pago |
| Script externo / CLI | `curl -X DELETE https://app.com/api/todos/stale` |
| API pública / contrato estable | Integración con Zapier, Make, n8n, SDK de terceros |
| Cron HTTP | Vercel Cron Jobs o GitHub Actions invocando `GET /api/cleanup` |
| Healthcheck / monitoring | Uptime Robot pegando `GET /api/health` cada minuto |
| OAuth callback | Google redirige a `/api/auth/callback/google?code=...` |
| Streaming / SSE | Chat de IA que entrega tokens uno a uno |
| Cross-origin / CORS | Otro dominio necesita consumir tus datos |

### Ejemplo en este proyecto

[src/app/api/todos/route.ts](../src/app/api/todos/route.ts) — conservado como **referencia educativa**, no consumido por el frontend:

```ts
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

Misma cadena de dependencias que la Server Action — solo cambia el "puerto" por el que entra la petición.

### Limitaciones

- **Sin tipos compartidos automáticos.** El cliente debe declarar manualmente el shape del payload (zod, OpenAPI, etc.).
- **Serialización JSON manual.** Pierdes tipos no-JSON (Date, Map, BigInt) si no manejas.
- **Más boilerplate.** Validación de body, manejo de status codes, headers, CORS, rate limiting.
- **Superficie de ataque expuesta.** URL pública estable que cualquiera puede descubrir y atacar.

---

## Cómo conviven en el patrón hexagonal

Ambos caminos llegan al mismo dominio. El dominio no se entera:

```
                    ┌──────────────────────┐
   Browser ────────►│  Server Action       │──► AddTodo.execute(...)
   (Next.js front)  │  (todos.actions.ts)  │         │
                    └──────────────────────┘         │
                                                     ▼
                                              TodoPrismaRepository
                                                     │
                                                     ▼
                                                 PostgreSQL
                                                     ▲
                                                     │
                                              TodoPrismaRepository
                                                     ▲
                    ┌──────────────────────┐         │
   curl       ─────►│  Route Handler       │─────────┘
   Postman          │  (api/todos/route.ts)│
   App móvil        └──────────────────────┘
   Webhook
```

Regla de oro: **el use case y el repo no cambian** entre ambos caminos. Cada composition root es ~10 líneas que solo ensamblan.

---

## Reglas prácticas para este proyecto

1. **Por defecto, Server Actions.** Toda nueva feature que solo consume el frontend Next.js → Server Action.
2. **Route Handler solo cuando aparezca un consumidor externo real.** No mantengas endpoints "por si acaso" — cada endpoint añade superficie de ataque y código a mantener.
3. **Cuando llegue ese día**, copias el patrón de [api/todos/route.ts](../src/app/api/todos/route.ts) en una carpeta nueva bajo `src/app/api/`. El use case y el repo ya existen — son 5 minutos.
4. **Mantén `api/todos/route.ts` como referencia.** Sirve como ejemplo "vivo" del patrón Route Handler aunque el frontend no lo consuma.

---

## Antipatrones a evitar

- **Llamar la API route desde tu propio frontend Next.js.** Es un round-trip HTTP innecesario. Tu frontend está en el mismo proceso del servidor — usa Server Components / Server Actions y ahorra latencia + serialización.
- **Duplicar lógica entre la Server Action y el Route Handler.** Ambos deben llamar al **mismo** use case. Si te ves escribiendo lógica de negocio dentro de la action o de la route, sácala a un use case.
- **Exponer Route Handlers públicos sin validación de input.** Server Actions tienen al menos el escudo de same-origin; las routes están expuestas a cualquiera. Usa zod o similar para validar el body antes de tocar use cases.
- **Confundir composition root con dominio.** Las decisiones de "qué retornar al cliente" (status codes, mensajes de error) viven en la composition root, no en el use case. El use case lanza excepciones de dominio; la action/route las traduce a HTTP o a estado UI.

---

## Referencias

- [Next.js docs — Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js docs — Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Arquitectura hexagonal — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
