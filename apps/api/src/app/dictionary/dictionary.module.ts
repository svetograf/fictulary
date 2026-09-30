import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefinitionsService } from './definitions.service';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { UserWord } from './user-word.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserWord])],
  controllers: [DictionaryController],
  providers: [DictionaryService, DefinitionsService],
})
export class DictionaryModule {}
