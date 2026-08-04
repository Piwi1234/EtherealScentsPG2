import { PartialType, PickType } from "@nestjs/swagger";
import { CreateAttributeDto } from "./create-attribute.dto";

// El tipo y las opciones no se pueden modificar por PATCH: cambiar el tipo
// invalidaría los valores ya cargados en productos. Para eso hay que crear
// un atributo nuevo. Las opciones se gestionan con su propio sub-recurso.
export class UpdateAttributeDto extends PartialType(
  PickType(CreateAttributeDto, ["name", "isFilterable", "isRequired", "showInProductList"] as const),
) {}
