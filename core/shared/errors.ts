export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}

export class APIError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, 'EXTERNAL_API_ERROR', statusCode);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 500, false); // Not operational, requires dev fix
  }
}
