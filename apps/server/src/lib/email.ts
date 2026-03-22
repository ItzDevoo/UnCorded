import { Resend } from "resend";
import { env } from "../env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping email send");
    console.warn(`[email] Would have sent to ${opts.to}: ${opts.subject}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: "UnCorded <noreply@uncorded.app>",
    ...opts,
  });

  if (error) throw error;
}
