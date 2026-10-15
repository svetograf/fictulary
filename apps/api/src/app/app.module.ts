import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DevAuthModule } from './auth/dev/dev-auth.module';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { oauthConfig } from './config/oauth.config';
import { DictionaryModule } from './dictionary/dictionary.module';
import { BooksModule } from './books/books.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
      load: [databaseConfig, authConfig, oauthConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => config,
    }),
    BooksModule,
    AuthModule,
    // Not the string form: it treats an unset variable as enabled. Keep in
    // sync with AuthController.providers().
    ConditionalModule.registerWhen(
      DevAuthModule,
      (env) => env.AUTH_DEV_LOGIN === 'true',
    ),
    DictionaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
