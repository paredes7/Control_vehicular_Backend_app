import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FiatOperationStatus, FiatOperationType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SafeService } from '../safe/safe.service';
import { AdminDecisionDto, AdminDecisionAction } from './dto/decision.dto';
import { ListAdminDepositsQueryDto, AdminDepositStatusFilter } from './dto/list-admin-deposits.dto';
import { ListAdminMintsQueryDto } from './dto/list-admin-mints.dto';
import { RequestCorrectionDto } from './dto/request-correction.dto';

type JwtUser = { userId: string; role: UserRole; email?: string };

@Injectable()
export class AdminDepositsService {
  private readonly logger = new Logger(AdminDepositsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly safeService: SafeService,
  ) {}

  private assertAdminOrOperator(u: JwtUser) {
    const allowed: UserRole[] = [UserRole.ADMIN, UserRole.OPERATOR_BO, UserRole.OPERATOR_PE];
    if (!u?.userId || !allowed.includes(u.role)) {
      throw new ForbiddenException('No autorizado.');
    }
  }

  private isMinted(
    status: FiatOperationStatus,
    deposit: { mintedAt: Date | null; mintTxHash: string | null } | null,
  ) {
    return (
      status === FiatOperationStatus.PROCESSED ||
      !!deposit?.mintedAt ||
      !!deposit?.mintTxHash
    );
  }

  private displayStatus(
    status: FiatOperationStatus,
    deposit: { mintedAt: Date | null; mintTxHash: string | null } | null,
  ) {
    return this.isMinted(status, deposit) ? 'MINTED' : status;
  }

  private toMaxDecimals(value: string, maxDecimals: number): string {
    if (maxDecimals <= 0) {
      return value.split('.')[0];
    }

    const parts = value.split('.');
    if (parts.length === 1) {
      return value;
    }

    const [intPart, decPart] = parts;
    if (!decPart) {
      return intPart;
    }

    const trimmed = decPart.slice(0, maxDecimals);
    if (trimmed.length === 0) {
      return intPart;
    }

    return `${intPart}.${trimmed}`;
  }

  async list(u: JwtUser, q: ListAdminDepositsQueryDto) {
    this.assertAdminOrOperator(u);

    const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
    const cursor = q.cursor?.trim() || undefined;

    const where: Prisma.FiatOperationWhereInput = {
      type: FiatOperationType.DEPOSIT,
    };

    const status = q.status ?? AdminDepositStatusFilter.PROOF_SUBMITTED;
    if (status !== AdminDepositStatusFilter.ALL) {
      if (status === AdminDepositStatusFilter.MINTED) {
        where.OR = [
          { status: FiatOperationStatus.PROCESSED },
          { deposit: { mintedAt: { not: null } } },
          { deposit: { mintTxHash: { not: null } } },
        ];
      } else {
        where.status = status as unknown as FiatOperationStatus;
      }
    }

    const rows = await this.prisma.fiatOperation.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        referenceCode: true,
        currency: true,
        status: true,

        amount: true,
        totalAmount: true,

        rateUsed: true,
        rateSource: true,
        rateQuotedAt: true,
        rateExpiresAt: true,

        validatedById: true,
        validatedAt: true,

        createdAt: true,

        deposit: {
          select: {
            expectedBOBH: true,
            proofUrl: true,
            proofUploadedAt: true,
            proofFileName: true,
            proofMimeType: true,
            safeTxHash: true,
            safeProposedAt: true,
            mintTxHash: true,
            mintedAt: true,
            reviewNote: true,
            reviewedById: true,
            reviewedAt: true,
          },
        },

        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            country: true,
            kycStatus: true,
            walletAddress: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const now = Date.now();

    return {
      items: items.map((d) => {
        const displayStatus = this.displayStatus(d.status, d.deposit);
        const isRateExpired =
          d.currency === 'PEN' &&
          !!d.rateExpiresAt &&
          !!d.deposit?.proofUploadedAt &&
          d.deposit.proofUploadedAt > d.rateExpiresAt &&
          displayStatus !== 'MINTED';

        return {
          id: d.id,
          referenceCode: d.referenceCode,
          currency: d.currency,
          status: displayStatus,
          isRateExpired,

          amount: d.amount.toString(),
          totalAmount: d.totalAmount.toString(),
          expectedBOBH: d.deposit?.expectedBOBH ? d.deposit.expectedBOBH.toString() : '0',

          rateUsed: d.rateUsed ? d.rateUsed.toString() : null,
          rateSource: d.rateSource ?? null,
          rateQuotedAt: d.rateQuotedAt ? d.rateQuotedAt.toISOString() : null,
          rateExpiresAt: d.rateExpiresAt ? d.rateExpiresAt.toISOString() : null,

          proofUrl: d.deposit?.proofUrl ?? null,
          proofUploadedAt: d.deposit?.proofUploadedAt ? d.deposit.proofUploadedAt.toISOString() : null,
          proofFileName: d.deposit?.proofFileName ?? null,
          proofMimeType: d.deposit?.proofMimeType ?? null,

          safeTxHash: d.deposit?.safeTxHash ?? null,
          safeProposedAt: d.deposit?.safeProposedAt ? d.deposit.safeProposedAt.toISOString() : null,

          validatedById: d.validatedById ?? null,
          validatedAt: d.validatedAt ? d.validatedAt.toISOString() : null,

          mintTxHash: d.deposit?.mintTxHash ?? null,
          mintedAt: d.deposit?.mintedAt ? d.deposit.mintedAt.toISOString() : null,

          reviewNote: d.deposit?.reviewNote ?? null,
          reviewedById: d.deposit?.reviewedById ?? null,
          reviewedAt: d.deposit?.reviewedAt ? d.deposit.reviewedAt.toISOString() : null,

          createdAt: d.createdAt.toISOString(),

          user: d.user,
        };
      }),
      nextCursor,
      hasMore,
      limit,
      filter: status,
    };
  }

  async listMints(u: JwtUser, q: ListAdminMintsQueryDto) {
    this.assertAdminOrOperator(u);

    const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
    const cursor = q.cursor?.trim() || undefined;

    const where: Prisma.FiatOperationWhereInput = {
      type: FiatOperationType.DEPOSIT,
      OR: [
        { status: FiatOperationStatus.APPROVED },
        { deposit: { safeTxHash: { not: null } } },
      ],
    };

    const rows = await this.prisma.fiatOperation.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        referenceCode: true,
        currency: true,
        status: true,
        createdAt: true,
        deposit: {
          select: {
            expectedBOBH: true,
            safeTxHash: true,
            safeProposedAt: true,
            mintTxHash: true,
            mintedAt: true,
          },
        },
        user: {
          select: {
            email: true,
            walletAddress: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return {
      items: items.map((d) => {
        const displayStatus = this.displayStatus(d.status, d.deposit);
        return {
          id: d.id,
          referenceCode: d.referenceCode,
          currency: d.currency,
          status: displayStatus,
          expectedBOBH: d.deposit?.expectedBOBH ? d.deposit.expectedBOBH.toString() : '0',
          safeTxHash: d.deposit?.safeTxHash ?? null,
          safeProposedAt: d.deposit?.safeProposedAt ? d.deposit.safeProposedAt.toISOString() : null,
          mintTxHash: d.deposit?.mintTxHash ?? null,
          mintedAt: d.deposit?.mintedAt ? d.deposit.mintedAt.toISOString() : null,
          createdAt: d.createdAt.toISOString(),
          user: d.user,
        };
      }),
      nextCursor,
      hasMore,
      limit,
    };
  }

  async getPendingMintsCount(u: JwtUser) {
    this.assertAdminOrOperator(u);

    const pendingCount = await this.prisma.fiatOperation.count({
      where: {
        type: FiatOperationType.DEPOSIT,
        OR: [
          { status: FiatOperationStatus.PROOF_SUBMITTED },
          { status: FiatOperationStatus.NEED_CORRECTION },
          { status: FiatOperationStatus.RATE_EXPIRED },
          { status: FiatOperationStatus.APPROVED },
        ],
        deposit: {
          safeTxHash: null,
          mintTxHash: null,
          mintedAt: null,
        },
      },
    });

    return { pendingCount };
  }

  async getOne(u: JwtUser, id: string) {
    this.assertAdminOrOperator(u);

    const d = await this.prisma.fiatOperation.findFirst({
      where: { id, type: FiatOperationType.DEPOSIT },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            country: true,
            kycStatus: true,
            walletAddress: true,
          },
        },
        deposit: true,
      },
    });
    if (!d) throw new NotFoundException('Deposito no encontrado');
    if (!d.deposit) throw new NotFoundException('Deposito no encontrado');
    const displayStatus = this.displayStatus(d.status, d.deposit);

    if (!d) throw new NotFoundException('Depósito no encontrado');

    return {
      id: d.id,
      referenceCode: d.referenceCode,
      currency: d.currency,
      status: displayStatus,
      userId: d.userId,

      amount: d.amount.toString(),
      feeRate: d.feeRate.toString(),
      serviceFee: d.serviceFee.toString(),
      totalAmount: d.totalAmount.toString(),
      expectedBOBH: d.deposit.expectedBOBH.toString(),
      rateUsed: d.rateUsed ? d.rateUsed.toString() : null,
      rateSource: d.rateSource ?? null,
      rateQuotedAt: d.rateQuotedAt ? d.rateQuotedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      processedAt: d.processedAt ? d.processedAt.toISOString() : null,
      validatedById: d.validatedById ?? null,
      validatedAt: d.validatedAt ? d.validatedAt.toISOString() : null,
      mintedAt: d.deposit.mintedAt ? d.deposit.mintedAt.toISOString() : null,
      mintTxHash: d.deposit.mintTxHash ?? null,
      proofUrl: d.deposit.proofUrl ?? null,
      proofUploadedAt: d.deposit.proofUploadedAt ? d.deposit.proofUploadedAt.toISOString() : null,
      proofFileName: d.deposit.proofFileName ?? null,
      proofMimeType: d.deposit.proofMimeType ?? null,
      rateExpiresAt: d.rateExpiresAt ? d.rateExpiresAt.toISOString() : null,
      reviewNote: d.deposit.reviewNote ?? null,
      reviewedById: d.deposit.reviewedById ?? null,
      reviewedAt: d.deposit.reviewedAt ? d.deposit.reviewedAt.toISOString() : null,

      user: d.user,
      transactions: [],
    };
  }

  async proposeMint(u: JwtUser, id: string) {
    this.assertAdminOrOperator(u);

    const op = await this.prisma.fiatOperation.findFirst({
      where: { id, type: FiatOperationType.DEPOSIT },
      include: {
        user: { select: { walletAddress: true } },
        deposit: true,
      },
    });

    if (!op || !op.deposit) throw new NotFoundException('Deposito no encontrado');

    // 1) No tocar si ya minteado/final
    if (this.isMinted(op.status, op.deposit)) {
      throw new BadRequestException('Este depósito ya fue minteado/procesado.');
    }

    // 2) Debe estar aprobado (recomendación)
    if (op.status !== FiatOperationStatus.APPROVED) {
      throw new BadRequestException('Solo se puede proponer mint cuando el depósito está APPROVED.');
    }

    // 3) Debe existir comprobante (ustedes decidieron exigirlo siempre)
    if (!op.deposit.proofUrl) {
      throw new BadRequestException('No se puede proponer mint sin comprobante.');
    }

    // 4) Wallet del usuario obligatoria
    const to = op.user.walletAddress;
    if (!to) throw new BadRequestException('El usuario no tiene wallet registrada.');

    // 5) Evitar duplicados
    if (op.deposit.safeTxHash) {
      throw new BadRequestException('Este depósito ya tiene un mint propuesto en Safe.');
    }
 
    // 6) Monto: expectedBOBH -> string con max 6 decimales
    const expected = op.deposit.expectedBOBH.toString();
    const amount6 = this.toMaxDecimals(expected, 6);
 
    // 7) Llamada a Safe
    const safeTxHash = await this.safeService.proposeMintTransaction(to, amount6);

    // 8) Guardar safeTxHash en deposit_details
    const updated = await this.prisma.fiatOperation.update({
      where: { id: op.id },
      data: {
        deposit: {
          update: {
            safeTxHash,
            safeProposedAt: new Date(),
          },
        },
      },
      include: { deposit: true },
    });

    return {
      depositId: updated.id,
      safeTxHash,
      safeProposedAt: updated.deposit?.safeProposedAt?.toISOString() ?? null,
    };
  }

  async decide(u: JwtUser, id: string, dto: AdminDecisionDto) {
    this.assertAdminOrOperator(u);

    const deposit = await this.prisma.fiatOperation.findFirst({
      where: { id, type: FiatOperationType.DEPOSIT },
      include: {
        deposit: true,
        user: { select: { walletAddress: true } },
      },
    });
    if (!deposit || !deposit.deposit) throw new NotFoundException('Deposito no encontrado');

    // No tocar si ya final
    if (this.isMinted(deposit.status, deposit.deposit)) {
      throw new BadRequestException('Este depósito ya fue minteado.');
    }

    const allowedForReject: FiatOperationStatus[] = [
      FiatOperationStatus.PROOF_SUBMITTED,
      FiatOperationStatus.NEED_CORRECTION,
    ];

    if (dto.action === AdminDecisionAction.APPROVE) {
      if (deposit.status !== FiatOperationStatus.PROOF_SUBMITTED) {
        throw new BadRequestException('Solo se puede aprobar cuando está en PROOF_SUBMITTED.');
      }
    }

    if (dto.action === AdminDecisionAction.REJECT) {
      if (!allowedForReject.includes(deposit.status)) {
        throw new BadRequestException('Solo se puede rechazar desde PROOF_SUBMITTED o NEED_CORRECTION.');
      }
    }

    // Exigir comprobante para aprobar
    if (dto.action === AdminDecisionAction.APPROVE && !deposit.deposit.proofUrl) {
      throw new BadRequestException('No se puede aprobar sin comprobante.');
    }

    // Si PEN: solo invalidar si el proof se subió DESPUÉS del vencimiento
    if (
      dto.action === AdminDecisionAction.APPROVE &&
      deposit.currency === 'PEN' &&
      deposit.rateExpiresAt &&
      deposit.deposit.proofUploadedAt &&
      deposit.deposit.proofUploadedAt > deposit.rateExpiresAt
    ) {
      await this.prisma.fiatOperation.update({
        where: { id },
        data: { status: FiatOperationStatus.RATE_EXPIRED },
      });
      throw new BadRequestException('El comprobante se subió después de que expiró el tipo de cambio.');
    }

    const newStatus =
      dto.action === AdminDecisionAction.APPROVE
        ? FiatOperationStatus.APPROVED
        : FiatOperationStatus.REJECTED;

    const updated = await this.prisma.fiatOperation.update({
      where: { id },
      data: {
        status: newStatus,
        validatedById: u.userId,
        validatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        validatedById: true,
        validatedAt: true,
      },
    });

    return {
      depositId: updated.id,
      status: updated.status,
      validatedById: updated.validatedById,
      validatedAt: updated.validatedAt ? updated.validatedAt.toISOString() : null,
    };
  }

  async requestCorrection(u: JwtUser, id: string, dto: RequestCorrectionDto) {
    this.assertAdminOrOperator(u);

    const op = await this.prisma.fiatOperation.findFirst({
      where: { id, type: FiatOperationType.DEPOSIT },
      include: { deposit: true },
    });

    if (!op || !op.deposit) throw new NotFoundException('Operación no encontrada');

    // 1) No tocar si ya está final/minteado
    if (this.isMinted(op.status, op.deposit)) {
      throw new BadRequestException('Este depósito ya fue minteado.');
    }

    // 2) Solo tiene sentido si ya existe proof para revisar
    if (!op.deposit.proofUrl) {
      throw new BadRequestException('No hay comprobante para revisar.');
    }

    // 3) Solo desde PROOF_SUBMITTED
    if (op.status !== FiatOperationStatus.PROOF_SUBMITTED) {
      throw new BadRequestException('Solo puedes solicitar corrección desde PROOF_SUBMITTED.');
    }

    const updated = await this.prisma.fiatOperation.update({
      where: { id },
      data: {
        status: FiatOperationStatus.NEED_CORRECTION,
        deposit: {
          update: {
            reviewNote: dto.note,
            reviewedById: u.userId,
            reviewedAt: new Date(),
          },
        },
      },
      select: {
        id: true,
        status: true,
        deposit: {
          select: {
            reviewNote: true,
            reviewedById: true,
            reviewedAt: true,
          },
        },
      },
    });

    return {
      depositId: updated.id,
      status: updated.status,
      reviewNote: updated.deposit?.reviewNote ?? null,
      reviewedById: updated.deposit?.reviewedById ?? null,
      reviewedAt: updated.deposit?.reviewedAt ? updated.deposit.reviewedAt.toISOString() : null,
    };
  }
}
