import { IsNotEmpty, IsString, IsUUID } from "class-validator";
export class AcceptRequestDto {
    @IsUUID()
    @IsString()
    @IsNotEmpty()
    requestId: string;

}