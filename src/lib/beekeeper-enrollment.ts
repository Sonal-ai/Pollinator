import {ethers} from 'ethers';
import {Prisma,type PrismaClient} from '@prisma/client';
import type {ChainTransport} from './chain/transport';
import {normalizeLoginIdentifier,normalizePhone} from './identity';
import {assertDeployment,deploymentConfig} from './deployment/identity';

export class BeekeeperEnrollmentError extends Error{}
type EnrollmentInput={identifier:string;beekeeperId:string;walletAddress:string;passwordHash:string};

// Trusted operator CLI only. Never expose as a self-service role/account endpoint.
export async function enrollBeekeeperAccount(db:PrismaClient,chain:Pick<ChainTransport,'context'|'registry'|'assertContext'>,input:EnrollmentInput){
 const identifier=normalizeLoginIdentifier(input.identifier);
 if(!identifier||!input.beekeeperId||!ethers.isAddress(input.walletAddress)||input.walletAddress.toLowerCase()===ethers.ZeroAddress||!/^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(input.passwordHash))throw new BeekeeperEnrollmentError('Use a valid identity, beekeeper, wallet and generated password hash.');
 const walletAddress=input.walletAddress.toLowerCase(),context=await chain.context(),registry=chain.registry(context);
 if(process.env.HONEYCHAIN_CLUSTER_MODE==='isolated')await assertDeployment(db,deploymentConfig());
 const hashes=[ethers.ZeroHash,...['BEEKEEPER','LAB','PROCESSOR','DISTRIBUTOR','RETAILER'].map(role=>ethers.id(role+'_ROLE'))];
 const assigned=await Promise.all(hashes.map(role=>registry.hasRole(role,walletAddress)));
 if(!assigned[1]||assigned.some((value,index)=>index!==1&&value))throw new BeekeeperEnrollmentError('The wallet must hold only the beekeeper operational role and no administrator role on the configured registry.');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${walletAddress},0))::text`;
  await tx.$queryRaw`SELECT "id" FROM "Beekeeper" WHERE "id"=${input.beekeeperId} FOR UPDATE`;
  const farmer=await tx.beekeeper.findUnique({where:{id:input.beekeeperId}});
  if(!farmer)throw new BeekeeperEnrollmentError('The beekeeper profile must already exist.');
  if(identifier.startsWith('+')&&normalizePhone(farmer.phone)!==identifier)throw new BeekeeperEnrollmentError('The phone identity must match the beekeeper profile.');
  if(farmer.wallet&&farmer.wallet.toLowerCase()!==walletAddress)throw new BeekeeperEnrollmentError('This profile already has another wallet. Wallet replacement requires separate migration review.');
  if(!farmer.wallet&&await tx.honeyBatch.count({where:{beekeeperId:farmer.id}}))throw new BeekeeperEnrollmentError('An unbound profile with historical batches needs migration review before wallet enrollment.');
  if(await tx.beekeeper.findFirst({where:{id:{not:farmer.id},wallet:{equals:walletAddress,mode:'insensitive'}},select:{id:true}}))throw new BeekeeperEnrollmentError('This wallet is already linked to another beekeeper.');
  const existing=await tx.dashboardAccount.findUnique({where:{identifier}});
  if(existing&&(existing.role!=='beekeeper'||existing.beekeeperId!==farmer.id||existing.walletAddress.toLowerCase()!==walletAddress))throw new BeekeeperEnrollmentError('This login identity is already assigned to another account binding.');
  const conflicts=await tx.dashboardAccount.findFirst({where:{...(existing?{id:{not:existing.id}}:{}),OR:[{walletAddress:{equals:walletAddress,mode:'insensitive'}},{beekeeperId:farmer.id}]},select:{id:true}});
  if(conflicts)throw new BeekeeperEnrollmentError('This wallet or beekeeper already belongs to another login account.');
  await chain.assertContext(context);
  if(!farmer.wallet)await tx.beekeeper.update({where:{id:farmer.id},data:{wallet:walletAddress}});
  return tx.dashboardAccount.upsert({where:{identifier},create:{identifier,role:'beekeeper',walletAddress,beekeeperId:farmer.id,passwordHash:input.passwordHash},
   update:{passwordHash:input.passwordHash,active:true,sessionVersion:{increment:1}},select:{id:true,role:true}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:3000,timeout:15000});
}
