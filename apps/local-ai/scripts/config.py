import json
from pathlib import Path
from pydantic import BaseModel, field_validator
from typing import List, Literal, Optional


CompetitionType = Literal["national_team"]
ProviderStatus = Literal["supported", "unsupported"]


class IngestionConfig(BaseModel):
    competition_id: str
    soccerdata_league: str
    seasons: List[int]
    train_split: List[int]
    val_split: List[int]
    test_split: List[int]
    competition_type: CompetitionType = "national_team"
    provider_status: ProviderStatus = "supported"
    enabled: bool = True

    @field_validator("enabled")
    @classmethod
    def reject_enabled_unsupported_sources(cls, value: bool, info):
        provider_status = info.data.get("provider_status")
        if value and provider_status == "unsupported":
            raise ValueError("Unsupported provider sources cannot be enabled.")
        return value


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


def get_enabled_national_team_configs() -> List[IngestionConfig]:
    return [
        item
        for item in COMPETITION_REGISTRY.values()
        if item.enabled and item.competition_type == "national_team"
    ]

