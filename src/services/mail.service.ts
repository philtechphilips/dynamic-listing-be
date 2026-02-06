/**
 * =============================================================================
 * EMAIL SERVICE
 * =============================================================================
 *
 * This module provides email sending functionality with support for two providers:
 *
 * 1. **Resend API** (Recommended for production/cloud environments)
 *    - Works on Render, Vercel, and other cloud platforms that block SMTP
 *    - Set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables
 *
 * 2. **SMTP/Nodemailer** (Fallback for local development)
 *    - Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables
 *
 * @module services/mail.service
 */

import nodemailer from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

/**
 * Resend API client instance.
 * Only initialized if RESEND_API_KEY is set.
 * Resend is recommended for production as many cloud hosts block SMTP.
 */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/**
 * Nodemailer SMTP transporter.
 * Used as fallback when Resend is not configured.
 * Note: SMTP may be blocked on cloud platforms like Render.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000, // 15 seconds
  greetingTimeout: 10000, // 10 seconds
  socketTimeout: 20000, // 20 seconds
});

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Checks if Resend API is properly configured.
 * @returns {boolean} True if RESEND_API_KEY is set
 */
function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Builds the "From" address for Resend emails.
 * Uses verified domain email or Resend's test address for development.
 * @returns {string} Formatted "From" address (e.g., "Name <email@domain.com>")
 */
function getResendFrom(): string {
  // Use verified domain email, or Resend's test address (onboarding@resend.dev)
  const email = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const name =
    process.env.RESEND_FROM_NAME ||
    process.env.SMTP_FROM_NAME ||
    "Dynamic Listing";
  return `"${name}" <${email}>`;
}

/**
 * Checks if SMTP is properly configured.
 * @returns {boolean} True if all required SMTP variables are set
 */
function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

/**
 * Builds the "From" address for SMTP/Nodemailer emails.
 * @returns {string} Formatted "From" address
 */
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

// ============================================================================
// EMAIL SENDING FUNCTIONS
// ============================================================================

/**
 * Send an email (awaitable).
 *
 * Uses Resend API when configured (recommended for production),
 * otherwise falls back to SMTP.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML email body content
 * @param {string} [text] - Optional plain text version
 * @returns {Promise<{messageId: string}>} The sent message ID
 * @throws {Error} If email sending fails
 *
 * @example
 * await sendMail(
 *   'user@example.com',
 *   'Welcome to Dynamic Listing',
 *   '<h1>Welcome!</h1><p>Thanks for joining.</p>'
 * );
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
 * Send an email in the background (fire-and-forget).
 *
 * Does not block the HTTP response. Use this for non-critical emails
 * where you don't need to wait for confirmation.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML email body content
 * @param {string} [text] - Optional plain text version
 *
 * @example
 * // Send welcome email without waiting
 * sendMailInBackground(user.email, 'Welcome!', welcomeHtml);
 * res.json({ message: 'User created' }); // Responds immediately
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
