import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorPayload {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      message: this.resolveMessage(exception),
      error: this.resolveError(exception),
      timestamp: new Date().toISOString(),
      path: request.url,
    } satisfies ErrorPayload);
  }

  private resolveMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return exceptionResponse;
      }

      if (isRecord(exceptionResponse) && isStringOrStringArray(exceptionResponse.message)) {
        return exceptionResponse.message;
      }
    }

    return 'Internal server error';
  }

  private resolveError(exception: unknown): string {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (isRecord(exceptionResponse) && typeof exceptionResponse.error === 'string') {
        return exceptionResponse.error;
      }

      return exception.name;
    }

    return 'InternalServerError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringOrStringArray(value: unknown): value is string | string[] {
  return typeof value === 'string' || (Array.isArray(value) && value.every(isString));
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
