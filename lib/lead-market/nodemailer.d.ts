declare module "nodemailer" {
  type Transport = { verify(): Promise<true>; sendMail(message: Record<string, unknown>): Promise<{ messageId: string; accepted: string[]; rejected: string[] }>; close(): void };
  const mailer: { createTransport(options: Record<string, unknown>): Transport };
  export default mailer;
}
