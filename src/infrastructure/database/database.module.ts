import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres',
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.name,
        autoLoadEntities: true,
        synchronize: config.synchronize,
        logging: config.logging,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        migrations: [__dirname + '/migrations/*.{ts,js}'],
      }),
    }),
  ],
})
export class DatabaseModule {}
