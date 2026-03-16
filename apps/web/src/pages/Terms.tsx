import { A } from "@solidjs/router";
import { buttonVariants } from "../components/ui/button.js";
import { cn } from "../lib/cn.js";

const Terms = () => {
  return (
    <div class="min-h-screen bg-background text-foreground">
      <nav class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div class="mx-auto flex h-14 max-w-3xl items-center px-4">
          <A href="/" class={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            &larr; Back to Home
          </A>
        </div>
      </nav>

      <main class="mx-auto max-w-3xl px-4 py-16">
        <h1 class="mb-2 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p class="mb-12 text-sm text-muted-foreground">Last Updated: March 16, 2026</p>

        <div class="space-y-10 text-sm leading-relaxed text-foreground/90">
          {/* 1. Agreement */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Agreement</h2>
            <p>
              By creating an account or using UnCorded, you agree to these Terms. If you do not
              agree, do not use the service.
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Eligibility</h2>
            <p>
              You must be at least 13 years old to use UnCorded. By registering, you confirm that
              you are 13 or older.
            </p>
          </section>

          {/* 3. Your Account */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Your Account</h2>
            <p>
              You are responsible for maintaining the security of your account credentials. Each
              person may only have one account. You agree to provide accurate information when
              registering.
            </p>
          </section>

          {/* 4. Subscriptions & Payments */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Subscriptions &amp; Payments</h2>
            <p class="mb-3">UnCorded offers the following tiers:</p>
            <ul class="mb-3 list-disc space-y-2 pl-5">
              <li>
                <strong class="text-foreground">Free:</strong> unlimited messaging, DM file sharing,
                join servers.
              </li>
              <li>
                <strong class="text-foreground">Supporter ($5/month):</strong> server file sharing,
                TURN relay, desktop app access.
              </li>
              <li>
                <strong class="text-foreground">Server Owner ($10+/month):</strong> create and
                manage servers.
              </li>
            </ul>
            <p class="mb-3">
              Paid subscriptions auto-renew monthly. You will be charged the subscription amount
              each month until you cancel.
            </p>
            <p class="mb-3">
              You can cancel anytime through the Stripe Customer Portal accessible from your account
              settings. Cancellation takes effect at the end of the current billing period.
            </p>
            <p>We do not offer refunds for partial months.</p>
          </section>

          {/* 5. Acceptable Use Policy */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Acceptable Use Policy</h2>
            <p class="mb-3">You agree NOT to:</p>
            <ul class="list-disc space-y-2 pl-5">
              <li>
                Share, distribute, or possess child sexual abuse material (CSAM). We scan files for
                known CSAM material and report violations to the National Center for Missing &amp;
                Exploited Children (NCMEC) as required by federal law.
              </li>
              <li>Share non-consensual intimate images of any person.</li>
              <li>Harass, threaten, bully, or intimidate other users.</li>
              <li>Share malware, viruses, or malicious files.</li>
              <li>Distribute copyrighted material without authorization.</li>
              <li>Spam or send unsolicited bulk messages.</li>
              <li>Share other users' personal information without consent (doxxing).</li>
              <li>Impersonate other users or entities.</li>
              <li>Attempt to circumvent security measures or access controls.</li>
              <li>Use the service for any activity illegal under applicable law.</li>
            </ul>
          </section>

          {/* 6. Peer-to-Peer File Sharing */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Peer-to-Peer File Sharing</h2>
            <ul class="list-disc space-y-2 pl-5">
              <li>
                Files are transferred directly between users via WebTorrent. UnCorded does not host,
                store, inspect, or control file content.
              </li>
              <li>
                You are solely responsible for ensuring you have the legal right to share any file.
              </li>
              <li>
                UnCorded is not responsible for the content, legality, or safety of files
                transferred between users.
              </li>
              <li>Your IP address is visible to other users during file transfers.</li>
              <li>
                You accept all risks associated with receiving files from other users, including but
                not limited to malware and copyright infringement.
              </li>
            </ul>
          </section>

          {/* 7. Content & Conduct */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Content &amp; Conduct</h2>
            <p class="mb-3">
              You retain ownership of content you post. By using UnCorded, you grant us a limited
              license to store, display, and transmit your messages as necessary to operate the
              service.
            </p>
            <p class="mb-3">We may remove content or suspend accounts that violate these Terms.</p>
            <p>We provide a report system for users to flag content that violates these Terms.</p>
          </section>

          {/* 8. Copyright & DMCA */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Copyright &amp; DMCA</h2>
            <p class="mb-3">
              If you believe content on UnCorded infringes your copyright, submit a DMCA takedown
              notice to{" "}
              <a href="mailto:contact@uncorded.app" class="text-primary hover:underline">
                [contact@uncorded.app]
              </a>
              .
            </p>
            <p class="mb-3">
              We will respond to valid DMCA notices and may remove or disable access to the
              allegedly infringing content.
            </p>
            <p class="mb-3">Repeat copyright infringers will have their accounts terminated.</p>
            <p>
              Counter-notifications: If you believe your content was wrongly removed, you may submit
              a counter-notification.
            </p>
          </section>

          {/* 9. Account Termination */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Account Termination</h2>
            <p class="mb-3">
              We may suspend or terminate your account for violations of these Terms, illegal
              activity, or at our discretion with notice.
            </p>
            <p class="mb-3">
              You may delete your account at any time through Settings &gt; Account &gt; Delete
              Account.
            </p>
            <p>
              Upon termination, your right to use the service ceases. Some provisions survive
              termination (liability limitations, dispute resolution).
            </p>
          </section>

          {/* 10. Disclaimers */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Disclaimers</h2>
            <p class="mb-3">
              UnCorded is provided "AS IS" and "AS AVAILABLE" without warranties of any kind.
            </p>
            <p class="mb-3">We do not guarantee uninterrupted or error-free service.</p>
            <p>We are not responsible for user-generated content or peer-to-peer file transfers.</p>
          </section>

          {/* 11. Limitation of Liability */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Limitation of Liability</h2>
            <p class="mb-3">
              To the maximum extent permitted by law, UnCorded's total liability is limited to the
              amount you paid us in the 12 months prior to the claim.
            </p>
            <p>We are not liable for indirect, incidental, special, or consequential damages.</p>
          </section>

          {/* 12. Dispute Resolution */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Dispute Resolution</h2>
            <p class="mb-3">These Terms are governed by the laws of [State], United States.</p>
            <p class="mb-3">
              Any disputes will be resolved through binding arbitration, except for claims that
              qualify for small claims court.
            </p>
            <p class="mb-3">You waive the right to participate in class action lawsuits.</p>
            <p>
              You may opt out of arbitration by notifying us within 30 days of account creation.
            </p>
          </section>

          {/* 13. Changes */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Changes to These Terms</h2>
            <p>
              We may update these Terms. Continued use after changes constitutes acceptance.
              Material changes will be notified via email or in-app notice.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:contact@uncorded.app" class="text-primary hover:underline">
                [contact@uncorded.app]
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
