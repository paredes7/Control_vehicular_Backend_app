import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CreateRetiroDto } from './dto/create-retiro.dto';
import { RateService } from '../rate/rate.service';
import { MailService } from 'src/mail/mail.service';
@Injectable()
export class RetiroService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private rateService: RateService,
    private mailService: MailService,
  ) { }

  private getComisionMinima(): number {
    return Number(this.config.get('COMISION_MINIMA'));
  }

  private getPorcentajeComision(): number {
    return Number(this.config.get('PORCENTAJE'));
  }


  private getRateBobToBobh(): number {
    return Number(this.config.get('BOB_TO_BOBH'));
  }

  private getrate_source(): string {
    return String(this.config.get('RATE_SOURCE'));
  }

  private getmount_minimo(): number {
    return Number(this.config.get('Monto_Minimo'));
  }

  async create(dto: CreateRetiroDto, userId: string) {

    const referenceCode = `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const monto_minimo = this.getmount_minimo();
    const amount = Number(dto.amount);
    const ratesource = this.getrate_source();

    //mosnto minimo = 100 y amount = 10
    //100 < 10 ? -> no
    //monto minimo =10000 y amount =9000
    //10000 < 9000 ? -> no
    if (monto_minimo > amount) {
      throw new BadRequestException(`El monto es menor a ${monto_minimo} > ${amount} BOBHs`);
    }

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: dto.bankAccountId },
      include: { bank: true },
    });

    if (!bankAccount) {
      throw new NotFoundException('La cuenta bancaria no existe');
    }

    this.validateCurrencyByCountry(dto.currency, bankAccount.bank.country);

    const porcentaje = this.getPorcentajeComision();
    const comisionMinima = this.getComisionMinima();

    const comisionCalculada = Math.max(amount * porcentaje, comisionMinima);
    const totalAmount = amount + comisionCalculada;

    const { rateUsed, fiatSent } = this.calculateConversion(
      dto.currency,
      amount,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.walletAddress) {
      throw new BadRequestException("Usuario sin wallet");
    }



    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const fiatOperation = await tx.fiatOperation.create({
          data: {
            type: 'WITHDRAW',
            userId,
            currency: dto.currency,
            amount,
            feeRate: porcentaje,
            serviceFee: comisionCalculada,
            totalAmount,
            rateUsed,
            rateSource: ratesource,
            rateQuotedAt: dto.rateQuotedAt,
            rateExpiresAt: dto.rateExpiresAt,
            referenceCode,
            status: 'PENDING',
          },
        });

        const withdrawalDetail = await tx.withdrawalDetail.create({
          data: {
            operationId: fiatOperation.id,
            burnedBOBH: totalAmount,
            TxHash: dto.txHash,
            fiatSent,
            bankAccountId: dto.bankAccountId,
          },
        });

        await this.mailService.sendRetiroConfirmationRequest({
          email: user.email,
          bankAccount: bankAccount.accountNumber,
          amount: amount.toString(),
          serviceFee: comisionCalculada.toString(),
          totalAmount: totalAmount.toString(),
          referenceCode,
        });


      return { fiatOperation, withdrawalDetail };
    });

    return {
      success: true,
      fiatOperation: {
        ...result.fiatOperation,
        id: result.fiatOperation.id.toString(),
      },
      withdrawalDetail: {
        ...result.withdrawalDetail,
        operationId: result.withdrawalDetail.operationId.toString(),
        bankAccountId: result.withdrawalDetail.bankAccountId.toString(),
      },
    };
  } catch(error) {
    console.error('Error creando retiro:', error);
    throw error;
  }
}

  private validateCurrencyByCountry(currency: string, country: string) {
  const rules = {
    BOB: 'Bolivia',
    PEN: 'PERU',
  };

  if (rules[currency] && rules[currency] !== country) {
    throw new BadRequestException(
      `La cuenta bancaria es de ${country} y no admite retiros en ${currency}`,
    );
  }
}

  private calculateConversion(currency: string, amount: number) {

  const rateData = this.rateService.GetTipoCambioActual();

  if (!rateData) {
    throw new BadRequestException('Tipo de cambio no disponible');
  }

  if (currency === 'PEN') {
    const rate = rateData.conversion.BOB_PEN.valor;
    // 1 BOB = X PEN
    return {
      rateUsed: rate,
      fiatSent: amount * rate,
    };
  }

  // 1 BOB = X BOBH
  const rate = this.getRateBobToBobh();
  return {
    rateUsed: rate,
    fiatSent: amount,
  };
}
}
