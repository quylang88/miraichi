from pydantic import BaseModel
from typing import List, Optional

class IngestionConfig(BaseModel):
    competition_id: str
    soccerdata_league: str
    seasons: List[int]
    train_split: List[int]
    val_split: List[int]
    test_split: List[int]

COMPETITION_REGISTRY = {
    "comp-eng-pl": IngestionConfig(
        competition_id="comp-eng-pl",
        soccerdata_league="ENG-Premier League",
        seasons=[2022, 2023, 2024],
        train_split=[2022],
        val_split=[2023],
        test_split=[2024]
    )
}

def get_competition_config(competition_id: str) -> Optional[IngestionConfig]:
    return COMPETITION_REGISTRY.get(competition_id)
