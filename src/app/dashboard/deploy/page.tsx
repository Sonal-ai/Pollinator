import {requireSession} from '@/lib/auth';
import {DeploymentView} from './deployment-view';
export const dynamic='force-dynamic';
export default async function DeployPage(){await requireSession(['admin']);return <DeploymentView/>;}
