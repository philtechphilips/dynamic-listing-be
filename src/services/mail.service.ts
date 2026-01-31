import nodemailer from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Resend client (used when RESEND_API_KEY is set - works on Render, Vercel, etc.)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Nodemailer transporter (for SMTP - local dev or hosts that allow it)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function getResendFrom(): string {
  // Use verified domain email, or Resend's test address (onboarding@resend.dev)
  const email = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const name =
    process.env.RESEND_FROM_NAME ||
    process.env.SMTP_FROM_NAME ||
    "Dynamic Listing";
  return `"${name}" <${email}>`;
}

function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getFromAddress(): string {
  if (process.env.RESEND_FROM_EMAIL) {
    const name =
      process.env.SMTP_FROM_NAME ||
      process.env.RESEND_FROM_NAME ||
      "Dynamic Listing";
    return `"${name}" <${process.env.RESEND_FROM_EMAIL}>`;
  }
  if (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER) {
    const name = process.env.SMTP_FROM_NAME || "Dynamic Listing";
    const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    return `"${name}" <${email}>`;
  }
  return '"Dynamic Listing" <onboarding@resend.dev>';
}

/**
 * Send an email (awaitable). Uses Resend API when configured (recommended for Render/production),
 * otherwise falls back to SMTP. Throws on failure.
 */
export const sendMail = async (
  to: string,
  subject: string,
  html: string,
  text?: string,
) => {
  // Prefer Resend - works on Render (HTTPS) where SMTP is blocked
  if (resend && isResendConfigured()) {
    try {
      const { data, error } = await resend.emails.send({
        from: getResendFrom(),
        to,
        subject,
        html,
        text: text || undefined,
      });
      if (error) {
        console.error("Resend error:", error);
        throw new Error(error.message);
      }
      console.log("Email sent via Resend:", data?.id);
      return { messageId: data?.id };
    } catch (error) {
      console.error("Error sending email (Resend):", error);
      throw error;
    }
  }

  // Fallback to SMTP (blocked on Render - use Resend for production)
  if (!isSmtpConfigured()) {
    console.warn(
      "Email not configured. Set RESEND_API_KEY + RESEND_FROM_EMAIL (recommended) or SMTP_* vars.",
    );
    return { messageId: "skipped" };
  }

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text: text || "",
      html,
    });
    console.log("Message sent via SMTP:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email (SMTP):", error);
    throw error;
  }
};

/**
 * Send an email in the background. Does not block the HTTP response.
 */
export const sendMailInBackground = (
  to: string,
  subject: string,
  html: string,
  text?: string,
) => {
  sendMail(to, subject, html, text).catch((err) => {
    console.error("[Background email failed]", { to, subject, error: err });
  });
};
