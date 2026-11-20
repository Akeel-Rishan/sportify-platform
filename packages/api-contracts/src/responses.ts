import type { ApiErrorResponse } from './errors.js';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;
