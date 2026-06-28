import pytest
from pydantic import ValidationError
from scripts.config import IngestionConfig, get_competition_config

def test_get_competition_config_valid():
    cfg = get_competition_config("comp-eng-pl")
    assert cfg is not None
    assert cfg.competition_id == "comp-eng-pl"
    assert cfg.soccerdata_league == "ENG-Premier League"
    assert cfg.seasons == [2022, 2023, 2024]

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

