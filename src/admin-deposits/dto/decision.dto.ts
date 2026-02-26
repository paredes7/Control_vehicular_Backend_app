import { IsEnum } from 'class-validator';

export enum AdminDecisionAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class AdminDecisionDto {
  @IsEnum(AdminDecisionAction)
  action: AdminDecisionAction;
}
