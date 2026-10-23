export const DASHBOARD_RETURN_HEADER='x-pollinator-dashboard-return';
export function safeDashboardReturn(value:string|null|undefined):string{
 if(!value||value.length>2048||/[\x00-\x20\\]/.test(value)||!value.startsWith('/')||value.startsWith('//'))return '/dashboard';
 try{
  const target=new URL(value,'https://internal.invalid');
  if(target.origin!=='https://internal.invalid'||!/^\/dashboard(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(target.pathname)||target.pathname.startsWith('/dashboard/login'))return '/dashboard';
  return target.pathname+target.search+target.hash;
 }catch{return '/dashboard';}
}
export function dashboardLoginPath(value:string|null|undefined){const target=safeDashboardReturn(value);return target==='/dashboard'?'/dashboard/login':'/dashboard/login?next='+encodeURIComponent(target);}
