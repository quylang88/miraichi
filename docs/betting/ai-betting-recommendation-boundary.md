# AI Betting Recommendation Boundary Specification

This document plans the owner-applied architectural boundary for future AI-suggested wagers, ensuring traceability, safety, and strict alignment with owner decision gates.

## 1. Safety & Traceability Guidelines

AI recommendations are a deferred feature. To prevent unchecked agentic suggestions, any future recommendation candidate must satisfy these owner-applied rules:
* **Read-Only Cards**: AI recommendations should appear as read-only recommendation cards.
* **Manual Conversion Only**: AI must not auto-create bet records. The user must manually press Add to Journal.
* **Traceability When Available**: Recommendation cards must include trace references when available, such as `predictionTraceId` and `recommendationId`.
* **No Stake Suggestions in v1**: AI must not suggest stake in v1.
* **No Ranking or Real Confidence Claims Yet**: AI must not rank bets or claim real confidence until the prediction algorithm is approved.
* **No-Bet / Refusal Support**: AI must support a no-bet/refusal state.
* **No Invented Picks**: AI must not invent picks when `predictionAvailable` is false.
* **Approval Required**: Implementing recommendation engines requires an independent, owner-approved ADR before execution.

---

## 2. Open Questions for the Owner

The owner applied the following decisions for future card planning:

* **Q1: Should AI suggest only market direction or also the exact line?**
  * *Owner-applied boundary*: Suggested market, line, and selection are allowed future card content only after prediction ADR approval.
* **Q2: Should AI display multiple candidate wagers or only the single highest-value pick?**
  * *Owner-applied boundary*: Ranking and real confidence claims are not allowed until the prediction algorithm is approved.
* **Q3: Should AI rank bets?**
  * *Owner-applied boundary*: No ranking in v1 before prediction approval.
* **Q4: Should AI explain why a bet is suggested?**
  * *Owner-applied boundary*: Explanation is allowed future card content only after prediction ADR approval.
* **Q5: Should AI suggest a "no-bet" option?**
  * *Owner-applied boundary*: Yes. Support no-bet/refusal state.
* **Q6: Should AI ever suggest stake points?**
  * *Owner-applied boundary*: No stake suggestion in v1.
* **Q7: Should AI consider user betting history when suggesting wagers?**
  * *Owner-applied boundary*: No bankroll-based recommendation in v1.
* **Q8: Should AI be allowed to learn the user's style or preferences?**
  * *Owner-applied boundary*: Deferred until a future owner decision.
* **Q9: Should AI suggestions be saved automatically to betting history?**
  * *Owner-applied boundary*: No auto-save and no auto-bet.
* **Q10: How should the user convert an AI suggestion into a manual bet record?**
  * *Owner-applied boundary*: User must manually press Add to Journal.

---

## 3. Recommended Safe v1 Architecture

For future planning, the AI recommendation boundary behaves as follows:
1. **Candidate Recommendation Cards**: AI outputs read-only data cards. Allowed future card content after prediction ADR approval includes suggested market, suggested line, suggested selection, explanation, `predictionTraceId`, and `recommendationId`.
2. **User Confirmation Gate**: The card is presentational only. Clicking "Track this Bet" opens the manual bet logger pre-filled with the card's values. The user must manually save the wager.
3. **No Automated Betting**: No code path may place or save a bet without explicit user action.
4. **No Active Recommendation Logic in v1**: Stake suggestion, auto-save, auto-bet, bankroll-based recommendation, ranking, real confidence claims, and invented picks remain disallowed.
