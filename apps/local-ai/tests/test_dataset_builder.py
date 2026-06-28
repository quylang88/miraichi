import os
import json
import pandas as pd
import pytest
from pydantic import ValidationError
from scripts.build_dataset import build_dataset, ProcessedMatch, MatchScores
from scripts.config import IngestionConfig, COMPETITION_REGISTRY

def test_build_dataset_valid(tmp_path):
    # Set up raw data test fixture
    raw_csv = tmp_path / "comp-eng-pl_schedule.csv"
    data = {
        "season": [2022, 2023, 2024],
        "date": ["2022-09-01", "2023-09-02", "2024-09-03"],
        "time": ["15:00", "16:00", "17:00"],
        "home_team": ["Manchester United", "Arsenal", "Arsenal FC"],
        "away_team": ["Arsenal", "Manchester United", "Manchester United"],
        "home_score": [2.0, 1.0, 3.0],
        "away_score": [1.0, 2.0, 0.0],
        "venue": ["Old Trafford", "Emirates", "Emirates"],
        "game_id": ["m1", "m2", "m3"]
    }
    df = pd.DataFrame(data)
    df.to_csv(raw_csv, index=False)
    
    # Process dataset
    processed_dir = tmp_path / "processed"
    build_dataset("comp-eng-pl", raw_path=str(raw_csv), output_dir=str(processed_dir))
    
    assert os.path.exists(processed_dir / "train.jsonl")
    assert os.path.exists(processed_dir / "val.jsonl")
    assert os.path.exists(processed_dir / "test.jsonl")
    assert os.path.exists(processed_dir / "metadata.json")
    assert os.path.exists(processed_dir / "quality_report.json")
    
    # Verify metadata
    with open(processed_dir / "metadata.json", 'r') as f:
        meta = json.load(f)
        assert meta["competitionId"] == "comp-eng-pl"
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
        assert record["id"] == "match-m1"
        assert record["competitionId"] == "comp-eng-pl"
        assert record["homeTeamId"] == "team-eng-man-united"
        assert record["awayTeamId"] == "team-eng-arsenal"
        assert record["status"] == "completed"
        assert record["kickoffTime"] == "2022-09-01T15:00:00Z"
        assert record["scores"] == {"homeScore": 2, "awayScore": 1}
        assert record["venueName"] == "Old Trafford"

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
    raw_csv = tmp_path / "comp-eng-pl_schedule.csv"
    data = {
        "season": [2022],
        "date": ["2022-09-01"],
        "time": [None],  # Time is missing
        "home_team": ["Manchester United"],
        "away_team": ["Arsenal"],
        "home_score": [None],
        "away_score": [None],
        "venue": [None],
        "game_id": ["m1"]
    }
    df = pd.DataFrame(data)
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    build_dataset("comp-eng-pl", raw_path=str(raw_csv), output_dir=str(processed_dir))
    
    # Verify kickoffTime defaults to 00:00
    with open(processed_dir / "train.jsonl", 'r') as f:
        record = json.loads(f.readline())
        assert record["kickoffTime"] == "2022-09-01T00:00:00Z"
        assert record["scores"] is None

def test_build_dataset_invalid_records(tmp_path):
    # Set up raw data with invalid fields (missing critical date or game_id)
    raw_csv = tmp_path / "comp-eng-pl_schedule.csv"
    data = {
        "season": [2022, 2022, 2022],
        "date": ["2022-09-01", None, "2022-09-03"],
        "time": ["15:00", "16:00", "17:00"],
        "home_team": ["Manchester United", "Arsenal", "Arsenal FC"],
        "away_team": ["Arsenal", "Manchester United", "Manchester United"],
        "home_score": [2, 1, 3],
        "away_score": [1, 2, 0],
        "venue": ["Old Trafford", "Emirates", "Emirates"],
        "game_id": ["m1", "m2", None]  # m2 lacks date, m3 lacks game_id
    }
    df = pd.DataFrame(data)
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    build_dataset("comp-eng-pl", raw_path=str(raw_csv), output_dir=str(processed_dir))
    
    with open(processed_dir / "quality_report.json", 'r') as f:
        report = json.load(f)
        assert report["processedCount"] == 3
        assert report["rejectedCount"] == 2
        assert len(report["warnings"]) == 2
        assert "Missing critical date/game_id" in report["warnings"][0]

def test_build_dataset_non_disjoint_splits(tmp_path, monkeypatch):
    # Create invalid config with overlapping splits
    invalid_config = IngestionConfig(
        competition_id="comp-eng-pl",
        soccerdata_league="ENG-Premier League",
        seasons=[2022, 2023, 2024],
        train_split=[2022, 2023],
        val_split=[2023],  # Overlaps with train!
        test_split=[2024]
    )
    
    # Temporarily override registry
    monkeypatch.setitem(COMPETITION_REGISTRY, "comp-eng-pl", invalid_config)
    
    raw_csv = tmp_path / "comp-eng-pl_schedule.csv"
    df = pd.DataFrame({
        "season": [2022],
        "date": ["2022-09-01"],
        "time": ["15:00"],
        "home_team": ["Manchester United"],
        "away_team": ["Arsenal"],
        "home_score": [2],
        "away_score": [1],
        "venue": ["Old Trafford"],
        "game_id": ["m1"]
    })
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    with pytest.raises(ValueError, match="Train, validation, and test splits must be disjoint"):
        build_dataset("comp-eng-pl", raw_path=str(raw_csv), output_dir=str(processed_dir))

def test_build_dataset_non_chronological_splits(tmp_path, monkeypatch):
    # Create config with non-chronological splits
    invalid_config = IngestionConfig(
        competition_id="comp-eng-pl",
        soccerdata_league="ENG-Premier League",
        seasons=[2022, 2023, 2024],
        train_split=[2024],  # Train is in future
        val_split=[2023],
        test_split=[2022]
    )
    
    # Temporarily override registry
    monkeypatch.setitem(COMPETITION_REGISTRY, "comp-eng-pl", invalid_config)
    
    raw_csv = tmp_path / "comp-eng-pl_schedule.csv"
    df = pd.DataFrame({
        "season": [2022],
        "date": ["2022-09-01"],
        "time": ["15:00"],
        "home_team": ["Manchester United"],
        "away_team": ["Arsenal"],
        "home_score": [2],
        "away_score": [1],
        "venue": ["Old Trafford"],
        "game_id": ["m1"]
    })
    df.to_csv(raw_csv, index=False)
    
    processed_dir = tmp_path / "processed"
    with pytest.raises(ValueError, match="Train split seasons must precede validation split seasons"):
        build_dataset("comp-eng-pl", raw_path=str(raw_csv), output_dir=str(processed_dir))

def test_build_dataset_missing_raw_file(tmp_path):
    processed_dir = tmp_path / "processed"
    with pytest.raises(IOError, match="Failed to read raw CSV file"):
        build_dataset("comp-eng-pl", raw_path="non_existent_file.csv", output_dir=str(processed_dir))
