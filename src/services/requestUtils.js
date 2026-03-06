export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export const withTimeout = (promise, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, message = 'Request timed out') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeoutError(message)), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export const isTimeoutError = (error) =>
  error?.name === 'RequestTimeoutError' || error?.message?.toLowerCase?.().includes('timed out');
