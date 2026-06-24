# AI Betting Recommendation Boundary Specification

This document plans the architectural boundary for future AI-suggested wagers, ensuring traceability, safety, and strict alignment with owner decision gates.

## 1. Safety & Traceability Guidelines

AI recommendations are a deferred feature. To prevent unchecked agentic suggestions, any recommendation candidate must satisfy these rules:
* **Traceability Contract**: Every recommendation must trace directly back to:
  - A valid `PredictionEnvelope` (representing the underlying probability output).
  - An `inputCandidateId` (the match statistics snapshot used as input).
  - The `strategyVersion` (the version of the model engine).
* **No Invented Picks**: The AI must not generate recommendations out of thin air. Suggestions are strictly derived from verified model outcome predictions.
* **No Stake Suggestions**: The AI must not recommend stake sizes or point allocations unless a dedicated, owner-approved bankroll/risk ADR is established.
* **Confidence Labeling**: Recommendations must display a confidence status (`HIGH`, `MEDIUM`, `LOW`, `NEUTRAL`).
* **Refusal Support**: If prediction statistics or inputs are missing, the AI must output a standard refusal message instead of guessing.
* **Approval Required**: Implementing recommendation engines requires an independent, owner-approved ADR before execution.

---

## 2. Open Questions for the Owner

The following parameters require owner decisions before designing the recommendation engine:

* **Q1: Should AI suggest only market direction or also the exact line?**
  * *Recommended Default*: Suggest both the market type (e.g. Over/Under) and the specific line value (e.g. 2.5) to ensure clarity.
* **Q2: Should AI display multiple candidate wagers or only the single highest-value pick?**
  * *Recommended Default*: Display up to three candidate wagers in a carousel, allowing the user to compare.
* **Q3: Should AI rank bets?**
  * *Recommended Default*: Yes, sort by expected confidence level.
* **Q4: Should AI explain why a bet is suggested?**
  * *Recommended Default*: Yes, show a short summary explaining key statistical signals (e.g. "team A averages 3.2 corners at home").
* **Q5: Should AI suggest a "no-bet" option?**
  * *Recommended Default*: Yes. If no value is found, display "No recommendations available".
* **Q6: Should AI ever suggest stake points?**
  * *Recommended Default*: No. In v1, staking is strictly user-controlled.
* **Q7: Should AI consider user betting history when suggesting wagers?**
  * *Recommended Default*: No. Keep wagers focused purely on statistical models in v1 (avoid filter bubbles).
* **Q8: Should AI be allowed to learn the user's style or preferences?**
  * *Recommended Default*: No.
* **Q9: Should AI suggestions be saved automatically to betting history?**
  * *Recommended Default*: No. A suggestion must never auto-populate as a real bet record.
* **Q10: How should the user convert an AI suggestion into a manual bet record?**
  * *Recommended Default*: Provide a "Convert to Bet Record" button that copies the recommendation fields directly into a manual entry form.

---

## 3. Recommended Safe v1 Architecture

For the MVP release, the AI recommendation boundary behaves as follows:
1. **Candidate Recommendation Cards**: AI outputs read-only data cards detailing the proposed bet parameters (Teams, Market, Line, Odds) and its trace metadata.
2. **User Confirmation Gate**: The card is presentational only. Clicking "Track this Bet" opens the manual bet logger pre-filled with the card's values. The user must manually save the wager.
3. **No Automated Betting**: No code path exists to place or save a bet without explicit user action.
