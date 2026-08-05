import { PartialType, PickType } from "@nestjs/swagger";
import { CreateAttributeDto } from "./create-attribute.dto";

// El tipo, variantMode y las opciones no se pueden modificar por PATCH: cambiar el tipo o el modo
// de variante invalidaría los valores ya cargados en productos (viven en tablas distintas). Para
// eso hay que crear un atributo nuevo — con una excepción: MULTI_VALUE → PRICED_VARIANT sí tiene
// una migración segura y dedicada (POST /attributes/:id/convertir-a-precio-propio), porque los
// valores ya cargados (ProductVariantOptionValue) son reutilizables tal cual como opción de una
// variante nueva. Las opciones se gestionan con su propio sub-recurso.
// allowMultiple sí es editable: solo relaja/restringe cuántos valores admite el mismo atributo NONE
// (misma tabla, mismo tipo de dato), sin ese riesgo estructural — el servicio valida que solo
// aplique a atributos SELECT sin variante.
export class UpdateAttributeDto extends PartialType(
  PickType(CreateAttributeDto, [
    "name",
    "isFilterable",
    "isRequired",
    "showInProductList",
    "mostrarEnProforma",
    "orden",
    "allowMultiple",
  ] as const),
) {}
