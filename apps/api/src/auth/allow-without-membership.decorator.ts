import { SetMetadata } from '@nestjs/common';

export const ALLOW_NO_MEMBERSHIP_KEY = 'allowNoMembership';

export const AllowWithoutMembership = () => SetMetadata(ALLOW_NO_MEMBERSHIP_KEY, true);
