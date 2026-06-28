import os
import json
import pandas as pd
import pytest
from pydantic import ValidationError
from scripts.build_dataset import build_dataset, ProcessedMatch, MatchScores
from scripts.config import IngestionConfig, COMPETITION_REGISTRY

def test_build_dataset_valid(tmp_path):
    # Set up raw data test fixture
    raw_csv = tmp_path / "comp-int-world-cup_schedule.csv"
    data = {
        "season": [2014, 2018, 2022],
        "date": ["2014-06-16", "2018-07-15", "2022-11-26"],
        "time": ["13:00", "18:00", "22:00"],
        "home_team": ["Germany", "France", "Argentina"],
        "away_team": ["Portugal", "Croatia", "Mexico"],
        "home_score": [4.0, 4.0, 2.0],
        "away_score": [0.0, 2.0, 0.0],
        "venue": ["Arena Fonte Nova", "Luzhniki Stadium", "Lusail Stadium"],
        "game_id": ["wc-2014-sample-1", "wc-2018-sample-1", "wc-2022-sample-1"]
    }
    df = pd.DataFrame(data)
    df.to_csv(raw_csv, index=False)
    
    # Process dataset
    processed_dir = tmp_path / "processed"
    build_dataset("comp-int-world-cup", raw_path=str(raw_csv), output_dir=str(processed_dir))
    
    assert os.path.exists(processed_dir / "train.jsonl")
    assert os.path.exists(processed_dir / "val.jsonl")
    assert os.path.exists(processed_dir / "test.jsonl")
    assert os.path.exists(processed_dir / "metadata.json")
    assert os.path.exists(processed_dir / "quality_report.json")
    
    # Verify metadata
    with open(processed_dir / "metadata.json", 'r') as f:
        meta = json.load(f)
        assert meta["competitionId"] == "comp-int-world-cup"
        assert meta["trainCount"] == 1
        assert meta["valCount"] == 1
        assert meta["testCount"] == 1
        assert meta["builtAt"].endswith("Z")
        
    # Verify quality report
    with open(processed_dir / "quality_report.json", 'r') as f:
        report = json.load(f)
        assert report["processedCount"] == 3
        assert report["rejectedCount"] == 0
        assert len(report["warnings"]) == 0

    # Verify structured record in train.jsonl
    with open(processed_dir / "train.jsonl", 'r') as f:
        record = json.loads(f.readline())
        assert record["id"] == "match-wc-2014-sample-1"
        assert record["competitionId"] == "comp-int-world-cup"
        assert record["homeTeamId"] == "team-deu-national"
        assert record["awayTeamId"] == "team-prt-national"
        assert record["status"] == "completed"
        assert record["kickoffTime"] == "2014-06-16T13:00:00Z"
        assert record["scores"] == {"homeScore": 4, "awayScore": 0}
        assert record["venueName"] == "Arena Fonte Nova"

def test_processed_match_empty_team_id():
    with pytest.raises(ValidationError):
        ProcessedMatch(
            id="match-1",
            competitionId="comp-1",
            seasonId="season-2026",
            homeTeamId="",  # Empty ID should fail validation
            awayTeamId="team-away",
            status="scheduled",
            kickoffTime="2026-06-28T12:00:00Z"
        )

def test_match_scores_validation():
    # Negative scores should raise validation error
    with pytest.raises(ValidationError):
        MatchScores(homeScore=-1, awayScore=2)
    with pytest.raises(ValidationError):
        MatchScores(homeScore=2, awayScore=-5)

def test_build_dataset_nan_time(tmp_path):
    # Set up raw data test fixture with a NaN time
    raw_csv = tmp_path / "comp-int-world-cup_schedule.csv"
    data = {
        "season": [2014],
        "date": ["2014-06-16"],
        "time": [None],  # Time is missing
        "home_team": ["Germany"],
        "away_team": ["Portugal"],
        "home_score": [None],
        "away_score": [None],
        "venue": [None],
        "game_id": ["m1"]
    }
    df = pd.DataFrame(data)
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    build_dataset("comp-int-world-cup", raw_path=str(raw_csv), output_dir=str(processed_dir))
    
    # Verify kickoffTime defaults to 00:00
    with open(processed_dir / "train.jsonl", 'r') as f:
        record = json.loads(f.readline())
        assert record["kickoffTime"] == "2014-06-16T00:00:00Z"
        assert record["scores"] is None

def test_build_dataset_invalid_records(tmp_path):
    # Set up raw data with invalid fields (missing critical date or game_id)
    raw_csv = tmp_path / "comp-int-world-cup_schedule.csv"
    data = {
        "season": [2014, 2014, 2014],
        "date": ["2014-06-16", None, "2014-06-20"],
        "time": ["15:00", "16:00", "17:00"],
        "home_team": ["Germany", "France", "Argentina"],
        "away_team": ["Portugal", "Croatia", "Mexico"],
        "home_score": [4, 4, 2],
        "away_score": [0, 2, 0],
        "venue": ["Arena Fonte Nova", "Luzhniki Stadium", "Lusail Stadium"],
        "game_id": ["m1", "m2", None]  # m2 lacks date, m3 lacks game_id
    }
    df = pd.DataFrame(data)
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    build_dataset("comp-int-world-cup", raw_path=str(raw_csv), output_dir=str(processed_dir))
    
    with open(processed_dir / "quality_report.json", 'r') as f:
        report = json.load(f)
        assert report["processedCount"] == 3
        assert report["rejectedCount"] == 2
        assert len(report["warnings"]) == 2
        assert "Missing critical date/game_id" in report["warnings"][0]

def test_build_dataset_non_disjoint_splits(tmp_path, monkeypatch):
    # Create invalid config with overlapping splits
    invalid_config = IngestionConfig(
        competition_id="comp-int-world-cup",
        soccerdata_league="INT-World Cup",
        seasons=[2014, 2018, 2022],
        train_split=[2014, 2018],
        val_split=[2018],  # Overlaps with train!
        test_split=[2022]
    )
    
    # Temporarily override registry
    monkeypatch.setitem(COMPETITION_REGISTRY, "comp-int-world-cup", invalid_config)
    
    raw_csv = tmp_path / "comp-int-world-cup_schedule.csv"
    df = pd.DataFrame({
        "season": [2014],
        "date": ["2014-06-16"],
        "time": ["15:00"],
        "home_team": ["Germany"],
        "away_team": ["Portugal"],
        "home_score": [4],
        "away_score": [0],
        "venue": ["Arena Fonte Nova"],
        "game_id": ["m1"]
    })
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    with pytest.raises(ValueError, match="Train, validation, and test splits must be disjoint"):
        build_dataset("comp-int-world-cup", raw_path=str(raw_csv), output_dir=str(processed_dir))

def test_build_dataset_non_chronological_splits(tmp_path, monkeypatch):
    # Create config with non-chronological splits
    invalid_config = IngestionConfig(
        competition_id="comp-int-world-cup",
        soccerdata_league="INT-World Cup",
        seasons=[2014, 2018, 2022],
        train_split=[2022],  # Train is in future
        val_split=[2018],
        test_split=[2014]
    )
    
    # Temporarily override registry
    monkeypatch.setitem(COMPETITION_REGISTRY, "comp-int-world-cup", invalid_config)
    
    raw_csv = tmp_path / "comp-int-world-cup_schedule.csv"
    df = pd.DataFrame({
        "season": [2014],
        "date": ["2014-06-16"],
        "time": ["15:00"],
        "home_team": ["Germany"],
        "away_team": ["Portugal"],
        "home_score": [4],
        "away_score": [0],
        "venue": ["Arena Fonte Nova"],
        "game_id": ["m1"]
    })
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    with pytest.raises(ValueError, match="Train split seasons must precede validation split seasons"):
        build_dataset("comp-int-world-cup", raw_path=str(raw_csv), output_dir=str(processed_dir))

def test_build_dataset_missing_raw_file(tmp_path):
    processed_dir = tmp_path / "processed"
    with pytest.raises(IOError, match="Failed to read raw CSV file"):
        build_dataset("comp-int-world-cup", raw_path="non_existent_file.csv", output_dir=str(processed_dir))
