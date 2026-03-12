/* oxlint-disable eslint(no-shadow) -- vi.hoisted destructuring pattern */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (available to vi.mock factories) ─────────────────────────────

const { mockDisconnectUser, mockStripe, selectResults, capturedSets, capturedInserts, mockDb } =
  vi.hoisted(() => {
    const mockDisconnectUser = vi.fn();

    const mockStripe = {
      webhooks: { constructEventAsync: vi.fn() },
      subscriptions: { retrieve: vi.fn() },
    };

    const selectResults: unknown[][] = [];
    const capturedSets: unknown[] = [];
    const capturedInserts: unknown[] = [];

    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
          }),
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((data: unknown) => {
          capturedSets.push(data);
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((data: unknown) => {
          capturedInserts.push(data);
          return Promise.resolve();
        }),
      })),
    };

    return { mockDisconnectUser, mockStripe, selectResults, capturedSets, capturedInserts, mockDb };
  });

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("../../ws/connections.js", () => ({ disconnectUser: mockDisconnectUser }));
vi.mock("../../env.js", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_SUPPORTER_PRICE_ID: "price_supporter",
    STRIPE_SERVER_OWNER_PRICE_ID: "price_server_owner",
  },
}));
vi.mock("../../lib/stripe.js", () => ({ getStripe: () => mockStripe }));
vi.mock("../../db/schema.js", () => ({
  subscriptions: {
    id: "subscriptions.id",
    userId: "subscriptions.userId",
    stripeSubscriptionId: "subscriptions.stripeSubscriptionId",
  },
  user: { id: "user.id" },
}));
vi.mock("../../db/index.js", () => ({ db: mockDb }));

// ── Import the Elysia instance (after mocks) ──────────────────────────────────

import { webhookRoutes } from "../webhook.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sendWebhook(): Promise<Response> {
  return webhookRoutes.handle(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "test_sig",
      },
      body: "{}",
    }),
  );
}

function makeCheckoutEvent(subId: string, cusId: string) {
  return {
    type: "checkout.session.completed",
    data: { object: { subscription: subId, customer: cusId } },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    capturedSets.length = 0;
    capturedInserts.length = 0;
  });

  // ── Signature verification ────────────────────────────────────────────────

  describe("signature verification", () => {
    it("returns 400 for missing stripe-signature header", async () => {
      const res = await webhookRoutes.handle(
        new Request("http://localhost/api/webhooks/stripe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid signature", async () => {
      mockStripe.webhooks.constructEventAsync.mockRejectedValueOnce(new Error("bad sig"));
      const res = await sendWebhook();
      expect(res.status).toBe(400);
    });
  });

  // ── checkout.session.completed ────────────────────────────────────────────

  describe("checkout.session.completed", () => {
    it("creates new subscription with supporter tier", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce(
        makeCheckoutEvent("sub_1", "cus_1"),
      );
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: { userId: "user_1" },
        items: {
          data: [{ price: { id: "price_supporter" }, current_period_end: 1700000000 }],
        },
      });
      selectResults.push([]); // no existing subscription

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: true });

      expect(capturedInserts).toHaveLength(1);
      expect(capturedInserts[0]).toMatchObject({
        userId: "user_1",
        tier: "supporter",
        status: "active",
      });
      expect(capturedSets).toContainEqual({ subscriptionTier: "supporter" });
      expect(mockDisconnectUser).toHaveBeenCalledWith("user_1");
    });

    it("updates existing subscription with server_owner tier", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce(
        makeCheckoutEvent("sub_1", "cus_1"),
      );
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: { userId: "user_1" },
        items: {
          data: [{ price: { id: "price_server_owner" }, current_period_end: 1700000000 }],
        },
      });
      selectResults.push([{ id: "existing_sub" }]); // existing subscription

      const res = await sendWebhook();
      expect(res.status).toBe(200);

      expect(capturedInserts).toHaveLength(0);
      expect(capturedSets).toContainEqual(
        expect.objectContaining({ tier: "server_owner", status: "active" }),
      );
      expect(capturedSets).toContainEqual({ subscriptionTier: "server_owner" });
      expect(mockDisconnectUser).toHaveBeenCalledWith("user_1");
    });

    it("returns early when userId is missing from metadata", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce(
        makeCheckoutEvent("sub_1", "cus_1"),
      );
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: {},
        items: {
          data: [{ price: { id: "price_supporter" }, current_period_end: 1700000000 }],
        },
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(capturedInserts).toHaveLength(0);
      expect(mockDisconnectUser).not.toHaveBeenCalled();
    });

    it("returns early for unknown price ID (tierFromPriceId returns null)", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce(
        makeCheckoutEvent("sub_1", "cus_1"),
      );
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: { userId: "user_1" },
        items: {
          data: [{ price: { id: "price_unknown" }, current_period_end: 1700000000 }],
        },
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(capturedInserts).toHaveLength(0);
      expect(mockDisconnectUser).not.toHaveBeenCalled();
    });

    it("returns early when subscription/customer IDs are missing", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "checkout.session.completed",
        data: { object: { subscription: null, customer: null } },
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(capturedInserts).toHaveLength(0);
    });
  });

  // ── customer.subscription.updated ─────────────────────────────────────────

  describe("customer.subscription.updated", () => {
    it("updates tier when price changes", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_1",
            status: "active",
            items: {
              data: [{ price: { id: "price_server_owner" }, current_period_end: 1700000000 }],
            },
          },
        },
      });
      selectResults.push([{ id: "sub_rec_1", userId: "user_1" }]);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toContainEqual(expect.objectContaining({ tier: "server_owner" }));
      expect(capturedSets).toContainEqual({ subscriptionTier: "server_owner" });
      expect(mockDisconnectUser).toHaveBeenCalledWith("user_1");
    });

    it("reverts to free when subscription is not active", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_1",
            status: "past_due",
            items: {
              data: [{ price: { id: "price_supporter" }, current_period_end: 1700000000 }],
            },
          },
        },
      });
      selectResults.push([{ id: "sub_rec_1", userId: "user_1" }]);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toContainEqual({ subscriptionTier: "free" });
    });

    it("returns early when no matching subscription exists", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_unknown",
            status: "active",
            items: {
              data: [{ price: { id: "price_supporter" }, current_period_end: 1700000000 }],
            },
          },
        },
      });
      selectResults.push([]); // no match

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(mockDisconnectUser).not.toHaveBeenCalled();
    });
  });

  // ── customer.subscription.deleted ─────────────────────────────────────────

  describe("customer.subscription.deleted", () => {
    it("reverts user to free tier", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_1", status: "canceled", items: { data: [] } },
        },
      });
      selectResults.push([{ id: "sub_rec_1", userId: "user_1" }]);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toContainEqual({ status: "cancelled" });
      expect(capturedSets).toContainEqual({ subscriptionTier: "free" });
      expect(mockDisconnectUser).toHaveBeenCalledWith("user_1");
    });

    it("returns early when no matching subscription exists", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_unknown", status: "canceled", items: { data: [] } },
        },
      });
      selectResults.push([]);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(mockDisconnectUser).not.toHaveBeenCalled();
    });
  });

  // ── invoice.payment_failed ────────────────────────────────────────────────

  describe("invoice.payment_failed", () => {
    it("sets subscription to past_due and reverts user to free", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "inv_1",
            parent: { subscription_details: { subscription: "sub_1" } },
          },
        },
      });
      selectResults.push([{ id: "sub_rec_1", userId: "user_1" }]);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toContainEqual({ status: "past_due" });
      expect(capturedSets).toContainEqual({ subscriptionTier: "free" });
      expect(mockDisconnectUser).toHaveBeenCalledWith("user_1");
    });

    it("returns early when subscription ID is missing from invoice", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "invoice.payment_failed",
        data: { object: { id: "inv_1", parent: null } },
      });

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(mockDisconnectUser).not.toHaveBeenCalled();
    });

    it("returns early when no matching subscription record", async () => {
      mockStripe.webhooks.constructEventAsync.mockResolvedValueOnce({
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "inv_1",
            parent: { subscription_details: { subscription: "sub_unknown" } },
          },
        },
      });
      selectResults.push([]);

      const res = await sendWebhook();
      expect(res.status).toBe(200);
      expect(capturedSets).toHaveLength(0);
      expect(mockDisconnectUser).not.toHaveBeenCalled();
    });
  });
});
