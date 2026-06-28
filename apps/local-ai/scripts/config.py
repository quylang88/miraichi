import json
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional

class IngestionConfig(BaseModel):
    competition_id: str
    soccerdata_league: str
    seasons: List[int]
    train_split: List[int]
    val_split: List[int]
    test_split: List[int]

_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "competition-registry.json"

def _load_registry_payload() -> dict:
    with _CONFIG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)

_REGISTRY_PAYLOAD = _load_registry_payload()
INITIAL_COMPETITION_ID = _REGISTRY_PAYLOAD["initialCompetitionId"]
COMPETITION_REGISTRY = {
    item["competition_id"]: IngestionConfig(**item)
    for item in _REGISTRY_PAYLOAD["competitions"]
}

def get_competition_config(competition_id: str) -> Optional[IngestionConfig]:
    return COMPETITION_REGISTRY.get(competition_id)
