import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
 

interface JwtUser {
  userId: string;
  email: string;
  isVerified: boolean;
}

@Injectable()
export class HistorialRetiroService {

  constructor(private  prisma: PrismaService) {}
 
 async getHistorialUser(user: JwtUser, page: number, limit: number) {
  try {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.withdrawalDetail.findMany({
        skip,
        take: limit,
        where: {
          operation: {
            userId: user.userId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          operation: true,
          bankAccount: {
            include: {
              bank: true,
            },
          },
        },
      }),
      this.prisma.withdrawalDetail.count({
        where: {
          operation: {
            userId: user.userId,
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
}


}
