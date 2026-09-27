import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../../config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.SMTP_HOST) {
      this.logger.log(`EmailService: transport configured host=${env.SMTP_HOST} port=${env.SMTP_PORT} user=${env.SMTP_USER || '(none)'}`);
      this.transport = createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
      });
    } else {
      this.logger.warn('EmailService: SMTP_HOST is not set — emails will only be logged to console');
      this.transport = null;
    }
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.transport) {
      this.logger.log(`EMAIL(dev-console) to=${to} subject="${subject}"`);
      return;
    }
    this.logger.log(`EmailService: sending to=${to} subject="${subject}"`);
    try {
      const info = await this.transport.sendMail({ from: this.env.SMTP_FROM, to, subject, text: body });
      this.logger.log(`EmailService: sent to=${to} messageId=${info.messageId}`);
    } catch (err) {
      this.logger.error(`EmailService: FAILED to send to=${to} subject="${subject}" error=${(err as Error).message}`);
      this.logger.error(err);
    }
  }
}
