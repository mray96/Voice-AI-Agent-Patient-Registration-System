export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export function success<T>(data: T) {
  return { data, error: null };
}

export function failure(error: ApiErrorBody) {
  return { data: null, error };
}
