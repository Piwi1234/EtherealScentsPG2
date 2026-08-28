import type { ProductAttributeValue, ProductVariantOption, ProductVariantOptionValue } from "../../lib/types";

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
 * por coma dentro del mismo atributo).
 *
 * `variantOptionValues` también guarda los valores de atributos PRICED_VARIANT (ej. "100 ML"/"200 ML"
 * de Tamaño) — ahí es el catálogo de TODOS los valores posibles del producto, uno por cada variante
 * creada, no el de una variante puntual. Para proforma (`flag="mostrarEnProforma"`) se excluyen a
 * propósito: la línea ya es de UNA variante elegida (su valor se muestra aparte, ver
 * `formatCartAtributos`), así que listar "todos los tamaños" sería confuso. Para la tarjeta pública
 * (`flag="mostrarEnTarjeta"`) es al revés: la tarjeta representa el producto entero, así que se
 * quiere ver TODOS los tamaños disponibles (ej. "100 ML, 200 ML"), igual que un MULTI_VALUE.
 */
function visiblesOrdenadosPor(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[],
  flag: "mostrarEnProforma" | "mostrarEnTarjeta",
  ordenField: "orden" | "ordenTarjeta",
): AtributoVisible[] {
  const porAtributo = new Map<string, AtributoVisible>();

  for (const pv of attributeValues) {
    if (!pv.attribute[flag]) continue;
    // Un atributo "select" con allowMultiple (ej. Acordes) trae una fila de attributeValues por
    // cada opción elegida — se acumulan todas en vez de quedarse con la última.
    const existing = porAtributo.get(pv.attributeId);
    if (existing) {
      existing.valor = `${existing.valor}, ${formatValue(pv)}`;
    } else {
      porAtributo.set(pv.attributeId, {
        key: pv.attributeId,
        orden: pv.attribute[ordenField],
        nombre: pv.attribute.name,
        valor: formatValue(pv),
      });
    }
  }

  for (const v of variantOptionValues) {
    if (!v.attribute[flag]) continue;
    if (flag === "mostrarEnProforma" && v.attribute.variantMode !== "MULTI_VALUE") continue;
    const existing = porAtributo.get(v.attributeId);
    if (existing) {
      existing.valor = `${existing.valor}, ${v.value}`;
    } else {
      porAtributo.set(v.attributeId, { key: v.attributeId, orden: v.attribute[ordenField], nombre: v.attribute.name, valor: v.value });
    }
  }

  return Array.from(porAtributo.values()).sort((a, b) => a.orden - b.orden);
}

function visiblesOrdenados(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[],
): AtributoVisible[] {
  return visiblesOrdenadosPor(attributeValues, variantOptionValues, "mostrarEnProforma", "orden");
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

/** "Val1, Val2" — sin el nombre del atributo, para el resumen de atributos que reusa el criterio de
 * proforma (ej. el carrito público, ver `formatCartAtributos`). Para la tarjeta de producto en sí
 * usar `formatAtributosTarjeta`, que tiene su propio flag independiente. */
export function formatAtributosVisiblesValores(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[] = [],
): string {
  return visiblesOrdenados(attributeValues, variantOptionValues)
    .map((a) => a.valor)
    .join(", ");
}

/** "Val1, Val2" — sin el nombre del atributo, para las tarjetas de producto del catálogo público
 * (ahí el nombre no aporta, solo ocupa lugar). Solo los atributos marcados `mostrarEnTarjeta=true`,
 * ordenados por `ordenTarjeta` — independiente de lo que se muestra en proforma. Para un atributo
 * con precio propio (ej. Tamaño) muestra TODOS los valores disponibles del producto (ej.
 * "100 ML, 200 ML"), no solo el de la variante puntual que la tarjeta esté mostrando — ver el
 * doc-comment de `visiblesOrdenadosPor`. */
export function formatAtributosTarjeta(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[] = [],
): string {
  return visiblesOrdenadosPor(attributeValues, variantOptionValues, "mostrarEnTarjeta", "ordenTarjeta")
    .map((a) => a.valor)
    .join(", ");
}

/** "Val1, Val2" para el resumen del carrito público: el/los valor(es) de la variante con precio
 * propio elegida (ej. "50 ML", que `formatAtributosVisiblesValores` excluye a propósito, ver su doc)
 * + los valores heredados del producto — mismo criterio sin nombre de atributo, solo que acá sí
 * importa mostrar cuál variante se agregó. */
export function formatCartAtributos(
  attributeValues: ProductAttributeValue[],
  variantOptionValues: ProductVariantOptionValue[] = [],
  variantOptions: ProductVariantOption[] = [],
): string {
  const propios = variantOptions.map((o) => o.optionValue.value);
  const heredados = visiblesOrdenados(attributeValues, variantOptionValues).map((a) => a.valor);
  return [...propios, ...heredados].join(", ");
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
