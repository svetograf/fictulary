import { CefrLevel, SetLevelRequest } from '@fictulary/shared/models';
import { IsEnum, ValidateIf } from 'class-validator';

export class SetLevelDto implements SetLevelRequest {
  /** Null removes the knowledge-level word list. */
  @ValidateIf((dto: SetLevelDto) => dto.level !== null)
  @IsEnum(CefrLevel)
  level!: CefrLevel | null;
}
