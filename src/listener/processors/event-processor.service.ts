// src/event-listener/processors/event-processor.service.ts
// ─────────────────────────────────────────────────────────────
// Recibe cada evento ya guardado en EventLog y ejecuta la lógica
// de dominio correspondiente:
//
//   Minted              → enlaza con DepositDetail, marca operación como PROCESSED
//   Burned              → log de auditoría (la lógica real está en Finalized/Confiscated)
//   RedemptionRequested → registra que el usuario envió tokens al contrato
//   RedemptionFinalized → enlaza con WithdrawalDetail, activa pago bancario
//   RedemptionRejected  → marca operación como REJECTED
//   Confiscated         → crea BlacklistEntry con montos confiscados
//   SystemPaused        → setea flag global de pausa
//   SystemUnpaused      → limpia flag global de pausa
//   AddedToBlacklist    → setea KycStatus=BLACKLISTED, crea BlacklistEntry
//   RemovedFromBlacklist→ revierte KycStatus, crea BlacklistEntry
//   TokensRecovered     → solo audit log, sin lógica extra
// ─────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { formatUnits, type PublicClient, type Address } from 'viem';
import { PrismaService } from '../../../prisma/prisma.service';
import { BOBH_READ_ABI } from '../abi/bobh.abi';

@Injectable()
export class EventProcessorService {
    private readonly logger = new Logger(EventProcessorService.name);

    // ─── Estado global de pausa (en memoria) ───
    // Se inicializa leyendo el contrato al arrancar la app (ver ContractStateService).
    // Los eventos SystemPaused/Unpaused lo actualizan en tiempo real.
    private isPaused = false;

    constructor(private prisma: PrismaService) { }

    // ─── ROUTER: distribuye al método correcto según eventType ──
    async process(eventType: string, savedEvent: any, rawLog: any) {
        switch (eventType) {
            case 'MINTED': await this.onMinted(rawLog); break;
            case 'BURNED': await this.onBurned(rawLog); break;
            case 'REDEMPTION_REQUESTED': await this.onRedemptionRequested(rawLog); break;
            case 'REDEMPTION_FINALIZED': await this.onRedemptionFinalized(rawLog); break;
            case 'REDEMPTION_REJECTED': await this.onRedemptionRejected(rawLog); break;
            case 'CONFISCATED': await this.onConfiscated(rawLog); break;
            case 'SYSTEM_PAUSED': await this.onSystemPaused(rawLog); break;
            case 'SYSTEM_UNPAUSED': await this.onSystemUnpaused(rawLog); break;
            case 'ADDED_TO_BLACKLIST': await this.onAddedToBlacklist(rawLog); break;
            case 'REMOVED_FROM_BLACKLIST': await this.onRemovedFromBlacklist(rawLog); break;
            case 'TOKENS_RECOVERED': this.logger.log(`🔄 TokensRecovered logged`); break;
            case 'TRANSFER': await this.onTransfer(rawLog); break;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MINTED
    // ═══════════════════════════════════════════════════════════════
    // El Safe ejecutó mint() → los BOBH ya están en la wallet del usuario.
    // Necesitamos enlazar la transacción con el DepositDetail correspondiente.
    //
    // Cómo encontrar el DepositDetail correcto:
    //   - args.to = wallet address del usuario
    //   - Buscamos el usuario por walletAddress
    //   - Buscamos su DepositDetail más antiguo donde mintTxHash = null
    //     (FIFO: si tiene varios depósitos pendientes, el primero en cola)
    private async onMinted(log: any) {
        const { to, amount } = log.args;
        const humanAmount = formatUnits(amount, 6);
        this.logger.log(`🪙 MINTED: ${humanAmount} BOBH → ${to}`);

        // 1. Buscar usuario por wallet
        const user = await this.prisma.user.findFirst({
            where: { walletAddress: to },
        });
        if (!user) {
            this.logger.warn(`⚠️ Minted: no hay usuario con wallet ${to}`);
            return;
        }

        // 2. Buscar el DepositDetail pendiente (sin mintTxHash, más antiguo primero)
        const depositDetail = await this.prisma.depositDetail.findFirst({
            where: {
                mintTxHash: null,                        // Aún no enlazado a un mint tx
                operation: {
                    userId: user.id,
                    type: 'DEPOSIT',
                    status: 'APPROVED',                   // Solo operaciones aprobadas
                },
            },
            orderBy: { safeProposedAt: 'asc' },       // FIFO
        });

        if (!depositDetail) {
            this.logger.warn(`⚠️ Minted: no hay DepositDetail pendiente para ${user.id}`);
            return;
        }

        // 3. Actualizar DepositDetail con el tx hash real del mint
        await this.prisma.depositDetail.update({
            where: { id: depositDetail.id },
            data: {
                mintTxHash: log.transactionHash,
                mintedAt: new Date(),
            },
        });

        // 4. Marcar la FiatOperation como PROCESSED
        await this.prisma.fiatOperation.update({
            where: { id: depositDetail.operationId },
            data: {
                status: 'PROCESSED',
                processedAt: new Date(),
            },
        });

        this.logger.log(`✅ DepositDetail ${depositDetail.id} → enlazado al mint | Operación PROCESSED`);
    }

    // ═══════════════════════════════════════════════════════════════
    // BURNED
    // ═══════════════════════════════════════════════════════════════
    // Evento de auditoría puro. Se emite junto con RedemptionFinalized
    // o Confiscated. La lógica real está en esos processors.
    private async onBurned(log: any) {
        const { from, amount } = log.args;
        this.logger.log(`🔥 BURNED: ${formatUnits(amount, 6)} BOBH | from=${from}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // REDEMPTION_REQUESTED
    // ═══════════════════════════════════════════════════════════════
    // El usuario llamó requestRedemption() on-chain directamente.
    // Sus tokens ya fueron transferidos al contrato (en custodia).
    // El backend debe crear/actualizar la operación de retiro.
    private async onRedemptionRequested(log: any) {
        const { user, amount } = log.args;
        const humanAmount = formatUnits(amount, 6);
        this.logger.log(`📤 REDEMPTION_REQUESTED: ${humanAmount} BOBH | usuario=${user}`);

        // Buscar el usuario
        const existingUser = await this.prisma.user.findFirst({
            where: { walletAddress: user },
        });
        if (!existingUser) {
            this.logger.warn(`⚠️ RedemptionRequested: no hay usuario con wallet ${user}`);
            return;
        }

        // Buscar si ya hay una FiatOperation WITHDRAW pendiente sin WithdrawalDetail
        // Si existe → simplemente loggeamos (la operación ya fue creada desde el frontend)
        // Si no existe → alguien llamó directamente al contrato (edge case)
        const pendingOp = await this.prisma.fiatOperation.findFirst({
            where: {
                userId: existingUser.id,
                type: 'WITHDRAW',
                status: 'PENDING',
                withdrawal: null,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (pendingOp) {
            this.logger.log(`📝 Retiro pendiente encontrado: operación ${pendingOp.id} | esperando validación del admin`);
        } else {
            // Edge case: el usuario llamó requestRedemption() sin crear operación desde el app.
            // Solo loggeamos → el admin puede ver esto en el dashboard y actuar.
            this.logger.warn(
                `⚠️ RedemptionRequested sin operación previa | wallet=${user} | monto=${humanAmount} | ` +
                `Revisar en el panel de administración`
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // REDEMPTION_FINALIZED
    // ═══════════════════════════════════════════════════════════════
    // El Safe ejecutó finalizeRedemption() → los tokens ya fueron quemados.
    // Ahora el backend debe:
    //   1. Enlazar el WithdrawalDetail con el burn tx
    //   2. Disparar el pago bancario (transferencia de BOB al usuario)
    private async onRedemptionFinalized(log: any) {
        const { user, amount } = log.args;
        this.logger.log(`✅ REDEMPTION_FINALIZED: ${formatUnits(amount, 6)} BOBH | usuario=${user}`);

        const existingUser = await this.prisma.user.findFirst({
            where: { walletAddress: user },
        });
        if (!existingUser) return;

        // Buscar el WithdrawalDetail que espera el burn (sin burnTxHash, más antiguo)
        const withdrawal = await this.prisma.withdrawalDetail.findFirst({
            where: {
                TxHash: null,                        // Aún no se ejecutó el burn
                operation: {
                    userId: existingUser.id,
                    type: 'WITHDRAW',
                },
            },
            orderBy: { createdAt: 'asc' },            // FIFO
        });

        if (!withdrawal) {
            this.logger.warn(`⚠️ RedemptionFinalized: no hay WithdrawalDetail pendiente para ${user}`);
            return;
        }

        // 1. Enlazar con el tx hash del burn
        await this.prisma.withdrawalDetail.update({
            where: { id: withdrawal.id },
            data: {
                TxHash: log.transactionHash,
                burnedAt: new Date(),
            },
        });

        // 2. Actualizar FiatOperation
        await this.prisma.fiatOperation.update({
            where: { id: withdrawal.operationId },
            data: {
                status: 'PROCESSED',
                processedAt: new Date(),
            },
        });

        this.logger.log(`✅ WithdrawalDetail ${withdrawal.id} → burn enlazado`);

        // ─── 🏦 SIGUIENTE PASO: pago bancario ─────────────────────
        // Aquí se dispararía el servicio que hace la transferencia bancaria real.
        // Ejemplo:
        //   await this.bankPaymentService.initiatePayment(withdrawal.operationId);
        //
        // Por ahora solo loggeamos que está listo para pagar.
        this.logger.log(`🏦 [TODO] Operación ${withdrawal.operationId} → lista para pago bancario`);
    }

    // ═══════════════════════════════════════════════════════════════
    // REDEMPTION_REJECTED
    // ═══════════════════════════════════════════════════════════════
    // El Safe ejecutó rejectRedemption() → tokens devueltos al usuario.
    // No hay burn. La operación se marca como REJECTED.
    private async onRedemptionRejected(log: any) {
        const { user, amount } = log.args;
        this.logger.log(`❌ REDEMPTION_REJECTED: ${formatUnits(amount, 6)} BOBH devueltos a ${user}`);

        const existingUser = await this.prisma.user.findFirst({
            where: { walletAddress: user },
        });
        if (!existingUser) return;

        // Buscar la operación pendiente
        const withdrawal = await this.prisma.withdrawalDetail.findFirst({
            where: {
                TxHash: null,
                operation: {
                    userId: existingUser.id,
                    type: 'WITHDRAW',
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        if (withdrawal) {
            await this.prisma.fiatOperation.update({
                where: { id: withdrawal.operationId },
                data: { status: 'REJECTED' },
            });
            this.logger.log(`📝 Operación ${withdrawal.operationId} marcada como REJECTED`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFISCATED
    // ═══════════════════════════════════════════════════════════════
    // El Safe ejecutó confiscate() → todos los tokens del usuario fueron quemados.
    // Crear BlacklistEntry con los montos detallados.
    private async onConfiscated(log: any) {
        const { user, amount } = log.args;
        this.logger.log(`🚨 CONFISCATED: ${formatUnits(amount, 6)} BOBH | usuario=${user}`);

        const existingUser = await this.prisma.user.findFirst({
            where: { walletAddress: user },
        });
        if (!existingUser) return;

        // Crear registro de confiscación
        // Nota: amount total viene del evento. El desglose wallet/pending
        // se puede obtener del rawData de los EventLog asociados si es necesario.
        await this.prisma.blacklistEntry.create({
            data: {
                userId: existingUser.id,
                action: 'CONFISCATED',
                reason: 'Confiscación ejecutada on-chain por BLACKLIST_MANAGER_ROLE',
                actionBy: 'SYSTEM',
                isCurrentlyBlocked: true,
                executionTxHash: log.transactionHash,
                // Si necesitas el desglose exacto, se puede leer del contrato
                // leyendo los campos walletBalance y pendingAmount antes del confiscate
            },
        });

        this.logger.log(`🚨 BlacklistEntry CONFISCATED creado para usuario ${existingUser.id}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM_PAUSED
    // ═══════════════════════════════════════════════════════════════
    // El contrato está pausado → ninguna transferencia funciona.
    // Actualizar flag global y notificar admins.
    private async onSystemPaused(log: any) {
        this.isPaused = true;
        this.logger.log(`⏸️  SISTEMA PAUSADO | ejecutor=${log.args.account} | tx=${log.transactionHash}`);

        // 🔔 TODO: Notificar a todos los admins
        //    await this.notificationService.notifyAdmins('emergencia', 'El contrato fue pausado');
    }

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM_UNPAUSED
    // ═══════════════════════════════════════════════════════════════
    private async onSystemUnpaused(log: any) {
        this.isPaused = false;
        this.logger.log(`▶️  SISTEMA REANUDADO | ejecutor=${log.args.account} | tx=${log.transactionHash}`);

        // 🔔 TODO: Notificar a todos los admins
    }

    // ═══════════════════════════════════════════════════════════════
    // ADDED_TO_BLACKLIST
    // ═══════════════════════════════════════════════════════════════
    // Un usuario fue agregado a la lista negra on-chain.
    // 1. Cambiar KycStatus del usuario a BLACKLISTED
    // 2. Crear BlacklistEntry con action=ADDED
    private async onAddedToBlacklist(log: any) {
        const { account, by } = log.args;
        this.logger.log(`🚫 ADDED_TO_BLACKLIST: ${account} | por=${by}`);

        const user = await this.prisma.user.findFirst({
            where: { walletAddress: account },
        });
        if (!user) {
            this.logger.warn(`⚠️ AddedToBlacklist: no hay usuario con wallet ${account}`);
            return;
        }

        // 1. Bloquear usuario
        await this.prisma.user.update({
            where: { id: user.id },
            data: { kycStatus: 'BLACKLISTED' },
        });

        // 2. Crear entrada en historial
        await this.prisma.blacklistEntry.create({
            data: {
                userId: user.id,
                action: 'ADDED',
                actionBy: 'SYSTEM',           // 'by' es la dirección on-chain del admin
                isCurrentlyBlocked: true,
                executionTxHash: log.transactionHash,
                // reason se puede pre-rellenar desde el panel admin cuando se crea la propuesta Safe
                reason: null,
            },
        });

        this.logger.log(`🚫 Usuario ${user.id} bloqueado | KycStatus → BLACKLISTED`);
    }

    // ═══════════════════════════════════════════════════════════════
    // REMOVED_FROM_BLACKLIST
    // ═══════════════════════════════════════════════════════════════
    // El usuario fue removido de la lista negra.
    // 1. Revertir KycStatus a VERIFIED
    // 2. Marcar la entrada anterior como isCurrentlyBlocked=false
    // 3. Crear nueva entrada con action=REMOVED
    private async onRemovedFromBlacklist(log: any) {
        const { account, by } = log.args;
        this.logger.log(`✅ REMOVED_FROM_BLACKLIST: ${account} | por=${by}`);

        const user = await this.prisma.user.findFirst({
            where: { walletAddress: account },
        });
        if (!user) return;

        // 1. Desbloquear usuario
        await this.prisma.user.update({
            where: { id: user.id },
            data: { kycStatus: 'VERIFIED' },
        });

        // 2. Marcar la entrada activa como inactiva
        await this.prisma.blacklistEntry.updateMany({
            where: {
                userId: user.id,
                isCurrentlyBlocked: true,
            },
            data: { isCurrentlyBlocked: false },
        });

        // 3. Crear nueva entrada REMOVED
        await this.prisma.blacklistEntry.create({
            data: {
                userId: user.id,
                action: 'REMOVED',
                actionBy: 'SYSTEM',
                isCurrentlyBlocked: false,
                executionTxHash: log.transactionHash,
            },
        });

        this.logger.log(`✅ Usuario ${user.id} desbloqueado | KycStatus → VERIFIED`);
    }

    // ─── GETTERS del estado de pausa (para otros servicios) ──────
    getIsPaused(): boolean {
        return this.isPaused;
    }

    setIsPaused(value: boolean) {
        this.isPaused = value;
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSFER (P2P entre usuarios)
    // ═══════════════════════════════════════════════════════════════
    // Solo se procesa si es una transferencia directa usuario → usuario.
    // Ya filtrado en listener.service.ts (no mint, no burn, no redemption).
    private async onTransfer(log: any) {
        const { from, to, value } = log.args;
        const humanAmount = formatUnits(value, 6);
        this.logger.log(`💸 TRANSFER P2P: ${humanAmount} BOBH | de ${from} → ${to}`);

        // Aquí puedes agregar lógica adicional si necesitas:
        // - Detectar transferencias sospechosas
        // - Validar límites de transferencia
        // - Notificar al usuario
        // - etc.

        // Por ahora solo loggeamos (el evento ya está guardado en EventLog)
    }

    // ─── INICIALIZAR estado de pausa desde el contrato ────────────
    async initializePausedState(publicClient: PublicClient, contractAddress: Address) {
        try {
            const paused = await publicClient.readContract({
                address: contractAddress,
                abi: BOBH_READ_ABI,
                functionName: 'paused',
            });
            this.isPaused = paused as boolean;
            this.logger.log(`🔄 Estado de pausa inicializado: ${this.isPaused ? '⏸️  PAUSADO' : '▶️  ACTIVO'}`);
        } catch (error) {
            this.logger.error('❌ Error al leer estado de pausa del contrato:', error.message);
            // En caso de error, asumir no pausado por defecto (fail-safe)
            this.isPaused = false;
        }
    }
}