import type { Role } from './access-policy';
export const BATCH_STAGES = ['CREATED', 'HARVESTED', 'PROCESSED', 'LAB_VERIFIED', 'PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAIL', 'SOLD', 'RECALLED'] as const;
export function custodyStageOptions(current: string, role: Role): string[] {
  if (!BATCH_STAGES.includes(current as typeof BATCH_STAGES[number]) || ['CREATED', 'SOLD', 'RECALLED'].includes(current)) return [];
  const options = [current];
  if (current === 'HARVESTED' && role === 'processor') options.push('PROCESSED');
  if (current === 'PACKAGED') options.push('IN_DISTRIBUTION');
  if (current === 'IN_DISTRIBUTION') options.push('AT_RETAIL');
  if (current === 'AT_RETAIL' && role === 'retailer') options.push('SOLD');
  return options;
}
