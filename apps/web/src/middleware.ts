import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];
// /ingresar y /registro viven fuera de este prefijo a propósito — así no hace falta ninguna
// excepción acá, nunca chocan con la cookie de cliente que se chequea abajo.
const PROTECTED_PREFIXES_CLIENTE = ["/cuenta"];

// URL pública única del sitio — todo lo demás (apex sin www, http, etc.) redirige acá. Antes el
// sitio respondía 200 en varias combinaciones de host/esquema a la vez, sin ninguna marcada como
// "la oficial" — eso es lo que Search Console reporta como contenido "Duplicado: el usuario no ha
// indicado ninguna versión canónica". Solo aplica a los hosts de producción conocidos: localhost
// (dev) y el dominio interno que asigna Railway quedan afuera a propósito.
const CANONICAL_HOST = "www.etherealscents-bo.com";
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const KNOWN_PUBLIC_HOSTS = new Set(["etherealscents-bo.com", CANONICAL_HOST]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0];
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (KNOWN_PUBLIC_HOSTS.has(hostname) && (hostname !== CANONICAL_HOST || proto !== "https")) {
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${search}`, 308);
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !request.cookies.get("app_token")?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const isProtectedCliente = PROTECTED_PREFIXES_CLIENTE.some((p) => pathname.startsWith(p));
  if (isProtectedCliente && !request.cookies.get("customer_token")?.value) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }

  const response = NextResponse.next();
  // Refuerza el canonical también como header HTTP (Google lo respeta igual que el <link> en el
  // <head> — ver https://developers.google.com/search/docs/crawling-indexing/canonicalization),
  // sin tener que agregar `generateMetadata` a cada página pública una por una.
  if (!pathname.startsWith("/dashboard")) {
    response.headers.set("Link", `<${CANONICAL_ORIGIN}${pathname}>; rel="canonical"`);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
