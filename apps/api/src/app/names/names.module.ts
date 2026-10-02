import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Name } from './name.entity';
import { NamesService } from './names.service';

@Module({
  imports: [TypeOrmModule.forFeature([Name])],
  providers: [NamesService],
  exports: [NamesService],
})
export class NamesModule {}
