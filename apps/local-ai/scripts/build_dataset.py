import os
import json
import datetime
import hashlib
import pandas as pd
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from scripts.config import INITIAL_COMPETITION_ID, get_competition_config
from scripts.team_mapper import TeamMapper

FEATURE_SPEC_VERSION = "feature-spec-v0.1.0"

class MatchScores(BaseModel):
    homeScore: int = Field(..., ge=0)
    awayScore: int = Field(..., ge=0)

class TeamStats(BaseModel):
    home: Optional[int] = None
    away: Optional[int] = None

class MatchCards(BaseModel):
    yellow: TeamStats
    red: TeamStats

class MatchStats(BaseModel):
    corners: Optional[TeamStats] = None
    cards: Optional[MatchCards] = None

class GoalIncident(BaseModel):
    time: str
    isHome: bool

class MatchIncidents(BaseModel):
    goals: list[GoalIncident] = []

class ProcessedMatch(BaseModel):
    id: str
    competitionId: str
    seasonId: str
    homeTeamId: str
    awayTeamId: str
    status: str
    kickoffTime: datetime.datetime
    scores: Optional[MatchScores] = None
    venueName: Optional[str] = None
    round: Optional[str] = None
    stats: Optional[MatchStats] = None
    incidents: Optional[MatchIncidents] = None

    @field_validator('homeTeamId', 'awayTeamId')
    @classmethod
    def check_team_id_not_empty(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("Team ID cannot be empty")
        return v

def build_dataset(competition_id: str, raw_path: Optional[str] = None, output_dir: Optional[str] = None):
    config = get_competition_config(competition_id)
    if not config:
        raise ValueError(f"No config found for {competition_id}")
        
    # Ensure splits are disjoint and chronological to avoid look-ahead leaks
    train_set = set(config.train_split)
    val_set = set(config.val_split)
    test_set = set(config.test_split)
    
    if not train_set.isdisjoint(val_set) or not train_set.isdisjoint(test_set) or not val_set.isdisjoint(test_set):
        raise ValueError("Train, validation, and test splits must be disjoint.")
    if train_set and val_set and max(train_set) >= min(val_set):
        raise ValueError("Train split seasons must precede validation split seasons.")
    if val_set and test_set and max(val_set) >= min(test_set):
        raise ValueError("Validation split seasons must precede test split seasons.")
        
    script_dir = os.path.dirname(__file__)
    if not raw_path:
        raw_path = os.path.abspath(os.path.join(script_dir, f"../data/raw/{competition_id}_schedule.csv"))
    if not output_dir:
        output_dir = os.path.abspath(os.path.join(script_dir, f"../data/processed/{competition_id}"))
        
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        if not os.path.exists(raw_path):
            raise FileNotFoundError(f"Raw snapshot not found at {raw_path}")
        df = pd.read_csv(raw_path)
    except Exception as e:
        raise IOError(f"Failed to read raw CSV file from {raw_path}: {e}")
    team_mapper = TeamMapper()
    
    splits = {"train": [], "val": [], "test": []}
    rejected_count = 0
    warnings = []
    
    for idx, row in df.iterrows():
        try:
            # Check critical fields
            if pd.isna(row.get("date")) or pd.isna(row.get("game_id")):
                rejected_count += 1
                warnings.append(f"Row {idx}: Missing critical date/game_id")
                continue
                
            season_year = int(row["season"])
            
            # Safely handle missing or NaN time field and strip timezone descriptors (e.g. "21:00 (04:00)")
            time_val = row.get("time")
            if pd.isna(time_val):
                time_str = "00:00"
            else:
                time_str = str(time_val).strip().split(" ")[0]
            kickoff_str = f"{row['date']}T{time_str}:00Z"
            
            # Scores extraction using Pydantic MatchScores
            scores = None
            has_home_away = "home_score" in row and "away_score" in row and not pd.isna(row.get("home_score")) and not pd.isna(row.get("away_score"))
            if has_home_away:
                scores = MatchScores(
                    homeScore=int(float(row["home_score"])),
                    awayScore=int(float(row["away_score"]))
                )
            elif "score" in row and not pd.isna(row.get("score")):
                score_str = str(row["score"]).strip()
                parts = []
                for sep in ["\u2013", "\u2014", "-"]:
                    if sep in score_str:
                        parts = score_str.split(sep)
                        break
                if len(parts) == 2:
                    try:
                        scores = MatchScores(
                            homeScore=int(float(parts[0].strip())),
                            awayScore=int(float(parts[1].strip()))
                        )
                    except ValueError:
                        pass
            
            # Map Team names
            home_id = team_mapper.resolve(str(row["home_team"]))
            away_id = team_mapper.resolve(str(row["away_team"]))
            
            # Parse round
            round_val = row.get("round")
            round_str = str(round_val).strip() if not pd.isna(round_val) else None
            
            # Parse corners
            c_home = row.get("corners_home")
            c_away = row.get("corners_away")
            corners = None
            if not pd.isna(c_home) and not pd.isna(c_away):
                corners = TeamStats(home=int(float(c_home)), away=int(float(c_away)))
                
            # Parse cards
            y_home = row.get("yellow_cards_home")
            y_away = row.get("yellow_cards_away")
            r_home = row.get("red_cards_home")
            r_away = row.get("red_cards_away")
            cards = None
            if not pd.isna(y_home) and not pd.isna(y_away) and not pd.isna(r_home) and not pd.isna(r_away):
                cards = MatchCards(
                    yellow=TeamStats(home=int(float(y_home)), away=int(float(y_away))),
                    red=TeamStats(home=int(float(r_home)), away=int(float(r_away)))
                )
                
            stats = MatchStats(corners=corners, cards=cards) if (corners or cards) else None

            # Parse goal minutes list
            g_home_val = row.get("goal_minutes_home")
            g_away_val = row.get("goal_minutes_away")
            goals_list = []
            
            if not pd.isna(g_home_val) and str(g_home_val).strip():
                for m in str(g_home_val).split(","):
                    if m.strip():
                        goals_list.append(GoalIncident(time=m.strip(), isHome=True))
            if not pd.isna(g_away_val) and str(g_away_val).strip():
                for m in str(g_away_val).split(","):
                    if m.strip():
                        goals_list.append(GoalIncident(time=m.strip(), isHome=False))
                        
            incidents = MatchIncidents(goals=goals_list) if goals_list else None

            match_data = ProcessedMatch(
                id=f"match-{row['game_id']}",
                competitionId=competition_id,
                seasonId=f"season-{season_year}",
                homeTeamId=home_id,
                awayTeamId=away_id,
                status="completed" if scores is not None else "scheduled",
                kickoffTime=kickoff_str,
                scores=scores,
                venueName=str(row["venue"]) if not pd.isna(row.get("venue")) else None,
                round=round_str,
                stats=stats,
                incidents=incidents
            )
            
            # Split chronologically (use mode='json' to serialize datetime & sub-models)
            dumped_record = match_data.model_dump(mode='json')
            if season_year in config.train_split:
                splits["train"].append(dumped_record)
            elif season_year in config.val_split:
                splits["val"].append(dumped_record)
            elif season_year in config.test_split:
                splits["test"].append(dumped_record)
            else:
                rejected_count += 1
                warnings.append(f"Row {idx}: Season {season_year} not in splits configuration.")
                
        except Exception as e:
            rejected_count += 1
            warnings.append(f"Row {idx} failed: {str(e)}")
            
    try:
        # Write splits
        for split_name, records in splits.items():
            split_file = os.path.join(output_dir, f"{split_name}.jsonl")
            with open(split_file, 'w', encoding='utf-8') as f:
                for record in records:
                    f.write(json.dumps(record) + "\n")
                    
        # Calculate file hashes
        hasher = hashlib.sha256()
        with open(raw_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        snapshot_hash = hasher.hexdigest()
        
        # Metadata Record
        metadata = {
            "datasetId": f"dataset-{competition_id}-{datetime.date.today().isoformat()}",
            "competitionId": competition_id,
            "schemaVersion": "1.0.0",
            "featureSpecVersion": FEATURE_SPEC_VERSION,
            "sourceProviderId": "soccerdata-fbref",
            "sourceSnapshotHash": snapshot_hash,
            "builtAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            "trainCount": len(splits["train"]),
            "valCount": len(splits["val"]),
            "testCount": len(splits["test"])
        }
        with open(os.path.join(output_dir, "metadata.json"), 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
            
        # Quality Report
        report = {
            "processedCount": len(df),
            "rejectedCount": rejected_count,
            "trainCount": len(splits["train"]),
            "valCount": len(splits["val"]),
            "testCount": len(splits["test"]),
            "warnings": warnings
        }
        with open(os.path.join(output_dir, "quality_report.json"), 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
    except Exception as e:
        raise IOError(f"Failed during file write or hashing operations: {e}")

if __name__ == "__main__":
    build_dataset(INITIAL_COMPETITION_ID)
