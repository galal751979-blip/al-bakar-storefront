const version = '1.0.0';

const pageRequestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const sensitiveField = /(password|token|secret|api.?key|authorization|cookie|phone|mobile|email|address|customer|card|cvv|body|payload)/i;

function redactText(value) {
  return String(value)
    .replace(/[\r\n\u0000-\u001f\u007f]/g, ' ')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g, '[REDACTED_PHONE]')
    .slice(0, 3000);
}

function safeError(error) {
  if (!error) return { type: 'Error', message: 'Unknown error' };
  return {
    type: redactText(error.name || 'Error'),
    message: redactText(error.message || error),
    ...(error.stack ? { stack: redactText(error.stack) } : {})
  };
}

export function logClientError(event, error, fields = {}) {
  write('ERROR', event, { ...fields, error: safeError(error) }, error?.requestId);
}

export function logClientWarning(event, fields = {}) {
  write('WARNING', event, fields);
}

function write(level, event, fields, requestId) {
  const safeFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    sensitiveField.test(key)
      ? '[REDACTED]'
      : key === 'request_id'
        ? (typeof value === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(value) ? value : '[INVALID_REQUEST_ID]')
        : typeof value === 'string' ? redactText(value) : value
  ]));
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'bakar-storefront-web',
    environment: import.meta.env?.MODE || 'production',
    version,
    event: redactText(event),
    message: redactText(event),
    request_id: requestId || pageRequestId,
    ...safeFields
  };
  console[level === 'ERROR' ? 'error' : 'warn'](JSON.stringify(record));
}
