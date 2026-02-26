import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocumentType, KycStatus, KycResourceType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const ALLOWED_STATUS_FILTERS: KycStatus[] = [
  KycStatus.PENDING,
  KycStatus.NEED_CORRECTION,
  KycStatus.REJECTED,
  KycStatus.VERIFIED,
  KycStatus.UNVERIFIED,
];

const REQUIRED_DOCS: KycDocumentType[] = [
  KycDocumentType.ID_FRONT,
  KycDocumentType.ID_BACK,
  KycDocumentType.LIVENESS_VIDEO,
];

@Injectable()
export class AdminKycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async list(params: { status?: string; page: number; limit: number }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);
    const skip = (page - 1) * limit;

    const where: { status?: KycStatus } = {};
    if (params.status) {
      const normalized = params.status.toUpperCase();
      const status = ALLOWED_STATUS_FILTERS.find(
        (s) => s === (normalized as KycStatus),
      );
      if (!status) {
        throw new BadRequestException('status inválido');
      }
      where.status = status;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.kycRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.kycRequest.count({ where }),
    ]);

    const ids = items.map((i) => i.id);
    const docs = ids.length
      ? await this.prisma.kycDocument.findMany({
          where: { kycRequestId: { in: ids } },
          select: { kycRequestId: true, docType: true },
        })
      : [];

    const docsByRequest = new Map<string, Set<KycDocumentType>>();
    for (const doc of docs) {
      const set = docsByRequest.get(doc.kycRequestId) ?? new Set<KycDocumentType>();
      set.add(doc.docType);
      docsByRequest.set(doc.kycRequestId, set);
    }

    const result = items.map((item) => {
      const existing = docsByRequest.get(item.id) ?? new Set<KycDocumentType>();
      const missingDocs = REQUIRED_DOCS.filter((d) => !existing.has(d));
      return {
        requestId: item.id,
        status: item.status,
        createdAt: item.createdAt,
        reviewedAt: item.reviewedAt,
        user: item.user,
        missingDocs,
      };
    });

    return {
      items: result,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOne(id: string) {
    const request = await this.prisma.kycRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud KYC no encontrada');
    }

    const docs = await this.prisma.kycDocument.findMany({
      where: { kycRequestId: id },
      select: {
        docType: true,
        publicId: true,
        mimeType: true,
        bytes: true,
        uploadedAt: true,
        resourceType: true,
      },
    });

    const latestByType = new Map<KycDocumentType, (typeof docs)[number]>();
    for (const doc of docs) {
      const existing = latestByType.get(doc.docType);
      if (!existing) {
        latestByType.set(doc.docType, doc);
        continue;
      }
      const existingTime = existing.uploadedAt?.getTime() ?? 0;
      const docTime = doc.uploadedAt?.getTime() ?? 0;
      if (docTime >= existingTime) {
        latestByType.set(doc.docType, doc);
      }
    }

    const documents = Array.from(latestByType.values()).map((doc) => ({
      docType: doc.docType,
      publicId: doc.publicId,
      mimeType: doc.mimeType,
      bytes: doc.bytes,
      uploadedAt: doc.uploadedAt,
      resourceType: doc.resourceType,
      signedUrl: this.cloudinary.getSignedUrl({
        publicId: doc.publicId,
        resourceType: doc.resourceType as 'image' | 'video' | 'raw',
        expiresInSeconds: 600,
        version: doc.uploadedAt
          ? doc.uploadedAt.getTime()
          : undefined,
      }),
    }));

    return {
      request,
      documents,
    };
  }

  async approve(id: string, adminUserId: string, note: string | null) {
    const request = await this.prisma.kycRequest.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    });
    if (!request) {
      throw new NotFoundException('Solicitud KYC no encontrada');
    }
    if (request.status === KycStatus.VERIFIED) {
      throw new BadRequestException('La solicitud ya está verificada');
    }

    const docs = await this.prisma.kycDocument.findMany({
      where: { kycRequestId: id },
      select: { docType: true },
    });
    const missingDocs = this.computeMissingDocs(docs);
    if (missingDocs.length > 0) {
      throw new BadRequestException(
        `Faltan documentos: ${missingDocs.join(', ')}`,
      );
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRequest.update({
        where: { id },
        data: {
          status: KycStatus.VERIFIED,
          reviewNote: note ?? null,
          reviewedById: adminUserId,
          reviewedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: request.userId },
        data: { kycStatus: KycStatus.VERIFIED },
      }),
    ]);

    return { requestId: updated.id, status: updated.status };
  }

  async requestCorrection(id: string, adminUserId: string, reviewNote: string) {
    const request = await this.prisma.kycRequest.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!request) {
      throw new NotFoundException('Solicitud KYC no encontrada');
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRequest.update({
        where: { id },
        data: {
          status: KycStatus.NEED_CORRECTION,
          reviewNote,
          reviewedById: adminUserId,
          reviewedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: request.userId },
        data: { kycStatus: KycStatus.NEED_CORRECTION },
      }),
    ]);

    return { requestId: updated.id, status: updated.status };
  }

  async reject(id: string, adminUserId: string, reviewNote: string | null) {
    const request = await this.prisma.kycRequest.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!request) {
      throw new NotFoundException('Solicitud KYC no encontrada');
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRequest.update({
        where: { id },
        data: {
          status: KycStatus.REJECTED,
          reviewNote: reviewNote ?? null,
          reviewedById: adminUserId,
          reviewedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: request.userId },
        data: { kycStatus: KycStatus.REJECTED },
      }),
    ]);

    return { requestId: updated.id, status: updated.status };
  }

  private computeMissingDocs(docs: { docType: KycDocumentType }[]) {
    const existing = new Set(docs.map((d) => d.docType));
    return REQUIRED_DOCS.filter((d) => !existing.has(d));
  }
}
