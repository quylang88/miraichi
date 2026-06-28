import { getBetHistory } from '../mock-client.js';

/**
 * Renders the read-only bet history view.
 *
 * @param {HTMLElement} container
 */
export async function renderBetHistoryPlaceholderView(container: HTMLElement) {
  container.innerHTML = `
    <h2>Betting History (Read-Only)</h2>
    <p style="color: var(--miraichi-text-muted);">Simulated placing logs (Option B Product Boundary). Live placing, bankroll allocation, and risk management are disabled.</p>
    <div class="loading" style="padding: 1rem; color: var(--miraichi-primary);">Loading bet history...</div>
  `;
  
  try {
    const history = await getBetHistory();
    let html = `
      <h2>Betting History (Read-Only)</h2>
      <p style="color: var(--miraichi-text-muted);">Simulated placing logs (Option B Product Boundary). Live placing, bankroll allocation, and risk management are disabled.</p>
      <div class="bets-list">
    `;
    
    for (const bet of history) {
      html += `
        <div class="miraichi-card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--miraichi-secondary);">
          <h3 class="miraichi-card-title">Simulated Bet ID: ${bet.betId}</h3>
          <div class="miraichi-card-body">
            <p><strong>Match ID:</strong> ${bet.matchId}</p>
            <p><strong>Prediction ID:</strong> ${bet.predictionId}</p>
            <p><strong>Selected Market:</strong> ${bet.selectedMarket}</p>
            <p><strong>Simulated Amount:</strong> $${bet.amount.toFixed(2)}</p>
            <p><strong>Placed Odds:</strong> ${bet.placedOdds.toFixed(2)}</p>
            <p><strong>Status:</strong> <span class="badge" style="background: var(--miraichi-bg); padding: 0.2rem 0.5rem; border-radius: 0.25rem; border: 1px solid var(--miraichi-border); color: var(--miraichi-primary);">${bet.status}</span></p>
            <p><strong>Placed At:</strong> ${new Date(bet.placedAt).toLocaleString()}</p>
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color: var(--miraichi-danger); padding: 1rem;">Failed to load bet history: ${err instanceof Error ? err.message : String(err)}</div>`;
  }
}
