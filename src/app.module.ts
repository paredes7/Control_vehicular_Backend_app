import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TestModule } from './test/test.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { readFileSync } from 'fs';
import * as Handlebars from 'handlebars';

// Registrar layout base para emails (se usa en cada template con {{#> base}} ... {{/base}})
Handlebars.registerPartial(
  'base',
  readFileSync(join(__dirname, 'mail', 'templates', 'layouts', 'base.hbs'), 'utf8'),
);
import { MailModule } from './mail/mail.module';
import { BanksModule } from './banks/banks.module';
import { RatesModule } from './rates/rates.module';
import { DepositsModule } from './deposits/deposits.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { CompanyBankAccountsModule } from './company-bank-accounts/company-bank-accounts.module';
import { AdminDepositsModule } from './admin-deposits/admin-deposits.module';
import { RetiroModule } from './retiro/retiro.module';
import { VerificationModule } from './verification/verification.module';
import { RateModule } from './rate/rate.module';
import { AdminRetirosModule } from './admin-retiros/admin-retiros.module';
import { JobsModule } from './jobs/jobs.module';
import { ListenerModule } from './listener/listener.module';
import { KycModule } from './kyc/kyc.module';
import { HistorialRetiroModule } from './historial-retiro/historial-retiro.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { P2PModule } from './p2-p/p2-p.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que ConfigModule esté disponible en toda la app(osea traer varibales de entorno)
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TestModule,
    UsersModule,
    AuthModule,
    MailerModule.forRoot({
      transport: {
        host: process.env.EMAIL_HOST,
        port: 587, // 465 para SSL, 587 para TLS
        secure: false, // true para 465, false para otros
        auth: {
          user: process.env.EMAIL_USER, // ⚠️ Poner esto en .env
          pass: process.env.EMAIL_PASS, // ⚠️ NO es tu pass normal (leer nota abajo)
        },
      },
      defaults: {
        from: '"No Reply" <noreply@tuapp.com>',
      },
      template: {
        dir: join(__dirname,'mail','templates'), // Carpeta donde guardas los HTML
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    MailModule,
    BanksModule,
    RatesModule,
    DepositsModule,
    BankAccountsModule,
    CompanyBankAccountsModule,
    AdminDepositsModule,
    RetiroModule,
    VerificationModule,
    RateModule,
    AdminRetirosModule,
    JobsModule,
    ListenerModule,
    KycModule,
    HistorialRetiroModule,
    ExchangeRateModule,
    P2PModule,
    CacheModule.register({ isGlobal: true }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
