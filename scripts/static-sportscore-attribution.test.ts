import { describe, expect, it } from 'vitest';
import { getIndexHtml } from '../apps/web/src/index.js';
import { verifyStaticSportScoreAttribution } from './static-sportscore-attribution.js';

describe('static SportScore attribution', () => {
  it('requires exactly one crawler-visible exact contract link in server HTML', () => {
    expect(verifyStaticSportScoreAttribution(getIndexHtml())).toEqual([]);
  });

  it('rejects duplicates, dynamic placeholders, and wrong link attributes', () => {
    const wrong = '<body><div id="app-root"></div><a href="https://sportscore.com/" rel="nofollow">Powered by SportScore</a><script>document.write("Powered by SportScore")</script></body>';
    expect(verifyStaticSportScoreAttribution(wrong)).toEqual(expect.arrayContaining([
      'missing_exact_static_link',
      'invalid_attribution_count'
    ]));
  });
});
