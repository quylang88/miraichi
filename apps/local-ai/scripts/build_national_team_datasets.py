import json
import os
from typing import Iterable, Optional

from scripts.build_dataset import build_dataset
from scripts.config import IngestionConfig, get_enabled_national_team_configs


def build_enabled_national_team_datasets(
    configs: Optional[Iterable[IngestionConfig]] = None,
    raw_dir: Optional[str] = None,
    processed_root: Optional[str] = None,
) -> dict:
    script_dir = os.path.dirname(__file__)
    raw_dir = raw_dir or os.path.abspath(os.path.join(script_dir, "../data/raw"))
    processed_root = processed_root or os.path.abspath(os.path.join(script_dir, "../data/processed"))
    configs = [cfg for cfg in (configs or get_enabled_national_team_configs()) if cfg.enabled]

    built_competition_ids = []
    total_train_count = 0
    total_val_count = 0
    total_test_count = 0

    for cfg in configs:
        raw_path = os.path.join(raw_dir, f"{cfg.competition_id}_schedule.csv")
        output_dir = os.path.join(processed_root, cfg.competition_id)
        build_dataset(cfg.competition_id, raw_path=raw_path, output_dir=output_dir)

        with open(os.path.join(output_dir, "metadata.json"), "r", encoding="utf-8") as f:
            metadata = json.load(f)

        built_competition_ids.append(cfg.competition_id)
        total_train_count += metadata["trainCount"]
        total_val_count += metadata["valCount"]
        total_test_count += metadata["testCount"]

    return {
        "builtCompetitionIds": built_competition_ids,
        "totalTrainCount": total_train_count,
        "totalValCount": total_val_count,
        "totalTestCount": total_test_count,
    }


if __name__ == "__main__":
    report = build_enabled_national_team_datasets()
    print(json.dumps(report, indent=2))
