// src/event-listener/abi/bobh.abi.ts
// ─────────────────────────────────────────────────────────────
// ABI de los 11 eventos de MyStableCoin (HUNBOLI).
// Fuente: CONTRATO_INTELIGENTE lines 23-40
// Se usa en getLogs() y watchContractEvent() de Viem.
// ─────────────────────────────────────────────────────────────

import { parseAbi } from 'viem';

export const BOBH_EVENTS_ABI = parseAbi([
    // ── Redención
    'event RedemptionRequested(address indexed user, uint256 amount)',
    'event RedemptionFinalized(address indexed user, uint256 amount)',
    'event RedemptionRejected(address indexed user, uint256 amount)',

    // ── Auditoría
    'event Minted(address indexed minter, address indexed to, uint256 amount)',
    'event Burned(address indexed burner, address indexed from, uint256 amount)',
    'event Confiscated(address indexed user, uint256 amount)',
    'event SystemPaused(address indexed account)',
    'event SystemUnpaused(address indexed account)',
    'event AddedToBlacklist(address indexed account, address indexed by)',
    'event RemovedFromBlacklist(address indexed account, address indexed by)',
    'event TokensRecovered(address indexed token, address indexed to, uint256 amount)',

    // ── ERC20 Estándar (solo Transfer P2P entre usuarios)
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// ABI para funciones de lectura del contrato
export const BOBH_READ_ABI = parseAbi([
    'function paused() view returns (bool)',
]);

// ─────────────────────────────────────────────────────────────
// Mapeo: nombre del evento (Solidity) → enum ContractEventType (Prisma)
// ─────────────────────────────────────────────────────────────
export const EVENT_NAME_TO_TYPE: Record<string, string> = {
    Minted: 'MINTED',
    Burned: 'BURNED',
    RedemptionRequested: 'REDEMPTION_REQUESTED',
    RedemptionFinalized: 'REDEMPTION_FINALIZED',
    RedemptionRejected: 'REDEMPTION_REJECTED',
    Confiscated: 'CONFISCATED',
    SystemPaused: 'SYSTEM_PAUSED',
    SystemUnpaused: 'SYSTEM_UNPAUSED',
    AddedToBlacklist: 'ADDED_TO_BLACKLIST',
    RemovedFromBlacklist: 'REMOVED_FROM_BLACKLIST',
    TokensRecovered: 'TOKENS_RECOVERED',
    Transfer: 'TRANSFER', // Solo se guarda si es P2P (usuario a usuario)
};