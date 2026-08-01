interface ApiCallError {
  statusCode?: number;
  responseBody?: string;
  message?: string;
  lastError?: ApiCallError;
}

// Turn an AI-SDK/provider error into a message worth showing a learner.
export function providerErrorMessage(err: unknown): string {
  const e = (err ?? {}) as ApiCallError;
  const status = e.statusCode ?? e.lastError?.statusCode;
  const body = `${e.responseBody ?? ''} ${e.lastError?.responseBody ?? ''} ${e.message ?? ''}`;

  if (status === 529 || /overloaded/i.test(body)) {
    return 'The model is overloaded right now. Wait a few seconds and try again.';
  }
  if (status === 429 || /rate.?limit/i.test(body)) {
    return 'The model rate limit was hit. Try again in a moment.';
  }
  if (status === 401 || status === 403) {
    return 'The model API key was rejected — check ANTHROPIC_API_KEY on the backend.';
  }
  return e.message ? `Model error: ${e.message}` : 'Something went wrong talking to the model.';
}
