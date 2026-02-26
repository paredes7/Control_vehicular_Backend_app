import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { VerificationStatus } from '@prisma/client';

@Injectable()
export class VerificationService {

  constructor(private prisma: PrismaService,
    private readonly cloudinary: CloudinaryService
  ) { }


  async createRequest(userId: string, file: Express.Multer.File) {
    const uploadResult = await this.cloudinary.uploadVerificationFile({ file, userId });
    return await this.prisma.verification_requests.create({
      data: {
        userId,
        imageUrl: uploadResult.secureUrl,
        cloudinaryPublicId: uploadResult.publicId,
        status: 'PENDING'
      }
    });
  }

  async findPendingRequests() {
    return this.prisma.verification_requests.findMany({
      where: { status: 'PENDING' },
      include: {
        users: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
  }
  async findRequestsByParam(param: VerificationStatus) {
    return this.prisma.verification_requests.findMany({
      where: { status: param },
      include: {
        users: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
  }

  async acceptPendingRequest(requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.verification_requests.findUnique({ where: { id: requestId } });

      if (!request) throw new NotFoundException("Solicitud no encontrada");
      if (request.status !== 'PENDING') {
        throw new BadRequestException("La solicitud ya fue procesada");
      }

      await tx.user.update({
        where: { id: request.userId },
        data: { isVerified: true }
      });

      return tx.verification_requests.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      });
    });
  }

  async rejectPendingRequest(requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.verification_requests.findUnique({ where: { id: requestId } });

      if (!request) throw new NotFoundException("Solicitud no encontrada");
      if (request.status !== 'PENDING') {
        throw new BadRequestException("La solicitud ya fue procesada");
      }

      await tx.user.update({
        where: { id: request.userId },
        data: { isVerified: false }
      });

      return tx.verification_requests.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      });
    });
  }
  async getQuantity() {
    const data = await this.findPendingRequests();
    return { quantity: data.length };
  }


  findAll() {
    return this.prisma.verification_requests.findMany({
      include: {
        users: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
  }

  findOne(requestId: string) {
    return this.prisma.verification_requests.findUnique({
      where: { id: requestId },
      include: {
        users: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
  }

  async findStatusByUserId(id: string) {
    const data = await this.prisma.verification_requests.findFirst({
      where: { userId: id }
    })
    if (!data) throw new NotFoundException("Solicitud de verificacion no encontrada");
    return data

  }

  update(id: number, updateVerificationDto: UpdateVerificationDto) {
    return `This action updates a #${id} verification`;
  }

  remove(requestId: string) {
    return this.prisma.verification_requests.delete({ where: { id: requestId } });
  }
}
