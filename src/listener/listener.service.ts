// src/listener/event-listener.service.ts
// ─────────────────────────────────────────────────────────────
// Escucha eventos del smart contract HUNBOLI cada 10 segundos.
//
// FLUJO:
//   1. onModuleStart → lee el último bloque procesado de la BD
//   2. Si hay bloques nuevos → getLogs() obtiene los eventos
//   3. Cada evento se guarda en EventLog (audit trail)
//   4. Se envía al EventProcessorService para lógica de dominio
//   5. lastProcessedBlock se actualiza solo si todo salió bien
//      → si falla, se reintentan los mismos bloques en el siguiente ciclo
//
// POR QUÉ polling con getLogs y no watchContractEvent:
//   - getLogs + lastProcessedBlock es más robusto ante restarts
//   - No se pierde ningún evento si la app cae entre bloques
//   - El retry es automático: simplemente no avanzan el puntero
// ─────────────────────────────────────────────────────────────
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {Cron,CronExpression} from '@nestjs/schedule';
import { createPublicClient, http, type Address, type Chain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { PrismaService } from '../../prisma/prisma.service';
import { BOBH_EVENTS_ABI, EVENT_NAME_TO_TYPE } from './abi/bobh.abi';
import { EventProcessorService } from './processors/event-processor.service';
import {ContractEventType}from '@prisma/client'
// Alchemy Free tier solo permite 10 bloques por petición
// Alchemy PAYG/Growth permite hasta 2000 bloques
const BLOCK_BATCH_SIZE = 10n;

// Mapeo de CHAIN_ID a objetos Chain de viem
const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
};

@Injectable()
export class ListenerService implements OnModuleInit{
  private readonly logger = new Logger(ListenerService.name);
  private publicClient;
  private contractAddress: Address;
  //Ultimo bloque a leer
  private lastProcessedBlock: bigint = 0n;
  private isInitialized = false;
  private isProcessing = false; // Lock para evitar ejecuciones concurrentes
  private listenerEnabled = false; // Flag para habilitar/deshabilitar el listener

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private eventProcessor: EventProcessorService,
  ){
    this.contractAddress = this.configService.get<string>('CONTRACT_ADDRESS') as Address;

    // Leer si el listener está habilitado desde .env
    this.listenerEnabled = this.configService.get<string>('LISTENER_ENABLED') === 'true';

    // Obtener chain desde .env en lugar de hardcodear
    const chainId = parseInt(this.configService.get<string>('CHAIN_ID') || '11155111');
    const chain = CHAIN_MAP[chainId];

    if (!chain) {
      throw new Error(`Chain ID ${chainId} no soportado. Cadenas disponibles: ${Object.keys(CHAIN_MAP).join(', ')}`);
    }

    this.publicClient= createPublicClient({
      chain,
      transport: http(this.configService.get<string>('RPC_URL'))
    })
  }

  async onModuleInit() {
    if (!this.listenerEnabled) {
      this.logger.warn('⏸️  Event Listener DESHABILITADO (LISTENER_ENABLED=false en .env)');
      return;
    }

    this.logger.log('🔊 Event Listener iniciando...');
    await this.restoreLastBlock();

    // Inicializar estado de pausa del contrato
    await this.eventProcessor.initializePausedState(this.publicClient, this.contractAddress);

    this.isInitialized = true;
    this.logger.log(`📍 Último bloque procesado: ${this.lastProcessedBlock}`);
    // No llamamos pollEvents() aquí → el cron lo hará automáticamente cada 10 segundos
  }

  private async restoreLastBlock(){
    const lastLog =await this.prisma.eventLog.findFirst({
      orderBy:{blockNumber: 'desc'}
    });
    if(lastLog){
      // Retomar desde donde quedamos
      this.lastProcessedBlock = BigInt(lastLog.blockNumber);
      this.logger.log(`📦 Retomando desde bloque ${this.lastProcessedBlock} (último evento en BD)`);
    }else{
      // Primera vez ever → usar CONTRACT_DEPLOY_BLOCK de .env
      // Si no está definido, empezar desde 0 (lento pero seguro)
      const deployBlock = this.configService.get<string>('CONTRACT_DEPLOY_BLOCK') || '0';
      this.lastProcessedBlock = BigInt(deployBlock);
      this.logger.log(`🆕 Sin historial en BD. Comenzando desde bloque ${this.lastProcessedBlock}`);
    }

  }

    // ─── POLLER PRINCIPAL (cada 10 segundos) ───────────────────
  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollEvents() {
    if (!this.listenerEnabled || !this.isInitialized || this.isProcessing) return;

    this.isProcessing = true;
    try {
      const currentBlock = await this.publicClient.getBlockNumber();

      // Nada nuevo
      if (this.lastProcessedBlock >= currentBlock) return;

      this.logger.debug(
        `🔍 Scanning bloques: ${this.lastProcessedBlock + 1n} → ${currentBlock}`,
      );

      // ── Procesamos en batches para no exceder el límite del RPC ──
      let fromBlock = this.lastProcessedBlock + 1n;

      while (fromBlock <= currentBlock) {
        const toBlock =
          fromBlock + BLOCK_BATCH_SIZE - 1n < currentBlock
            ? fromBlock + BLOCK_BATCH_SIZE - 1n
            : currentBlock;

        const logs = await this.publicClient.getLogs({
          address: this.contractAddress,
          events: BOBH_EVENTS_ABI,
          fromBlock,
          toBlock,
        });

        if (logs.length > 0) {
          this.logger.log(`📥 ${logs.length} evento(s) en bloques ${fromBlock}-${toBlock}`);
        }

        // Procesar cada log en orden cronológico
        for (const log of logs) {
          await this.processLog(log);
        }

        fromBlock = toBlock + 1n;
      }

      // ✅ Todo procesado sin error → avanzar el puntero
      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      this.logger.error('❌ Error en pollEvents:', error.stack || error.message);
      // NO actualizamos lastProcessedBlock → automáticamente se reinten en el siguiente ciclo
    } finally {
      this.isProcessing = false;
    }
  }
  // ─── PROCESAR UN SOLO LOG ───────────────────────────────────
  private async processLog(log: any) {
    const eventName = log.eventName as string;
    if (!eventName) return;

    // Mapear nombre del evento a enum de Prisma
    const eventType = EVENT_NAME_TO_TYPE[eventName] as ContractEventType;
    if (!eventType) {
      this.logger.warn(`⚠️ Evento no mapeado: ${eventName}`);
      return;
    }

    // ── FILTRO ESPECIAL: solo Transfer P2P (usuario → usuario) ──
    if (eventType === 'TRANSFER') {
      const { from, to } = log.args;
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

      // Ignorar si es mint (from = 0x0)
      if (from.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        return;
      }

      // Ignorar si es burn (to = 0x0)
      if (to.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        return;
      }

      // Ignorar si involucra al contrato (requestRedemption o rejectRedemption)
      const contractAddress = this.contractAddress.toLowerCase();
      if (from.toLowerCase() === contractAddress || to.toLowerCase() === contractAddress) {
        return;
      }

      // ✅ Es una transferencia P2P legítima → continuar
    }

    // Normalizar los campos que vamos a guardar en EventLog
    const fields = this.extractFields(log.args, eventName);

    try {
      // ─── 1. GUARDAR EN EventLog (siempre, es el audit trail) ───
      const savedEvent = await this.prisma.eventLog.create({
        data: {
          eventType ,
          txHash:        log.transactionHash,
          blockNumber:   BigInt(log.blockNumber),
          logIndex:      log.logIndex,
          userAddress:   fields.userAddress,
          fromAddress:   fields.fromAddress,
          toAddress:     fields.toAddress,
          amount:        fields.amount?.toString() ?? null,
          rawData:       this.serializeBigInts(log.args),
          // processedAt se pone después de que el processor termine
        },
      });

      this.logger.log(
        `💾 [${eventType}] guardado | tx=${log.transactionHash.slice(0, 12)}... | bloque=${log.blockNumber}`,
      );

      // ─── 2. ENVIAR AL PROCESSOR para lógica de dominio ─────────
      await this.eventProcessor.process(eventType, savedEvent, log);

      // ─── 3. MARCAR COMO PROCESADO ───────────────────────────────
      await this.prisma.eventLog.update({
        where: { id: savedEvent.id },
        data: { processedAt: new Date() },
      });

    } catch (error) {
      // P2002 = unique constraint → el evento ya existe en BD (duplicate)
      // Pasa si el app se reinicia en medio de un batch ya procesado
      if (error.code === 'P2002') {
        this.logger.debug(`⏭️  Evento duplicado, skipped: tx=${log.transactionHash} logIndex=${log.logIndex}`);
        return;
      }
      // Cualquier otro error → re-throw para detener el batch
      // (no avanzan lastProcessedBlock y se reinten todo el rango)
      this.logger.error(`❌ Error procesando [${eventName}]:`, error.message);
      throw error;
    }
  }
  // ─── EXTRAER CAMPOS COMUNES POR TIPO DE EVENTO ─────────────
  // Cada evento tiene args con nombres distintos.
  // Aquí los normalizamos para guardarlos en EventLog de forma uniforme.
  private extractFields(args: any, eventName: string) {
    switch (eventName) {
      case 'Minted':
        // event Minted(address indexed minter, address indexed to, uint256 amount)
        return { userAddress: args.to,      fromAddress: args.minter, toAddress: args.to,   amount: args.amount };

      case 'Burned':
        // event Burned(address indexed burner, address indexed from, uint256 amount)
        return { userAddress: args.from,    fromAddress: args.burner, toAddress: null,      amount: args.amount };

      case 'RedemptionRequested':
      case 'RedemptionFinalized':
      case 'RedemptionRejected':
      case 'Confiscated':
        // event X(address indexed user, uint256 amount)
        return { userAddress: args.user,    fromAddress: null,        toAddress: null,      amount: args.amount };

      case 'SystemPaused':
      case 'SystemUnpaused':
        // event X(address indexed account)
        return { userAddress: null,         fromAddress: args.account,toAddress: null,      amount: null };

      case 'AddedToBlacklist':
      case 'RemovedFromBlacklist':
        // event X(address indexed account, address indexed by)
        return { userAddress: args.account, fromAddress: args.by,     toAddress: null,      amount: null };

      case 'TokensRecovered':
        // event TokensRecovered(address indexed token, address indexed to, uint256 amount)
        return { userAddress: null,         fromAddress: args.token,  toAddress: args.to,   amount: args.amount };

      default:
        return { userAddress: null, fromAddress: null, toAddress: null, amount: null };
    }
  }

  // ─── SERIALIZAR BigInt → string para JSON ──────────────────
  private serializeBigInts(obj: any): any {
    return JSON.parse(
      JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  // ─── STATUS PÚBLICO (para el controller) ───────────────────
  getStatus() {
    return {
      enabled:            this.listenerEnabled,
      isRunning:          this.isInitialized,
      lastProcessedBlock: this.lastProcessedBlock.toString(),
      contractAddress:    this.contractAddress,
    };
  }

}
