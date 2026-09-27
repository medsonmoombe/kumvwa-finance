import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../../config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport = env.SMTP_HOST
      ? createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: env.SMTP_USER
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
        })
      : null;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.transport) {
      this.logger.log(`EMAIL(dev-console) to=${to} subject="${subject}"`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.env.SMTP_FROM, to, subject, text: body });
    } catch (err) {
      this.logger.error({ err }, `Failed to send email to ${to}`);
    }
  }
}
