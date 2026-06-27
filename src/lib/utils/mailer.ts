import nodemailer from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getSettings } from "./settings";

const ALGO = "aes-256-cbc";

function getKey(): Buffer {
  const key = process.env.SMTP_ENCRYPTION_KEY;
  if (!key) throw new Error("SMTP_ENCRYPTION_KEY ist nicht gesetzt.");
  return Buffer.from(key, "hex");
}

export function encryptPassword(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const s = await getSettings();
  if (!s.smtpHost || !s.smtpUser || !s.smtpPassword) {
    throw new Error("SMTP nicht konfiguriert. Bitte Einstellungen unter /settings vervollständigen.");
  }
  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: Number(s.smtpPort ?? 587),
    secure: Number(s.smtpPort) === 465,
    auth: {
      user: s.smtpUser,
      pass: decryptPassword(s.smtpPassword),
    },
  });
  await transporter.sendMail({
    from: `"${s.smtpFromName || "vkEinfach"}" <${s.smtpFrom || s.smtpUser}>`,
    to,
    subject,
    html,
    text,
  });
}
