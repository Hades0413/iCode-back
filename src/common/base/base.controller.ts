import { Logger } from '@nestjs/common';

/**
 * Extendé esto en los controllers nuevos en vez de instanciar tu propio
 * `new Logger(NombreController.name)` cada vez — mismo patrón en todos
 * lados, un solo lugar para cambiarlo si el día de mañana el logger de
 * cada clase necesita algo más (contexto extra, etc.).
 */
export abstract class BaseController {
  protected readonly logger = new Logger(this.constructor.name);
}
