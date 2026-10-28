/** Same form-friendly error shape as the integrated application's API client. */
export class ApiError extends Error {
  constructor({ code = 'ERROR', message = 'Demo action failed.', details = [], status = 0 }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
    this.requestId = null;
  }

  fieldError(field) {
    return this.details.find((item) => item.field === field || item.field?.endsWith(`.${field}`))?.issue;
  }
}

export function fail(code, message, status = 409, details = []) {
  throw new ApiError({ code, message, status, details });
}

export function invalid(field, issue) {
  fail('VALIDATION_ERROR', issue, 422, [{ field, issue }]);
}
