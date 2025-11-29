export class ApiError extends Error {
  public readonly _isApiError = true;
  constructor(public key: string, public params?: Record<string, any>) {
    super(`API Error: ${key}`);
    this.name = 'ApiError';
  }
}
