import { Elysia } from "elysia";
import { eq, or, desc, and, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/index.js";
import { fileReceipts, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { ValidationError } from "@uncorded/shared";

const RECEIPT_PAGE_SIZE = 20;

export const fileReceiptRoutes = new Elysia({ prefix: "/api/file-receipts" })
  .resolve(authResolve())
  .get("/", async ({ user: sessionUser, query }) => {
    const type = query.type ?? "all";
    if (type !== "all" && type !== "sent" && type !== "received") {
      throw new ValidationError("type must be 'all', 'sent', or 'received'");
    }
    const cursor = query.cursor ?? undefined;

    const senderAlias = alias(user, "sender");
    const receiverAlias = alias(user, "receiver");

    const conditions = [];
    if (type === "sent") {
      conditions.push(eq(fileReceipts.senderId, sessionUser.id));
    } else if (type === "received") {
      conditions.push(eq(fileReceipts.receiverId, sessionUser.id));
    } else {
      conditions.push(
        or(
          eq(fileReceipts.senderId, sessionUser.id),
          eq(fileReceipts.receiverId, sessionUser.id),
        )!,
      );
    }

    // Only include DM receipts (those with receiverId set)
    conditions.push(eq(fileReceipts.receiverId, fileReceipts.receiverId));

    if (cursor) {
      conditions.push(lt(fileReceipts.createdAt, new Date(cursor)));
    }

    const rows = await db
      .select({
        id: fileReceipts.id,
        fileName: fileReceipts.fileName,
        fileSize: fileReceipts.fileSize,
        contentType: fileReceipts.contentType,
        senderId: fileReceipts.senderId,
        senderUsername: senderAlias.username,
        receiverId: fileReceipts.receiverId,
        receiverUsername: receiverAlias.username,
        createdAt: fileReceipts.createdAt,
      })
      .from(fileReceipts)
      .leftJoin(senderAlias, eq(fileReceipts.senderId, senderAlias.id))
      .leftJoin(receiverAlias, eq(fileReceipts.receiverId, receiverAlias.id))
      .where(and(...conditions))
      .orderBy(desc(fileReceipts.createdAt))
      .limit(RECEIPT_PAGE_SIZE + 1);

    const hasMore = rows.length > RECEIPT_PAGE_SIZE;
    const receipts = rows.slice(0, RECEIPT_PAGE_SIZE).map((r) => ({
      id: r.id,
      fileName: r.fileName,
      fileSize: r.fileSize,
      contentType: r.contentType,
      senderId: r.senderId,
      senderUsername: r.senderUsername,
      receiverId: r.receiverId,
      receiverUsername: r.receiverUsername,
      createdAt: r.createdAt?.toISOString() ?? null,
    }));

    return { receipts, hasMore };
  });
