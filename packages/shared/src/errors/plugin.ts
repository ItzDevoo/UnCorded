import { AppError } from "./base.js";

// ── Category ──────────────────────────────────────────────────────────────

export type PluginErrorCategory =
  | "configuration"
  | "permission"
  | "validation"
  | "network"
  | "resource"
  | "lifecycle"
  | "internal";

// ── Wire format ───────────────────────────────────────────────────────────

/** Serializable error payload that flows across postMessage, HTTP, and IPC. */
export interface PluginErrorPayload {
  code: string;
  message: string;
  category: PluginErrorCategory;
  retryable: boolean;
  pluginId?: string;
  causeCode?: string;
}

// ── Status code mapping ───────────────────────────────────────────────────

const CATEGORY_STATUS: Record<PluginErrorCategory, number> = {
  configuration: 500,
  permission: 403,
  validation: 400,
  network: 502,
  resource: 503,
  lifecycle: 500,
  internal: 500,
};

// ── Error class ───────────────────────────────────────────────────────────

export class PluginError extends AppError {
  readonly category: PluginErrorCategory;
  readonly retryable: boolean;
  readonly pluginId?: string;
  readonly causeCode?: string;

  constructor(
    code: string,
    message: string,
    category: PluginErrorCategory,
    retryable: boolean,
    options?: {
      pluginId?: string | undefined;
      causeCode?: string | undefined;
      cause?: unknown;
    },
  ) {
    super("PluginError", CATEGORY_STATUS[category], code, message, {
      cause: options?.cause,
    });
    this.category = category;
    this.retryable = retryable;
    if (options?.pluginId !== undefined) this.pluginId = options.pluginId;
    if (options?.causeCode !== undefined) this.causeCode = options.causeCode;
  }

  toPayload(): PluginErrorPayload {
    const payload: PluginErrorPayload = {
      code: this.code,
      message: this.message,
      category: this.category,
      retryable: this.retryable,
    };
    if (this.pluginId !== undefined) payload.pluginId = this.pluginId;
    if (this.causeCode !== undefined) payload.causeCode = this.causeCode;
    return payload;
  }

  static fromPayload(p: PluginErrorPayload): PluginError {
    const opts: {
      pluginId?: string | undefined;
      causeCode?: string | undefined;
    } = {};
    if (p.pluginId !== undefined) opts.pluginId = p.pluginId;
    if (p.causeCode !== undefined) opts.causeCode = p.causeCode;
    return new PluginError(p.code, p.message, p.category, p.retryable, opts);
  }

  /** Type guard: check if an error response contains a PluginErrorPayload. */
  static isPayload(value: unknown): value is PluginErrorPayload {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v["code"] === "string" &&
      typeof v["message"] === "string" &&
      typeof v["category"] === "string" &&
      v["category"] in CATEGORY_STATUS &&
      typeof v["retryable"] === "boolean"
    );
  }
}
