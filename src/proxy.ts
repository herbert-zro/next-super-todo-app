import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/shared/infrastructure/auth/auth.config";
import NextAuth from "next-auth";

const { auth } = NextAuth(authConfig);

// `auth` también funciona como handler de proxy al invocarse con (req, event)
// (rama `instanceof Request` de next-auth), pero sus overloads de tipo no
// exponen esa firma. La tipamos explícitamente para el call site.
const authMiddleware = auth as unknown as (
  req: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;

// --- Configuración del rate limit (ventana fija) ---
const MAX_ATTEMPTS = 5; // intentos permitidos por ventana
const WINDOW_MS = 60_000; // duración de la ventana: 60s

// Store en memoria por IP. Clave = IP, valor = { count, resetAt }.
// NOTA: estado a nivel de módulo — persiste en `next dev` (proceso único) pero
// NO es fiable en producción Edge (múltiples isolates). Ver plan/README.
const attempts = new Map<string, { count: number; resetAt: number }>();

// Solo limitamos el flujo de login y solo POST (las recargas GET no penalizan).
function isLoginFlowRequest(req: NextRequest): boolean {
  if (req.method !== "POST") return false;
  const { pathname } = req.nextUrl;
  return pathname === "/login" || pathname.startsWith("/api/auth");
}

// Next 16 no expone req.ip -> leemos de headers de proxy.
function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for puede ser una lista "ip-cliente, proxy1, proxy2".
    return forwardedFor.split(",")[0]!.trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1"; // fallback en local (no hay proxy que setee los headers)
}

// Ventana fija con reinicio perezoso. Devuelve true cuando hay que bloquear.
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  // Sin entrada o la ventana anterior ya expiró -> abrir ventana nueva.
  if (!entry || now >= entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  // Dentro de la ventana: a partir del 6.º intento se bloquea.
  if (entry.count >= MAX_ATTEMPTS) {
    return true; // 6.º intento (y siguientes) dentro de la misma ventana
  }

  entry.count += 1;
  return false;
}

function tooManyRequestsResponse(): NextResponse {
  return NextResponse.json(
    { message: "Too Many Requests" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isLoginFlowRequest(req) && isRateLimited(getClientIp(req))) {
    return tooManyRequestsResponse();
  }

  // Delegar al middleware de NextAuth sin cambios (preserva la protección de
  // /todos y el redirect del usuario logueado fuera de /login y /register).
  return authMiddleware(req, event);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/api/auth/:path*",
  ],
};
