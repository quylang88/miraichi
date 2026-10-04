# ADR-0054: Known-match daily LIVE overlay

- Status: Implementation decision for the owner's reopened LIVE correction, 2026-09-12.
- Supersedes ADR-0051's widget-only live-source selection when `LIVE_DATA_MODE=fotmob-daily`.
- Narrows ADR-0049's no-in-play-publication rule to the terminal warehouse; the existing factual
  score/status source is also used by a separate live read overlay. Existing source-risk
  acceptance and all no-bypass/access-block rules remain unchanged.

The owner reported that LIVE is empty despite live detail and requested a fix verified directly
on staging. A current probe confirmed the widget window contains only early-day fixtures and no
active records, while the existing daily source exposes known active matches. The agent selected
this implementation to satisfy that request; the owner did not name the provider or configuration.

Use the existing guarded FotMob daily client at most once for today's UTC date and once for
yesterday during the first four UTC hours. Resolve only configured competition roots and unique
known canonical provider match IDs, with home/away and kickoff validation. No detail request,
new provider, invented locator, extra season hydration or new infrastructure is introduced.

Keep the durable live refresh lease, 60-second manual floor, five-minute visible/background
cadence and shared six-hour FotMob access-block circuit. Publish score/status/period/minute only
to the private live snapshot, then redact locators for the owner API. Season/canonical publication
remains terminal-only; no owner betting data is changed.

Daily coverage is explicitly `registered-daily-window`, bounded to 2,000 observations; it is not
a claim of guaranteed completeness. Missing active observations keep their old timestamps for
at most ten minutes, then leave the visible snapshot without being declared completed. Confirmed
terminal observations leave active LIVE. Provider failure preserves the last good snapshot.

Keep disabled/legacy widget modes for rollback. Deploy the new API and compatible PWA validator
together, advance the installed cache, and require unmocked hosted LIVE across multiple leagues
before opening detail. Fixtures supplement this gate but cannot satisfy it.
