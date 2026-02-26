import { IsString } from "class-validator";


export class LinkWalletDto {
    @IsString()
    walletAddress: string;
    @IsString()
    password: string;
}