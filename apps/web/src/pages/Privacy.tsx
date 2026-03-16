import { A } from "@solidjs/router";
import { buttonVariants } from "../components/ui/button.js";
import { cn } from "../lib/cn.js";

const Privacy = () => {
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
        <h1 class="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p class="mb-12 text-sm text-muted-foreground">Last Updated: March 16, 2026</p>

        <div class="space-y-10 text-sm leading-relaxed text-foreground/90">
          {/* 1. Who We Are */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Who We Are</h2>
            <p>
              UnCorded is operated by [Contact Name] ([contact@uncorded.app]). UnCorded is a
              real-time chat application with peer-to-peer file sharing.
            </p>
          </section>

          {/* 2. What Data We Collect */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">What Data We Collect</h2>
            <ul class="list-disc space-y-3 pl-5">
              <li>
                <strong class="text-foreground">Account data:</strong> email address, username,
                display name, avatar image.
              </li>
              <li>
                <strong class="text-foreground">Chat messages:</strong> stored on our servers to
                deliver chat functionality.
              </li>
              <li>
                <strong class="text-foreground">Authentication data:</strong> session cookies, OAuth
                profile data from Discord (user ID, username, email, avatar) and Google (email,
                name, profile picture).
              </li>
              <li>
                <strong class="text-foreground">Payment data:</strong> processed by Stripe — we
                never see or store your credit card number. We receive your email and subscription
                status from Stripe.
              </li>
              <li>
                <strong class="text-foreground">Technical data:</strong> IP addresses (for rate
                limiting and security). Redis stores rate limit counters (short-lived).
              </li>
              <li>
                <strong class="text-foreground">File sharing metadata:</strong> file name, size,
                content type, magnet URI — but NOT the file content itself.
              </li>
            </ul>
          </section>

          {/* 3. How We Use Your Data */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">How We Use Your Data</h2>
            <p>
              We use your data to deliver the chat service, process payments, enforce our rules,
              prevent abuse, and perform rate limiting. We do not sell your data to third parties.
            </p>
          </section>

          {/* 4. Peer-to-Peer File Sharing & IP Addresses */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">
              Peer-to-Peer File Sharing &amp; IP Addresses
            </h2>
            <p class="mb-3">
              When you share or receive files, transfers happen directly between you and the other
              user via WebRTC. Your public IP address is shared with the other user during this
              process.
            </p>
            <p class="mb-3">
              Files never pass through our servers. We cannot see, access, or control file content
              transferred between users.
            </p>
            <p>
              If you use TURN relay (paid feature), the relay server routes encrypted data but does
              not inspect content.
            </p>
          </section>

          {/* 5. Third-Party Services */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Third-Party Services</h2>
            <p class="mb-3">We use the following third-party services:</p>
            <ul class="list-disc space-y-2 pl-5">
              <li>
                <strong class="text-foreground">Cloudflare</strong> (CDN, DNS, file storage for
                avatars) —{" "}
                <a
                  href="https://www.cloudflare.com/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong class="text-foreground">Neon</strong> (database hosting) —{" "}
                <a
                  href="https://neon.tech/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong class="text-foreground">Stripe</strong> (payment processing) —{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong class="text-foreground">Discord</strong> (OAuth login) —{" "}
                <a
                  href="https://discord.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong class="text-foreground">Google</strong> (OAuth login) —{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong class="text-foreground">Upstash</strong> (Redis hosting) —{" "}
                <a
                  href="https://upstash.com/trust/privacy.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          {/* 6. Data Retention */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Data Retention</h2>
            <p>
              Account data is retained until you delete your account. Chat messages are retained
              until you or a server owner deletes them. Rate limiting data expires automatically
              within minutes. Session data expires after 7 days of inactivity.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Your Rights</h2>
            <p class="mb-3">
              You have the right to access, correct, and delete your personal data.
            </p>
            <p>
              To delete your account and all associated data, go to Settings &gt; Account &gt;
              Delete Account. To request a copy of your data or ask questions, email{" "}
              <a href="mailto:contact@uncorded.app" class="text-primary hover:underline">
                [contact@uncorded.app]
              </a>
              .
            </p>
          </section>

          {/* 8. International Users */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">International Users</h2>
            <p>
              UnCorded is operated from the United States. If you are accessing the service from
              outside the US, your data will be transferred to and processed in the United States.
            </p>
          </section>

          {/* 9. Children */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Children</h2>
            <p>
              UnCorded is not intended for users under the age of 13. We do not knowingly collect
              personal information from children under 13. If we discover that a user is under 13,
              we will delete their account and data.
            </p>
          </section>

          {/* 10. Cookies */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Cookies</h2>
            <p>
              We use a single session cookie for authentication. We do not use tracking cookies,
              analytics cookies, or advertising cookies.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Changes to This Policy</h2>
            <p>
              We may update this policy. We will notify registered users of material changes via
              email or in-app notice.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-foreground">Contact</h2>
            <p>
              For privacy questions, contact us at{" "}
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

export default Privacy;
