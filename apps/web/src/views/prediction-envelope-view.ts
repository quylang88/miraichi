/**
 * prediction-envelope-view.ts
 * Renders the prediction envelope details view.
 * Displays predictionAvailable status, engineMode, outputSummary, warnings,
 * and trace elements. Strictly excludes betting tips, picks, or bankroll metrics.
 */

import { getMockPrediction } from '../mock-client.js';

export async function renderPredictionEnvelopeView(container) {
  container.innerHTML = `
    <h2>Local AI Prediction Envelope View</h2>
    <div style="background: var(--miraichi-bg-card); border: 1px solid var(--miraichi-border); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
      <p style="color: var(--miraichi-text-muted);">This view displays the standard traceable prediction output envelope from the mock prediction engine.</p>
    </div>
    <div class="loading" style="padding: 1rem; color: var(--miraichi-primary);">Fetching mock prediction envelope...</div>
  `;

  const inputCandidate = {
    inputCandidateId: 'input-candidate-alpha-001',
    matchId: 'match-alpha-001',
    competitionId: 'competition-alpha',
    seasonId: 'season-alpha-2026',
    sourceProviderId: 'provider-mock-alpha',
    ingestedAt: new Date().toISOString(),
    freshnessStatus: 'fresh',
    validationStatus: 'passed',
    availableMarkets: ['1X2'],
    dataQualityIssues: [],
    trace: {
      workerRunId: 'run-alpha-001',
      adapterVersion: '1.0.0-mock'
    }
  };

  try {
    const envelope = await getMockPrediction(inputCandidate);

    let warningsHtml = '<em>None</em>';
    if (envelope.warnings && envelope.warnings.length > 0) {
      warningsHtml = `<ul style="margin: 0; padding-left: 1.2rem; color: var(--miraichi-danger);">
        ${envelope.warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>`;
    }

    container.innerHTML = `
      <h2>Local AI Prediction Envelope View</h2>
      <div style="background: var(--miraichi-bg-card); border: 1px solid var(--miraichi-border); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
        <p style="color: var(--miraichi-text-muted); margin: 0;">This view displays the standard traceable prediction output envelope from the mock prediction engine.</p>
      </div>

      <div style="background: var(--miraichi-bg-alert-info, rgba(59, 130, 246, 0.1)); border: 1px solid var(--miraichi-primary); color: var(--miraichi-text); padding: 1rem; border-radius: 0.375rem; margin-bottom: 1.5rem; font-weight: 500;">
        ⚠️ Mock Mode Active: No prediction algorithm is currently active. Showing trace telemetry only.
      </div>

      <div class="miraichi-card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--miraichi-primary);">
        <h3 class="miraichi-card-title">Prediction Status: ${envelope.predictionId}</h3>
        <div class="miraichi-card-body">
          <p><strong>Match Reference:</strong> ${envelope.matchId}</p>
          <p><strong>Competition Reference:</strong> ${envelope.competitionId} (${envelope.seasonId})</p>
          <p><strong>Inference Engine Mode:</strong> <span class="badge" style="background: var(--miraichi-bg); border: 1px solid var(--miraichi-border); padding: 0.2rem 0.5rem; border-radius: 0.25rem;">${envelope.engineMode}</span></p>
          <p><strong>Prediction Available:</strong> <span style="font-weight: bold; color: ${envelope.predictionAvailable ? 'var(--miraichi-success)' : 'var(--miraichi-danger)'};">${envelope.predictionAvailable}</span></p>
          <p><strong>Confidence Label:</strong> <code>${envelope.confidenceLabel}</code></p>
          <p><strong>Summary Details:</strong> ${envelope.outputSummary}</p>
          
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--miraichi-bg); border: 1px solid var(--miraichi-border); border-radius: 0.375rem;">
            <strong>Data Lineage Warnings:</strong>
            <div style="margin-top: 0.5rem;">${warningsHtml}</div>
          </div>

          <details style="margin-top: 1.5rem;">
            <summary style="cursor: pointer; color: var(--miraichi-primary); font-weight: 500; outline: none;">View Lineage Trace Metadata</summary>
            <pre style="background: #0b0f19; color: #a5b4fc; padding: 0.75rem; border-radius: 0.375rem; font-size: 0.85rem; overflow-x: auto; margin-top: 0.5rem; border: 1px solid var(--miraichi-border);">${JSON.stringify(envelope.trace, null, 2)}</pre>
          </details>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color: var(--miraichi-danger); padding: 1rem;">Failed to load mock prediction envelope: ${err.message}</div>`;
  }
}
