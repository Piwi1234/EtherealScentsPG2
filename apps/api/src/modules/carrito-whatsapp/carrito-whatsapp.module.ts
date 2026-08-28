import { Module } from "@nestjs/common";
import { CarritoWhatsappController } from "./carrito-whatsapp.controller";
import { CarritoWhatsappService } from "./carrito-whatsapp.service";

@Module({
  controllers: [CarritoWhatsappController],
  providers: [CarritoWhatsappService],
})
export class CarritoWhatsappModule {}
