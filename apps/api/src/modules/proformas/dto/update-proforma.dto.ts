import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateProformaDto } from "./create-proforma.dto";

/** El tipo (COMPRA/VENTA) no se puede cambiar después de creada — sería otro documento. */
export class UpdateProformaDto extends PartialType(OmitType(CreateProformaDto, ["tipo"] as const)) {}
