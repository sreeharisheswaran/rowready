export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof URIError && error.status === 400) {
    return res.status(400).json({
      error: { code: 'INVALID_URL', message: 'The request URL contains invalid encoding.' },
    });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request exceeds the allowed size. Use a smaller CSV.',
      },
    });
  }
  if (error.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'The request must contain valid JSON.' } });
  }
  if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
    return res.status(415).json({
      error: {
        code: 'UNSUPPORTED_ENCODING',
        message: 'Send uncompressed UTF-8 CSV or JSON. This request encoding is not supported.',
      },
    });
  }
  if (error instanceof AppError || (error && error.status && error.code)) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  // Never log sensitive credentials or connection URIs. Safe error summary:
  console.error(
    'Request failed:',
    req.method,
    req.originalUrl || req.url,
    error.name === 'MongoServerError' ? 'database error' : error.message || 'internal error',
  );
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
}
