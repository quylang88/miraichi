from scripts.discover_national_team_sources import classify_national_team_sources


def test_classify_national_team_sources_marks_provider_supported_leagues():
    report = classify_national_team_sources([
        "INT-World Cup",
        "INT-European Championship",
        "ENG-Premier League",
    ])

    world_cup = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-world-cup")
    euro = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-euro")
    copa = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-copa-america")
    premier_league = next(item for item in report["blockedClubCompetitions"] if item["providerLeague"] == "ENG-Premier League")

    assert world_cup["providerStatus"] == "supported"
    assert euro["providerStatus"] == "supported"
    assert copa["providerStatus"] == "unsupported"
    assert premier_league["blockedReason"] == "club_competition"


def test_classify_national_team_sources_does_not_enable_unsupported_copa_america():
    report = classify_national_team_sources(["INT-World Cup", "INT-European Championship"])
    copa = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-copa-america")

    assert copa["enabledByDefault"] is False
    assert "not available from current FBref soccerdata discovery" in copa["blockedReason"]
