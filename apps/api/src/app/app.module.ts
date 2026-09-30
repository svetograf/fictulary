import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { DictionaryModule } from './dictionary/dictionary.module';
import { BooksModule } from './books/books.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
      load: [databaseConfig, authConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => config,
    }),
    BooksModule,
    AuthModule,
    DictionaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
