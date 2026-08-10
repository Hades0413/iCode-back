import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from './base.controller';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { paginate } from '../utils/paginate.util';

/**
 * PLANTILLA — a propósito no está en los `controllers` de ningún módulo,
 * así que no expone ninguna ruta real. Es para copiar y pegar como punto
 * de partida de un controller nuevo:
 *
 * 1. Copiá este archivo a src/presentation/controllers/, renombralo y
 *    cambiá la clase y el @Controller('...').
 * 2. Registralo en los `controllers` del módulo que corresponda.
 * 3. Reemplazá el arreglo hardcodeado de acá abajo por una llamada real a
 *    tu service (`this.miService.findAndCount(query)`).
 *
 * Lo que demuestra: extender BaseController (logger gratis), documentar
 * con Swagger, y paginar con PaginationQueryDto + paginate() en vez de
 * reinventar la lógica de página/límite/total en cada controller.
 */
@ApiTags('example')
@Controller('example')
export class ExampleController extends BaseController {
  @Get()
  @ApiOperation({ summary: '[Plantilla] Listado paginado de ejemplo' })
  @ApiOkResponse({
    description: 'Página de resultados + metadata de paginación',
  })
  findAll(@Query() query: PaginationQueryDto) {
    this.logger.debug(
      `Listando página ${query.page} (${query.limit} por página)`,
    );

    // Acá va tu service real, ej:
    //   const [items, total] = await this.miService.findAndCount(query);
    const allItems = Array.from({ length: 45 }, (_, i) => `item-${i + 1}`);
    const total = allItems.length;
    const items = allItems.slice(query.skip, query.skip + query.limit);

    return paginate(items, total, query);
  }
}
