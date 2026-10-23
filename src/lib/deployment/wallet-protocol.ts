import {ethers} from 'ethers';
import {z} from 'zod';

export const ACTOR_ROLES=['beekeeper','lab','processor','distributor','retailer'] as const;
const address=z.string().refine(value=>ethers.isAddress(value)&&value.toLowerCase()!==ethers.ZeroAddress,'Use a valid nonzero wallet address').transform(value=>ethers.getAddress(value).toLowerCase());
export const EnrollmentSchema=z.object({relayer:address,actors:z.object({beekeeper:address,lab:address,processor:address,distributor:address,retailer:address}).strict()}).strict();
export type Enrollment=z.infer<typeof EnrollmentSchema>;
export function validateEnrollment(input:unknown,administrator:string):Enrollment{
 const plan=EnrollmentSchema.parse(input),all=[administrator.toLowerCase(),plan.relayer,...ACTOR_ROLES.map(role=>plan.actors[role])];
 if(new Set(all).size!==all.length)throw new DeploymentError('Administrator, relayer and every actor need distinct addresses.',422);
 return plan;
}
export class DeploymentError extends Error{constructor(message:string,readonly status=409){super(message);}}
export const DeploymentActionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('PREPARE')}).strict(),
 z.object({action:z.literal('CANCEL')}).strict(),
 z.object({action:z.literal('BEGIN'),stepId:z.string().max(100)}).strict(),
 z.object({action:z.literal('REJECTED'),stepId:z.string().max(100)}).strict(),
 z.object({action:z.literal('RECONCILE'),stepId:z.string().max(100),txHash:z.string().regex(/^0x[a-fA-F0-9]{64}$/)}).strict(),
 z.object({action:z.literal('REFRESH')}).strict(),
 z.object({action:z.literal('RETRY_FAILED'),stepId:z.string().max(100)}).strict(),
 z.object({action:z.literal('EXPORT')}).strict(),
]);
export type DeploymentAction=z.infer<typeof DeploymentActionSchema>;
