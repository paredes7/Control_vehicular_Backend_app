import { SetMetadata } from '@nestjs/common';

export const KYC_VERIFIED_KEY = 'kycVerified';
export const KycVerified = () => SetMetadata(KYC_VERIFIED_KEY, true);
