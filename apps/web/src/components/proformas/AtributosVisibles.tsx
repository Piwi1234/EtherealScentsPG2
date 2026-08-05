import type { ProductAttributeValue } from "../../lib/types";

function formatValue(pv: ProductAttributeValue): string {
  if (pv.option) return pv.option.value;
  if (pv.valueText !== null) return pv.valueText;
  if (pv.valueNumber !== null) return pv.valueNumber;
  if (pv.valueBoolean !== null) return pv.valueBoolean ? "Sí" : "No";
  return "—";
}

function visiblesOrdenados(attributeValues: ProductAttributeValue[]): ProductAttributeValue[] {
  return [...attributeValues]
    .filter((pv) => pv.attribute.mostrarEnProforma)
    .sort((a, b) => a.attribute.orden - b.attribute.orden);
}

/** "Attr1: Val1, Attr2: Val2" — para celdas de tabla compactas (ProformaDetalleTable), donde no
 * entra el layout en badges de `AtributosVisibles`. */
export function formatAtributosVisibles(attributeValues: ProductAttributeValue[]): string {
  return visiblesOrdenados(attributeValues)
    .map((pv) => `${pv.attribute.name}: ${formatValue(pv)}`)
    .join(", ");
}

/** Solo los atributos marcados mostrarEnProforma=true, ordenados por `orden`. Se usa tanto en
 * VarianteSelector (al elegir un producto) como en la vista de detalle de una proforma. */
export function AtributosVisibles({ attributeValues }: { attributeValues: ProductAttributeValue[] }) {
  const visibles = visiblesOrdenados(attributeValues);

  if (visibles.length === 0) return null;

  return (
    <div className="atributos-visibles">
      {visibles.map((pv) => (
        <span key={pv.id}>
          <strong>{pv.attribute.name}:</strong> {formatValue(pv)}
        </span>
      ))}
    </div>
  );
}
