import { GoogleSignInRequest } from '@fictulary/shared/models';
import { IsJWT } from 'class-validator';

export class GoogleSignInDto implements GoogleSignInRequest {
  @IsJWT()
  idToken!: string;
}
