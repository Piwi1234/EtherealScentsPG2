import { Module } from "@nestjs/common";
import { RedesSocialesController } from "./redes-sociales.controller";
import { RedesSocialesService } from "./redes-sociales.service";

@Module({
  controllers: [RedesSocialesController],
  providers: [RedesSocialesService],
})
export class RedesSocialesModule {}
