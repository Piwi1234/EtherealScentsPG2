import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

// A propósito no incluye email (cambiarlo sin un flujo de verificación es riesgoso: alguien podría
// tomar el email de otra persona) ni tipoDocumento/numeroDocumento (los administra gestión, ver
// CreateClienteDto). Solo los datos de contacto que el cliente puede editar libremente.
export class UpdateClientePerfilDto {
  @ApiPropertyOptional({ example: "Juan Pérez" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  // Reemplaza al viejo campo de texto libre `ciudad` (ese lo sigue usando gestión) — el perfil de
  // cliente ahora elige de la lista real de ciudades registradas (Configuración > Almacenes >
  // Ciudades), como ya hace Proforma.ciudadEntregaId.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ciudadId?: string;
}
