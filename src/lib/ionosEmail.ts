import nodemailer from 'nodemailer';

type IonosEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
};

const DEFAULT_HOST = 'smtp.ionos.it';
const DEFAULT_PORT = 465;
const DEFAULT_USER = 'support@movesbook.net';
const DEFAULT_PASSWORD = '1bcc3792fef5f3@2023!Azp';
const DEFAULT_FROM_EMAIL = 'support@movesbook.net';
const DEFAULT_FROM_NAME = 'Movesbook';
const SMTP_TIMEOUT_MS = 30000;

function envValue(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function getSmtpConfig() {
  return {
    host: envValue('IONOS_SMTP_HOST', DEFAULT_HOST),
    port: Number(process.env.IONOS_SMTP_PORT || DEFAULT_PORT),
    user: envValue('IONOS_SMTP_USER', DEFAULT_USER),
    password: envValue('IONOS_SMTP_PASSWORD', DEFAULT_PASSWORD),
    fromEmail: envValue('IONOS_FROM_EMAIL', DEFAULT_FROM_EMAIL),
    fromName: envValue('IONOS_FROM_NAME', DEFAULT_FROM_NAME),
  };
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function extractEmailAddress(value: string): string {
  const match = value.match(/<([^<>@\s]+@[^<>@\s]+)>/);
  return sanitizeHeader(match?.[1] || value);
}

let transporter: nodemailer.Transporter | null = null;
let transporterKey = '';

function getTransporter(): nodemailer.Transporter {
  const config = getSmtpConfig();
  const key = `${config.host}:${config.port}:${config.user}:${config.password}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.password,
      },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      tls: {
        servername: config.host,
      },
    });
    transporterKey = key;
  }
  return transporter;
}

export async function sendIonosEmail(payload: IonosEmailPayload): Promise<void> {
  const config = getSmtpConfig();
  const transport = getTransporter();

  const info = await transport.sendMail({
    from: {
      name: config.fromName,
      address: config.fromEmail,
    },
    to: extractEmailAddress(payload.to),
    subject: sanitizeHeader(payload.subject),
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo ? extractEmailAddress(payload.replyTo) : undefined,
    attachments: payload.attachments?.map((a) => ({
      filename: sanitizeHeader(a.filename),
      content: a.content,
      contentType: a.contentType,
    })),
  });

  if (!info.messageId) {
    throw new Error('IONOS SMTP did not accept the message');
  }
}
