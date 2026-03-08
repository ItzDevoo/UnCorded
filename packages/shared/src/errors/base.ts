export class AppError extends Error {
  readonly _tag: string;
  readonly statusCode: number;
  readonly code: string;

  constructor(
    tag: string,
    statusCode: number,
    code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this._tag = tag;
    this.statusCode = statusCode;
    this.code = code;
  }
}
