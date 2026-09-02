import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXACT_LINK = '<a href="https://sportscore.com/" rel="dofollow" title="Sports data by SportScore">Powered by SportScore</a>';

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

export function verifyStaticSportScoreAttribution(html: string): string[] {
  const findings: string[] = [];
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '');
  if (count(withoutScripts, EXACT_LINK) !== 1) findings.push('missing_exact_static_link');
  if (count(html, 'Powered by SportScore') !== 1
    || count(html, 'href="https://sportscore.com/"') !== 1) findings.push('invalid_attribution_count');
  if (!withoutScripts.includes('data-static-provider-attribution="sportscore"')) {
    findings.push('missing_static_footer');
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = readFileSync('apps/web/dist/index.html', 'utf8');
  const findings = verifyStaticSportScoreAttribution(html);
  if (findings.length > 0) {
    console.error(JSON.stringify({ status: 'failed', findings }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: 'passed', attribution: 'sportscore-static-exact' }, null, 2));
  }
}
