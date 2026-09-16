import { fetchMatchDetail, type MatchDetailViewState } from '../../services/match-detail-service.js';

export async function retryAutomaticSettlementEvidence(input: {
  readonly matchId: string;
  readonly fetchDetail?: typeof fetchMatchDetail;
  readonly reloadBets: () => Promise<void>;
}): Promise<MatchDetailViewState['status']> {
  const request = input.fetchDetail ?? fetchMatchDetail;
  try {
    return (await request(input.matchId, { refresh: true })).status;
  } finally {
    await input.reloadBets();
  }
}
