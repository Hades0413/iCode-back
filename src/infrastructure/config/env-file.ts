/**
 * Un solo lugar que decide qué archivo de entorno cargar, para que
 * ConfigModule (app) y el DataSource del CLI de TypeORM (migraciones)
 * nunca queden leyendo archivos distintos por accidente.
 */
export function resolveEnvFilePath(): string {
  return process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
}
