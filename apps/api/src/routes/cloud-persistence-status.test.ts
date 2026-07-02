import { describe, expect, it } from 'vitest';
import { createCloudPersistenceAdapter } from '../persistence/create-cloud-persistence-adapter.js';
import { handleCloudPersistenceStatus } from './cloud-persistence-status.js';

function responseMock() { return { statusCode: 0, body: '', writeHead(code:number){this.statusCode=code;}, end(body?:unknown){this.body=String(body??'');} }; }
describe('cloud persistence status route', () => {
  it('reports disabled persistence honestly', async () => {
    const response=responseMock();
    await handleCloudPersistenceStatus({method:'GET'} as never,response as never,{adapter:createCloudPersistenceAdapter({mode:'disabled',appEnv:'local',ownerProfileId:'owner-primary'}),ownerProfileId:'owner-primary'});
    expect(response.statusCode).toBe(200); expect(JSON.parse(response.body).state).toBe('unconfigured');
  });
});
