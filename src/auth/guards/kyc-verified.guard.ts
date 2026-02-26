import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KycStatus } from '@prisma/client';
import { KYC_VERIFIED_KEY } from '../decorators/kyc-verified.decorator';

@Injectable()
export class KycVerifiedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireKyc = this.reflector.getAllAndOverride<boolean>(
      KYC_VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireKyc) return true;

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sesión inválida o expirada.',
      });
    }

    if (!user.isVerified) {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_VERIFIED',
        message: 'Debes activar/verificar tu cuenta antes de continuar.',
      });
    }

    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException({
        code: 'KYC_REQUIRED',
        message: 'Debes completar la verificación KYC antes de continuar.',
        kycStatus: user.kycStatus, // útil para UI (PENDING/NEED_CORRECTION/etc.)
      });
    }

    return true;
  }
}
