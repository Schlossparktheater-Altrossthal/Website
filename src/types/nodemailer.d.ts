declare module "nodemailer" {
  type AddressLike = string | { name?: string | null | undefined; address: string };

  interface Attachment {
    filename?: string | null | undefined;
    content?: unknown;
    path?: string | null | undefined;
    contentType?: string | null | undefined;
  }

  export interface SendMailOptions {
    from?: AddressLike | AddressLike[] | null | undefined;
    to?: AddressLike | AddressLike[] | null | undefined;
    cc?: AddressLike | AddressLike[] | null | undefined;
    bcc?: AddressLike | AddressLike[] | null | undefined;
    replyTo?: AddressLike | null | undefined;
    subject?: string | null | undefined;
    text?: string | null | undefined;
    html?: string | null | undefined;
    attachments?: Attachment[] | null | undefined;
  }

  export interface Transporter<T = unknown> {
    sendMail(mail: SendMailOptions): Promise<T>;
    verify(options?: unknown): Promise<void>;
    close?(): void;
  }

  export function createTransport(options: unknown): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
