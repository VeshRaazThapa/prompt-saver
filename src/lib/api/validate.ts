import { NextRequest } from 'next/server';
import { ValidationError } from '../errors';

export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    validator?: (value: unknown) => boolean;
  };
}

/**
 * Validates request body against a schema
 * @param body The request body to validate
 * @param schema The validation schema
 * @throws ValidationError if validation fails
 */
export function validateBody(body: unknown, schema: ValidationSchema): void {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Request body must be an object');
  }

  const bodyObj = body as Record<string, unknown>;

  for (const [field, rules] of Object.entries(schema)) {
    const value = bodyObj[field];

    // Check required fields
    if (rules.required === true && (value === undefined || value === null)) {
      throw new ValidationError(`Field '${field}' is required`, field);
    }

    // Skip validation for optional undefined fields
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      throw new ValidationError(
        `Field '${field}' must be of type ${rules.type}, got ${actualType}`,
        field
      );
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        throw new ValidationError(
          `Field '${field}' must be at least ${rules.minLength} characters`,
          field
        );
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        throw new ValidationError(
          `Field '${field}' must be at most ${rules.maxLength} characters`,
          field
        );
      }
      if (rules.pattern !== undefined && !rules.pattern.test(value)) {
        throw new ValidationError(`Field '${field}' has invalid format`, field);
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        throw new ValidationError(`Field '${field}' must be at least ${rules.min}`, field);
      }
      if (rules.max !== undefined && value > rules.max) {
        throw new ValidationError(`Field '${field}' must be at most ${rules.max}`, field);
      }
    }

    // Custom validator
    if (rules.validator !== undefined && !rules.validator(value)) {
      throw new ValidationError(`Field '${field}' failed custom validation`, field);
    }
  }
}

/**
 * Validates query parameters
 * @param request The Next.js request
 * @param schema The validation schema for query params
 * @returns Validated query parameters
 * @throws ValidationError if validation fails
 */
export function validateQuery(
  request: NextRequest,
  schema: ValidationSchema
): Record<string, string | number | boolean> {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string | number | boolean> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = searchParams.get(field);

    // Check required fields
    if (rules.required === true && value === null) {
      throw new ValidationError(`Query parameter '${field}' is required`, field);
    }

    // Skip validation for optional undefined fields
    if (value === null) {
      continue;
    }

    // Type conversion and validation
    if (rules.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new ValidationError(
          `Query parameter '${field}' must be a number, got '${value}'`,
          field
        );
      }
      if (rules.min !== undefined && numValue < rules.min) {
        throw new ValidationError(
          `Query parameter '${field}' must be at least ${rules.min}`,
          field
        );
      }
      if (rules.max !== undefined && numValue > rules.max) {
        throw new ValidationError(`Query parameter '${field}' must be at most ${rules.max}`, field);
      }
      params[field] = numValue;
    } else if (rules.type === 'boolean') {
      params[field] = value === 'true';
    } else {
      // String validation
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        throw new ValidationError(
          `Query parameter '${field}' must be at least ${rules.minLength} characters`,
          field
        );
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        throw new ValidationError(
          `Query parameter '${field}' must be at most ${rules.maxLength} characters`,
          field
        );
      }
      if (rules.pattern !== undefined && !rules.pattern.test(value)) {
        throw new ValidationError(`Query parameter '${field}' has invalid format`, field);
      }
      params[field] = value;
    }
  }

  return params;
}

/**
 * Parses and validates JSON body from request
 * @param request The Next.js request
 * @param schema The validation schema
 * @returns Validated body
 * @throws ValidationError if parsing or validation fails
 */
export async function parseAndValidateBody<T>(
  request: NextRequest,
  schema: ValidationSchema
): Promise<T> {
  try {
    const body = await request.json();
    validateBody(body, schema);
    return body as T;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}
