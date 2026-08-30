import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedCliente } from "../strategies/cliente-jwt.strategy";

/** Extrae el cliente (seteado por ClienteJwtStrategy) en vez de usar @Req(). */
export const CurrentCliente = createParamDecorator(
  (data: keyof AuthenticatedCliente | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const cliente = request.user as AuthenticatedCliente;
    return data ? cliente?.[data] : cliente;
  },
);
