import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * El deploy corre detrás de Cloudflare + el proxy de Railway. ThrottlerGuard por defecto trackea
 * por `req.ip`, que sin "trust proxy" configurado (ver main.ts) resuelve siempre a la IP del
 * proxy — es decir, la MISMA para cualquier visitante — y el límite de intentos de login/registro
 * termina compartido entre todos los usuarios del sitio en vez de ser por persona: 5 intentos
 * fallidos de CUALQUIERA tumban el login para TODOS durante la ventana.
 *
 * Cloudflare pisa el header `cf-connecting-ip` con la IP real del visitante en cada request (no se
 * puede falsificar vía header porque Cloudflare lo sobreescribe antes de reenviar) — se prioriza
 * sobre `req.ip`, que queda de fallback para tráfico que no pase por Cloudflare (ej. local).
 */
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cfConnectingIp = req.headers?.["cf-connecting-ip"];
    if (typeof cfConnectingIp === "string" && cfConnectingIp) return cfConnectingIp;
    return req.ip;
  }
}
