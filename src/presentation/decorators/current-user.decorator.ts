import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: number;
  userName: string;
  sessionId: string;
}

/** El objeto que SessionAuthGuard deja en req.user tras validar el token. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
