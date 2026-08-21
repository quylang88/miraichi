import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildBetReport, type BetReportPeriod } from '../services/bet-report-service.js';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';

export async function handleBetReports(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  if(req.method!=='GET')return sendError(res,405,'method_not_allowed','Method not allowed.');
  const url=new URL(req.url??'/', 'http://localhost');const period=String(url.searchParams.get('period')??'week') as BetReportPeriod;const anchor=String(url.searchParams.get('anchor')??'');const accountId=url.searchParams.get('accountId')??undefined;
  if(!['week','month','previous_month','all'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(anchor))return sendError(res,400,'invalid_report_query','A valid period and anchor date are required.');
  try{const config=await deps.adapter.getDisciplineConfig(deps.ownerProfileId);if(!config)return sendError(res,409,'discipline_config_required','Configure a reporting timezone first.');const [bets,events]=await Promise.all([deps.adapter.listBetRecords(deps.ownerProfileId),deps.adapter.listBetSettlementEvents(deps.ownerProfileId)]);return sendJson(res,200,buildBetReport({period,anchor,timeZone:config.timeZone,bets,events,...(accountId?{accountId}:{})}));}catch(error){mapCloudError(res,error);}
}
