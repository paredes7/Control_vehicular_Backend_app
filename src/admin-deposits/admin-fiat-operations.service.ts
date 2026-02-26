// src/admin/admin-fiat-operations.service.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export class AdminFiatOperationsService {
  constructor(private prisma: PrismaService) {}

  async requestDepositCorrection(adminId: string, operationId: string, note: string) {
    const op = await this.prisma.fiatOperation.findUnique({
      where: { id: operationId },
      include: { deposit: true },
    });

    if (!op) throw new NotFoundException('Operación no encontrada');
    if (op.type !== 'DEPOSIT') throw new BadRequestException('Solo aplica a depósitos');
    if (op.status !== 'PROOF_SUBMITTED') {
      throw new BadRequestException('Solo puedes solicitar corrección si ya hay comprobante enviado');
    }
    if (!op.deposit) throw new BadRequestException('Depósito sin detalle (DepositDetail)');
    if (!op.deposit.proofUrl) throw new BadRequestException('No hay comprobante para revisar');

    return this.prisma.fiatOperation.update({
      where: { id: operationId },
      data: {
        status: 'NEED_CORRECTION',
        deposit: {
          update: {
            reviewNote: note,
            reviewedById: adminId,
            reviewedAt: new Date(),
          },
        },
      },
      include: { deposit: true },
    });
  }
}