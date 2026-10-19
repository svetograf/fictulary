import {
  DictionaryPage,
  DictionaryWord,
  DictionaryWordDetails,
  WordDefinition,
} from '@fictulary/shared/models';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt-payload';
import { DefinitionsService } from './definitions.service';
import { DictionaryService } from './dictionary.service';
import { ListDictionaryQuery } from './dto/list-dictionary.query';
import { UpdateWordStatusDto } from './dto/update-word-status.dto';

/** Letters with inner apostrophes or hyphens, like the words we store. */
const LOOKUP_WORD = /^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u;

@Controller()
export class DictionaryController {
  constructor(
    private readonly dictionary: DictionaryService,
    private readonly definitions: DefinitionsService,
  ) {}

  /** Paginated words in one status, most used across the user's books first. */
  @Get('my-dictionary')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListDictionaryQuery,
  ): Promise<DictionaryPage> {
    return this.dictionary.list(
      user.id,
      query.status,
      query.page,
      query.pageSize,
      query.bookWordsOnly,
    );
  }

  /** A word with its usage in each of the user's books. */
  @Get('my-dictionary/:wordId')
  details(
    @CurrentUser() user: AuthUser,
    @Param('wordId', ParseIntPipe) wordId: number,
  ): Promise<DictionaryWordDetails> {
    return this.dictionary.details(user.id, String(wordId));
  }

  @Patch('my-dictionary/:wordId')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('wordId', ParseIntPipe) wordId: number,
    @Body() dto: UpdateWordStatusDto,
  ): Promise<DictionaryWord> {
    return this.dictionary.updateStatus(user.id, String(wordId), dto.status);
  }

  /** Marks the word as looked up: UNKNOWN becomes LEARNING. */
  @Post('my-dictionary/:wordId/view')
  @HttpCode(HttpStatus.OK)
  markViewed(
    @CurrentUser() user: AuthUser,
    @Param('wordId', ParseIntPipe) wordId: number,
  ): Promise<DictionaryWord> {
    return this.dictionary.markViewed(user.id, String(wordId));
  }

  /** English dictionary article for a word. */
  @Get('definitions/:word')
  definition(@Param('word') word: string): Promise<WordDefinition> {
    if (word.length > 100 || !LOOKUP_WORD.test(word)) {
      throw new BadRequestException('Not a word that can be looked up');
    }
    return this.definitions.lookup(word);
  }
}
