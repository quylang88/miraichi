import { describe, expect, it } from 'vitest';
import { getCloudPersistenceViewState } from './cloud-persistence-service.js';
describe('cloud persistence service',()=>{
  it('maps ready and unconfigured states',async()=>{const ready=await getCloudPersistenceViewState(async()=>new Response(JSON.stringify({state:'ready'}),{status:200}));expect(ready).toEqual({status:'ready'});const missing=await getCloudPersistenceViewState(async()=>new Response(JSON.stringify({state:'unconfigured',message:'Setup required'}),{status:200}));expect(missing).toEqual({status:'unavailable',reason:'Setup required'});});
  it('maps failed requests to unavailable',async()=>{expect(await getCloudPersistenceViewState(async()=>new Response('',{status:503}))).toMatchObject({status:'unavailable'});});
});
