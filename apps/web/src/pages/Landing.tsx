import { A } from "@solidjs/router";
import { For } from "solid-js";
import { buttonVariants } from "../components/ui/button.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card.js";
import { cn } from "../lib/cn.js";

const features = [
  {
    title: "P2P File Sharing",
    description:
      "Files transfer directly between you and your friends via WebTorrent. No middleman, no cloud storage, no surprises.",
  },
  {
    title: "No Server Storage",
    description:
      "We never store your files. Not temporarily, not in a cache, not ever. Your data stays on your devices.",
  },
  {
    title: "Radical Transparency",
    description:
      "Every charge shows exactly where the money goes — our costs, our margin, and why. No hidden fees.",
  },
];

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Chat and share files in DMs",
    features: ["Unlimited messaging", "DM file sharing (P2P)", "Join any server", "Basic presence"],
    cta: "Get Started",
    highlighted: false,
    tier: null,
  },
  {
    name: "Supporter",
    price: "$5",
    period: "/mo",
    description: "Share files everywhere",
    features: [
      "Everything in Free",
      "Server file sharing",
      "TURN relay (NAT bypass)",
      "Desktop app access",
    ],
    cta: "Get Started",
    highlighted: true,
    tier: "supporter" as const,
  },
  {
    name: "Server Owner",
    price: "$10",
    period: "/mo",
    description: "Run your own community",
    features: [
      "Everything in Supporter",
      "Create & manage servers",
      "Traffic dashboard",
      "Priority support",
    ],
    cta: "Get Started",
    highlighted: false,
    tier: "server_owner" as const,
  },
];

const Landing = () => {
  return (
    <div class="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div class="flex items-center gap-2">
            <img src="/icon-192.png" alt="UnCorded" class="h-12 w-12 rounded-lg" />
            <span class="text-lg font-bold tracking-tight">UnCorded</span>
          </div>
          <div class="flex items-center gap-2">
            <A href="/login" class={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Sign In
            </A>
            <A href="/register" class={cn(buttonVariants({ size: "sm" }))}>
              Get Started
            </A>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section class="mx-auto max-w-3xl px-4 py-24 text-center sm:py-32">
        <div class="mb-6 flex items-center justify-center gap-3">
          <img src="/icon-192.png" alt="UnCorded" class="h-16 w-16 rounded-xl" />
          <span class="text-3xl font-bold tracking-tight">UnCorded</span>
        </div>
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
          You know exactly where your files go.
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Real-time chat with peer-to-peer file sharing. Your files transfer directly between
          devices — they never touch our servers.
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <A href="/register" class={cn(buttonVariants({ size: "lg" }))}>
            Create Account
          </A>
          <A href="/login" class={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Sign In
          </A>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section class="mx-auto max-w-5xl px-4 pb-24">
        <div class="grid gap-4 sm:grid-cols-3">
          <For each={features}>
            {(feature) => (
              <Card>
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            )}
          </For>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section class="border-t border-border bg-secondary/30 px-4 py-24">
        <div class="mx-auto max-w-5xl">
          <h2 class="mb-2 text-center text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
          <p class="mb-12 text-center text-muted-foreground">
            No hidden fees. Every charge is transparent.
          </p>
          <div class="grid gap-4 sm:grid-cols-3">
            <For each={tiers}>
              {(tier) => (
                <Card class={tier.highlighted ? "border-primary ring-1 ring-primary" : undefined}>
                  <CardHeader>
                    <CardTitle>{tier.name}</CardTitle>
                    <div class="flex items-baseline gap-1">
                      <span class="text-3xl font-bold">{tier.price}</span>
                      <span class="text-sm text-muted-foreground">{tier.period}</span>
                    </div>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul class="space-y-2 text-sm">
                      <For each={tier.features}>
                        {(f) => (
                          <li class="flex items-start gap-2">
                            <span class="mt-0.5 text-primary">&#10003;</span>
                            <span>{f}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                    <A
                      href={tier.tier ? `/register?tier=${tier.tier}` : "/register"}
                      class={cn(
                        buttonVariants({
                          variant: tier.highlighted ? "default" : "outline",
                        }),
                        "mt-6 w-full",
                      )}
                    >
                      {tier.cta}
                    </A>
                  </CardContent>
                </Card>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <section class="mx-auto max-w-3xl px-4 py-24 text-center">
        <h2 class="text-2xl font-bold tracking-tight">Ready to take control of your files?</h2>
        <p class="mt-2 text-muted-foreground">
          Join UnCorded and start chatting with true privacy.
        </p>
        <A href="/register" class={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Get Started
        </A>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer class="border-t border-border px-4 py-6">
        <div class="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} UnCorded</span>
          <A href="/privacy" class="hover:text-primary hover:underline">
            Privacy Policy
          </A>
          <A href="/terms" class="hover:text-primary hover:underline">
            Terms of Service
          </A>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
