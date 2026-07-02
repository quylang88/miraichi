import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendJson } from './cloud-route-types.js';
export async function handleCloudPersistenceStatus(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  if(req.method!=='GET') return sendJson(res,405,{error:{code:'method_not_allowed',message:'Method not allowed.'}});
  try{sendJson(res,200,await deps.adapter.getStatus());}catch(error){mapCloudError(res,error);}
}
