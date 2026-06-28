import { sendChatQuery } from '../mock-client.js';

/**
 * Renders the AI Explanation chat component.
 *
 * @param {HTMLElement} container
 */
export function renderExplanationView(container: HTMLElement) {
  container.innerHTML = `
    <h2>AI Prediction Explanations</h2>
    <p style="color: var(--miraichi-text-muted);">Ask the statistical assistant to explain confidence results. (ADR-0007 Refusal Rule applies).</p>
    
    <div class="miraichi-card" style="margin-bottom: 1.5rem; border: 1px solid var(--miraichi-border);">
      <div class="miraichi-card-body">
        <label for="chat-pred-id" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Select Prediction ID</label>
        <select id="chat-pred-id" style="width: 100%; padding: 0.5rem; background: var(--miraichi-bg); color: var(--miraichi-text); border: 1px solid var(--miraichi-border); border-radius: 0.25rem; margin-bottom: 1rem;">
          <option value="pred_2026_9999">pred_2026_9999 (Team A vs Team B)</option>
          <option value="pred_2026_9998">pred_2026_9998 (Team C vs Team D)</option>
        </select>
        
        <label for="chat-message" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Your Message</label>
        <textarea id="chat-message" rows="3" style="width: 100%; padding: 0.5rem; background: var(--miraichi-bg); color: var(--miraichi-text); border: 1px solid var(--miraichi-border); border-radius: 0.25rem; margin-bottom: 1rem; font-family: inherit;" placeholder="Ask why the model made this prediction, or ask an out-of-scope question (e.g. 'What is the recipe for pizza?') to test refusal limits."></textarea>
        
        <button id="chat-submit-btn" class="miraichi-btn">Ask AI Assistant</button>
      </div>
    </div>
    
    <div id="chat-response-container" style="margin-top: 1.5rem;"></div>
  `;
  
  const submitBtn = container.querySelector('#chat-submit-btn') as HTMLButtonElement | null;
  submitBtn?.addEventListener('click', async () => {
    const predId = (container.querySelector('#chat-pred-id') as HTMLInputElement | null)?.value || '';
    const message = (container.querySelector('#chat-message') as HTMLInputElement | null)?.value || '';
    const responseContainer = container.querySelector('#chat-response-container');
    
    if (!message.trim()) return;
    
    if (responseContainer) responseContainer.innerHTML = '<div style="color: var(--miraichi-primary); padding: 1rem;">Generating response...</div>';
    
    try {
      const response = await sendChatQuery(predId, message);
      
      const isRefused = response.trace && response.trace.refusalCheck && !response.trace.refusalCheck.passed;
      const borderClr = isRefused ? 'var(--miraichi-danger)' : 'var(--miraichi-accent)';
      
      if (responseContainer) responseContainer.innerHTML = `
        <div class="miraichi-card" style="border-left: 4px solid ${borderClr};">
          <h3 class="miraichi-card-title">${isRefused ? 'Refusal Notice (Safety Out-of-Scope)' : 'Assistant Reply'}</h3>
          <div class="miraichi-card-body">
            <p>${response.reply}</p>
            <details style="margin-top: 1rem;">
              <summary style="cursor: pointer; color: var(--miraichi-primary); font-size: 0.9rem;">Trace & Safety Audit Envelope (ADR-0007)</summary>
              <pre style="background: #0b0f19; color: #a5b4fc; padding: 0.75rem; border-radius: 0.375rem; font-size: 0.85rem; overflow-x: auto; margin-top: 0.5rem; border: 1px solid var(--miraichi-border);">${JSON.stringify(response.trace, null, 2)}</pre>
            </details>
          </div>
        </div>
      `;
    } catch (err) {
      if (responseContainer) responseContainer.innerHTML = `<div style="color: var(--miraichi-danger); padding: 1rem;">Error communicating with AI: ${err instanceof Error ? err.message : String(err)}</div>`;
    }
  });
}
