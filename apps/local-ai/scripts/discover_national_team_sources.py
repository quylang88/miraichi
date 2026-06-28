import json
import os
from typing import Iterable

import soccerdata as sd


DESIRED_NATIONAL_TEAM_COMPETITIONS = [
    {
        "competitionId": "comp-int-world-cup",
        "providerLeague": "INT-World Cup",
        "priority": "enabled",
    },
    {
        "competitionId": "comp-int-euro",
        "providerLeague": "INT-European Championship",
        "priority": "enabled",
    },
    {
        "competitionId": "comp-int-womens-world-cup",
        "providerLeague": "INT-Women's World Cup",
        "priority": "candidate",
    },
    {
        "competitionId": "comp-int-copa-america",
        "providerLeague": "INT-Copa America",
        "priority": "desired_future",
    },
]

BLOCKED_CLUB_PROVIDER_LEAGUES = [
    "ENG-Premier League",
    "ESP-La Liga",
    "GER-Bundesliga",
    "ITA-Serie A",
    "FRA-Ligue 1",
]


def classify_national_team_sources(provider_leagues: Iterable[str]) -> dict:
    provider_league_set = set(provider_leagues)
    competitions = []

    for item in DESIRED_NATIONAL_TEAM_COMPETITIONS:
        supported = item["providerLeague"] in provider_league_set
        competitions.append({
            "competitionId": item["competitionId"],
            "providerLeague": item["providerLeague"],
            "competitionType": "national_team",
            "providerStatus": "supported" if supported else "unsupported",
            "enabledByDefault": supported and item["priority"] == "enabled",
            "blockedReason": None if supported else f"{item['providerLeague']} is not available from current FBref soccerdata discovery.",
        })

    blocked_club_competitions = [
        {
            "providerLeague": league,
            "competitionType": "club",
            "blockedReason": "club_competition",
        }
        for league in BLOCKED_CLUB_PROVIDER_LEAGUES
        if league in provider_league_set
    ]

    return {
        "sourceProviderId": "soccerdata-fbref",
        "competitions": competitions,
        "blockedClubCompetitions": blocked_club_competitions,
    }


def discover_national_team_sources() -> dict:
    return classify_national_team_sources(sd.FBref.available_leagues())


def write_discovery_report(output_path: str) -> dict:
    report = discover_national_team_sources()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    return report


if __name__ == "__main__":
    report_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__),
        "../reports/phase-8-3a-national-team-source-discovery.json",
    ))
    report = write_discovery_report(report_path)
    print(f"[Phase 8.3A Source Discovery] Wrote {report_path}")
    print(json.dumps(report, indent=2))
