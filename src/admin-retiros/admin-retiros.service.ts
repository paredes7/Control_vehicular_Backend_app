import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateAdminRetiroDto } from './dto/update-admin-retiro.dto';
import { FiatOperationStatus as PrismaStatus } from '@prisma/client';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { SafeService } from 'src/safe/safe.service';
import { MailService } from 'src/mail/mail.service';

interface JwtUser {
  userId: string;
  email: string;
  isVerified: boolean;
}

@Injectable()
export class AdminRetirosService {
  constructor(
    private prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly safeService: SafeService,
    private readonly mailService: MailService,
  ) { }


  async getAllburns(page: number, limit: number) {
    try {
      const skip = (page - 1) * limit;

      const [data, total] = await this.prisma.$transaction([
        this.prisma.withdrawalDetail.findMany({
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            operation: {
              include: {
                user: true,
              },
            },
            bankAccount: {
              include: {
                bank: true,
              },
            },
          },
        }),
        this.prisma.withdrawalDetail.count(),
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

  async searchBurns(query?: string, userId?: string) {
    try {
      // Paso 1: buscar todos los withdrawals sin filtrar por userId en la query de Prisma
      // porque ahora userId es el nombre del usuario y lo buscaremos en memoria
      const allWithdrawals = await this.prisma.withdrawalDetail.findMany({
        include: {
          operation: {
            include: {
              user: true,
            },
          },
          bankAccount: {
            include: {
              bank: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Si no hay query ni userId (nombre), devolvemos todo
      if (!query && !userId) {
        return allWithdrawals;
      }

      // Paso 2: filtro en memoria
      const filtered = allWithdrawals.filter((w) => {
        let matches = true;

        // Filtro por query (referencia, cuenta, email, moneda)
        if (query) {
          const lowerQuery = query.toLowerCase();
          const ref = w.operation?.referenceCode?.toLowerCase() || '';
          const acc = w.bankAccount?.accountNumber?.toLowerCase() || '';
          const email = w.operation?.user?.email?.toLowerCase() || '';
          const currency = w.operation?.currency?.toLowerCase() || '';

          const queryMatch =
            ref.includes(lowerQuery) ||
            acc.includes(lowerQuery) ||
            email.includes(lowerQuery) ||
            currency.includes(lowerQuery);

          matches = matches && queryMatch;
        }

        // Filtro por userId (que ahora es nombre de usuario)
        if (userId) {
          const lowerUserSearch = userId.toLowerCase();
          const firstName = w.operation?.user?.firstName?.toLowerCase() || '';
          const lastName = w.operation?.user?.lastName?.toLowerCase() || '';
          const fullName = `${firstName} ${lastName}`.toLowerCase();

          const userMatch =
            firstName.includes(lowerUserSearch) ||
            lastName.includes(lowerUserSearch) ||
            fullName.includes(lowerUserSearch);

          matches = matches && userMatch;
        }

        return matches;
      });

      return filtered;
    } catch (error) {
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateAdminRetiroDto,
    user: JwtUser,
    file?: Express.Multer.File,
  ) {

    const withdrawal = await this.prisma.withdrawalDetail.findUnique({
      where: { id },
      include: {
        operation: true,
        bankAccount: true,
      },
    });

    if (!withdrawal) {
      throw new NotFoundException(`WithdrawalDetail with id ${id} not found`);
    }

    const userw = await this.prisma.user.findUnique({
      where: { id: withdrawal.operation.userId },
    });

    if (!userw?.walletAddress) {
      throw new BadRequestException("Usuario sin wallet");
    }

    const walletAddress = userw.walletAddress;
    const totalAmount = withdrawal.operation.totalAmount;

    const fiatUpdateData: any = {
      status: dto.status,
      updatedAt: new Date(),
    };

    if (dto.status === PrismaStatus.PROCESSED) {
      fiatUpdateData.processedAt = new Date();
      fiatUpdateData.validatedAt = new Date();
      fiatUpdateData.validatedBy = { connect: { id: user.userId } };
    }

    const operation = await this.prisma.fiatOperation.update({
      where: { id: withdrawal.operationId },
      data: fiatUpdateData,
    });

    /* ================= SAFE TRANSACTIONS ================= */

    if (dto.status === PrismaStatus.PROCESSED) {
      await this.safeService.proposeFinalizeRedemptionTransaction(
        walletAddress,
        totalAmount.toString()
      );
    }

    if (dto.status === PrismaStatus.REJECTED) {
      await this.safeService.proposeRejectRedemptionTransaction(
        walletAddress,
        totalAmount.toString()
      );
    }

    /* ================= WITHDRAWAL UPDATE ================= */

    const withdrawalUpdateData: any = {};

    if (dto.payoutTxRef) {
      withdrawalUpdateData.payoutTxRef = dto.payoutTxRef;
      withdrawalUpdateData.paidAt = new Date();
    }

    let proofUrl: string | undefined;

    if (file) {
      const uploadResult = await this.cloudinary.uploadWithdrawalProof({
        file,
        userId: user.userId,
        withdrawalId: id,
      });

      proofUrl = uploadResult.secureUrl;

      withdrawalUpdateData.logProofUrl = uploadResult.secureUrl;
      withdrawalUpdateData.cloudinaryPublicId = uploadResult.publicId;
      withdrawalUpdateData.proofUploadedAt = new Date();
    }

    if (Object.keys(withdrawalUpdateData).length > 0) {
      await this.prisma.withdrawalDetail.update({
        where: { id },
        data: withdrawalUpdateData,
      });
    }

    /* ================= EMAILS ================= */

    if (dto.status === PrismaStatus.PROCESSED) {
      await this.mailService.sendRetiroConfirmation(
        dto.payoutTxRef,
        userw.email,
        withdrawal.bankAccount.accountNumber,
        proofUrl,
      );
    }

    if (dto.status === PrismaStatus.REJECTED) {
      await this.mailService.sendRetiroRejected(
        dto.payoutTxRef,
        userw.email,
        withdrawal.bankAccount.accountNumber,
        totalAmount.toString(),
      );
    }

    return operation;
  }




  async getPendingCount() {
    try {
      const pendingCount = await this.prisma.withdrawalDetail.count({
        where: {
          operation: {
            status: 'PENDING',
          },
        },
      });

      return { pendingCount };
    } catch (error) {
      throw error;
    }
  }


}
