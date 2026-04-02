import { Elysia } from "elysia";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { NotFoundError, ForbiddenError, ValidationError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { pluginRegistry, pluginSubmissions } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { validateInput } from "../helpers/validation.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";

const PLUGIN_PERMISSIONS = [
  "server.read",
  "members.read",
  "channels.read",
  "messages.read",
  "messages.send",
  "users.read",
  "presence.read",
  "notifications.send",
  "config.read",
  "storage.read",
  "storage.write",
] as const;

const permissionEnum = z.enum(PLUGIN_PERMISSIONS);

const manifestSchema = z.object({
  runtime: z.object({
    image: z
      .string()
      .min(1)
      .max(200)
      .refine(
        (img) =>
          !img.includes("..") &&
          !img.includes("\\") &&
          /^[a-z0-9][a-z0-9._/-]*[a-z0-9]$/i.test(img),
        { message: "Invalid Docker image reference" },
      ),
    port: z.number().int().min(1).max(65535),
    healthCheck: z.string().min(1),
  }),
  permissions: z.array(permissionEnum).min(1),
});

const pluginSubmitSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "ID must be lowercase alphanumeric with hyphens, min 2 chars",
    ),
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(500),
  author: z.string().min(1).max(100),
  category: z.enum(["ai", "productivity", "developer", "media", "social", "utility", "other"]),
  scope: z.enum(["server", "personal", "both"]),
  image: z.string().min(1).max(200),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g. 1.0.0)"),
  manifest: manifestSchema,
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  repository: z.string().url().optional(),
  screenshots: z.array(z.string().url()).max(5).optional(),
});

const versionPushSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g. 1.0.0)"),
  image: z.string().min(1).optional(),
  manifest: manifestSchema.optional(),
});

const pluginUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Must be semver format")
    .optional(),
  image: z.string().min(1).optional(),
  manifest: manifestSchema.optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  repository: z.string().url().nullable().optional(),
  screenshots: z.array(z.string().url()).max(5).optional(),
});

export const developerRoutes = new Elysia({ prefix: "/api/developer" })
  .resolve(authResolve())

  // ── POST /api/developer/plugins — Submit a new plugin ───────────────────
  .post("/plugins", async ({ body, user: sessionUser }) => {
    await checkUserRateLimit(sessionUser.id, RL.DEVELOPER_PLUGIN_SUBMIT, 5, 3_600_000);
    const data = validateInput(pluginSubmitSchema, body);

    try {
      const result = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(pluginRegistry)
          .values({
            id: data.id,
            name: data.name,
            description: data.description,
            author: data.author,
            category: data.category,
            scope: data.scope,
            image: data.image,
            version: data.version,
            manifest: data.manifest,
            tags: data.tags ?? [],
            repository: data.repository ?? null,
            screenshots: data.screenshots ?? [],
            published: false,
            authorUserId: sessionUser.id,
          })
          .onConflictDoNothing()
          .returning({ id: pluginRegistry.id });

        if (!inserted) throw new ValidationError("Plugin with this ID already exists");

        const [submission] = await tx
          .insert(pluginSubmissions)
          .values({
            pluginId: data.id,
            authorUserId: sessionUser.id,
          })
          .returning({ id: pluginSubmissions.id });

        return { pluginId: data.id, submissionId: submission!.id, status: "pending" as const };
      });

      return result;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // Postgres unique constraint violation (23505)
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        throw new ValidationError("Plugin with this ID already exists");
      }
      throw err;
    }
  })

  // ── GET /api/developer/plugins — List user's submitted plugins ──────────
  .get("/plugins", async ({ user: sessionUser }) => {
    const rows = await db
      .select({
        id: pluginRegistry.id,
        name: pluginRegistry.name,
        description: pluginRegistry.description,
        version: pluginRegistry.version,
        category: pluginRegistry.category,
        scope: pluginRegistry.scope,
        image: pluginRegistry.image,
        published: pluginRegistry.published,
        createdAt: pluginRegistry.createdAt,
      })
      .from(pluginRegistry)
      .where(eq(pluginRegistry.authorUserId, sessionUser.id))
      .orderBy(desc(pluginRegistry.createdAt));

    // Get latest submission for each plugin
    const plugins = await Promise.all(
      rows.map(async (plugin) => {
        const [latestSubmission] = await db
          .select({
            id: pluginSubmissions.id,
            status: pluginSubmissions.status,
            submittedAt: pluginSubmissions.submittedAt,
            rejectionReason: pluginSubmissions.rejectionReason,
            reviewedAt: pluginSubmissions.reviewedAt,
          })
          .from(pluginSubmissions)
          .where(eq(pluginSubmissions.pluginId, plugin.id))
          .orderBy(desc(pluginSubmissions.submittedAt))
          .limit(1);

        return Object.assign(plugin, {
          createdAt: plugin.createdAt.toISOString(),
          submission: latestSubmission
            ? {
                id: latestSubmission.id,
                status: latestSubmission.status,
                submittedAt: latestSubmission.submittedAt.toISOString(),
                rejectionReason: latestSubmission.rejectionReason,
                reviewedAt: latestSubmission.reviewedAt?.toISOString() ?? null,
              }
            : null,
        });
      }),
    );

    return { plugins };
  })

  // ── PUT /api/developer/plugins/:pluginId — Update unpublished plugin ────
  .put("/plugins/:pluginId", async ({ params, body, user: sessionUser }) => {
    await checkUserRateLimit(sessionUser.id, RL.DEVELOPER_PLUGIN_UPDATE, 10, 3_600_000);
    const data = validateInput(pluginUpdateSchema, body);

    // Verify ownership
    const [plugin] = await db
      .select({
        id: pluginRegistry.id,
        authorUserId: pluginRegistry.authorUserId,
        published: pluginRegistry.published,
      })
      .from(pluginRegistry)
      .where(eq(pluginRegistry.id, params.pluginId))
      .limit(1);

    if (!plugin) throw new NotFoundError("Plugin");
    if (plugin.authorUserId !== sessionUser.id) throw new ForbiddenError("Not your plugin");
    if (plugin.published) throw new ForbiddenError("Cannot edit a published plugin");

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.version !== undefined) updates.version = data.version;
    if (data.image !== undefined) updates.image = data.image;
    if (data.manifest !== undefined) updates.manifest = data.manifest;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.repository !== undefined) updates.repository = data.repository;
    if (data.screenshots !== undefined) updates.screenshots = data.screenshots;

    if (Object.keys(updates).length > 0) {
      await db.update(pluginRegistry).set(updates).where(eq(pluginRegistry.id, params.pluginId));
    }

    // If previous submission was rejected, create a new pending submission (resubmission)
    const [latestSubmission] = await db
      .select({ status: pluginSubmissions.status })
      .from(pluginSubmissions)
      .where(eq(pluginSubmissions.pluginId, params.pluginId))
      .orderBy(desc(pluginSubmissions.submittedAt))
      .limit(1);

    if (latestSubmission?.status === "rejected") {
      await db.insert(pluginSubmissions).values({
        pluginId: params.pluginId,
        authorUserId: sessionUser.id,
      });
    }

    return { success: true };
  })

  // ── PUT /api/developer/plugins/:pluginId/version — Push a new version ───
  .put("/plugins/:pluginId/version", async ({ params, body, user: sessionUser }) => {
    await checkUserRateLimit(sessionUser.id, RL.DEVELOPER_PLUGIN_VERSION_PUSH, 10, 3_600_000);
    const data = validateInput(versionPushSchema, body);

    // Verify ownership
    const [plugin] = await db
      .select({
        id: pluginRegistry.id,
        authorUserId: pluginRegistry.authorUserId,
        published: pluginRegistry.published,
        version: pluginRegistry.version,
      })
      .from(pluginRegistry)
      .where(eq(pluginRegistry.id, params.pluginId))
      .limit(1);

    if (!plugin) throw new NotFoundError("Plugin");
    if (plugin.authorUserId !== sessionUser.id) throw new ForbiddenError("Not your plugin");
    if (!plugin.published) throw new ForbiddenError("Cannot push versions to unpublished plugins");

    const updates: Record<string, unknown> = {
      version: data.version,
    };
    if (data.image !== undefined) updates.image = data.image;
    if (data.manifest !== undefined) updates.manifest = data.manifest;

    // Atomic conditional update — only succeeds if new version > current version
    // Compares semver parts numerically using SQL to avoid TOCTOU races
    const parts = data.version.split(".").map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;
    const result = await db
      .update(pluginRegistry)
      .set(updates)
      .where(
        and(
          eq(pluginRegistry.id, params.pluginId),
          sql`(
          split_part(${pluginRegistry.version}, '.', 1)::int < ${major}
          OR (split_part(${pluginRegistry.version}, '.', 1)::int = ${major}
              AND split_part(${pluginRegistry.version}, '.', 2)::int < ${minor})
          OR (split_part(${pluginRegistry.version}, '.', 1)::int = ${major}
              AND split_part(${pluginRegistry.version}, '.', 2)::int = ${minor}
              AND split_part(${pluginRegistry.version}, '.', 3)::int < ${patch})
        )`,
        ),
      )
      .returning({ id: pluginRegistry.id });

    if (result.length === 0) {
      throw new ValidationError(`Version ${data.version} must be greater than the current version`);
    }

    // If image or manifest changed, require re-review
    if (data.image !== undefined || data.manifest !== undefined) {
      await db
        .update(pluginRegistry)
        .set({ published: false })
        .where(eq(pluginRegistry.id, params.pluginId));
      await db.insert(pluginSubmissions).values({
        pluginId: params.pluginId,
        authorUserId: sessionUser.id,
      });
    }

    return { success: true, version: data.version };
  })

  // ── GET /api/developer/plugins/:pluginId/status — Check submission status
  .get("/plugins/:pluginId/status", async ({ params, user: sessionUser }) => {
    // Verify ownership
    const [plugin] = await db
      .select({ authorUserId: pluginRegistry.authorUserId })
      .from(pluginRegistry)
      .where(eq(pluginRegistry.id, params.pluginId))
      .limit(1);

    if (!plugin) throw new NotFoundError("Plugin");
    if (plugin.authorUserId !== sessionUser.id) throw new ForbiddenError("Not your plugin");

    const [submission] = await db
      .select({
        id: pluginSubmissions.id,
        status: pluginSubmissions.status,
        submittedAt: pluginSubmissions.submittedAt,
        reviewedBy: pluginSubmissions.reviewedBy,
        reviewedAt: pluginSubmissions.reviewedAt,
        rejectionReason: pluginSubmissions.rejectionReason,
      })
      .from(pluginSubmissions)
      .where(eq(pluginSubmissions.pluginId, params.pluginId))
      .orderBy(desc(pluginSubmissions.submittedAt))
      .limit(1);

    if (!submission) throw new NotFoundError("Submission");

    return {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt.toISOString(),
      reviewedBy: submission.reviewedBy,
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
      rejectionReason: submission.rejectionReason,
    };
  });
