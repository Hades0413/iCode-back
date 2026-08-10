import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Único formato de error para toda la API. Sin esto, un ValidationPipe
 * devuelve un shape, un throw genérico devuelve otro (con stack trace
 * filtrándose al cliente en desarrollo), y un HttpException de negocio
 * devuelve un tercero — cada consumidor de la API tendría que adivinar
 * cuál le tocó. Los errores no controlados (500) nunca exponen el mensaje
 * real ni el stack al cliente, solo quedan logueados server-side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? extractMessage(exception)
      : 'Internal server error';

    const body: ErrorBody = {
      statusCode,
      error: isHttpException
        ? exception.constructor.name.replace(/Exception$/, '')
        : 'InternalServerError',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500 /* HttpStatus.INTERNAL_SERVER_ERROR */) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(body);
  }
}

function extractMessage(exception: HttpException): string | string[] {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  const maybeMessage = (response as { message?: string | string[] }).message;
  return maybeMessage ?? exception.message;
}
