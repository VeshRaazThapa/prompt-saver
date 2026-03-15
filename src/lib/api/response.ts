import { NextResponse } from 'next/server';
import { AppError, formatError } from '../errors';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    field?: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Creates a success response
 * @param data The response data
 * @param meta Optional metadata
 * @returns NextResponse with success data
 */
export function successResponse<T>(
  data: T,
  meta?: { requestId?: string }
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Creates an error response
 * @param error The error object
 * @param requestId Optional request ID
 * @returns NextResponse with error data
 */
export function errorResponse(error: Error, requestId?: string): NextResponse<ApiResponse> {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const isValidationError = error.name === 'ValidationError';

  const response: ApiResponse = {
    success: false,
    error: {
      message: error.message,
      code: error.name,
      ...(isValidationError && 'field' in error
        ? { field: (error as { field?: string }).field }
        : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  // Log non-operational errors
  if (!(error instanceof AppError) || !error.isOperational) {
    console.error('Unexpected error:', formatError(error));
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Creates a paginated response
 * @param data The page data
 * @param pagination Pagination metadata
 * @param meta Optional metadata
 * @returns NextResponse with paginated data
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  },
  meta?: { requestId?: string }
): NextResponse<
  ApiResponse<{
    items: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>
> {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return NextResponse.json({
    success: true,
    data: {
      items: data,
      pagination: {
        ...pagination,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Creates a no content response (204)
 * @returns NextResponse with no content
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
