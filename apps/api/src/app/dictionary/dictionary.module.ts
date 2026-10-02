import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NamesModule } from '../names/names.module';
import { DefinitionsService } from './definitions.service';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { UserWord } from './user-word.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserWord]), NamesModule],
  controllers: [DictionaryController],
  providers: [DictionaryService, DefinitionsService],
})
export class DictionaryModule {}
