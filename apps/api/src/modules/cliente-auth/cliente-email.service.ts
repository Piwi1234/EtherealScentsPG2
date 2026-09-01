import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

/** Envío de emails transaccionales del auth de clientes (hoy: reset de contraseña). Sin
 * RESEND_API_KEY configurada (dev local sin cuenta armada todavía) loguea el link a consola en vez
 * de tirar error — así el flujo se puede probar sin depender de una cuenta de Resend real. */
@Injectable()
export class ClienteEmailService {
  private readonly logger = new Logger(ClienteEmailService.name);
  private readonly resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  private readonly from = process.env.RESEND_FROM_EMAIL ?? "Ethereal Scents <no-reply@etherealscents-bo.com>";

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY no configurada — link de reset para ${to}: ${resetUrl}`);
      return;
    }

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: "Restablecé tu contraseña — Ethereal Scents",
      html: `
        <p>Recibimos un pedido para restablecer la contraseña de tu cuenta.</p>
        <p><a href="${resetUrl}">Hacé click acá para elegir una contraseña nueva</a>.</p>
        <p>Este link expira en 1 hora. Si vos no pediste esto, podés ignorar este email.</p>
      `,
    });
  }
}
