import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FiatCurrency, FiatOperationStatus, FiatOperationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateDepositDto, FiatCurrencyDto } from './dto/create-deposit.dto';
import { ListMyDepositsQueryDto } from './dto/list-my-deposits.dto';
import { randomBytes } from 'crypto';
import { RatesService } from '../rates/rates.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { calculateDepositFees } from './fee.utils';

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratesService: RatesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  private readonly MIN_DEPOSIT_BOB = new Prisma.Decimal('10000'); // 10k Bs (equivalente)
  private readonly RATE_LOCK_MINUTES = Number(
    process.env.RATE_LOCK_MINUTES ?? '30',
  );

  private generateReferenceCode(): string {
    return `HUN-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async createDeposit(userId: string, dto: CreateDepositDto) {
    if (!userId) throw new BadRequestException('Usuario no autenticado');
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Monto inválido');
    }

    const amount = new Prisma.Decimal(dto.amount);

    // DTO currency -> Prisma enum
    const currency: FiatCurrency =
      dto.currency === FiatCurrencyDto.BOB
        ? FiatCurrency.BOB
        : FiatCurrency.PEN;

    // Rate lock SOLO para PEN
    let rateUsed: Prisma.Decimal | null = null; // PEN->BOB
    let rateSource: string | null = null;
    let rateQuotedAt: Date | null = null;
    let rateExpiresAt: Date | null = null;

    let bobEquivalent = new Prisma.Decimal('0');

    if (currency === FiatCurrency.BOB) {
      bobEquivalent = amount; // 1:1
    } else {
      const r = await this.ratesService.getPenToBobRate(); // { rate: Decimal, source, updatedAt, cacheSeconds }

      rateUsed = r.rate;
      rateSource = r.source;

      rateQuotedAt = new Date(r.updatedAt);
      rateExpiresAt = new Date(
        rateQuotedAt.getTime() + this.RATE_LOCK_MINUTES * 60_000,
      );

      bobEquivalent = amount.mul(rateUsed);
    }

    // Mínimo: 10k Bs equivalentes
    if (bobEquivalent.lt(this.MIN_DEPOSIT_BOB)) {
      throw new BadRequestException(
        `Depósito mínimo: ${this.MIN_DEPOSIT_BOB.toString()} Bs (equivalente).`,
      );
    }

    const company = await this.prisma.companyBankAccount.findUnique({
      where: { currency },
    });
    if (!company) {
      throw new ConflictException(
        `No hay cuenta bancaria configurada para ${currency}`,
      );
    }

    const expectedBOBH = bobEquivalent; // 1:1 con BOB (en equivalente BOB)

    const { feeRate, serviceFee, totalAmount } = calculateDepositFees({
      amount,
      bobEquivalent,
      currency,
      rateUsed,
    });

    // referenceCode único con reintentos
    for (let i = 0; i < 5; i++) {
      const referenceCode = this.generateReferenceCode();

      try {
        const deposit = await this.prisma.fiatOperation.create({
          data: {
            type: FiatOperationType.DEPOSIT,
            userId,
            currency,
            amount,
            feeRate,
            serviceFee,
            totalAmount,

            // rate lock
            rateUsed,
            rateSource,
            rateQuotedAt,
            rateExpiresAt,

            referenceCode,
            deposit: {
              create: {
                expectedBOBH,
              },
            },
            // status default: PENDING
          },
          include: { deposit: true },
        });

        const displayStatus = this.displayStatus(deposit.status, deposit.deposit);
        return {
          depositId: deposit.id,
          status: displayStatus,
          referenceCode: deposit.referenceCode,
          currency: deposit.currency,

          amount: deposit.amount.toString(),
          feeRate: deposit.feeRate.toString(),
          serviceFee: deposit.serviceFee.toString(),
          totalAmount: deposit.totalAmount.toString(),

          rateUsed: deposit.rateUsed?.toString() ?? null,
          rateSource: deposit.rateSource ?? null,
          rateQuotedAt: deposit.rateQuotedAt
            ? deposit.rateQuotedAt.toISOString()
            : null,
          rateExpiresAt: deposit.rateExpiresAt
            ? deposit.rateExpiresAt.toISOString()
            : null,

          expectedBOBH: deposit.deposit?.expectedBOBH ? deposit.deposit.expectedBOBH.toString() : '0',

          instructions: {
            title: 'Transferencia bancaria',
            bankName: company.bankName,
            accountName: company.accountHolder,
            accountNumber: company.accountNumber,
            cci: company.cci ?? null,
            qrImageUrl: company.qrImageUrl ?? null,
            qrPublicId: company.qrPublicId ?? null,
            note:
              deposit.currency === 'PEN' && deposit.rateExpiresAt
                ? `Usa esta referencia en el pago: ${deposit.referenceCode}. Tipo de cambio fijado hasta: ${deposit.rateExpiresAt.toISOString()}`
                : `Usa esta referencia en el pago: ${deposit.referenceCode}`,
          },
        };
      } catch (e: unknown) {
        // P2002 = unique constraint failed (referenceCode)
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === 'P2002') continue;
        }
        throw e;
      }
    }

    throw new InternalServerErrorException(
      'No se pudo generar un referenceCode único',
    );
  }

  // método para subir comprobante
  async uploadProof(userId: string, depositId: string, file: Express.Multer.File) {
    if (!userId) throw new BadRequestException('Usuario no autenticado');
    if (!depositId) throw new BadRequestException('depositId inválido');
    if (!file) throw new BadRequestException('Archivo requerido');

    const deposit = await this.prisma.fiatOperation.findFirst({
      where: { id: depositId, type: FiatOperationType.DEPOSIT },
      include: { deposit: true },
    });

    if (!deposit || !deposit.deposit) throw new NotFoundException('Deposito no encontrado');
    if (deposit.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este depósito');
    }

    // Solo permitimos subir comprobante en estos estados
    const allowedStatuses: FiatOperationStatus[] = [
      FiatOperationStatus.PENDING,
      FiatOperationStatus.NEED_CORRECTION,
    ];

    if (!allowedStatuses.includes(deposit.status)) {
      throw new BadRequestException('No puedes subir comprobante en este estado.');
    }

    // Si PEN: el rate solo bloquea en el PRIMER envío (PENDING)
    if (
      deposit.currency === 'PEN' &&
      deposit.status === FiatOperationStatus.PENDING &&
      deposit.rateExpiresAt
    ) {
      const now = new Date();
      if (now > deposit.rateExpiresAt) {
        await this.prisma.fiatOperation.update({
          where: { id: depositId },
          data: { status: FiatOperationStatus.RATE_EXPIRED },
        });

        throw new BadRequestException('El tipo de cambio expiró. Crea un nuevo depósito.');
      }
    }

    // Validación básica de archivo (además del interceptor)
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Solo se permite JPG, PNG, WEBP o PDF.');
    }

    // Subimos a Cloudinary
    const uploaded = await this.cloudinaryService.uploadDepositProof({
      file,
      userId,
      depositId,
      referenceCode: deposit.referenceCode,
    });

    const now = new Date();

    // Si venía de NEED_CORRECTION, limpiamos la nota de revisión
    const shouldClearReview = deposit.status === FiatOperationStatus.NEED_CORRECTION;

    const updated = await this.prisma.fiatOperation.update({
      where: { id: depositId },
      data: {
        status: FiatOperationStatus.PROOF_SUBMITTED,
        deposit: {
          update: {
            proofUrl: uploaded.secureUrl,
            proofUploadedAt: now,
            proofFileName: file.originalname,
            proofMimeType: file.mimetype,

            ...(shouldClearReview
              ? {
                  reviewNote: null,
                  reviewedById: null,
                  reviewedAt: null,
                }
              : {}),
          },
        },
      },
      include: { deposit: true },
    });

    return {
      depositId: updated.id,
      status: this.displayStatus(updated.status, updated.deposit),
      proofUrl: updated.deposit?.proofUrl ?? null,
      proofUploadedAt: updated.deposit?.proofUploadedAt?.toISOString() ?? null,
      proofFileName: updated.deposit?.proofFileName ?? null,
      proofMimeType: updated.deposit?.proofMimeType ?? null,

      // (Opcional) devolver reviewNote por si el frontend quiere refrescar UI:
      reviewNote: updated.deposit?.reviewNote ?? null,
      reviewedById: updated.deposit?.reviewedById ?? null,
      reviewedAt: updated.deposit?.reviewedAt ? updated.deposit.reviewedAt.toISOString() : null,
    };
  }
  async listMyDeposits(userId: string, q: ListMyDepositsQueryDto) {
    if (!userId) throw new BadRequestException('Usuario no autenticado');

    const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
    const cursor = q.cursor?.trim() || undefined;

    const rows = await this.prisma.fiatOperation.findMany({
      where: { userId, type: FiatOperationType.DEPOSIT },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        referenceCode: true,
        currency: true,
        status: true,

        amount: true,
        feeRate: true,
        serviceFee: true,
        totalAmount: true,

        rateUsed: true,
        rateSource: true,
        rateQuotedAt: true,
        rateExpiresAt: true,

        validatedById: true,
        validatedAt: true,

        createdAt: true,
        updatedAt: true,
        processedAt: true,

        deposit: {
          select: {
            expectedBOBH: true,
            proofUrl: true,
            proofUploadedAt: true,
            proofFileName: true,
            proofMimeType: true,
            mintTxHash: true,
            mintedAt: true,
            reviewNote: true,
            reviewedAt: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items: items.map((d) => {
        const displayStatus = this.displayStatus(d.status, d.deposit);

        return {
          id: d.id,
          referenceCode: d.referenceCode,
          currency: d.currency,
          status: displayStatus,

          amount: d.amount.toString(),
          feeRate: d.feeRate.toString(),
          serviceFee: d.serviceFee.toString(),
          totalAmount: d.totalAmount.toString(),
          expectedBOBH: d.deposit?.expectedBOBH ? d.deposit.expectedBOBH.toString() : '0',

          rateUsed: d.rateUsed ? d.rateUsed.toString() : null,
          rateSource: d.rateSource ?? null,
          rateQuotedAt: d.rateQuotedAt ? d.rateQuotedAt.toISOString() : null,
          rateExpiresAt: d.rateExpiresAt ? d.rateExpiresAt.toISOString() : null,

          proofUrl: d.deposit?.proofUrl ?? null,
          proofUploadedAt: d.deposit?.proofUploadedAt
            ? d.deposit.proofUploadedAt.toISOString()
            : null,
          proofFileName: d.deposit?.proofFileName ?? null,
          proofMimeType: d.deposit?.proofMimeType ?? null,
          reviewNote: d.deposit?.reviewNote ?? null,
          reviewedAt: d.deposit?.reviewedAt ? d.deposit.reviewedAt.toISOString() : null,

          validatedById: d.validatedById ?? null,
          validatedAt: d.validatedAt ? d.validatedAt.toISOString() : null,

          mintTxHash: d.deposit?.mintTxHash ?? null,
          mintedAt: d.deposit?.mintedAt ? d.deposit.mintedAt.toISOString() : null,

          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
          processedAt: d.processedAt ? d.processedAt.toISOString() : null,
        };
      }),
      nextCursor,
      hasMore,
      limit,
    };
  }
}
