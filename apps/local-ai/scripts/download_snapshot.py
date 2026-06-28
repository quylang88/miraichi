import os
from typing import Optional
import soccerdata as sd
from scripts.config import INITIAL_COMPETITION_ID, get_competition_config

def download_snapshot(competition_id: Optional[str] = None):
    competition_id = competition_id or INITIAL_COMPETITION_ID
    config = get_competition_config(competition_id)
    if not config:
        raise ValueError(f"No configuration found for {competition_id}")
    
    # Configure local caching directories inside apps/local-ai/data/raw
    raw_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/raw"))
    os.makedirs(raw_dir, exist_ok=True)
    
    print(f"Scraping schedule for {config.soccerdata_league}...")
    fbref = sd.FBref(leagues=config.soccerdata_league, seasons=config.seasons)
    schedule = fbref.read_schedule()
    
    # Store snapshot as parquet/csv for offline rebuilds
    output_path = os.path.join(raw_dir, f"{competition_id}_schedule.csv")
    schedule.to_csv(output_path)
    print(f"Saved raw snapshot to {output_path}")

if __name__ == "__main__":
    import sys
    comp = sys.argv[1] if len(sys.argv) > 1 else INITIAL_COMPETITION_ID
    download_snapshot(comp)
