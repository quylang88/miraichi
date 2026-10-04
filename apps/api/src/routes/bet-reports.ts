import type { IncomingMessage, ServerResponse } from 'node:http';
import { isValidIanaTimeZone } from '@miraichi/shared';
import { buildBetReport, type BetReportPeriod } from '../services/bet-report-service.js';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';

export async function handleBetReports(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  if(req.method!=='GET')return sendError(res,405,'method_not_allowed','Method not allowed.');
  const url=new URL(req.url??'/', 'http://localhost');
  const period=String(url.searchParams.get('period')??'week') as BetReportPeriod;
  const anchor=String(url.searchParams.get('anchor')??'');
  const accountId=url.searchParams.get('accountId')??undefined;
  const startDate=url.searchParams.get('startDate')??undefined;
  const endDate=url.searchParams.get('endDate')??undefined;
  const requestedTimeZone=url.searchParams.get('timeZone')??undefined;
  const validPeriods:BetReportPeriod[]=['this_week','previous_week','this_month','all','custom','week','month'];
  if(!validPeriods.includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(anchor))return sendError(res,400,'invalid_report_query','A valid period and anchor date are required.');
  if(requestedTimeZone!==undefined&&!isValidIanaTimeZone(requestedTimeZone))return sendError(res,400,'invalid_report_query','timeZone must be a valid IANA timezone.');
  if(period==='custom'){
    if(!startDate||!endDate||!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||startDate>endDate){
      return sendError(res,400,'invalid_report_query','A valid start and end date are required for custom period.');
    }
  }
  try{
    const config=await deps.adapter.getDisciplineConfig(deps.ownerProfileId);
    const timeZone=config?.timeZone??requestedTimeZone;
    if(!timeZone)return sendError(res,400,'invalid_report_query','A validated owner timezone is required when discipline preferences are unavailable.');
    const [bets,events]=await Promise.all([deps.adapter.listBetRecords(deps.ownerProfileId),deps.adapter.listBetSettlementEvents(deps.ownerProfileId)]);
    return sendJson(res,200,buildBetReport({period,anchor,timeZone,weekStartDay:config?.weekStartDay??'monday',...(startDate&&endDate?{customRange:{startDate,endDate}}:{}),bets,events,...(accountId?{accountId}:{})}));
  }catch(error){mapCloudError(res,error);}
}
