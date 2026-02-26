import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { KycDocumentType, KycResourceType, KycStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const REQUIRED_DOCS: KycDocumentType[] = [
  KycDocumentType.ID_FRONT,
  KycDocumentType.ID_BACK,
  KycDocumentType.LIVENESS_VIDEO,
];

type UploadConfig = {
  docType: KycDocumentType;
  publicId: string;
  resourceType: 'image' | 'video';
  allowedMimes: string[];
  allowedExts?: string[];
  maxBytes: number;
};

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async getOrCreateRequest(userId: string) {
    const user = await this.getUserOrThrow(userId);
    if (user.kycStatus === KycStatus.VERIFIED) {
      return {
        requestId: null,
        status: KycStatus.VERIFIED,
        missingDocs: [],
      };
    }

    const existing = await this.prisma.kycRequest.findFirst({
      where: {
        userId: user.id,
        status: {
          in: [KycStatus.UNVERIFIED, KycStatus.PENDING, KycStatus.NEED_CORRECTION],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const request =
      existing ??
      (await this.prisma.kycRequest.create({
        data: {
          userId: user.id,
          status: KycStatus.UNVERIFIED,
        },
      }));

    const docs = await this.prisma.kycDocument.findMany({
      where: { kycRequestId: request.id },
      select: { docType: true },
    });

    return {
      requestId: request.id,
      status: request.status,
      missingDocs: this.computeMissingDocs(docs),
    };
  }

  async uploadDocument(
    userId: string,
    requestId: string,
    type: string,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo requerido');
    }

    const request = await this.prisma.kycRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) {
      throw new NotFoundException('Solicitud KYC no encontrada');
    }
    if (request.status === KycStatus.VERIFIED) {
      throw new BadRequestException('Solicitud no editable.');
    }
    if (request.status === KycStatus.REJECTED) {
      throw new BadRequestException('Solicitud no editable.');
    }
    if (request.status === KycStatus.PENDING) {
      throw new BadRequestException(
        'Solicitud en revisión, no puedes modificar archivos.',
      );
    }

    const user = await this.getUserOrThrow(userId);
    const config = this.getUploadConfig(type);

    const mime = file.mimetype || '';
    const baseMime = mime.split(';')[0]?.trim().toLowerCase() ?? '';
    const filename = file.originalname?.toLowerCase() ?? '';
    const ext = filename.includes('.') ? filename.split('.').pop() ?? '' : '';
    const treatAsEmptyMime =
      !baseMime ||
      baseMime === 'application/octet-stream' ||
      baseMime === 'text/plain';
    console.log('[KYC validate]', {
      type,
      baseMime,
      rawMime: mime,
      ext,
      size: file.size,
      resourceType: config.resourceType,
    });

    const mimeExplicitAllowed = baseMime
      ? config.allowedMimes.some((allowed) => baseMime === allowed)
      : false;

    if (config.resourceType === 'video') {
      const videoByMime = !!baseMime && baseMime.startsWith('video/');
      const videoByExt =
        treatAsEmptyMime && config.allowedExts
          ? config.allowedExts.includes(ext)
          : false;
      if (!(videoByMime || mimeExplicitAllowed || videoByExt)) {
        throw new BadRequestException(
          `Invalid video type: ${baseMime || ext || 'unknown'}`,
        );
      }
      if (file.size > config.maxBytes) {
        throw new BadRequestException(`Video too large: ${file.size}`);
      }
    } else {
      const imageByMime = !!baseMime && baseMime.startsWith('image/');
      if (!(imageByMime || mimeExplicitAllowed)) {
        throw new BadRequestException('Tipo de archivo no permitido');
      }
      if (file.size > config.maxBytes) {
        throw new BadRequestException('Archivo demasiado grande');
      }
    }

    const folder = this.buildKycFolder(user, request.id);
    const uploaded = await this.cloudinary.uploadPrivate({
      file,
      folder,
      publicId: config.publicId,
      resourceType: config.resourceType,
    });

    const now = new Date();

    const doc = await this.prisma.kycDocument.upsert({
      where: {
        kycRequestId_docType: {
          kycRequestId: request.id,
          docType: config.docType,
        },
      },
      create: {
        userId: user.id,
        kycRequestId: request.id,
        docType: config.docType,
        publicId: uploaded.publicId,
        folder,
        resourceType: uploaded.resourceType as KycResourceType,
        mimeType: file.mimetype,
        bytes: uploaded.bytes,
        uploadedAt: now,
        docUrl: null,
      },
      update: {
        publicId: uploaded.publicId,
        folder,
        resourceType: uploaded.resourceType as KycResourceType,
        mimeType: file.mimetype,
        bytes: uploaded.bytes,
        uploadedAt: now,
      },
    });

    return {
      docType: doc.docType,
      publicId: doc.publicId,
      uploadedAt: doc.uploadedAt,
    };
  }

  async submitRequest(userId: string, requestId: string) {
    const request = await this.prisma.kycRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) {
      throw new NotFoundException('Solicitud KYC no encontrada');
    }

    const docs = await this.prisma.kycDocument.findMany({
      where: { kycRequestId: request.id },
      select: { docType: true },
    });
    const missingDocs = this.computeMissingDocs(docs);
    if (missingDocs.length > 0) {
      throw new BadRequestException(
        `Faltan documentos: ${missingDocs.join(', ')}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRequest.update({
        where: { id: request.id },
        data: { status: KycStatus.PENDING },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.PENDING },
      }),
    ]);

    return {
      requestId: updated.id,
      status: updated.status,
    };
  }

  async getMyStatus(userId: string) {
    const user = await this.getUserOrThrow(userId);

    const request = await this.prisma.kycRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const docs = request
      ? await this.prisma.kycDocument.findMany({
          where: { kycRequestId: request.id },
          select: { docType: true },
        })
      : [];

    return {
      userId: user.id,
      kycStatus: user.kycStatus,
      requestActual: request,
      reviewNote:
        request?.status === KycStatus.NEED_CORRECTION
          ? request.reviewNote
          : null,
      missingDocs: this.computeMissingDocs(docs),
    };
  }

  private getUploadConfig(type: string): UploadConfig {
    const normalized = String(type || '').trim().toLowerCase();

    if (normalized === 'id-front') {
      return {
        docType: KycDocumentType.ID_FRONT,
        publicId: 'id_front',
        resourceType: 'image',
        allowedMimes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif',
        ],
        maxBytes: 10 * 1024 * 1024,
      };
    }

    if (normalized === 'id-back') {
      return {
        docType: KycDocumentType.ID_BACK,
        publicId: 'id_back',
        resourceType: 'image',
        allowedMimes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif',
        ],
        maxBytes: 10 * 1024 * 1024,
      };
    }

    if (normalized === 'video') {
      return {
        docType: KycDocumentType.LIVENESS_VIDEO,
        publicId: 'liveness_video',
        resourceType: 'video',
        allowedMimes: [
          'video/webm',
          'video/mp4',
          'video/quicktime',
          'video/3gpp',
        ],
        allowedExts: ['webm', 'mp4', 'mov', '3gp'],
        maxBytes: 50 * 1024 * 1024,
      };
    }

    throw new BadRequestException('Tipo de documento no permitido');
  }

  private computeMissingDocs(docs: { docType: KycDocumentType }[]) {
    const existing = new Set(docs.map((d) => d.docType));
    return REQUIRED_DOCS.filter((d) => !existing.has(d));
  }

  private buildKycFolder(
    user: { id: string; firstName: string; lastName: string; email: string },
    requestId: string,
  ) {
    const baseName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const fromEmail = user.email?.split('@')[0] ?? '';
    const raw = baseName || fromEmail || '';
    const slug = this.slugify(raw);

    const folderKey = slug ? `${slug}_${user.id}` : user.id;
    return `hunboli/kyc/${folderKey}/${requestId}`;
  }

  private slugify(input: string) {
    if (!input) return '';
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }
}
