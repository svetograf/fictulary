import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard. Every other route requires a
 * valid access token, so new endpoints are protected by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
