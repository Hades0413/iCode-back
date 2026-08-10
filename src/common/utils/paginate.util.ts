import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Única fuente de la fórmula de paginación — así ningún servicio la
 * reinventa (y se equivoca con el redondeo de totalPages). Tomá `total`
 * de un `.count()`/segundo query aparte, esto no cuenta nada por sí solo.
 */
export function paginate<T>(
  data: T[],
  total: number,
  query: Pick<PaginationQueryDto, 'page' | 'limit'>,
): Paginated<T> {
  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}
