/** Convierte duraciones tipo "30m"/"7d" a milisegundos. Soporta s/m/h/d. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Duración inválida: "${value}" (formato esperado: 30m, 7d, etc.)`);
  }
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(match[1]) * unitMs[match[2] as "s" | "m" | "h" | "d"];
}

/** jsonwebtoken tipa `expiresIn` como number (segundos) | string acotado; usamos number para evitar pelear con ese tipo. */
export function parseDurationSeconds(value: string): number {
  return Math.round(parseDurationMs(value) / 1000);
}
