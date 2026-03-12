import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../env.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function isR2Configured(): boolean {
  return !!(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME &&
    env.R2_PUBLIC_URL
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export async function uploadAvatar(
  userId: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const ext = MIME_TO_EXT[contentType] ?? "png";
  const key = `avatars/${userId}/${Date.now()}.${ext}`;

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME!,
        Key: key,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (err) {
    console.error("[r2] uploadAvatar failed:", err);
    throw new Error("Failed to upload avatar", { cause: err });
  }

  return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteAvatar(avatarUrl: string): Promise<void> {
  if (!env.R2_PUBLIC_URL) return;

  const prefix = `${env.R2_PUBLIC_URL}/`;
  if (!avatarUrl.startsWith(prefix)) return;

  const key = avatarUrl.slice(prefix.length);

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
    }),
  );
}
