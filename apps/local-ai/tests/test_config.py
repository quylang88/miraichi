import pytest
from pydantic import ValidationError
import scripts.config as config
from scripts.config import IngestionConfig, get_competition_config

def test_get_competition_config_valid():
    cfg = get_competition_config("comp-int-world-cup")
    assert cfg is not None
    assert cfg.competition_id == "comp-int-world-cup"
    assert cfg.soccerdata_league == "INT-World Cup"
    assert cfg.seasons == [2014, 2018, 2022]
    assert cfg.train_split == [2014]
    assert cfg.val_split == [2018]
    assert cfg.test_split == [2022]

def test_initial_competition_targets_world_cup_research_use_case():
    assert getattr(config, "INITIAL_COMPETITION_ID", None) == "comp-int-world-cup"

def test_get_competition_config_invalid():
    cfg = get_competition_config("non-existent")
    assert cfg is None

def test_ingestion_config_validation():
    # Test invalid type for seasons (must be list of ints)
    with pytest.raises(ValidationError):
        IngestionConfig(
            competition_id="comp-test",
            soccerdata_league="Test League",
            seasons="not-a-list",  # Should raise validation error
            train_split=[2022],
            val_split=[2023],
            test_split=[2024]
        )

    # Test missing required field
    with pytest.raises(ValidationError):
        IngestionConfig(
            competition_id="comp-test",
            soccerdata_league="Test League"
            # seasons is missing
        )


def test_registry_marks_enabled_competitions_as_national_team_only():
    enabled = config.get_enabled_national_team_configs()

    assert {item.competition_id for item in enabled} == {"comp-int-world-cup", "comp-int-euro"}
    assert all(item.competition_type == "national_team" for item in enabled)
    assert all(item.enabled is True for item in enabled)


def test_copa_america_is_not_enabled_without_provider_support():
    cfg = get_competition_config("comp-int-copa-america")

    assert cfg is not None
    assert cfg.competition_type == "national_team"
    assert cfg.enabled is False
    assert cfg.provider_status == "unsupported"


def test_registry_rejects_enabled_club_competitions():
    with pytest.raises(ValidationError):
        IngestionConfig(
            competition_id="comp-eng-premier-league",
            soccerdata_league="ENG-Premier League",
            seasons=[2022, 2023, 2024],
            train_split=[2022],
            val_split=[2023],
            test_split=[2024],
            competition_type="club",
            provider_status="supported",
            enabled=True,
        )

