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
 */
function visiblesOrdenados(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[],
): AtributoVisible[] {
  const porAtributo = new Map<string, AtributoVisible>();

  for (const pv of attributeValues) {
    if (!pv.attribute.mostrarEnProforma) continue;
    porAtributo.set(pv.attributeId, {
      key: pv.attributeId,
      orden: pv.attribute.orden,
      nombre: pv.attribute.name,
      valor: formatValue(pv),
    });
  }

  for (const v of variantOptionValues) {
    if (!v.attribute.mostrarEnProforma) continue;
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
