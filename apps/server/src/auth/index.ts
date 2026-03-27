import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createId } from "@uncorded/shared";
import { db } from "../db/index.js";
import { env } from "../env.js";
import { sendEmail } from "../lib/email.js";

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // APP_URL always has a value (see env.ts default), so this array is never empty
  trustedOrigins: [env.APP_URL, env.CORS_ORIGIN, `https://admin.${new URL(env.APP_URL).host}`].filter(Boolean) as string[],
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Verify your UnCorded email",
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#111114;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111114;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1a1a1f;border-radius:12px;border:1px solid #2a2a30;padding:40px;">
        <tr><td style="text-align:center;padding-bottom:24px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#22c55e;">UnCorded</h1>
        </td></tr>
        <tr><td style="color:#e4e4e7;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(user.name ?? "there")},</p>
          <p style="margin:0 0 24px;">Please verify your email address to complete your UnCorded account setup.</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${escapeHtml(url)}" style="display:inline-block;background-color:#22c55e;color:#000;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none;">Verify Email</a>
        </td></tr>
        <tr><td style="color:#a1a1aa;font-size:13px;line-height:1.5;">
          <p style="margin:0 0 8px;">This link expires in 24 hours.</p>
          <p style="margin:0;">If you didn't create an account, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
        });
      } catch (err) {
        console.error("[email] Failed to send verification email:", err);
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your UnCorded password",
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#111114;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111114;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1a1a1f;border-radius:12px;border:1px solid #2a2a30;padding:40px;">
        <tr><td style="text-align:center;padding-bottom:24px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#22c55e;">UnCorded</h1>
        </td></tr>
        <tr><td style="color:#e4e4e7;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(user.name ?? "there")},</p>
          <p style="margin:0 0 24px;">We received a request to reset your password. Click the button below to choose a new one.</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${escapeHtml(url)}" style="display:inline-block;background-color:#22c55e;color:#000;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none;">Reset Password</a>
        </td></tr>
        <tr><td style="color:#a1a1aa;font-size:13px;line-height:1.5;">
          <p style="margin:0 0 8px;">This link expires in 1 hour.</p>
          <p style="margin:0;">If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
        });
      } catch (err) {
        console.error("[email] Failed to send password reset email:", err);
      }
    },
  },
  plugins: [username()],
  socialProviders: {
    ...(env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET && {
        discord: {
          clientId: env.DISCORD_CLIENT_ID,
          clientSecret: env.DISCORD_CLIENT_SECRET,
        },
      }),
    ...(env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }),
  },
  user: {
    additionalFields: {
      displayName: {
        type: "string",
        input: true,
        required: false,
      },
      avatarUrl: {
        type: "string",
        input: false,
        required: false,
      },
      status: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "offline",
      },
      subscriptionTier: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "free",
      },
      banned: {
        type: "boolean",
        input: false,
        required: false,
        defaultValue: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: () => createId(),
    },
    cookiePrefix: "uncorded",
    defaultCookieAttributes: {
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      secure: env.NODE_ENV === "production",
    },
    ...(env.AUTH_COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.AUTH_COOKIE_DOMAIN,
          },
        }
      : {}),
  },
});
