"use client";

import { useEffect, useState } from "react";
import { getCampanaActiva } from "./api";

/** Campaña activa ahora mismo en la tienda (ej. Black Friday): su nombre y sus fechas. */
export type CampanaActiva = { nombre: string; inicio: string; fin: string };

const TTL_MS = 30_000;
let cache: { at: number; valor: CampanaActiva | null } | null = null;
let pendiente: Promise<CampanaActiva | null> | null = null;

/** Una sola consulta compartida por todos los componentes que piden la campaña (navbar y home), con un caché corto. */
function cargar(): Promise<CampanaActiva | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.valor);
  if (!pendiente) {
    pendiente = getCampanaActiva()
      .then((r) => (r.activa ? { nombre: r.nombre, inicio: r.inicio, fin: r.fin } : null))
      .catch(() => null)
      .then((valor) => {
        cache = { at: Date.now(), valor };
        pendiente = null;
        return valor;
      });
  }
  return pendiente;
}

/** La campaña activa (o null). Se apaga sola cuando llega su fin, sin recargar la página. */
export function useCampana(): CampanaActiva | null {
  const [campana, setCampana] = useState<CampanaActiva | null>(null);

  useEffect(() => {
    let vivo = true;
    cargar().then((valor) => vivo && setCampana(valor));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!campana) return;
    const falta = new Date(campana.fin).getTime() - Date.now();
    if (falta <= 0) {
      setCampana(null);
      return;
    }
    const t = setTimeout(() => {
      cache = null;
      setCampana(null);
    }, Math.min(falta, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [campana]);

  return campana;
}

/** «16 al 30 de noviembre» (o «30 de noviembre al 2 de diciembre»), en la hora de la tienda. */
export function rangoCampana(inicio: string, fin: string): string {
  const fmt = (d: Date, mes: boolean) => d.toLocaleDateString("es-BO", { timeZone: "America/La_Paz", day: "numeric", ...(mes ? { month: "long" as const } : {}) });
  const i = new Date(inicio);
  const f = new Date(fin);
  const mismoMes = i.toLocaleDateString("es-BO", { timeZone: "America/La_Paz", month: "long", year: "numeric" }) === f.toLocaleDateString("es-BO", { timeZone: "America/La_Paz", month: "long", year: "numeric" });
  return mismoMes ? `${fmt(i, false)} al ${fmt(f, true)}` : `${fmt(i, true)} al ${fmt(f, true)}`;
}
