import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
export interface CloudRouteDependencies { adapter: CloudPersistenceAdapter; ownerProfileId: string; now?: () => Date }
export function sendJson(res: import('http').ServerResponse, status: number, payload: unknown): void { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(payload)); }
export function sendError(res: import('http').ServerResponse, status: number, code: string, message: string): void { sendJson(res,status,{error:{code,message}}); }
export function mapCloudError(res: import('http').ServerResponse, error: unknown): void {
  const value=error as {code?:string;message?:string};
  if(value.code==='cloud_persistence_unconfigured') return sendError(res,503,'cloud_persistence_unconfigured','Cloud persistence is not configured.');
  sendError(res,503,'cloud_persistence_unavailable','Cloud persistence is unavailable.');
}
