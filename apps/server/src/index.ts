import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { ZodError } from "zod";
import { AppError } from "@uncorded/shared";
import { env } from "./env.js";
import { betterAuthPlugin } from "./middleware/auth.js";
import { userRoutes } from "./routes/user.js";
import { serverRoutes } from "./routes/server.js";
import { channelRoutes } from "./routes/channel.js";
import { memberRoutes } from "./routes/member.js";
import { inviteRoutes } from "./routes/invite.js";
import { messageRoutes } from "./routes/message.js";
import { friendRoutes } from "./routes/friend.js";
import { dmRoutes } from "./routes/dm.js";
import { webhookRoutes } from "./routes/webhook.js";
import { stripeRoutes } from "./routes/stripe.js";
import { turnRoutes } from "./routes/turn.js";
import { gatewayTicketRoutes } from "./routes/gateway.js";
import { gateway } from "./ws/gateway.js";

const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN ?? env.APP_URL,
      credentials: true,
    }),
  )
  .use(betterAuthPlugin)
  .use(webhookRoutes)
  .use(
    rateLimit({
      max: env.RATE_LIMIT_MAX,
      duration: env.RATE_LIMIT_WINDOW_MS,
    }),
  )
  .onBeforeHandle({ as: "global" }, ({ request, set }) => {
    const method = request.method;
    if (method !== "POST" && method !== "PATCH" && method !== "DELETE" && method !== "PUT") return;

    const path = new URL(request.url).pathname;
    if (
      path.startsWith("/api/auth/") ||
      path.startsWith("/api/webhooks/") ||
      path === "/api/users/@me/avatar"
    )
      return;

    const contentType = request.headers.get("content-type");
    if (!contentType) return;

    if (!contentType.startsWith("application/json")) {
      set.status = 415;
      return { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" };
    }
  })
  .use(stripeRoutes)
  .use(turnRoutes)
  .use(userRoutes)
  .use(serverRoutes)
  .use(channelRoutes)
  .use(memberRoutes)
  .use(inviteRoutes)
  .use(messageRoutes)
  .use(friendRoutes)
  .use(dmRoutes)
  .use(gatewayTicketRoutes)
  .use(gateway)
  .get("/health", () => ({ status: "ok" }))
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { code: error.code, message: error.message };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Route not found" };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return { code: "VALIDATION_ERROR", message: error.message };
    }

    if (error instanceof ZodError) {
      set.status = 400;
      return { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid input" };
    }

    console.error("Unhandled error:", error);
    set.status = 500;
    return { code: "INTERNAL_ERROR", message: "Internal server error" };
  })
  .listen(env.PORT);

if (import.meta.env.DEV) {
  console.log(`UnCorded server running on ${env.APP_URL} (port ${app.server?.port})`);
}

export type App = typeof app;
