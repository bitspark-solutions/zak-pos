export interface ApiError {
  message: string;
  error: string;
  statusCode: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

