import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycStatus, UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  kycStatus: KycStatus;
  isVerified: boolean;
  walletAddress: string;
}
 
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o deshabilitado.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
      isVerified: user.isVerified,
      walletAddress: user.walletAddress,
    };
  }
}
