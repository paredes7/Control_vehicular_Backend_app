import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { MetaTransactionData, OperationType } from '@safe-global/types-kit';
import { ethers } from 'ethers';

@Injectable()
export class SafeService implements OnModuleInit {
  private readonly logger = new Logger(SafeService.name);

  private proposerPrivateKey: string;
  private rpcUrl: string;
  private chainId: bigint;
  private contractAddress: string;
  private safeAddress: string;
  private txServiceUrl: string;
  private safeApiKey: string;
  private mintInterface: ethers.utils.Interface;

  constructor(private readonly config: ConfigService) {
    this.safeApiKey = this.config.get<string>('SAFE_API_KEY') ?? '';
    if (!this.safeApiKey) {
      throw new Error('SAFE_API_KEY no está configurado');
    }
  }

  onModuleInit() {
    this.proposerPrivateKey = this.config.getOrThrow<string>('PROPOSER_PRIVATE_KEY');
    this.rpcUrl = this.config.getOrThrow<string>('RPC_URL');
    this.chainId = BigInt(this.config.getOrThrow<string>('CHAIN_ID'));
    this.contractAddress = this.config.getOrThrow<string>('CONTRACT_ADDRESS');
    this.safeAddress = this.config.getOrThrow<string>('SAFE_ADDRESS');
    this.txServiceUrl = this.config.get<string>('SAFE_TX_SERVICE_URL') ?? '';
    if (!this.txServiceUrl) {
      throw new Error('SAFE_TX_SERVICE_URL no está configurado');
    }
    this.logger.log(`Safe txServiceUrl: ${this.txServiceUrl}`);

    this.mintInterface = new ethers.utils.Interface([
      'function mint(address to, uint256 amount)',
      'function finalizeRedemption(address user, uint256 amount)',
      'function rejectRedemption(address user, uint256 amount)',
    ]);

    this.safeApiKey = this.config.get<string>('SAFE_API_KEY') ?? '';
    if (!this.safeApiKey) {
      throw new Error('SAFE_API_KEY no está configurado');
    }

    const wallet = new ethers.Wallet(this.proposerPrivateKey);
    this.logger.log(`Safe service initialized. Proposer: ${wallet.address}, Safe: ${this.safeAddress}`);
  }

  private buildApiKit() {
    return new SafeApiKit({
      chainId: BigInt(this.chainId),
      txServiceUrl: this.txServiceUrl,
      apiKey: this.safeApiKey,
    });
  }

  async getSafeTxExecution(
    safeTxHash: string,
  ): Promise<{ executed: boolean; txHash: string | null; executionDate: string | null }> {
    const apiKit = this.buildApiKit();
    const tx = await apiKit.getTransaction(safeTxHash);
    return {
      executed: !!tx.isExecuted && !!tx.transactionHash,
      txHash: tx.transactionHash ?? null,
      executionDate: tx.executionDate ?? null,
    };
  }

  /**
   * Propone una transaccion mint() en la Safe Multisig.
   * @param to Direccion de la wallet destino (usuario)
   * @param amount Cantidad de BOBH como string decimal (ej: "100.50")
   * @returns safeTxHash de la propuesta creada
   */ 
  async proposeMintTransaction(to: string, amount: string): Promise<string> {
    const amountParsed = ethers.utils.parseUnits(amount, 6);
    const data = this.mintInterface.encodeFunctionData('mint', [to, amountParsed]);

    this.logger.log(
      `Proposing mint: to=${to}, amount=${amount} BOBH (${amountParsed.toString()} raw)`,
    );

    return this.proposeContractTransaction(data);
  }

  /**
   * Propone finalizeRedemption(user, amount) en la Safe Multisig.
   * Esto quema los tokens en custodia y completa el retiro.
   */
  async proposeFinalizeRedemptionTransaction(user: string, amount: string): Promise<string> {
    const amountParsed = ethers.utils.parseUnits(amount, 6);
    const data = this.mintInterface.encodeFunctionData('finalizeRedemption', [user, amountParsed]);

    this.logger.log(
      `Proposing finalizeRedemption: user=${user}, amount=${amount} BOBH (${amountParsed.toString()} raw)`,
    );

    return this.proposeContractTransaction(data);
  }

  /**
   * Propone rejectRedemption(user, amount) en la Safe Multisig.
   * Esto devuelve los tokens al usuario y cancela el retiro.
   */
  async proposeRejectRedemptionTransaction(user: string, amount: string): Promise<string> {
    const amountParsed = ethers.utils.parseUnits(amount, 6);
    const data = this.mintInterface.encodeFunctionData('rejectRedemption', [user, amountParsed]);

    this.logger.log(
      `Proposing rejectRedemption: user=${user}, amount=${amount} BOBH (${amountParsed.toString()} raw)`,
    );

    return this.proposeContractTransaction(data);
  }

  /**
   * Logica comun: crea, firma y propone una transaccion Safe con calldata al contrato HUNBOLI.
   */
  private async proposeContractTransaction(data: string): Promise<string> {
    const protocolKit = await Safe.init({
      provider: this.rpcUrl,
      signer: this.proposerPrivateKey,
      safeAddress: this.safeAddress,
    });

    const txData: MetaTransactionData = {
      to: this.contractAddress,
      value: '0',
      data,
      operation: OperationType.Call,
    };

    const safeTransaction = await protocolKit.createTransaction({
      transactions: [txData],
    });

    const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
    const signature = await protocolKit.signHash(safeTxHash);

    const apiKit = this.buildApiKit();
    const proposerWallet = new ethers.Wallet(this.proposerPrivateKey);

    await apiKit.proposeTransaction({
      safeAddress: this.safeAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress: proposerWallet.address,
      senderSignature: signature.data,
      origin: 'HUNBOLI Backend',
    });

    this.logger.log(`Transaction proposed successfully. safeTxHash=${safeTxHash}`);
    return safeTxHash;
  }
}
