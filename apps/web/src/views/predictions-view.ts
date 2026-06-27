import { getMatches, getPrediction } from '../mock-client.js';

/**
 * Renders the Predictions view displaying upcoming matches and their AI prediction traces.
 *
 * @param {HTMLElement} container
 */
export async function renderPredictionsView(container) {
  container.innerHTML = `
    <h2>Upcoming Matches & Predictions</h2>
    <p style="color: var(--miraichi-text-muted);">View AI model confidence profiles and data pipelines. Completely competition-agnostic.</p>
    <div class="loading" style="padding: 1rem; color: var(--miraichi-primary);">Loading predictions...</div>
  `;
  
  try {
    const matches = await getMatches();
    let html = `
      <h2>Upcoming Matches & Predictions</h2>
      <p style="color: var(--miraichi-text-muted);">View AI model confidence profiles and data pipelines. Completely competition-agnostic.</p>
      <div class="matches-list">
    `;
    
    for (const match of matches) {
      const pred = await getPrediction(match.id);
      
      html += `
        <div class="miraichi-card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--miraichi-primary);">
          <h3 class="miraichi-card-title">${match.homeTeam.name} vs ${match.awayTeam.name}</h3>
          <div class="miraichi-card-body">
            <p><strong>Scheduled:</strong> ${new Date(match.scheduledTime).toLocaleString()}</p>
            <p><strong>Prediction:</strong> <span class="badge" style="background: var(--miraichi-bg); padding: 0.2rem 0.5rem; border-radius: 0.25rem; border: 1px solid var(--miraichi-border); color: var(--miraichi-accent); font-weight: bold;">${pred.predictionOutcome}</span></p>
            <p><strong>Confidence:</strong> ${pred.confidenceLevel} (${(pred.confidenceScore * 100).toFixed(0)}%)</p>
            <details style="margin-top: 1rem;">
              <summary style="cursor: pointer; color: var(--miraichi-primary); font-weight: 500; outline: none;">View Model Trace Metadata (ADR-0006)</summary>
              <pre style="background: #0b0f19; color: #a5b4fc; padding: 0.75rem; border-radius: 0.375rem; font-size: 0.85rem; overflow-x: auto; margin-top: 0.5rem; border: 1px solid var(--miraichi-border);">${JSON.stringify(pred.trace, null, 2)}</pre>
            </details>
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color: var(--miraichi-danger); padding: 1rem;">Failed to load predictions: ${err.message}</div>`;
  }
}
