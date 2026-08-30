import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];
// /ingresar y /registro viven fuera de este prefijo a propósito — así no hace falta ninguna
// excepción acá, nunca chocan con la cookie de cliente que se chequea abajo.
const PROTECTED_PREFIXES_CLIENTE = ["/cuenta"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !request.cookies.get("app_token")?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const isProtectedCliente = PROTECTED_PREFIXES_CLIENTE.some((p) => pathname.startsWith(p));
  if (isProtectedCliente && !request.cookies.get("customer_token")?.value) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
