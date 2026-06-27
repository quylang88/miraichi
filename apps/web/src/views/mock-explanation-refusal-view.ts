/**
 * mock-explanation-refusal-view.js
 * Renders the mock explanation refusal view.
 * Displays explanationAvailable status, reason, trace references, and refusal text verbatim.
 * Strictly excludes any speculative wagers or chatbot advice.
 */

import { getMockPrediction, getMockExplanation } from '../mock-client.js';

export async function renderMockExplanationRefusalView(container) {
  container.innerHTML = `
    <h2>Local AI Explanation Refusal View</h2>
    <div style="background: var(--miraichi-bg-card); border: 1px solid var(--miraichi-border); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
      <p style="color: var(--miraichi-text-muted);">This view displays how the natural language mediation layer refuses to speculate when predictions are unavailable.</p>
    </div>
    <div class="loading" style="padding: 1rem; color: var(--miraichi-primary);">Generating mock explanation refusal...</div>
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
    // 1. Get mock envelope
    const envelope = await getMockPrediction(inputCandidate);

    // 2. Request mock explanation
    const explanation = await getMockExplanation(envelope);

    container.innerHTML = `
      <h2>Local AI Explanation Refusal View</h2>
      <div style="background: var(--miraichi-bg-card); border: 1px solid var(--miraichi-border); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
        <p style="color: var(--miraichi-text-muted); margin: 0;">This view displays how the natural language mediation layer refuses to speculate when predictions are unavailable.</p>
      </div>

      <div class="miraichi-card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--miraichi-danger);">
        <h3 class="miraichi-card-title">LLM Explainer Output</h3>
        <div class="miraichi-card-body">
          <p><strong>Explanation Available:</strong> <span style="font-weight: bold; color: var(--miraichi-danger);">${explanation.explanationAvailable}</span></p>
          <p><strong>Refusal Reason:</strong> ${explanation.reason}</p>
          
          <div style="margin-top: 1rem; padding: 1rem; background: var(--miraichi-bg); border: 1px solid var(--miraichi-border); border-radius: 0.375rem; color: var(--miraichi-accent); font-style: italic;">
            "${explanation.text || explanation.reason}"
          </div>

          <div style="margin-top: 1.5rem; border-top: 1px solid var(--miraichi-border); padding-top: 1rem;">
            <strong>Traceability References:</strong>
            <ul style="margin: 0.5rem 0 0 0; padding-left: 1.2rem; font-size: 0.9rem; color: var(--miraichi-text-muted);">
              <li><strong>Prediction ID:</strong> <code>${explanation.references.predictionId || 'n/a'}</code></li>
              <li><strong>Trace ID (Input Candidate):</strong> <code>${explanation.references.traceId || 'n/a'}</code></li>
            </ul>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color: var(--miraichi-danger); padding: 1rem;">Failed to load explanation refusal: ${err.message}</div>`;
  }
}
