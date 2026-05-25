# Guía Senior → Junior: Implementar Auth.js v5 (Credentials + JWT) con Clean Architecture

> Mentoría práctica para añadir autenticación clásica (registro, login, logout, sesión JWT, protección de rutas) a esta aplicación Next.js + TypeScript + Prisma, **tratando Auth.js como infraestructura** y manteniendo el dominio puro.
>
> No es una descripción del código: es la **secuencia de creación** y la **forma de validar** cada capa antes de avanzar a la siguiente. La guía replica la estructura de [todos-clean-architecture-development-order.md](todos-clean-architecture-development-order.md) — léela primero si no la conoces, esta guía asume que ya entiendes el patrón hexagonal aplicado a Todos.

---

## Tabla de contenidos

1. [Objetivo del feature](#1-objetivo-del-feature)
2. [Mapa arquitectónico](#2-mapa-arquitectónico-del-feature)
3. [Las cuatro reglas de oro (auth)](#3-las-cuatro-reglas-de-oro-auth)
4. [Paso 1 — Capa de Dominio](#4-paso-1--capa-de-dominio)
5. [Paso 2 — Capa de Aplicación (Schemas, Validación y Casos de Uso)](#5-paso-2--capa-de-aplicación-schemas-validación-y-casos-de-uso)
6. [Paso 3 — Capa de Infraestructura](#6-paso-3--capa-de-infraestructura)
7. [Paso 4 — Configuración de Auth.js (la pieza única)](#7-paso-4--configuración-de-authjs-la-pieza-única)
8. [Paso 5 — Composition Root (Server Actions)](#8-paso-5--composition-root-server-actions)
9. [Paso 6 — Componentes UI (Client Components)](#9-paso-6--componentes-ui-client-components)
10. [Paso 7 — Integrar con features existentes (proteger `/todos` y scope al usuario)](#10-paso-7--integrar-con-features-existentes-proteger-todos-y-scope-al-usuario)
11. [Errores comunes a evitar](#11-errores-comunes-a-evitar)
12. [Troubleshooting (lecciones de la sesión real)](#12-troubleshooting-lecciones-de-la-sesión-real)
13. [Recomendaciones de mejora detectadas](#13-recomendaciones-de-mejora-detectadas)
14. [Ruta mental del flujo de datos: "Register + auto-login + redirect"](#14-ruta-mental-del-flujo-de-datos-register--auto-login--redirect)

---

## 1. Objetivo del feature

El feature `users` permite a una persona **crear una cuenta, iniciar sesión, cerrar sesión y mantener una sesión persistente** usando email + password. La sesión se gestiona vía **JWT firmado** (sin tabla de sesiones en DB).

Operaciones disponibles desde la UI:

- **Register** (`/register`) — crear cuenta con `name`, `email`, `password`. Auto-login y redirect a `/todos` si tiene éxito.
- **Login** (`/login`) — autenticar con `email` + `password`. Redirect a `/todos`.
- **Logout** — botón en `/todos`. Borra la cookie y redirige a `/login`.
- **Sesión persistente** — JWT vigente por 30 días.

Operaciones automáticas (sin UI):

- **Protección de rutas** — `/todos/*` requiere sesión; intentar entrar sin login redirige a `/login`. Estar logueado y visitar `/login` o `/register` redirige a `/todos`.
- **Scope de todos por usuario** — cada Todo se asocia al `userId` del usuario logueado; los queries filtran por ese id (un usuario no ve los todos de otro).

**¿Por qué este feature es buen ejemplo didáctico?**
Auth.js es una librería con sus propias convenciones (`auth.ts` en raíz, `[...nextauth]` route handler, `middleware.ts`, etc.) que **chocan a primera vista con el patrón hexagonal**. La gracia del ejercicio es **encajarla como infraestructura** sin contaminar dominio ni aplicación. Si entiendes este feature, sabrás cómo integrar cualquier librería con convención propia (Stripe, Sentry, Pusher, etc.) sin romper la separación de capas.

**Stack involucrado:**

- Next.js 16 (App Router) + React 19
- TypeScript con `paths` `@/*` → `./src/*`
- Prisma 7 + PostgreSQL (vía `@prisma/adapter-pg`)
- **Auth.js v5 beta** (`next-auth@5.0.0-beta.31`) con **Credentials provider** + **JWT session strategy**
- **bcryptjs** para hashing
- Tailwind v4 + shadcn/ui (mismas piezas de UI que el feature `todos`)

---

## 2. Mapa arquitectónico del feature

```
                          ┌──────────────────────────────────┐
                          │  app/(auth)/login/page.tsx        │
                          │  app/(auth)/register/page.tsx     │  ← Server Components
                          │  app/(auth)/layout.tsx            │     (envoltorios mínimos)
                          └──────────────┬───────────────────┘
                                         │ renderizan
                                         ▼
        ┌─────────────────────────────────────────────────────┐
  UI    │  components/LoginForm.tsx    components/RegisterForm│  ← Client Components
        └─────────────────┬──────────────────┬────────────────┘
                          │ loginAction      │ registerAction
                          ▼                  ▼
        ┌──────────────────────────────────────────────────────┐
 ACTION │           actions/auth.actions.ts                     │  ← Composition Root
        │           "use server" · signIn · signOut             │     (Server Actions)
        └─────────────────┬─────────────────────────────────────┘
                          │ new RegisterUser(repo, hasher).execute(...)
                          │ signIn("credentials", {...})  ← Auth.js
                          ▼
        ┌──────────────────────────────────────────────────────┐
  APP   │   application/use-cases/                              │  ← Casos de uso
        │   · RegisterUser  · VerifyCredentials                 │     (orquestan)
        │                                                       │
        │   application/schemas/                                │  ← Adapters de validación
        │   · registerFormSchema.ts    · loginFormSchema.ts     │
        │   application/validation/createUserRegistration.ts    │
        └─────────────────┬─────────────────────────────────────┘
                          │ this.userRepository.xxx(...) · this.passwordHasher.xxx(...)
                          ▼
        ┌──────────────────────────────────────────────────────┐
DOMAIN  │   domain/entities/User.ts            (interface)      │  ← Núcleo
        │   domain/entities/UserWithPassword.ts (extends User)  │     (cero deps)
        │   domain/repositories/UserRepository.ts (interface)   │
        │   domain/services/PasswordHasher.ts     (interface)   │
        │   domain/errors/UserValidationError.ts                │
        │   domain/errors/EmailAlreadyTakenError.ts             │
        └─────────────────▲─────────────────────────────────────┘
                          │ implementan
        ┌─────────────────┴─────────────────────────────────────┐
 INFRA  │   infrastructure/repositories/UserPrismaRepository.ts │  ← Adapters
        │   infrastructure/hashing/bcryptHasher.ts              │
        │   infrastructure/mappers/userMapper.ts                │
        └───────────────────────────────────────────────────────┘

                          ┌──────────────────────────────────────┐
                          │  AUTH.JS — pieza transversal          │
                          │                                       │
                          │  shared/infrastructure/auth/          │
                          │  · auth.config.ts  (edge-safe)        │
                          │  · auth.ts         (full + provider)  │
                          │                                       │
                          │  src/auth.ts             (re-export)  │
                          │  src/middleware.ts       (protección) │
                          │  app/api/auth/[...nextauth]/route.ts  │
                          └───────────────────────────────────────┘
```

### Tabla de archivos por capa

| #   | Archivo                                                                                                                                                   | Capa                                          | Existe |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------ |
| 1   | [src/features/users/domain/entities/User.ts](../src/features/users/domain/entities/User.ts)                                                               | Dominio (Entidad)                             | ✅     |
| 2   | [src/features/users/domain/entities/UserWithPassword.ts](../src/features/users/domain/entities/UserWithPassword.ts)                                       | Dominio (Entidad interna)                     | ✅     |
| 3   | [src/features/users/domain/repositories/UserRepository.ts](../src/features/users/domain/repositories/UserRepository.ts)                                   | Dominio (Puerto)                              | ✅     |
| 4   | [src/features/users/domain/services/PasswordHasher.ts](../src/features/users/domain/services/PasswordHasher.ts)                                           | Dominio (Puerto de servicio)                  | ✅     |
| 5   | [src/features/users/domain/errors/UserValidationError.ts](../src/features/users/domain/errors/UserValidationError.ts)                                     | Dominio (Error)                               | ✅     |
| 6   | [src/features/users/domain/errors/EmailAlreadyTakenError.ts](../src/features/users/domain/errors/EmailAlreadyTakenError.ts)                               | Dominio (Error)                               | ✅     |
| 7   | [src/features/users/application/schemas/registerFormSchema.ts](../src/features/users/application/schemas/registerFormSchema.ts)                           | Aplicación (Schema Zod)                       | ✅     |
| 8   | [src/features/users/application/schemas/loginFormSchema.ts](../src/features/users/application/schemas/loginFormSchema.ts)                                 | Aplicación (Schema Zod)                       | ✅     |
| 9   | [src/features/users/application/validation/createUserRegistration.ts](../src/features/users/application/validation/createUserRegistration.ts)             | Aplicación (Factory)                          | ✅     |
| 10  | [src/features/users/application/use-cases/RegisterUser.ts](../src/features/users/application/use-cases/RegisterUser.ts)                                   | Aplicación (Caso de uso)                      | ✅     |
| 11  | [src/features/users/application/use-cases/VerifyCredentials.ts](../src/features/users/application/use-cases/VerifyCredentials.ts)                         | Aplicación (Caso de uso, llamado por Auth.js) | ✅     |
| 12  | [prisma/schema.prisma](../prisma/schema.prisma)                                                                                                           | Infraestructura (esquema DB)                  | ✅     |
| 13  | [src/features/users/infrastructure/hashing/bcryptHasher.ts](../src/features/users/infrastructure/hashing/bcryptHasher.ts)                                 | Infraestructura (Adapter de PasswordHasher)   | ✅     |
| 14  | [src/features/users/infrastructure/mappers/userMapper.ts](../src/features/users/infrastructure/mappers/userMapper.ts)                                     | Infraestructura (Mapper Prisma ↔ dominio)     | ✅     |
| 15  | [src/features/users/infrastructure/repositories/UserPrismaRepository.ts](../src/features/users/infrastructure/repositories/UserPrismaRepository.ts)       | Infraestructura (Adapter de UserRepository)   | ✅     |
| 16  | [src/shared/infrastructure/auth/auth.config.ts](../src/shared/infrastructure/auth/auth.config.ts)                                                         | Infraestructura compartida (config edge-safe) | ✅     |
| 17  | [src/shared/infrastructure/auth/auth.ts](../src/shared/infrastructure/auth/auth.ts)                                                                       | Infraestructura compartida (config completa)  | ✅     |
| 18  | [src/auth.ts](../src/auth.ts)                                                                                                                             | Re-export por convención Auth.js              | ✅     |
| 19  | [src/middleware.ts](../src/middleware.ts)                                                                                                                 | Protección de rutas (Edge runtime)            | ✅     |
| 20  | [src/app/api/auth/\[...nextauth\]/route.ts](<../src/app/api/auth/[...nextauth]/route.ts>)                                                                 | Route Handler de Auth.js                      | ✅     |
| 21  | [src/features/users/actions/auth.actions.ts](../src/features/users/actions/auth.actions.ts)                                                               | Composition Root (Server Actions)             | ✅     |
| 22  | [src/features/users/components/LoginForm.tsx](../src/features/users/components/LoginForm.tsx)                                                             | Presentación (Client)                         | ✅     |
| 23  | [src/features/users/components/RegisterForm.tsx](../src/features/users/components/RegisterForm.tsx)                                                       | Presentación (Client)                         | ✅     |
| 24  | [src/app/(auth)/layout.tsx](<../src/app/(auth)/layout.tsx>)                                                                                               | Presentación (Server)                         | ✅     |
| 25  | [src/app/(auth)/login/page.tsx](<../src/app/(auth)/login/page.tsx>)                                                                                       | Presentación (Server)                         | ✅     |
| 26  | [src/app/(auth)/register/page.tsx](<../src/app/(auth)/register/page.tsx>)                                                                                 | Presentación (Server)                         | ✅     |

---

## 3. Las cuatro reglas de oro (auth)

Antes de tocar un archivo, internaliza esto. Si dudas en el diseño, vuelve a estas cuatro reglas.

1. **Auth.js es infraestructura, no dominio.**
   Tu lógica de negocio (verificar credenciales, registrar usuario) vive en **use cases hexagonales**. Auth.js es el "gestor de cookies y JWTs" que llama a tus use cases. Si mañana cambias a Lucia, Clerk o un sistema propio, los use cases y el dominio quedan intactos — solo cambia la capa de auth.

2. **JWT > Database Sessions cuando puedas.**
   La estrategia `session: { strategy: "jwt" }` mantiene la sesión **en una cookie firmada** — no necesita la tabla `Session` que el Prisma Adapter exige. Es más simple, escala mejor (sin lectura DB por request) y encaja con un schema con solo `User` + `Credentials`. La contrapartida: para invalidar una sesión necesitas rotar `AUTH_SECRET` (afecta a todos los usuarios) o implementar un revocation list — si vas a tener OAuth o necesitas invalidación granular, ese día puedes migrar al adapter.

3. **`Credentials` es un detalle interno de `User` (aggregate).**
   El schema separa `User` y `Credentials` por razones técnicas (cuando agregues OAuth, los `Credentials` no aplican; el modelo `User` sigue siendo el mismo). Pero **en el dominio** los tratamos como un solo aggregate: un `UserRepository` único con un método `createWithCredentials` y un `findByEmailWithPassword`. El hash nunca sale del repositorio salvo cuando explícitamente lo pide `VerifyCredentials`.

4. **Split config: la config edge-safe no toca bcrypt ni Prisma.**
   El `middleware.ts` corre en **Edge runtime** (V8 sin Node APIs). bcryptjs es JS puro y "funcionaría", pero Prisma y el `@prisma/adapter-pg` **no son edge-safe**. Si tu `auth.ts` (con el provider que llama a Prisma) acaba importado por el middleware, el build falla. La solución estándar de Auth.js es **dividir** la config en dos: una `auth.config.ts` mínima (sin providers reales) que el middleware puede importar, y una `auth.ts` completa que el resto de la app usa.

> **SOLID en el contexto de auth**
>
> - **S**ingle Responsibility: cada use case hace una sola cosa (`RegisterUser` solo registra; `VerifyCredentials` solo verifica). `auth.actions.ts` solo orquesta.
> - **O**pen/Closed: añadir un nuevo provider OAuth no obliga a tocar `RegisterUser` ni `VerifyCredentials` — solo se añade el provider en `auth.ts`.
> - **L**iskov: cualquier `PasswordHasher` (bcrypt, argon2, mock) es intercambiable. Cualquier `UserRepository` (Prisma, in-memory) también.
> - **I**nterface Segregation: `PasswordHasher` expone solo `hash` y `verify`, no API extra. `UserRepository` expone solo los métodos que la app realmente usa.
> - **D**ependency Inversion: los use cases dependen de las interfaces `UserRepository` + `PasswordHasher`, nunca de Prisma ni bcrypt directamente.

---

## 4. Paso 1 — Capa de Dominio

> **Mantra del paso:** "Defino el qué — usuario, credenciales, hasher — sin importar cómo se persisten ni cómo se hashea."

Aquí construyes el corazón del feature: la entidad `User`, su variante "con password" (interna), el contrato de persistencia, el contrato del hasher y los errores de negocio.

### 4.1 `src/features/users/domain/entities/User.ts`

**Responsabilidad:** Modelar qué es un usuario en la aplicación. **Sin password**. Es el shape que viaja por toda la app: a la UI, al JWT, a los componentes.

**Por qué primero:** Es el núcleo. Cero dependencias. Tanto el repo como los use cases lo usan.

**Capa hexagonal:** Entidad de Dominio.

**Reglas SOLID aplicadas:**

- **SRP:** describe la forma de un usuario. La validación, la persistencia y el hashing viven en otros archivos.
- **DIP:** si mañana cambias de Zod a Yup, no toca este archivo.

**Conexiones:** ninguna. Cero `import`.

**Código actual:**

```typescript
// src/features/users/domain/entities/User.ts
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Detalles clave que un Junior debe ver:**

- **No incluye `hashedPassword`.** Esa información es **interna** del proceso de autenticación. Si la incluyéramos aquí, viajaría a la UI, al JWT, a los componentes — fuga de credenciales. La separamos en una entidad distinta (`UserWithPassword`) y solo se usa en `VerifyCredentials`.
- **Las fechas son `string` (ISO 8601)**, igual que en `Todo`. Las razones son las mismas: evitar problemas de serialización entre Server y Client Components.
- **`emailVerified` y `avatar` son nullable.** Refleja el schema de Prisma. `emailVerified` queda `null` hasta que implementemos el flujo de verificación por email (no está en alcance hoy).
- **No incluye relaciones (`todos`, `credentials`).** Las relaciones son detalles del ORM, no del dominio. Si necesitas los todos de un usuario, llamas a `TodoRepository.getTodos(userId)` — no a `user.todos`.

### 4.2 `src/features/users/domain/entities/UserWithPassword.ts`

**Responsabilidad:** Modelar la combinación `User` + `hashedPassword` usada **internamente** durante la verificación de credenciales.

**Por qué existe como tipo aparte:** Para que sea **imposible accidentalmente** pasar un objeto con password a algún sitio donde no debe llegar. El tipo te avisa: "esto trae el hash, no lo expongas".

**Capa hexagonal:** Entidad de Dominio (interna).

**Código actual:**

```typescript
// src/features/users/domain/entities/UserWithPassword.ts
import { User } from "./User";

export interface UserWithPassword extends User {
  hashedPassword: string;
}
```

**Detalles clave:**

- **Solo se construye en el adapter** (`UserPrismaRepository.findByEmailWithPassword`) y **solo se consume en `VerifyCredentials`**. Ningún otro punto del código toca este tipo.
- **No es `User & { hashedPassword?: string }`** (opcional). Hacerlo opcional permitiría confusión: ¿está o no? Lo definimos como `extends User` con campo requerido — si tienes uno, tienes el hash, fin.

### 4.3 `src/features/users/domain/repositories/UserRepository.ts`

**Responsabilidad:** Declarar el contrato de persistencia para `User` y su `Credentials` asociadas.

**Por qué ahora:** Es la abstracción que `RegisterUser` y `VerifyCredentials` consumirán. Si la dejas para después, tendrás los use cases tipados contra `any` o contra Prisma directamente.

**Capa hexagonal:** Puerto (Port) de Dominio.

**Reglas SOLID aplicadas:**

- **DIP:** los casos de uso dependen de esta interfaz, no de Prisma.
- **ISP:** expone solo los cuatro métodos que la app realmente usa. No hay un método `updateUser` "por si acaso" — cuando se necesite, se añade.
- **LSP:** un `UserPrismaRepository`, un `UserInMemoryRepository` o un `UserMockRepository` son intercambiables.

**Conexiones:** importa solo los tipos `User` y `UserWithPassword` de la misma capa.

**Código actual:**

```typescript
// src/features/users/domain/repositories/UserRepository.ts
import { User } from "../entities/User";
import { UserWithPassword } from "../entities/UserWithPassword";

export interface UserRepository {
  findById: (id: User["id"]) => Promise<User | null>;
  findByEmail: (email: User["email"]) => Promise<User | null>;
  findByEmailWithPassword: (
    email: User["email"],
  ) => Promise<UserWithPassword | null>;
  createWithCredentials: (input: {
    user: User;
    hashedPassword: string;
  }) => Promise<User>;
}
```

**Detalles clave:**

- **`findByEmail` vs `findByEmailWithPassword`** son dos métodos distintos. El primero devuelve `User` (sin hash) — uso general. El segundo devuelve `UserWithPassword` y **solo lo usa `VerifyCredentials`**. Esta separación garantiza que el hash no se filtre por accidente: cualquier sitio que solo necesite ver el usuario llama a `findByEmail`, y el tipo le impide ver el hash.
- **`createWithCredentials` es atómico.** Es un solo método que crea User + Credentials. No exponemos `createUser` + `createCredentials` por separado: el dominio considera que registrar un usuario es **una sola operación**. El adapter usa `nested writes` de Prisma para que sea una sola query SQL transaccional.
- **No hay `updateUser`, `deleteUser`, `getUsers`.** No los necesitamos hoy. Si mañana añadimos perfil editable, los añadiremos. **No diseñes para futuros hipotéticos.**

### 4.4 `src/features/users/domain/services/PasswordHasher.ts`

**Responsabilidad:** Declarar el contrato de un servicio que hashea y verifica passwords.

**Por qué está aquí y no en infrastructure:** Porque los **casos de uso lo consumen como una abstracción**. Si lo defines solo en infrastructure, los use cases acabarían importando bcrypt directamente — adiós inversión de dependencia y adiós tests sin dependencias.

**Capa hexagonal:** Puerto (Port) de servicio en Dominio.

**Reglas SOLID aplicadas:**

- **ISP:** dos métodos. Nada más.
- **DIP:** `RegisterUser` recibe un `PasswordHasher`; no sabe si dentro hay bcrypt, argon2 o un mock que devuelve `"hashed-" + plain`.

**Conexiones:** ninguna. Cero imports.

**Código actual:**

```typescript
// src/features/users/domain/services/PasswordHasher.ts
export interface PasswordHasher {
  hash: (plain: string) => Promise<string>;
  verify: (plain: string, hashed: string) => Promise<boolean>;
}
```

**Detalles clave:**

- **Métodos asíncronos** porque la implementación real (bcrypt) lo es (es lento por diseño: ese es el punto).
- **No expone parámetros como `cost`, `salt`** — el contrato es "dame plain, te doy hash". La elección del cost factor es un detalle de implementación, fijado en el adapter.

### 4.5 `src/features/users/domain/errors/UserValidationError.ts` y `EmailAlreadyTakenError.ts`

**Responsabilidad:** Modelar dos errores de dominio:

- `UserValidationError` — los campos del registro no cumplen las reglas (mismo patrón que `TodoValidationError`).
- `EmailAlreadyTakenError` — alguien intenta registrarse con un email ya existente.

**Por qué dos errores distintos:** Tienen tratamientos diferentes en la UI. `UserValidationError` mapea errores por campo (`name`, `email`, `password`); `EmailAlreadyTakenError` es un error de **conflicto de estado** que se proyecta al campo `email` con un mensaje específico ("Email is already taken").

**Capa hexagonal:** Errores de Dominio.

**Reglas SOLID aplicadas:**

- **SRP:** un archivo por error. Cada uno con su propia razón para cambiar.
- **OCP:** `UserValidationError<TField extends string>` genérico permite que distintos use cases lo tipen con sus propios campos sin tocar el archivo.

**Conexiones:** ninguna. Cero imports.

**Código actual:**

```typescript
// src/features/users/domain/errors/UserValidationError.ts
export class UserValidationError<TField extends string = string> extends Error {
  constructor(public readonly fieldErrors: Partial<Record<TField, string>>) {
    super("User validation failed");
    this.name = "UserValidationError";
  }
}
```

```typescript
// src/features/users/domain/errors/EmailAlreadyTakenError.ts
export class EmailAlreadyTakenError extends Error {
  constructor(public readonly email: string) {
    super(`Email ${email} is already taken`);
    this.name = "EmailAlreadyTakenError";
  }
}
```

**Detalles clave:**

- Mismo patrón que `TodoValidationError`. Si te resulta familiar, es porque lo es a propósito.
- `EmailAlreadyTakenError` **guarda el email** como `public readonly`. Si el caller quiere mostrarlo en el mensaje (`"foo@bar.com is already taken"`), puede acceder a `error.email`.

> #### ✅ Checkpoint 4 — Verificar que todo el dominio compila
>
> ```bash
> pnpm tsc --noEmit
> ```
>
> Si no hay errores, **avanza al Paso 2**. No hay nada ejecutable que probar aún — solo interfaces y tipos.

---

## 5. Paso 2 — Capa de Aplicación (Schemas, Validación y Casos de Uso)

> **Mantra del paso:** "Orquesto, no implemento. Y traduzco el mundo (formularios) a operaciones de dominio."

La estructura es **idéntica a `todos`** — schemas, validación, use cases — pero adaptada a auth.

### 5.1 `src/features/users/application/schemas/registerFormSchema.ts`

**Responsabilidad:** Definir el contrato de validación del formulario de registro: `name`, `email`, `password`.

**Capa hexagonal:** Adapter de validación (driving side).

**Código actual:**

```typescript
// src/features/users/application/schemas/registerFormSchema.ts
import { z } from "zod";

const MIN_NAME = 2;
const MIN_PASSWORD = 8;

export const registerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_NAME, `Name must be at least ${MIN_NAME} characters`),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z
    .string()
    .min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters`),
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type RegisterField = keyof RegisterFormValues;
```

**Detalles clave:**

- **`.toLowerCase()` en el email.** Garantiza que `Herbert@example.com` y `herbert@example.com` se traten como el mismo usuario. La normalización ocurre **una sola vez**, en el schema. Tanto la UI como `VerifyCredentials` ven el email ya normalizado.
- **`.trim()` no se aplica al password.** El password puede legítimamente empezar/terminar con espacios si el usuario los puso. Trimmearlo cambiaría el secreto sin que el usuario lo sepa.
- **`MIN_PASSWORD = 8` no es la regla óptima de seguridad** (NIST recomienda ≥ 8 con políticas adicionales o ≥ 12 sin), pero es un mínimo aceptable para una app de práctica. Si quieres endurecerlo, este es el sitio.

### 5.2 `src/features/users/application/schemas/loginFormSchema.ts`

**Responsabilidad:** Validar **mínimamente** la entrada del login. No es donde se decide si las credenciales son correctas — solo si la entrada tiene la forma esperada.

**Por qué es más laxo que el de register:**

- En **register** validamos reglas (`password ≥ 8`) porque estamos creando una cuenta nueva: queremos forzar al usuario a elegir un password aceptable.
- En **login** solo validamos que **haya** email y password. **Las reglas de fortaleza no aplican al loguearse** — si un usuario ya tiene una cuenta con password de 3 caracteres (porque cambiamos la regla después), debe poder entrar. La autoridad sobre "es correcto" la tiene `VerifyCredentials`, no el schema.

**Código actual:**

```typescript
// src/features/users/application/schemas/loginFormSchema.ts
import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type LoginField = keyof LoginFormValues;
```

**Detalle clave:**

- Este schema lo usan **dos sitios**: el `LoginForm.tsx` (cliente, para validar al submit) y el `authorize()` de Auth.js (servidor, para parsear el input antes de llamar a `VerifyCredentials`). Una sola fuente de verdad.

### 5.3 `src/features/users/application/validation/createUserRegistration.ts`

**Responsabilidad:** Tomar un input crudo del formulario de registro y devolverlo **validado y normalizado**, o lanzar `UserValidationError`.

**Capa hexagonal:** Factory de la capa de aplicación.

**Código actual:**

```typescript
// src/features/users/application/validation/createUserRegistration.ts
import { UserValidationError } from "../../domain/errors/UserValidationError";
import {
  registerFormSchema,
  type RegisterField,
  type RegisterFormValues,
} from "../schemas/registerFormSchema";

export function createUserRegistration(
  input: RegisterFormValues,
): RegisterFormValues {
  const parsed = registerFormSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<RegisterField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as RegisterField;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    throw new UserValidationError<RegisterField>(fieldErrors);
  }

  return parsed.data;
}
```

**Detalles clave:**

- Es prácticamente un clon de `createTodo`, por diseño. Si entiendes uno, entiendes el otro.
- **No devuelve un `User`** — devuelve `RegisterFormValues` (datos del formulario validados). La construcción del `User` (id, timestamps) la hace `RegisterUser` con esos datos.

### 5.4 `src/features/users/application/use-cases/RegisterUser.ts`

**Responsabilidad:** Orquestar el registro: validar input, comprobar email único, hashear password, crear User + Credentials atómicamente.

**Capa hexagonal:** Caso de uso (Aplicación).

**Reglas SOLID aplicadas:**

- **SRP:** una sola intención del usuario — "quiero registrarme".
- **DIP:** depende de `UserRepository` y `PasswordHasher` (interfaces), no de Prisma ni bcrypt.

**Código actual:**

```typescript
// src/features/users/application/use-cases/RegisterUser.ts
import { User } from "../../domain/entities/User";
import { EmailAlreadyTakenError } from "../../domain/errors/EmailAlreadyTakenError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PasswordHasher } from "../../domain/services/PasswordHasher";
import { createUserRegistration } from "../validation/createUserRegistration";
import { RegisterFormValues } from "../schemas/registerFormSchema";

export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterFormValues): Promise<User> {
    const { name, email, password } = createUserRegistration(input);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyTakenError(email);
    }

    const now = new Date().toISOString();
    const hashedPassword = await this.passwordHasher.hash(password);

    return this.userRepository.createWithCredentials({
      user: {
        id: crypto.randomUUID(),
        name,
        email,
        emailVerified: null,
        avatar: null,
        createdAt: now,
        updatedAt: now,
      },
      hashedPassword,
    });
  }
}
```

**Detalles clave:**

- **El orden importa:** validar → buscar duplicado → hashear → crear. Hashear es caro (bcrypt cost 10 ≈ 100ms). Si el email ya existe, **no queremos pagar el costo del hash**. Por eso `findByEmail` va antes que `hash`.
- **Race condition pequeña:** entre `findByEmail` y `createWithCredentials` podrían crearse dos usuarios con el mismo email si dos requests llegan simultáneamente. La constraint `UNIQUE` en `email` del schema garantiza que la DB rechace el segundo. Si en algún momento quieres devolver `EmailAlreadyTakenError` en ese caso límite, atrapa el error de Prisma `P2002` en el adapter y mapéalo. Hoy no lo hacemos — es un caso muy raro y la UI lo mostrará como error genérico.
- **`crypto.randomUUID()` y `new Date().toISOString()` viven aquí, no en el dominio.** El razonamiento es el mismo que en `AddTodo`/`addTodoAction` para `todos`: el reloj y el id-gen son efectos del mundo, deberían inyectarse. Lo dejamos así por pragmatismo (ver "recomendaciones" de la guía de todos).

### 5.5 `src/features/users/application/use-cases/VerifyCredentials.ts`

**Responsabilidad:** Dado un email y un password, devolver el `User` si las credenciales son válidas, o `null` si no.

**Por qué este use case en lugar de un `LoginUser`:**

Auth.js gestiona el "iniciar sesión" (crear el JWT, set-cookie, redirect). **Lo que necesita de nosotros es solo "verifica si estas credenciales son válidas"**. Por eso este use case devuelve `User | null` — es exactamente lo que `authorize()` de Auth.js espera.

Meter aquí toda la lógica de cookie/redirect sería duplicar lo que Auth.js ya hace. La división es clara: **dominio se ocupa de "son correctas estas credenciales"; Auth.js se ocupa de "ahora estás logueado"**.

**Capa hexagonal:** Caso de uso (Aplicación).

**Código actual:**

```typescript
// src/features/users/application/use-cases/VerifyCredentials.ts
import { User } from "../../domain/entities/User";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PasswordHasher } from "../../domain/services/PasswordHasher";

type Input = {
  email: string;
  password: string;
};

export class VerifyCredentials {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({ email, password }: Input): Promise<User | null> {
    const row = await this.userRepository.findByEmailWithPassword(
      email.trim().toLowerCase(),
    );
    if (!row) return null;

    const ok = await this.passwordHasher.verify(password, row.hashedPassword);
    if (!ok) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      avatar: row.avatar,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
```

**Detalles clave:**

- **`email.trim().toLowerCase()` defensivo.** El schema ya hace esto, pero `authorize()` recibe input "crudo" del provider y queremos garantía absoluta. Mejor un `.toLowerCase()` extra que un bug de "hgutierrez@x.com" no encuentra "Hgutierrez@X.com".
- **Devuelve `null` en cualquier fallo, no lanza.** Auth.js convierte `null` en `CredentialsSignin` AuthError. Si lanzas, Auth.js te lo verá como error inesperado y la UX se degrada. **Devuelve `null` y deja que Auth.js componga el error.**
- **Reconstrucción explícita del `User`** (no `{ hashedPassword: _, ...user }`). Es más verboso pero garantiza por construcción que **nunca** vamos a devolver un objeto con `hashedPassword` por accidente. Es defensa en profundidad: aunque el tipo `User` ya no tiene `hashedPassword`, dejarlo explícito facilita la auditoría visual.
- **Tipos de mensaje genérico al fallar:** devolver `null` indistintamente cuando "usuario no existe" o "password incorrecto" evita el ataque de **enumeración de emails** (un atacante no puede distinguir si un email está registrado). Es práctica estándar.

> #### ✅ Checkpoint 5 — Probar `RegisterUser` y `VerifyCredentials` sin Prisma ni bcrypt
>
> Como con `todos`, puedes validar los use cases con un mock repo + mock hasher.
>
> ```ts
> // scratch-auth.ts
> import {
>   RegisterUser,
> } from "./src/features/users/application/use-cases/RegisterUser";
> import { VerifyCredentials } from "./src/features/users/application/use-cases/VerifyCredentials";
> import type { UserRepository } from "./src/features/users/domain/repositories/UserRepository";
> import type { PasswordHasher } from "./src/features/users/domain/services/PasswordHasher";
> import { User } from "./src/features/users/domain/entities/User";
> import { UserWithPassword } from "./src/features/users/domain/entities/UserWithPassword";
>
> // Mock repo en memoria
> const users: UserWithPassword[] = [];
> const repo: UserRepository = {
>   findById: async (id) => users.find((u) => u.id === id) ?? null,
>   findByEmail: async (email) => users.find((u) => u.email === email) ?? null,
>   findByEmailWithPassword: async (email) =>
>     users.find((u) => u.email === email) ?? null,
>   createWithCredentials: async ({ user, hashedPassword }) => {
>     users.push({ ...user, hashedPassword });
>     return user;
>   },
> };
>
> // Mock hasher (NO usar en producción: es identidad + prefijo)
> const hasher: PasswordHasher = {
>   hash: async (plain) => `mock-${plain}`,
>   verify: async (plain, hashed) => hashed === `mock-${plain}`,
> };
>
> async function main() {
>   await new RegisterUser(repo, hasher).execute({
>     name: "Ada Lovelace",
>     email: "ada@example.com",
>     password: "12345678",
>   });
>
>   const ok = await new VerifyCredentials(repo, hasher).execute({
>     email: "ada@example.com",
>     password: "12345678",
>   });
>   console.log("✅ Login con credenciales correctas:", ok?.email);
>
>   const fail = await new VerifyCredentials(repo, hasher).execute({
>     email: "ada@example.com",
>     password: "wrong",
>   });
>   console.log("✅ Login con password incorrecto:", fail); // null
> }
> main();
> ```
>
> Ejecuta: `pnpm tsx scratch-auth.ts`.
>
> **Si esto funciona, toda la lógica de auth está validada sin DB ni bcrypt.** Avanza al Paso 3.

---

## 6. Paso 3 — Capa de Infraestructura

> **Mantra del paso:** "Implemento los contratos del dominio usando bcryptjs y Prisma."

Tres archivos en orden:

1. El esquema de la base de datos (extender el existente).
2. El adapter de `PasswordHasher` (`bcryptHasher`).
3. El mapper Prisma ↔ dominio + el adapter de `UserRepository`.

### 6.1 `prisma/schema.prisma` (extensión)

Añade los modelos `User` y `Credentials`. **No tocas el modelo `Todo`** todavía (ese cambio viene en el Paso 7).

```prisma
// prisma/schema.prisma
model User {
  id             String       @id @default(cuid())
  name           String?
  email          String       @unique
  emailVerified  DateTime?
  avatar         String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @default(now()) @updatedAt
  credentials    Credentials?
  todos          Todo[]
}

model Credentials {
  id             String   @id @default(cuid())
  userId         String   @unique
  hashedPassword String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @default(now()) @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Detalles clave:**

- **`email String @unique`** — la DB es la última línea de defensa contra duplicados (cubre la race condition de `RegisterUser`).
- **`Credentials.userId @unique` + relación 1-1.** Un usuario tiene como mucho un set de credenciales. Si añades OAuth, los providers de OAuth no entran aquí — irían a una tabla `Account` separada (futuro).
- **`onDelete: Cascade`** — borrar el usuario borra automáticamente sus credenciales. Sin esto tendrías filas huérfanas en `Credentials`.

**Sincroniza con la DB:**

```bash
pnpm prisma db push
```

> **Después de cada `prisma db push` o `prisma generate`, reinicia `pnpm dev`.** Lo explico en detalle en el Paso 12 (Troubleshooting) — si no lo haces, te encontrarás con `Cannot read properties of undefined (reading 'findUnique')`.

### 6.2 `src/features/users/infrastructure/hashing/bcryptHasher.ts`

**Responsabilidad:** Implementar la interfaz `PasswordHasher` usando bcryptjs.

**Capa hexagonal:** Adapter (Infraestructura).

**Código actual:**

```typescript
// src/features/users/infrastructure/hashing/bcryptHasher.ts
import bcrypt from "bcryptjs";

import type { PasswordHasher } from "../../domain/services/PasswordHasher";

const COST = 10;

export const bcryptHasher: PasswordHasher = {
  hash: (plain) => bcrypt.hash(plain, COST),
  verify: (plain, hashed) => bcrypt.compare(plain, hashed),
};
```

**Detalles clave:**

- **`COST = 10`** — el cost factor de bcrypt (≈ 100ms por hash en hardware moderno). Subirlo (12, 14) endurece los ataques offline pero hace más lento cada login. 10 es razonable para una app de práctica; en producción seria, ajusta según tu hardware (objetivo: 250-500ms por hash).
- **Es un objeto literal, no una clase.** El singleton es trivialmente reusable y no necesita estado. Si en el futuro quieres inyectar el cost factor desde env, lo conviertes en una factory `createBcryptHasher(cost)` que devuelve un `PasswordHasher`.
- **`bcryptjs` (no `bcrypt`).** `bcryptjs` es JS puro, sin compilación nativa — funciona en Node, en Edge runtime y en bundlers. `bcrypt` (con C++) es más rápido pero requiere node-gyp y no funciona en Edge.

### 6.3 `src/features/users/infrastructure/mappers/userMapper.ts`

**Responsabilidad:** Traducir entre filas de Prisma (`UserModel`, `CredentialsModel`) y entidades de dominio (`User`, `UserWithPassword`).

**Por qué un archivo aparte:** Si lo dejas dentro del repo, el repo crece y se mezclan responsabilidades. Aislarlo facilita testear (`toDomain(row)` es una función pura) y reusar (si en el futuro otro adapter necesita el mismo mapeo).

**Código actual:**

```typescript
// src/features/users/infrastructure/mappers/userMapper.ts
import type {
  CredentialsModel,
  UserModel,
} from "@/shared/generated/prisma/models";

import type { User } from "../../domain/entities/User";
import type { UserWithPassword } from "../../domain/entities/UserWithPassword";

type UserRow = UserModel;
type UserRowWithCredentials = UserModel & { credentials: CredentialsModel };

export const toDomain = (row: UserRow): User => ({
  id: row.id,
  name: row.name ?? "",
  email: row.email,
  emailVerified: row.emailVerified ? row.emailVerified.toISOString() : null,
  avatar: row.avatar ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toDomainWithPassword = (
  row: UserRowWithCredentials,
): UserWithPassword => ({
  ...toDomain(row),
  hashedPassword: row.credentials.hashedPassword,
});

export const toPersistence = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
  avatar: user.avatar,
  createdAt: new Date(user.createdAt),
  updatedAt: new Date(user.updatedAt),
});
```

**Detalles clave:**

- **`row.name ?? ""`** — el schema permite `name` null, pero el dominio lo expone como `string` (tras la decisión de capa anterior de no permitir null). Si la DB tiene un null (registros viejos), lo normalizamos a `""`. Si quieres ser estricto, cambia el schema a `name String` (sin `?`).
- **Conversiones de fecha:** `DateTime` (Prisma) ↔ `string` ISO (dominio). Igual que en `todoMapper`.
- **`toDomainWithPassword` recibe la fila con `credentials` ya incluido.** El adapter es quien hace el `include: { credentials: true }`; el mapper solo asume que llega.

### 6.4 `src/features/users/infrastructure/repositories/UserPrismaRepository.ts`

**Responsabilidad:** Implementar la interfaz `UserRepository` usando Prisma.

**Capa hexagonal:** Adapter (Infraestructura).

**Reglas SOLID aplicadas:**

- **LSP:** intercambiable con cualquier otro `UserRepository`.
- **DIP cumplido:** el dominio define la interfaz; la infra la implementa.

**Código actual:**

```typescript
// src/features/users/infrastructure/repositories/UserPrismaRepository.ts
import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";

import type { UserRepository } from "../../domain/repositories/UserRepository";
import {
  toDomain,
  toDomainWithPassword,
  toPersistence,
} from "../mappers/userMapper";

type UserPrismaDatabase = Pick<typeof prisma, "user">;

export const createUserPrismaRepository = (
  db: UserPrismaDatabase,
): UserRepository => ({
  findById: async (id) => {
    const row = await db.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  findByEmail: async (email) => {
    const row = await db.user.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  },

  findByEmailWithPassword: async (email) => {
    const row = await db.user.findUnique({
      where: { email },
      include: { credentials: true },
    });
    if (!row || !row.credentials) return null;
    return toDomainWithPassword({ ...row, credentials: row.credentials });
  },

  createWithCredentials: async ({ user, hashedPassword }) => {
    const created = await db.user.create({
      data: {
        ...toPersistence(user),
        credentials: {
          create: {
            hashedPassword,
          },
        },
      },
    });
    return toDomain(created);
  },
});

export const UserPrismaRepository = createUserPrismaRepository(prisma);
```

**Detalles clave:**

- **Factory + singleton (`createUserPrismaRepository(prisma)`).** El mismo patrón que `TodoPrismaRepository`. La factory te permite inyectar otro cliente Prisma (e.g., uno mockeado para tests) sin tocar el módulo.
- **`createWithCredentials` usa nested write.** Prisma traduce esto a una transacción SQL atómica: si la creación de `Credentials` falla, también se rollback la creación de `User`. **No necesitas `$transaction` explícito** para este caso.
- **`findByEmailWithPassword` con `include`.** Sin `include`, el resultado no traería `credentials`. La doble verificación `if (!row || !row.credentials)` cubre el caso (improbable pero posible) de un User sin Credentials.

> #### ✅ Checkpoint 6 — Validar persistencia real
>
> 1. Asegúrate de que `.env` tiene `DATABASE_URL` válido.
> 2. Aplica el schema: `pnpm prisma db push`.
> 3. Reinicia `pnpm dev`.
> 4. Crea `scratch-user.ts`:
>
>    ```ts
>    import { UserPrismaRepository } from "./src/features/users/infrastructure/repositories/UserPrismaRepository";
>    import { bcryptHasher } from "./src/features/users/infrastructure/hashing/bcryptHasher";
>    import { RegisterUser } from "./src/features/users/application/use-cases/RegisterUser";
>    import { VerifyCredentials } from "./src/features/users/application/use-cases/VerifyCredentials";
>
>    async function main() {
>      const user = await new RegisterUser(
>        UserPrismaRepository,
>        bcryptHasher,
>      ).execute({
>        name: "Smoke Test",
>        email: "smoke@example.com",
>        password: "smoke-password",
>      });
>      console.log("✅ Registered:", user.id);
>
>      const verified = await new VerifyCredentials(
>        UserPrismaRepository,
>        bcryptHasher,
>      ).execute({ email: "smoke@example.com", password: "smoke-password" });
>      console.log("✅ Login OK:", verified?.email);
>    }
>    main();
>    ```
>
> 5. Ejecuta: `pnpm tsx scratch-user.ts`.
> 6. Abre `pnpm prisma studio` y confirma que aparecen filas en `User` y `Credentials`.
>
> Si funciona, **toda la lógica de auth está validada contra Postgres real, sin Auth.js todavía**. Avanza al Paso 4.

---

## 7. Paso 4 — Configuración de Auth.js (la pieza única)

> **Mantra del paso:** "Auth.js es el cartero de la sesión. Habla con mis use cases para verificar credenciales, y se encarga de la cookie y el JWT."

Esta es la sección más diferente respecto al feature `todos`. Auth.js v5 tiene **convenciones propias** que hay que respetar para que funcione:

- Un único archivo `auth.ts` que exporta `{ handlers, signIn, signOut, auth }` vía `NextAuth({...})`.
- Una ruta `[...nextauth]` en `app/api/auth/` que re-exporta los handlers.
- Un `middleware.ts` que protege rutas.

Y un patrón **recomendado por la propia Auth.js**: **split config** entre `auth.config.ts` (edge-safe) y `auth.ts` (completa). Vamos por partes.

### 7.1 `src/shared/infrastructure/auth/auth.config.ts` (edge-safe)

**Responsabilidad:** Configurar Auth.js con todo **excepto el provider real** (que carga Prisma + bcrypt). Es la config que el middleware puede importar sin romper Edge runtime.

**Por qué split:** El middleware corre en Edge runtime, donde **no puedes importar `@prisma/client` ni el adapter `@prisma/adapter-pg`**. Si tu `auth.ts` (que sí los importa, vía `UserPrismaRepository`) acabara importado por el middleware, el build de Next falla con un mensaje feo sobre módulos no compatibles con Edge.

La solución: **dos archivos**. La config "ligera" (edge-safe) tiene `providers: []` y se usa en el middleware. La config "completa" extiende la ligera y añade el `Credentials` provider real.

**Capa hexagonal:** Infraestructura compartida.

**Código actual:**

```typescript
// src/shared/infrastructure/auth/auth.config.ts
import type { DefaultSession, NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
  }
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  callbacks: {
    authorized: ({ auth, request: { nextUrl } }) => {
      const isLoggedIn = !!auth?.user;
      const isOnTodos = nextUrl.pathname.startsWith("/todos");
      const isOnAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");

      if (isOnTodos) return isLoggedIn;
      if (isOnAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/todos", nextUrl));
      }
      return true;
    },
    jwt: ({ token, user }) => {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
```

**Detalles clave:**

- **`declare module "next-auth"`** extiende los tipos por defecto para que `session.user.id` exista. Sin esto, TypeScript no sabe que añadiste `id` al callback de session y se queja.
- **`pages: { signIn: "/login" }`** — sobrescribe la página de login por defecto de Auth.js (`/api/auth/signin`) por nuestra propia ruta.
- **`session.strategy: "jwt"`** — la decisión clave. Sin esto, Auth.js asume database sessions y pide un adapter.
- **`maxAge: 60 * 60 * 24 * 30`** — JWT vigente 30 días. Después caduca y el usuario debe re-loguearse.
- **`authorized` callback** — la lógica de protección de rutas. Devuelve `true` para permitir, `false` para redirigir a `signIn` (configurado arriba), o un `Response.redirect()` para redirecciones custom.
  - Si entras a `/todos*` sin sesión → `false` → middleware te manda a `/login`.
  - Si entras a `/login` o `/register` **con** sesión → redirect a `/todos` (no tiene sentido loguearte si ya estás logueado).
  - Cualquier otra ruta → `true` (acceso libre).
- **`jwt` callback** — se ejecuta cuando se crea/refresca el JWT. Si hay `user` (es el primer login), copia el `id` al token. En llamadas posteriores `user` es `undefined` y el `token.id` ya está.
- **`session` callback** — se ejecuta cada vez que se lee la sesión (`auth()`). Copia `token.id` a `session.user.id` para que esté disponible en el resto de la app.
- **`providers: []`** — sí, vacío aquí. El provider real va en la config completa.
- **`satisfies NextAuthConfig`** — valida el shape sin perder el tipo literal (necesario para inferencia de tipos en callbacks).

### 7.2 `src/shared/infrastructure/auth/auth.ts` (full config)

**Responsabilidad:** Extender la config edge-safe añadiendo el `Credentials` provider real, que llama a `VerifyCredentials` con Prisma + bcrypt.

**Capa hexagonal:** Infraestructura compartida + Composition Root (decide qué adapters concretos usar).

**Código actual:**

```typescript
// src/shared/infrastructure/auth/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { bcryptHasher } from "@/features/users/infrastructure/hashing/bcryptHasher";
import { UserPrismaRepository } from "@/features/users/infrastructure/repositories/UserPrismaRepository";
import { VerifyCredentials } from "@/features/users/application/use-cases/VerifyCredentials";
import { loginFormSchema } from "@/features/users/application/schemas/loginFormSchema";

import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (raw) => {
        const parsed = loginFormSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await new VerifyCredentials(
          UserPrismaRepository,
          bcryptHasher,
        ).execute(parsed.data);

        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        };
      },
    }),
  ],
});
```

**Detalles clave:**

- **`{ handlers, signIn, signOut, auth }`** — las cuatro APIs que Auth.js exporta:
  - `handlers` — `{ GET, POST }` para el route handler de `[...nextauth]`.
  - `signIn` / `signOut` — funciones para Server Actions / Server Components.
  - `auth` — función para leer la sesión en Server Components y Server Actions, y también el wrapper de middleware (`NextAuth(authConfig).auth` lo usa el middleware aparte).
- **`Credentials({...})`** — define el provider de credenciales. `credentials: { email: {}, password: {} }` es la "forma" del input (Auth.js los usa para auto-generar páginas — nosotros las sobrescribimos, pero el shape sigue siendo necesario).
- **`authorize` es la integración real con tus use cases:**
  1. Parsea el input con `loginFormSchema` — defensa extra (Auth.js no garantiza shape).
  2. Llama a `VerifyCredentials` (composition root: aquí decidimos `UserPrismaRepository` + `bcryptHasher`).
  3. Si vuelve `null` → return `null` → Auth.js lanza `CredentialsSignin`.
  4. Si vuelve un `User` → return un objeto con `id`, `email`, `name`, `image` (Auth.js espera esa forma).
- **`image: user.avatar`** — mapeo de nombre: en el dominio le decimos `avatar`; Auth.js usa `image` por convención (compatible con OAuth providers).

### 7.3 `src/auth.ts` (re-export por convención)

**Responsabilidad:** Re-exportar `{ auth, signIn, signOut, handlers }` desde una ruta corta en la raíz de `src/`, porque Auth.js lo espera ahí por convención (las docs siempre dicen "import from `@/auth`").

**Capa:** Convención de proyecto.

**Código actual:**

```typescript
// src/auth.ts
export {
  auth,
  signIn,
  signOut,
  handlers,
} from "./shared/infrastructure/auth/auth";
```

**Por qué dos archivos para lo mismo:** La config real vive en `shared/infrastructure/auth/` porque conceptualmente es **infraestructura compartida**. Pero el resto del código importa desde `@/auth` porque es **la convención Auth.js** y las docs/tutoriales son más legibles así. Este re-export resuelve ambos requisitos sin compromisos.

### 7.4 `src/app/api/auth/[...nextauth]/route.ts`

**Responsabilidad:** Exponer el endpoint que Auth.js usa internamente (`/api/auth/callback/credentials`, `/api/auth/csrf`, etc.).

**Capa:** Composition Root (Route Handler).

**Código actual:**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

**Detalles clave:**

- **No tienes que entender qué hace internamente.** Auth.js maneja CSRF, callbacks, providers OAuth, etc. Tú solo expones los handlers.
- **`[...nextauth]`** es un catch-all route de Next.js. Cualquier path bajo `/api/auth/*` cae aquí.

### 7.5 `src/middleware.ts`

**Responsabilidad:** Interceptar **toda request HTTP** (excepto las excluidas en el matcher) y ejecutar el callback `authorized` de la config para decidir si permitir, redirigir o bloquear.

**Capa:** Edge protection layer.

**Código actual:**

```typescript
// src/middleware.ts
import NextAuth from "next-auth";

import { authConfig } from "@/shared/infrastructure/auth/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

**Detalles clave:**

- **Importa solo `authConfig` (edge-safe), NO `auth.ts`.** Esta es la razón de existir del split config. Si aquí importas `from "@/auth"` (que internamente importa Prisma y bcrypt), el build de Next.js falla con un error sobre incompatibilidad de Edge runtime.
- **`NextAuth(authConfig).auth`** — el wrapper devuelve una función de middleware lista para usar. El callback `authorized` de la config decide qué hacer.
- **`matcher`** excluye `/api/*` (porque el `[...nextauth]/route.ts` necesita correr sin auth-check), assets estáticos y favicon. Todo lo demás pasa por el middleware.

> #### ✅ Checkpoint 7 — Smoke test del flow completo
>
> 1. Asegúrate de que `.env` tiene `AUTH_SECRET` definido. Genera uno: `npx auth secret` o `openssl rand -hex 32`.
> 2. **Reinicia `pnpm dev`** (siempre tras tocar config, schema, o `prisma generate`).
> 3. Visita `http://localhost:3000/todos` sin login → debes ser redirigido a `/login`.
> 4. Visita `http://localhost:3000/login` → debes ver la página de login (aún no la has implementado en este paso — la haremos en el 9 — pero la ruta debe existir aunque la página esté vacía).
>
> Si los redirects funcionan, **la pieza Auth.js está bien conectada**. Avanza al Paso 5.

---

## 8. Paso 5 — Composition Root (Server Actions)

> **Mantra del paso:** "Aquí elijo concretos, aquí orquesto signIn/signOut con mis use cases, aquí traduzco errores al contrato que la UI espera."

### 8.1 `src/features/users/actions/auth.actions.ts`

**Responsabilidad:** Tres acciones server-side:

- `registerAction` — registra un usuario y le hace auto-login.
- `loginAction` — autentica con email + password.
- `logoutAction` — cierra sesión.

**Capa hexagonal:** Composition Root (driving adapter para la UI).

**Reglas SOLID aplicadas:**

- **SRP:** cada action hace una sola cosa.
- **DIP "se rompe" intencionalmente:** aquí _sí_ sabemos quién es `UserPrismaRepository` y `bcryptHasher`. Pero la decisión está **aislada en este archivo**.

**Código actual:**

```typescript
// src/features/users/actions/auth.actions.ts
"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { RegisterUser } from "../application/use-cases/RegisterUser";
import {
  type RegisterField,
  type RegisterFormValues,
} from "../application/schemas/registerFormSchema";
import { type LoginField } from "../application/schemas/loginFormSchema";
import { UserValidationError } from "../domain/errors/UserValidationError";
import { EmailAlreadyTakenError } from "../domain/errors/EmailAlreadyTakenError";
import { UserPrismaRepository } from "../infrastructure/repositories/UserPrismaRepository";
import { bcryptHasher } from "../infrastructure/hashing/bcryptHasher";

export type RegisterResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<RegisterField | "form", string>> };

export type LoginResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<LoginField | "form", string>> };

export async function registerAction(
  input: RegisterFormValues,
): Promise<RegisterResult> {
  try {
    await new RegisterUser(UserPrismaRepository, bcryptHasher).execute(input);
  } catch (e) {
    if (e instanceof UserValidationError) {
      return {
        ok: false,
        errors: e.fieldErrors as Partial<Record<RegisterField, string>>,
      };
    }
    if (e instanceof EmailAlreadyTakenError) {
      return { ok: false, errors: { email: "Email is already taken" } };
    }
    console.error("[registerAction] unexpected error:", e);
    return {
      ok: false,
      errors: { form: "Could not create account. Try again." },
    };
  }

  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: "/todos",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        ok: false,
        errors: { form: "Account created but auto-login failed. Please log in." },
      };
    }
    throw e;
  }

  return { ok: true };
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: "/todos",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, errors: { form: "Invalid credentials" } };
    }
    throw e;
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
```

**Detalles clave que un Junior debe entender:**

- **El patrón `try { signIn } catch (e) { if (AuthError) ... throw e; }` es la forma canónica recomendada por Auth.js v5.**
  - `signIn` con `redirectTo` exitoso llama internamente a `redirect()`, que **lanza un `NEXT_REDIRECT`**. Es así como Next.js implementa los redirects desde server actions.
  - Si tu catch atrapa el `NEXT_REDIRECT` y NO lo re-lanza, **el redirect se pierde** y el usuario se queda donde estaba. Por eso el `throw e` al final del catch es crítico: deja que el `NEXT_REDIRECT` salga de la action.
  - Solo tratamos `AuthError` (errores reales de auth, como credenciales inválidas) — todo lo demás (incluido `NEXT_REDIRECT`) se re-lanza.
- **`registerAction` tiene dos try/catch separados.** Uno para `RegisterUser` (errores de dominio: validación, email duplicado), otro para `signIn` (errores de Auth.js: credenciales que de alguna manera fallaron justo después de crearse). Mezclarlos los confundiría.
- **Retorna `RegisterResult` discriminado.** Es el mismo patrón que `AddTodoResult` en `todos.actions.ts`: los errores viajan como datos, no como excepciones. Permite a la UI proyectarlos campo a campo con `form.setError(...)`.
- **`logoutAction` no atrapa nada.** `signOut` también puede lanzar `NEXT_REDIRECT`, pero **eso es lo que queremos** — el redirect debe ocurrir.
- **El `console.error` final es debug útil.** Si algo inesperado rompe (e.g., DB caída), queda log en el servidor.

> #### ✅ Checkpoint 8 — Verificar que las actions compilan y arrancan
>
> ```bash
> pnpm tsc --noEmit && pnpm dev
> ```
>
> Las actions solo se pueden probar end-to-end con la UI lista. Sigue al Paso 6.

---

## 9. Paso 6 — Componentes UI (Client Components)

> **Mantra del paso:** "Los forms son agnósticos del Auth.js que hay por debajo. Solo conocen `loginAction` y `registerAction`."

### 9.1 `src/app/(auth)/layout.tsx`

**Responsabilidad:** Layout compartido para `/login` y `/register`. Centra el contenido y limita el ancho.

**Por qué un layout aparte:** Las páginas de auth no deben heredar la navegación principal de la app. El grupo de rutas `(auth)` (paréntesis = no afecta URL) nos permite tener su propio layout sin que ese layout aparezca en `/todos`.

**Código actual:**

```tsx
// src/app/(auth)/layout.tsx
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
};
export default AuthLayout;
```

### 9.2 `src/features/users/components/LoginForm.tsx`

**Responsabilidad:** Capturar email + password, validar en cliente vía Zod, llamar a `loginAction`, proyectar errores al formulario.

**Stack idéntico a `TodoInput`:** RHF + zodResolver + useTransition + shadcn `Form`. Si lees `TodoInput`, lees este — son hermanos.

**Código:** ver [LoginForm.tsx](../src/features/users/components/LoginForm.tsx). No lo pego completo porque es muy similar a `TodoInput`. Lo único conceptualmente distinto:

- **No espera `onLogin` como prop.** Importa `loginAction` directamente. Decisión consciente: estos forms son **acoplados al feature de auth** (no se reusan en otro contexto). Si en el futuro quieres que sean genéricos, conviértelos a recibir `onSubmit` como prop, igual que `TodoInput`.
- **Errores se proyectan a `email`, `password` o `root`** según el shape de `LoginResult`. El error genérico "Invalid credentials" siempre va a `root` (no queremos decir cuál de los dos falló).

### 9.3 `src/features/users/components/RegisterForm.tsx`

Lo mismo que `LoginForm` pero con tres campos (`name`, `email`, `password`) y llamando a `registerAction`.

**Detalle clave:** los errores tienen 4 posibles destinos: `name`, `email` (incluye "Email is already taken"), `password`, o `root`. La proyección es secuencial: cada `if (result.errors.X)` se evalúa y se llama a `form.setError`.

### 9.4 `src/app/(auth)/login/page.tsx` y `src/app/(auth)/register/page.tsx`

**Responsabilidad:** Páginas Server Component triviales que solo renderizan el form correspondiente.

```tsx
// src/app/(auth)/login/page.tsx
import LoginForm from "@/features/users/components/LoginForm";

const LoginPage = () => <LoginForm />;
export default LoginPage;
```

```tsx
// src/app/(auth)/register/page.tsx
import RegisterForm from "@/features/users/components/RegisterForm";

const RegisterPage = () => <RegisterForm />;
export default RegisterPage;
```

**Detalles clave:**

- Son Server Components (sin `"use client"`). Solo importan un Client Component.
- El layout (`(auth)/layout.tsx`) las envuelve automáticamente — no hace falta importarlo aquí.
- Si necesitas leer la sesión en la página (e.g., para redirigir si ya estás logueado), puedes hacerlo aquí — pero el middleware ya lo hace, así que no es necesario.

> #### ✅ Checkpoint 9 — Probar el flow Register completo
>
> 1. **Reinicia `pnpm dev`** (siempre).
> 2. Abre `http://localhost:3000/register`.
> 3. Rellena name, email, password y submit.
> 4. Espera: te redirige a `/todos` automáticamente, ves tu email en la cabecera.
> 5. Click en "Sign out" → vuelves a `/login`.
> 6. Loguéate de nuevo con las mismas credenciales → vuelves a `/todos`.
>
> Si los seis pasos pasan, **el feature de auth está completo end-to-end**. Avanza al Paso 7.

---

## 10. Paso 7 — Integrar con features existentes (proteger `/todos` y scope al usuario)

> **Mantra del paso:** "Cada Todo pertenece a un User. Las queries lo filtran; las mutaciones lo respetan."

Esta es la parte que **modifica** el feature `todos` para que sea consciente del usuario logueado. Cuatro cambios coordinados:

1. Añadir `userId` al schema `Todo` y al entity de dominio.
2. Cambiar la firma de los métodos del repo y los use cases para que reciban `userId`.
3. Actualizar los mappers y el adapter Prisma.
4. Actualizar las server actions para leer `session.user.id` y propagarlo.

### 10.1 Schema: añadir `userId` a `Todo`

```prisma
// prisma/schema.prisma
model Todo {
  id          String   @id @default(cuid())
  title       String
  description String   @default("")
  completed   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now()) @updatedAt
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Detalles clave:**

- **`userId String?`** (nullable) y **`user User?`** — relación opcional. Lo dejamos nullable porque puede haber filas legacy sin `userId`. Si quieres ser estricto y empezar de cero, hazlo `String` (sin `?`) y borra todas las filas existentes con `DELETE FROM "Todo" WHERE "userId" IS NULL;`.
- **`onDelete: Cascade`** — borrar el usuario borra todos sus todos. Sin esto, tendrías huérfanos.
- **`@@index([userId])`** — sin esto, `getTodos(userId)` haría un full scan. Con muchos todos, esto importa.

Aplica: `pnpm prisma db push` (y **reinicia `pnpm dev`**).

### 10.2 Entity: añadir `userId` a `Todo`

```typescript
// src/features/todos/domain/entities/Todo.ts
export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

**Detalle clave:** **`userId: string` (no nullable)** aunque la DB lo permita null. La entidad de dominio es más estricta: un Todo siempre tiene dueño. El mapper hace el bridge (`row.userId ?? ""` por defensa, aunque en la práctica el filtro `where: { userId }` ya excluye los nulls).

### 10.3 Repository interface: scope por `userId`

```typescript
// src/features/todos/domain/repositories/TodoRepository.ts
export interface TodoRepository {
  getTodos: (userId: Todo["userId"]) => Promise<Todo[]>;
  findById: (
    id: Todo["id"],
    userId: Todo["userId"],
  ) => Promise<Todo | null>;
  addTodo: (todo: Todo) => Promise<void>;
  updateTodo: (todo: Todo) => Promise<void>;
  deleteTodo: (id: Todo["id"], userId: Todo["userId"]) => Promise<void>;
}
```

**Por qué `userId` en `findById`/`deleteTodo`:** **Seguridad**. Sin el `userId`, un usuario malicioso podría llamar a `deleteTodo("id-de-otro-usuario")` y borrar todos ajenos (los ids son cuids/uuids predecibles si los logueas). Con `userId`, la query es `WHERE id = X AND userId = Y` — si Y no es el dueño, no encuentra nada y no pasa nada.

**Por qué `addTodo`/`updateTodo` no:** El `Todo` que reciben ya contiene `userId` en el shape. La validación se hace por contexto (la action lo asigna desde la sesión).

### 10.4 Adapter Prisma: implementar el scope

Ver [TodoPrismaRepository.ts](../src/features/todos/infrastructure/repositories/TodoPrismaRepository.ts) — los cambios son mecánicos:

- `getTodos` → `where: { userId }`
- `findById` → `findFirst({ where: { id, userId } })`
- `updateTodo`/`deleteTodo` → `updateMany`/`deleteMany` con `where: { id, userId }` (devuelven `count = 0` silenciosamente si no encuentran — comportamiento idempotente).

### 10.5 Use cases: propagar `userId`

`GetTodos`, `FindById`, `ToggleTodoCompletion`, `DeleteTodo`, `UpdateTodo` añaden `userId` como segundo parámetro a `execute`. `AddTodo` no cambia (el `Todo` que recibe ya viene con `userId` poblado).

### 10.6 Server Actions: leer `session.user.id`

```typescript
// src/features/todos/actions/todos.actions.ts
import { auth } from "@/auth";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function addTodoAction(title: string, description: string) {
  const userId = await requireUserId();
  // ... crea el Todo con userId
}

export async function toggleTodoAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await new ToggleTodoCompletion(TodoPrismaRepository).execute(id, userId);
  revalidatePath("/todos");
}
```

**Detalle clave:** `requireUserId()` es defensa en profundidad. El middleware ya garantiza que solo usuarios logueados acceden a `/todos`, pero confiar **solo** en el middleware sería frágil. Si mañana cambia el matcher, o si la action se llama desde otro contexto, esta función es la red de seguridad.

### 10.7 Page: leer sesión y mostrar el usuario

```typescript
// src/app/todos/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const TodosPage = async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const todos = await new GetTodos(TodoPrismaRepository).execute(
    session.user.id,
  );
  // ... render con session.user.email en la cabecera, botón Sign out
};
```

**Detalle clave:** El `if (!session?.user?.id) redirect("/login")` es **redundante** porque el middleware ya garantiza sesión. Pero es buena práctica: cinturón + tirantes. Y le da satisfacción al type-checker (sin ese check, `session.user.id` sería `string | undefined`).

> #### ✅ Checkpoint 10 — Aislamiento por usuario
>
> 1. Crea un usuario A, loguéate, añade 2 todos.
> 2. Sign out. Crea un usuario B, loguéate. Verifica que la lista está vacía.
> 3. Añade 1 todo como B. Sign out. Loguéate como A. Verifica que sigues viendo los 2 originales (no el de B).
>
> Si los datos no se mezclan, el scoping funciona.

---

## 11. Errores comunes a evitar

### 11.1 Importar `auth.ts` desde el middleware

❌ **Mal:**

```typescript
// middleware.ts
import { auth } from "@/auth"; // ← importa Prisma + bcrypt indirectamente
export default auth;
```

Resultado: build de Next falla con `Module not found` o errores opacos sobre Edge runtime, porque Prisma/bcrypt no son edge-safe.

✅ **Bien:** importa **solo `authConfig`** (el edge-safe).

```typescript
// middleware.ts
import NextAuth from "next-auth";
import { authConfig } from "@/shared/infrastructure/auth/auth.config";
export default NextAuth(authConfig).auth;
```

### 11.2 Atrapar `NEXT_REDIRECT` y no re-lanzarlo

❌ **Mal:**

```typescript
try {
  await signIn("credentials", { ..., redirectTo: "/todos" });
} catch (e) {
  console.error(e); // ← swallowing NEXT_REDIRECT
}
return { ok: true };
```

Resultado: el usuario hace login correctamente pero **se queda en /login** porque el redirect se perdió.

✅ **Bien:** re-lanza cualquier error que no sea `AuthError`.

```typescript
try {
  await signIn("credentials", { ..., redirectTo: "/todos" });
} catch (e) {
  if (e instanceof AuthError) {
    return { ok: false, errors: { form: "Invalid credentials" } };
  }
  throw e; // ← deja salir el NEXT_REDIRECT
}
```

### 11.3 Lanzar en `authorize()` en lugar de devolver `null`

❌ **Mal:**

```typescript
authorize: async (raw) => {
  const parsed = loginFormSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid input"); // ← rompe Auth.js
  const user = await new VerifyCredentials(...).execute(parsed.data);
  if (!user) throw new Error("Wrong credentials"); // ← idem
  return user;
};
```

Resultado: Auth.js no sabe traducir tu Error a algo útil; el cliente recibe un mensaje genérico de "Internal Server Error".

✅ **Bien:** **devuelve `null` en cualquier fallo**. Auth.js lo convierte en `CredentialsSignin` AuthError que tu action atrapa limpiamente.

### 11.4 Filtrar si el email existe en mensajes de error

❌ **Mal:**

```typescript
// en VerifyCredentials
if (!row) throw new Error("User not found");
if (!ok) throw new Error("Wrong password");
```

✅ **Bien:** mensaje **idéntico** en ambos casos. Auth.js solo sabe "sí" o "no", y el mensaje genérico ("Invalid credentials") evita enumeración de emails.

### 11.5 Exponer `hashedPassword` accidentalmente

❌ **Mal:**

```typescript
// en VerifyCredentials
return row; // ← row es UserWithPassword, devolvemos el hash a Auth.js
```

✅ **Bien:** construye explícitamente el `User` sin `hashedPassword` (como hace el código actual). Otra opción aceptable es `const { hashedPassword: _, ...user } = row; return user;` — pero la construcción explícita es más legible y resistente a refactors.

### 11.6 Olvidar reiniciar `pnpm dev` tras tocar el schema

❌ **Síntoma:** `Cannot read properties of undefined (reading 'findUnique')`.

✅ **Bien:** después de **cualquier** `pnpm prisma db push` o `pnpm prisma generate`, mata `pnpm dev` (`Ctrl+C`) y vuelve a lanzarlo. Lo explico en detalle en el Paso 12.

### 11.7 `getTodos()` sin filtrar por `userId`

❌ **Mal:** el repo devuelve todos los todos, la action los filtra después.

✅ **Bien:** el **filtro va en la query SQL**, no en JS. Es 1) más rápido (índice), 2) más seguro (no hay riesgo de que el filtro JS se olvide), 3) más correcto (paginación funciona).

---

## 12. Troubleshooting (lecciones de la sesión real)

Esta sección documenta los problemas reales que aparecieron al implementar este feature, para que el próximo Junior no tropiece con la misma piedra.

### 12.1 `Cannot read properties of undefined (reading 'findUnique')`

**Síntoma:** Cualquier action que use `prisma.user.xxx` (o `prisma.credentials.xxx`) explota con este TypeError después de regenerar el cliente Prisma.

**Causa raíz:** El dev server tiene cacheada una instancia **vieja** del `PrismaClient` (de antes de regenerar). El patrón singleton de [prisma.client.ts](../src/shared/infrastructure/database/prisma/prisma.client.ts) almacena el cliente en `globalThis` para evitar reconectar en cada hot-reload — la contrapartida es que **no se entera de regeneraciones de Prisma**. La clase vieja no tenía `user`/`credentials`, así que `prisma.user` es `undefined`.

**Fix permanente (ya aplicado):** El singleton ahora valida que el cliente cacheado tenga los modelos esperados. Si no, lo recrea.

```typescript
const EXPECTED_MODELS = ["todo", "user", "credentials"] as const;

const isFresh = (client: PrismaClientSingleton | undefined) =>
  !!client &&
  EXPECTED_MODELS.every(
    (m) => (client as unknown as Record<string, unknown>)[m] !== undefined,
  );

export const prisma = isFresh(globalForPrisma.prisma)
  ? (globalForPrisma.prisma as PrismaClientSingleton)
  : createPrismaClient();
```

**Cuando añadas un modelo nuevo al schema, actualiza también `EXPECTED_MODELS`.** Si no, el guard no detecta la regeneración y vuelves a tropezar con el bug.

**Fix manual (siempre funciona):** reinicia `pnpm dev`. El proceso nuevo no tiene cache, crea cliente fresco.

### 12.2 Registro 200 OK pero el usuario no se redirige a `/todos`

**Síntoma:** Submit completa, no hay error visible en el form, pero el usuario se queda en `/register`.

**Diagnóstico:** Instrumenta `registerAction` con logs alrededor de `signIn`:

```typescript
console.log("[registerAction] calling signIn...");
await signIn("credentials", { ..., redirectTo: "/todos" });
console.log("[registerAction] signIn returned without throwing");
```

Si ves "returned without throwing", el `signIn` no está disparando el redirect. Si nunca llegas al primer log, el problema está antes (en `RegisterUser`).

En esta sesión real, este síntoma fue **un falso positivo** (estaba causado por 12.1 — el cliente Prisma stale hizo que `RegisterUser` fallara silenciosamente y la action devolvió `ok: false` con el mensaje genérico, que coincidentalmente no se renderizaba). El fix de 12.1 lo resolvió.

### 12.3 `Module 'next-auth/jwt' cannot be found` al augmentar tipos

**Síntoma:** TS error en `auth.config.ts`:

```
error TS2664: Invalid module name in augmentation,
module 'next-auth/jwt' cannot be found.
```

**Causa:** `next-auth/jwt` re-exporta de `@auth/core/jwt`, pero `@auth/core` no está hoisted en `node_modules` (está en `.pnpm/`). La augmentación de `next-auth/jwt` falla por resolución de módulos.

**Fix:** No augmentes `next-auth/jwt`. Augmenta solo `next-auth`, y en el callback `session` verifica el tipo del `token.id` defensivamente:

```typescript
session: ({ session, token }) => {
  if (typeof token.id === "string") {
    session.user.id = token.id;
  }
  return session;
}
```

### 12.4 `_` en destructuring marcado como unused

**Síntoma:** `'_' is assigned a value but never used` lint warning al hacer `const { hashedPassword: _, ...user } = row;`.

**Fix:** Construye el objeto explícitamente en lugar de destructurar (más verboso pero más legible, y evita el warning). Ver `VerifyCredentials.ts`.

### 12.5 El usuario quedó duplicado tras un intento fallido

**Síntoma:** El primer intento de register se creó en BD pero el redirect falló. El segundo intento devuelve `Email is already taken`.

**Fix:** Borra manualmente con SQL o Prisma Studio: `DELETE FROM "User" WHERE email = '<email>';`. El `ON DELETE CASCADE` también borra las credenciales asociadas.

---

## 13. Recomendaciones de mejora detectadas

> Nota: **no se está pidiendo refactorizar ahora.** Son ideas para sesiones futuras.

1. **Falta verificación de email.** Hoy `User.emailVerified` siempre es `null`. Implementar un flujo: enviar email con token al registrarse, endpoint `/api/auth/verify?token=...` que marca `emailVerified = now()`. Puedes usar [Resend](https://resend.com/) o similar para el envío.

2. **No hay flujo "forgot password".** Mismo patrón: endpoint que envía un email con un token de un solo uso, página `/reset-password?token=...` que permite establecer un password nuevo.

3. **`AUTH_SECRET` es solo una env var.** En producción seria, debería rotarse periódicamente (lo que invalida todas las sesiones). Considera un sistema de versioning o JWKS si la rotación es frecuente.

4. **El cost de bcrypt está hardcodeado (10).** Para producción, hazlo configurable vía env y mide el tiempo en tu hardware real. Objetivo: 250-500ms por hash.

5. **Cuando llegue OAuth (Google/GitHub/etc.):** vas a necesitar la tabla `Account` (compatible con `@auth/prisma-adapter`). En ese momento puedes elegir:
   - Mantener JWT + tabla `Account` solo para guardar los tokens OAuth.
   - Migrar a database sessions (más invasivo, pero permite revocación granular).
   - Decision-tree: si nunca necesitas invalidar sesiones a la fuerza, JWT sigue siendo más simple.

6. **`requireUserId()` lanza `Error("Unauthorized")`.** Eso burbujea como 500. Mejor `redirect("/login")` o devolver un error tipado que la action sepa traducir.

7. **No hay rate limiting en `loginAction` ni `registerAction`.** Un atacante puede probar miles de passwords. En producción, añade rate limiting (e.g., [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)).

8. **El `EXPECTED_MODELS` de [prisma.client.ts](../src/shared/infrastructure/database/prisma/prisma.client.ts) tiene que mantenerse manualmente al día.** Una versión más robusta podría introspectar `_dmmf` o usar un test específico que detecte la divergencia.

9. **Tests automáticos.** Igual que en `todos`, el feature está perfectamente preparado para unit tests con mock repo + mock hasher. Primeros candidatos:
   - `createUserRegistration` con casos felices/inválidos.
   - `RegisterUser.execute` con repo en memoria + hasher mock — verificar happy path, email duplicado, password hasheado correctamente.
   - `VerifyCredentials.execute` con casos: usuario no existe, usuario existe pero password incorrecto, ambos correctos.

10. **`avatar` siempre es null.** Cuando integres OAuth, el `image` que vienen los providers se debería mapear a `avatar` y guardarse en `User.avatar` al registrarse. Hoy es un campo "dormido".

---

## 14. Ruta mental del flujo de datos: "Register + auto-login + redirect"

> Esta sección es el "video en cámara lenta" de lo que pasa al hacer click en "Create account" con datos válidos. Útil cuando algo falla y necesitas saber dónde buscar.

**Escenario:** el usuario está en `http://localhost:3000/register`. Rellena `name = "Ada Lovelace"`, `email = "ada@example.com"`, `password = "12345678"`. Hace click en "Create account".

### Cliente

1. **Evento DOM:** `submit` en el `<form>` de [RegisterForm.tsx](../src/features/users/components/RegisterForm.tsx).
2. **`form.handleSubmit(onSubmit)`** ejecuta `zodResolver(registerFormSchema)`:
   - `.trim()`, `.toLowerCase()` en email, `.min(2)` en name, `.min(8)` en password.
   - Si falla, muestra errores en los `<FormMessage />` sin tocar el servidor.
   - Si pasa, llama a `onSubmit(data)` con valores ya normalizados.
3. **`onSubmit`:**
   - `startTransition(async () => { const result = await registerAction(data); ... })`.
   - `useTransition` activa `isPending`: botón muestra "Creating account...".

### Cruce Cliente → Servidor

4. **Next serializa** `data` y lo envía vía RPC al servidor.

### Servidor — Composition Root

5. **Entra en `registerAction`** ([auth.actions.ts](../src/features/users/actions/auth.actions.ts)):
   - `new RegisterUser(UserPrismaRepository, bcryptHasher)`.
   - `.execute(input)` dentro de try.

### Servidor — Caso de uso (registro)

6. **`RegisterUser.execute(input)`:**
   - Llama a `createUserRegistration(input)` → re-valida con el mismo schema (Zod safeParse).
     - Si falla → `throw new UserValidationError(...)` → atrapado en `registerAction` → devuelve `{ ok: false, errors: { name/email/password: "..." } }`.
   - Llama a `userRepository.findByEmail("ada@example.com")` → `null` (no existe).
     - Si existiera → `throw new EmailAlreadyTakenError("ada@example.com")` → atrapado en `registerAction` → devuelve `{ ok: false, errors: { email: "Email is already taken" } }`.
   - Llama a `passwordHasher.hash("12345678")` → bcrypt cost 10 → `"$2b$10$..."` (≈ 100ms).
   - Llama a `userRepository.createWithCredentials({ user: {...}, hashedPassword })`.

### Servidor — Infraestructura

7. **`UserPrismaRepository.createWithCredentials`:**
   - `prisma.user.create({ data: { ...toPersistence(user), credentials: { create: { hashedPassword } } } })`.
   - Prisma + adapter-pg → SQL: dos INSERT en una transacción.
   - PostgreSQL responde OK.
   - `toDomain(created)` → devuelve `User` al composition root.

### Servidor — Vuelta a Composition Root (auto-login)

8. **`registerAction` sale del primer try sin errores.** Entra en el segundo try.
9. **`signIn("credentials", { email, password, redirectTo: "/todos" })`:**
   - Auth.js invoca internamente al provider `Credentials` (configurado en [auth.ts](../src/shared/infrastructure/auth/auth.ts)).
   - Provider llama a `authorize({ email: "ada@example.com", password: "12345678" })`.

### Servidor — Auth.js authorize

10. **`authorize`:**
    - `loginFormSchema.safeParse(raw)` → success.
    - `new VerifyCredentials(UserPrismaRepository, bcryptHasher).execute(parsed.data)`.

### Servidor — Caso de uso (verificación)

11. **`VerifyCredentials.execute`:**
    - `userRepository.findByEmailWithPassword("ada@example.com")` → fila con credenciales (la que acabamos de crear).
    - `passwordHasher.verify("12345678", "$2b$10$...")` → `true`.
    - Construye y devuelve el `User` sin password.

### Servidor — Auth.js cierra el ciclo

12. **`authorize` recibe el User**, devuelve `{ id, email, name, image }`.
13. **Auth.js ejecuta callbacks:**
    - `jwt({ token, user })` → `token.id = user.id`.
    - `session(...)` — aún no, se ejecuta al leer la sesión.
14. **Auth.js firma el JWT** con `AUTH_SECRET`, lo mete en una cookie HttpOnly Secure.
15. **Auth.js llama `redirect("/todos")`** → throw `NEXT_REDIRECT`.

### Servidor — Propagación del redirect

16. **`registerAction` recibe el throw en su try/catch.**
    - No es `AuthError` (es `NEXT_REDIRECT`) → `throw e` (re-lanza).
17. **El runtime de Server Action de Next** detecta el `NEXT_REDIRECT` y construye una respuesta especial que instruye al cliente a navegar a `/todos`.

### Cliente — Recepción

18. **El navegador recibe la respuesta + la cookie de sesión.**
19. **Next navega a `/todos`.** El RSC carga `app/todos/page.tsx`.
20. **`page.tsx`:**
    - `await auth()` → lee la cookie, valida JWT, ejecuta `session` callback → devuelve `{ user: { id: "...", email: "ada@example.com", name: "Ada Lovelace" } }`.
    - `new GetTodos(TodoPrismaRepository).execute(session.user.id)` → `[]` (Ada no tiene todos aún).
    - Renderiza la UI con "Signed in as ada@example.com" en la cabecera.
21. **El usuario ve:** la página de todos con su email arriba, lista vacía, formulario para añadir.

### Tiempos típicos en local

| Tramo                                       | Duración aprox. |
| ------------------------------------------- | --------------- |
| Cliente → servidor (RPC)                    | 5-15 ms         |
| Validación + bcrypt.hash + INSERT User+Cred | 120-200 ms      |
| signIn + bcrypt.verify + JWT sign           | 100-150 ms      |
| Redirect + carga de /todos                  | 50-100 ms       |
| **Total percibido**                         | **~300-500 ms** |

> bcrypt domina el tiempo. Si quieres bajar el percibido, baja el cost factor (pero eso es un trade-off de seguridad).

---

## Cierre

Si llegaste hasta aquí siguiendo los checkpoints, ya tienes:

- ✅ Un dominio de usuarios puro, con `User` separado de `UserWithPassword`.
- ✅ Casos de uso (`RegisterUser`, `VerifyCredentials`) testeables con cualquier repo + cualquier hasher.
- ✅ Un adapter Prisma que aísla la persistencia.
- ✅ Auth.js configurado correctamente como **infraestructura**, con split config para edge runtime.
- ✅ Server actions que orquestan `signIn`/`signOut` con tus use cases.
- ✅ Formularios con validación cliente + servidor compartiendo schema.
- ✅ Protección de rutas declarativa vía middleware.
- ✅ Aislamiento de datos por usuario (cada todo pertenece a su dueño).

**Cuando añadas el siguiente provider (Google, GitHub, etc.):**

1. Añade un modelo `Account` al schema (compatible con `@auth/prisma-adapter`) para guardar tokens OAuth.
2. Añade el provider en `auth.ts` (`Google({...})`, `Github({...})`).
3. Si quieres database sessions, añade `adapter: PrismaAdapter(prisma)` en `auth.ts` y cambia `session.strategy` a `"database"`.
4. **Tus use cases y tu dominio no cambian.** Es la promesa de tratar Auth.js como infraestructura: cambias los detalles externos sin tocar el núcleo.

**Cualquier feature nuevo que necesite autenticación se construye sobre esta misma base.** El patrón es: `requireUserId()` en la action, `userId` como parámetro en el use case, query SQL filtrada por `userId`. Te lo prometo.
