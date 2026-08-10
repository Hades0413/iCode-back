import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Sin esto, SessionAuthGuard (global, ver app.module.ts) exige sesión en
 * TODA ruta — "seguro por defecto", en vez de tener que acordarse de
 * proteger cada endpoint nuevo uno por uno.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
