import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsuariosModule } from "./modules/usuarios/usuarios.module";
import { ClientesModule } from "./modules/clientes/clientes.module";
import { EmpresasModule } from "./modules/empresas/empresas.module";
import { AlmacenesModule } from "./modules/almacenes/almacenes.module";
import { ProveedoresModule } from "./modules/proveedores/proveedores.module";
import { ProformasModule } from "./modules/proformas/proformas.module";
import { ContabilidadModule } from "./modules/contabilidad/contabilidad.module";
import { CatalogModule } from "./catalog/catalog.module";
import { SettingsModule } from "./settings/settings.module";
import { CarritoWhatsappModule } from "./modules/carrito-whatsapp/carrito-whatsapp.module";
import { RedesSocialesModule } from "./modules/redes-sociales/redes-sociales.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    UsuariosModule,
    ClientesModule,
    EmpresasModule,
    AlmacenesModule,
    ProveedoresModule,
    ProformasModule,
    ContabilidadModule,
    CatalogModule,
    SettingsModule,
    CarritoWhatsappModule,
    RedesSocialesModule,
    DashboardModule,
  ],
})
export class AppModule {}
