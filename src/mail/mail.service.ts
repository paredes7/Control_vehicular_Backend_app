import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { StringToBytesOpts } from 'viem';
import { Subject } from 'rxjs';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) { }

  // ========================================================
  // COMO CREAR UN NUEVO EMAIL:
  // 1. Copia cualquier .hbs de src/mail/templates/
  // 2. Cambia el titulo (h2), el texto y el boton
  // 3. Crea una funcion aqui abajo siguiendo el mismo patron
  // Las variables que pongas en context: {} las usas en el .hbs con {{variable}}
  // Es obligatorio  siempre poner el year y el subject si no se rompera layout del email dinamico
  // ========================================================

  async sendPasswordReset(email: string, resetLink: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Recuperación de contraseña',
      template: 'password-reset',
      context: {
        subject: 'Recuperación de contraseña',
        url: resetLink,
        year: new Date().getFullYear(),
      },
    });
  }

  async sendRetiroConfirmationRequest(data: {
    email: string;
    bankAccount: string;
    amount: string;
    serviceFee: string;
    totalAmount: string;
    referenceCode: string;
  }) {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Hemos recibido tu solicitud de retiro',
        template: 'retiro-pending',
        context: {
          bankAccount: data.bankAccount,
          subject: 'Hemos recibido tu solicitud de retiro',
          amount: data.amount,
          serviceFee: data.serviceFee,
          totalAmount: data.totalAmount,
          referenceCode: data.referenceCode,
          year: new Date().getFullYear(),
        },
      });
    } catch (error) {
      console.log(error);
    }
  }



  async sendRetiroConfirmation(
    payoutTxRef: string | undefined,
    email: string,
    bankAccount: string,
    proofUrl?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Cancelación en cuenta exitosa',
        template: 'retiro-confirmation',
        context: {
          payoutTxRef: payoutTxRef ?? 'No especificado',
          subject: 'Cancelación en cuenta exitosa',
          bankAccount,
          proofUrl: proofUrl ?? null,
          year: new Date().getFullYear(),
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendRetiroRejected(
    payoutTxRef: string | undefined,
    email: string,
    bankAccount: string,
    totalAmount?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Retiro Rechazado',
        template: 'retiro-reject',
        context: {
          payoutTxRef: payoutTxRef ?? 'No especificado',
          subject: 'Retiro Rechazado',
          bankAccount,
          totalAmount: totalAmount ?? null,
          year: new Date().getFullYear(),
        },
      });
    } catch (error) {
      console.log(error);
    }
  }



  async send6DigitCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Código de verificación - HUNBOLI',
      template: 'verification-code',
      context: {
        subject: 'Código de verificación - HUNBOLI',
        code,
        year: new Date().getFullYear(),
      },
    });
  }
}
