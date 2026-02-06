import { SetMetadata } from '@nestjs/common';

export const OPTION_AUTH_KEY = 'optionalAuth';
export const OptionalAuth = () => SetMetadata(OPTION_AUTH_KEY, true);
