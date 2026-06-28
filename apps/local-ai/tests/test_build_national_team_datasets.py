import json
import pandas as pd

from scripts.build_national_team_datasets import build_enabled_national_team_datasets
from scripts.config import IngestionConfig


def write_raw_fixture(raw_dir, competition_id, seasons):
    rows = []
    for season in seasons:
        rows.append({
            "season": season,
            "date": f"{season}-06-10",
            "time": "20:00",
            "home_team": "France",
            "away_team": "Germany",
            "home_score": 2,
            "away_score": 1,
            "venue": "Neutral Stadium",
            "game_id": f"{competition_id}-{season}-sample",
        })
    raw_path = raw_dir / f"{competition_id}_schedule.csv"
    pd.DataFrame(rows).to_csv(raw_path, index=False)
    return raw_path


from unittest.mock import patch, mock_open


def test_build_enabled_national_team_datasets_builds_only_enabled_sources(tmp_path):
    raw_dir = tmp_path / "raw"
    processed_root = tmp_path / "processed"
    raw_dir.mkdir()

    configs = [
        IngestionConfig(
            competition_id="comp-int-world-cup",
            soccerdata_league="INT-World Cup",
            seasons=[2014, 2018, 2022],
            train_split=[2014],
            val_split=[2018],
            test_split=[2022],
            competition_type="national_team",
            provider_status="supported",
            enabled=True,
        ),
        IngestionConfig(
            competition_id="comp-int-euro",
            soccerdata_league="INT-European Championship",
            seasons=[2016, 2021, 2024],
            train_split=[2016],
            val_split=[2021],
            test_split=[2024],
            competition_type="national_team",
            provider_status="supported",
            enabled=True,
        ),
        IngestionConfig(
            competition_id="comp-int-copa-america",
            soccerdata_league="INT-Copa America",
            seasons=[2024],
            train_split=[],
            val_split=[],
            test_split=[2024],
            competition_type="national_team",
            provider_status="unsupported",
            enabled=False,
        ),
    ]

    # Write raw fixtures ONLY for enabled configs
    for cfg in configs:
        if cfg.enabled:
            write_raw_fixture(raw_dir, cfg.competition_id, cfg.seasons)

    report = build_enabled_national_team_datasets(
        configs=configs,
        raw_dir=str(raw_dir),
        processed_root=str(processed_root),
    )

    assert report["builtCompetitionIds"] == ["comp-int-world-cup", "comp-int-euro"]
    assert report["totalTestCount"] == 2
    assert (processed_root / "comp-int-world-cup" / "test.jsonl").exists()
    assert (processed_root / "comp-int-euro" / "test.jsonl").exists()
    assert not (processed_root / "comp-int-copa-america").exists()

    with open(processed_root / "comp-int-euro" / "metadata.json", "r", encoding="utf-8") as f:
        metadata = json.load(f)
    assert metadata["competitionId"] == "comp-int-euro"


@patch("scripts.build_national_team_datasets.build_dataset")
@patch("scripts.build_national_team_datasets.open", new_callable=mock_open, read_data='{"trainCount": 1, "valCount": 2, "testCount": 3}')
def test_build_enabled_national_team_datasets_default_paths(mock_file, mock_build):
    configs = [
        IngestionConfig(
            competition_id="comp-mock",
            soccerdata_league="INT-Mock",
            seasons=[2024],
            train_split=[2024],
            val_split=[],
            test_split=[],
            competition_type="national_team",
            provider_status="supported",
            enabled=True,
        )
    ]

    report = build_enabled_national_team_datasets(
        configs=configs,
        raw_dir=None,
        processed_root=None,
    )

    assert report["builtCompetitionIds"] == ["comp-mock"]
    mock_build.assert_called_once()
    args, kwargs = mock_build.call_args
    assert args[0] == "comp-mock"

    raw_path = kwargs.get("raw_path") or args[1]
    output_dir = kwargs.get("output_dir") or args[2]

    assert "data/raw/comp-mock_schedule.csv" in raw_path.replace("\\", "/")
    assert "data/processed/comp-mock" in output_dir.replace("\\", "/")

