import type { ProductAttributeValue, ProductVariantOptionValue } from "../../lib/types";

function formatValue(pv: ProductAttributeValue): string {
  if (pv.option) return pv.option.value;
  if (pv.valueText !== null) return pv.valueText;
  if (pv.valueNumber !== null) return pv.valueNumber;
  if (pv.valueBoolean !== null) return pv.valueBoolean ? "Sí" : "No";
  return "—";
}

type AtributoVisible = { key: string; orden: number; nombre: string; valor: string };

/**
 * Junta las dos fuentes de valores de atributo de un producto: `attributeValues` (atributos NONE,
 * un valor fijo por producto) y `variantOptionValues` (atributos MULTI_VALUE — el producto puede
 * tener 1+ valores del mismo atributo, ej. varios sabores de un vape; se muestran juntos separados
 * por coma dentro del mismo atributo). Solo los marcados mostrarEnProforma=true, ordenados por
 * `orden`.
 *
 * `variantOptionValues` también guarda los valores de atributos PRICED_VARIANT (ej. "50 ML"/"100 ML"
 * de Tamanio) — pero ahí es el catálogo de TODOS los valores posibles del producto, no el de esta
 * variante puntual (eso ya lo trae `variante.options`, que el caller concatena aparte). Se excluyen acá
 * a propósito para no duplicar/mostrar de más las demás variantes.
 */
function visiblesOrdenados(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[],
): AtributoVisible[] {
  const porAtributo = new Map<string, AtributoVisible>();

  for (const pv of attributeValues) {
    if (!pv.attribute.mostrarEnProforma) continue;
    // Un atributo "select" con allowMultiple (ej. Acordes) trae una fila de attributeValues por
    // cada opción elegida — se acumulan todas en vez de quedarse con la última.
    const existing = porAtributo.get(pv.attributeId);
    if (existing) {
      existing.valor = `${existing.valor}, ${formatValue(pv)}`;
    } else {
      porAtributo.set(pv.attributeId, {
        key: pv.attributeId,
        orden: pv.attribute.orden,
        nombre: pv.attribute.name,
        valor: formatValue(pv),
      });
    }
  }

  for (const v of variantOptionValues) {
    if (!v.attribute.mostrarEnProforma || v.attribute.variantMode !== "MULTI_VALUE") continue;
    const existing = porAtributo.get(v.attributeId);
    if (existing) {
      existing.valor = `${existing.valor}, ${v.value}`;
    } else {
      porAtributo.set(v.attributeId, { key: v.attributeId, orden: v.attribute.orden, nombre: v.attribute.name, valor: v.value });
    }
  }

  return Array.from(porAtributo.values()).sort((a, b) => a.orden - b.orden);
}

/** "Attr1: Val1, Attr2: Val2" — para celdas de tabla compactas (ProformaDetalleTable), donde no
 * entra el layout en badges de `AtributosVisibles`. */
export function formatAtributosVisibles(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[] = [],
): string {
  return visiblesOrdenados(attributeValues, variantOptionValues)
    .map((a) => `${a.nombre}: ${a.valor}`)
    .join(", ");
}

/** "Val1, Val2" — sin el nombre del atributo, para las tarjetas de producto del catálogo público
 * (ahí el nombre no aporta, solo ocupa lugar). */
export function formatAtributosVisiblesValores(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[] = [],
): string {
  return visiblesOrdenados(attributeValues, variantOptionValues)
    .map((a) => a.valor)
    .join(", ");
}

/** Solo los atributos marcados mostrarEnProforma=true, ordenados por `orden`. */
export function AtributosVisibles({
  attributeValues,
  variantOptionValues = [],
}: {
  attributeValues: ProductAttributeValue[];
  variantOptionValues?: ProductVariantOptionValue[];
}) {
  const visibles = visiblesOrdenados(attributeValues, variantOptionValues);

  if (visibles.length === 0) return null;

  return (
    <div className="atributos-visibles">
      {visibles.map((a) => (
        <span key={a.key}>
          <strong>{a.nombre}:</strong> {a.valor}
        </span>
      ))}
    </div>
  );
}
