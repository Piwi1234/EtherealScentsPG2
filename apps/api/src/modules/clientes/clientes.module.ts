import { Module } from "@nestjs/common";
import { ClientesController } from "./clientes.controller";
import { ClientesService } from "./clientes.service";
import { ClientesImportService } from "./clientes-import.service";

@Module({
  controllers: [ClientesController],
  providers: [ClientesService, ClientesImportService],
})
export class ClientesModule {}
