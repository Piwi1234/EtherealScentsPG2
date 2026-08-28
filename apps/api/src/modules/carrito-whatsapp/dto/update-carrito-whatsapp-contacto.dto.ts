import { PartialType } from "@nestjs/swagger";
import { CreateCarritoWhatsappContactoDto } from "./create-carrito-whatsapp-contacto.dto";

export class UpdateCarritoWhatsappContactoDto extends PartialType(CreateCarritoWhatsappContactoDto) {}
