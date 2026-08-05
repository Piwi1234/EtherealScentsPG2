import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsuariosModule } from "./modules/usuarios/usuarios.module";
import { ClientesModule } from "./modules/clientes/clientes.module";
import { CatalogModule } from "./catalog/catalog.module";
import { SettingsModule } from "./settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    UsuariosModule,
    ClientesModule,
    CatalogModule,
    SettingsModule,
  ],
})
export class AppModule {}
