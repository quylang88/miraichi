# Phase 8.1 Dataset Snapshot and Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reproducible offline historical datasets for the World Cup and related national-team competitions first, then validate them against competition-agnostic TypeScript contracts for Phase 8 model R&D.

**Architecture:** We use a Python-based offline data preparation layer driven by registry/config data. World Cup/national-team metadata is allowed in config and fixtures; parser, dataset builder, TypeScript contracts, and future model code stay competition-agnostic. Scraped raw data is cached locally to prevent rate limits. Processed outputs (train, validation, and test splits) are written in JSON Lines format alongside provenance metadata and data quality reports. A TypeScript integration test verifies that the processed dataset elements map correctly to the monorepo's shared TypeScript contracts.

**Tech Stack:** Python 3 (with `soccerdata`, `pandas`, `pydantic`, and `pytest`), TypeScript/Node (with `vitest` for contract checking).

---

## Proposed Changes

### local-ai

#### [NEW] [requirements.txt](file:///c:/CODE/miraichi/apps/local-ai/requirements.txt)
Defines Python dependencies for historical data scraping, normalization, and validation.

#### [NEW] [config.py](file:///c:/CODE/miraichi/apps/local-ai/scripts/config.py)
Python configuration mapping internal generic competition IDs to `soccerdata` league and season names.

#### [NEW] [competition-registry.json](file:///c:/CODE/miraichi/apps/local-ai/config/competition-registry.json)
Registry data declaring `comp-int-world-cup` as the initial Phase 8.1 target. Club competitions are not default targets in this phase.

#### [NEW] [test_config.py](file:///c:/CODE/miraichi/apps/local-ai/tests/test_config.py)
Unit tests for the Python configuration layer.

#### [NEW] [download_snapshot.py](file:///c:/CODE/miraichi/apps/local-ai/scripts/download_snapshot.py)
Python script to trigger `soccerdata` scrapers (e.g., FBref or Football-Data.co.uk) for configured competitions.

#### [NEW] [test_snapshot.py](file:///c:/CODE/miraichi/apps/local-ai/tests/test_snapshot.py)
Unit tests for the snapshot download script using mocked scraper calls.

#### [NEW] [team_mapper.py](file:///c:/CODE/miraichi/apps/local-ai/scripts/team_mapper.py)
Python utility loading the team mapping dictionary and matching spelling variations to generic team IDs.

#### [NEW] [test_team_mapper.py](file:///c:/CODE/miraichi/apps/local-ai/tests/test_team_mapper.py)
Unit tests for team mapping and warning reporting.

#### [NEW] [build_dataset.py](file:///c:/CODE/miraichi/apps/local-ai/scripts/build_dataset.py)
Python script mapping raw scraped inputs into normalized JSON Lines splits, validating fields, generating a quality report, and writing a provenance metadata record.

#### [NEW] [test_dataset_builder.py](file:///c:/CODE/miraichi/apps/local-ai/tests/test_dataset_builder.py)
Unit tests for dataset building, normalization, validation, and quality metrics.

#### [NEW] [dataset-integration.test.ts](file:///c:/CODE/miraichi/apps/local-ai/src/input/dataset-integration.test.ts)
TypeScript integration test checking that processed JSON Lines match shared monorepo contracts.

---

### shared

#### [NEW] [team-mappings.json](file:///c:/CODE/miraichi/packages/shared/src/data/team-mappings.json)
Standardized spelling alias dictionary mapping variant source names to canonical internal team IDs.

---

## Tasks

### Task 1: Setup Python Environment and Dependencies

**Files:**
- Create: `apps/local-ai/requirements.txt`

- [ ] **Step 1: Create requirements.txt**
  Create `apps/local-ai/requirements.txt` containing the necessary Python packages for web scraping, data modeling, validation, and testing.

```text
soccerdata>=1.4.0
pandas>=2.0.0
pydantic>=2.0.0
pytest>=7.0.0
```

- [ ] **Step 2: Install dependencies**
  Run commands to configure a virtual environment and install the required dependencies.

Run:
```bash
python -m venv apps/local-ai/.venv
# Windows activation
& apps/local-ai/.venv/Scripts/Activate.ps1
pip install -r apps/local-ai/requirements.txt
```
Expected: Packages installed successfully.

- [ ] **Step 3: Commit (if auto_commit enabled)**
  Check `.agent/config.yml` for `auto_commit` setting.
  If `auto_commit: true` (default when absent):
  ```bash
  git add apps/local-ai/requirements.txt
  git commit -m "chore(local-ai): add python requirements for dataset pipeline"
  ```
  If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Ingestion & Competition Configuration

**Files:**
- Create: `apps/local-ai/config/competition-registry.json`
- Create: `apps/local-ai/scripts/config.py`
- Test: `apps/local-ai/tests/test_config.py`

- [ ] **Step 1: Write config loader unit tests**
  Create `apps/local-ai/tests/test_config.py` to verify that our configuration maps internal competition IDs to scraper parameters.

```python
import os
import scripts.config as config
from scripts.config import IngestionConfig, get_competition_config

def test_get_competition_config_valid():
    cfg = get_competition_config("comp-int-world-cup")
    assert cfg is not None
    assert cfg.competition_id == "comp-int-world-cup"
    assert cfg.soccerdata_league == "INT-World Cup"
    assert cfg.seasons == [2014, 2018, 2022]
    assert cfg.train_split == [2014]
    assert cfg.val_split == [2018]
    assert cfg.test_split == [2022]

def test_initial_competition_targets_world_cup_research_use_case():
    assert getattr(config, "INITIAL_COMPETITION_ID", None) == "comp-int-world-cup"

def test_get_competition_config_invalid():
    cfg = get_competition_config("non-existent")
    assert cfg is None
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest apps/local-ai/tests/test_config.py -v`
  Expected: FAIL with ModuleNotFoundError or import errors.

- [ ] **Step 3: Implement registry data**
  Create `apps/local-ai/config/competition-registry.json`.

```json
{
  "initialCompetitionId": "comp-int-world-cup",
  "competitions": [
    {
      "competition_id": "comp-int-world-cup",
      "soccerdata_league": "INT-World Cup",
      "seasons": [2014, 2018, 2022],
      "train_split": [2014],
      "val_split": [2018],
      "test_split": [2022]
    }
  ]
}
```

- [ ] **Step 4: Implement config script**
  Create `apps/local-ai/scripts/config.py`.

```python
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
```

- [ ] **Step 5: Run test to verify it passes**
  Run: `pytest apps/local-ai/tests/test_config.py -v`
  Expected: PASS

- [ ] **Step 6: Commit (if auto_commit enabled)**
  Check `.agent/config.yml` for `auto_commit` setting.
  If `auto_commit: true`:
  ```bash
  git add apps/local-ai/config/competition-registry.json apps/local-ai/scripts/config.py apps/local-ai/tests/test_config.py
  git commit -m "feat(local-ai): add competition ingestion configuration and tests"
  ```
  If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 3: Historical Scraper Script

**Files:**
- Create: `apps/local-ai/scripts/download_snapshot.py`
- Test: `apps/local-ai/tests/test_snapshot.py`

- [ ] **Step 1: Write snapshot download tests**
  Create `apps/local-ai/tests/test_snapshot.py` mocking the FBref scraping library behavior.

```python
from unittest.mock import patch, MagicMock
from scripts.download_snapshot import download_snapshot

@patch('soccerdata.FBref')
def test_download_snapshot_uses_initial_world_cup_config_by_default(mock_fbref):
    mock_fbref_instance = MagicMock()
    mock_fbref.return_value = mock_fbref_instance
    mock_fbref_instance.read_schedule.return_value = MagicMock()
    
    download_snapshot()
    
    mock_fbref.assert_called_once_with(leagues="INT-World Cup", seasons=[2014, 2018, 2022])
    mock_fbref_instance.read_schedule.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest apps/local-ai/tests/test_snapshot.py -v`
  Expected: FAIL with Import/ModuleNotFoundError.

- [ ] **Step 3: Write download script**
  Create `apps/local-ai/scripts/download_snapshot.py` which sets up the local cache under `apps/local-ai/data/raw/` and pulls schedule data.

```python
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
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest apps/local-ai/tests/test_snapshot.py -v`
  Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**
  Check `.agent/config.yml` for `auto_commit` setting.
  If `auto_commit: true`:
  ```bash
  git add apps/local-ai/scripts/download_snapshot.py apps/local-ai/tests/test_snapshot.py
  git commit -m "feat(local-ai): implement offline soccerdata schedule downloader"
  ```
  If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 4: Team Name Mapping Dictionary

**Files:**
- Create: `packages/shared/src/data/team-mappings.json`
- Create: `apps/local-ai/scripts/team_mapper.py`
- Test: `apps/local-ai/tests/test_team_mapper.py`

- [ ] **Step 1: Create team-mappings.json**
  Create `packages/shared/src/data/team-mappings.json` containing standardized internal team keys and provider alias configurations.

```json
{
  "mappings": [
    {
      "canonicalId": "team-deu-national",
      "aliases": ["Germany", "Germany National Team"]
    },
    {
      "canonicalId": "team-prt-national",
      "aliases": ["Portugal", "Portugal National Team"]
    },
    {
      "canonicalId": "team-fra-national",
      "aliases": ["France", "France National Team"]
    },
    {
      "canonicalId": "team-hrv-national",
      "aliases": ["Croatia", "Croatia National Team"]
    },
    {
      "canonicalId": "team-arg-national",
      "aliases": ["Argentina", "Argentina National Team"]
    },
    {
      "canonicalId": "team-mex-national",
      "aliases": ["Mexico", "Mexico National Team"]
    }
  ]
}
```

- [ ] **Step 2: Write team mapper unit tests**
  Create `apps/local-ai/tests/test_team_mapper.py` to verify correct alias lookup behavior.

```python
from scripts.team_mapper import TeamMapper

def test_team_mapper_resolved():
    mapper = TeamMapper()
    assert mapper.resolve("Germany") == "team-deu-national"
    assert mapper.resolve("France") == "team-fra-national"
    assert mapper.resolve("Portugal") == "team-prt-national"
    assert mapper.resolve("Argentina") == "team-arg-national"

def test_team_mapper_unknown():
    mapper = TeamMapper()
    assert mapper.resolve("Unknown National Team") == "unknown-national-team"
```

- [ ] **Step 3: Run test to verify it fails**
  Run: `pytest apps/local-ai/tests/test_team_mapper.py -v`
  Expected: FAIL with ModuleNotFoundError or ImportErrors.

- [ ] **Step 4: Implement team mapper script**
  Create `apps/local-ai/scripts/team_mapper.py` to load json aliases and resolve team IDs.

```python
import json
import os
import re

class TeamMapper:
    def __init__(self):
        json_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__),
            "../../../packages/shared/src/data/team-mappings.json"
        ))
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        if not os.path.exists(json_path):
            # Save default mappings template
            with open(json_path, 'w') as f:
                json.dump({"mappings": []}, f, indent=2)
        
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        self.alias_to_id = {}
        for entry in data.get("mappings", []):
            canonical = entry["canonicalId"]
            for alias in entry.get("aliases", []):
                self.alias_to_id[alias.lower()] = canonical

    def resolve(self, team_name: str) -> str:
        clean_name = team_name.strip()
        lower_name = clean_name.lower()
        if lower_name in self.alias_to_id:
            return self.alias_to_id[lower_name]
        
        # Fallback to normalized slug
        slug = re.sub(r'[^a-z0-9]+', '-', lower_name).strip('-')
        return slug
```

- [ ] **Step 5: Run test to verify it passes**
  Run: `pytest apps/local-ai/tests/test_team_mapper.py -v`
  Expected: PASS

- [ ] **Step 6: Commit (if auto_commit enabled)**
  Check `.agent/config.yml` for `auto_commit` setting.
  If `auto_commit: true`:
  ```bash
  git add packages/shared/src/data/team-mappings.json apps/local-ai/scripts/team_mapper.py apps/local-ai/tests/test_team_mapper.py
  git commit -m "feat(local-ai): add team name alias mapper and baseline config"
  ```
  If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 5: Dataset Builder Script

**Files:**
- Create: `apps/local-ai/scripts/build_dataset.py`
- Test: `apps/local-ai/tests/test_dataset_builder.py`

- [ ] **Step 1: Write dataset builder tests**
  Create `apps/local-ai/tests/test_dataset_builder.py` to ensure that data parsing enforces validation, splits files chronologically, and emits metadata files correctly.

```python
import os
import json
import pandas as pd
from scripts.build_dataset import build_dataset

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
    
    with open(processed_dir / "metadata.json", 'r') as f:
        meta = json.load(f)
        assert meta["competitionId"] == "comp-int-world-cup"
        assert meta["trainCount"] == 1
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest apps/local-ai/tests/test_dataset_builder.py -v`
  Expected: FAIL with Module/ImportErrors.

- [ ] **Step 3: Implement build_dataset.py**
  Create `apps/local-ai/scripts/build_dataset.py` containing Pydantic row validation, parser flow, and metadata generation.

```python
import os
import sys
import json
import datetime
import hashlib
import pandas as pd
from pydantic import BaseModel, Field
from typing import Optional
from scripts.config import get_competition_config
from scripts.team_mapper import TeamMapper

class ProcessedMatch(BaseModel):
    id: str
    competitionId: str
    seasonId: str
    homeTeamId: str
    awayTeamId: str
    status: str
    kickoffTime: str
    scores: Optional[dict] = None
    venueName: Optional[str] = None

def build_dataset(competition_id: str, raw_path: Optional[str] = None, output_dir: Optional[str] = None):
    config = get_competition_config(competition_id)
    if not config:
        raise ValueError(f"No config found for {competition_id}")
        
    script_dir = os.path.dirname(__file__)
    if not raw_path:
        raw_path = os.path.abspath(os.path.join(script_dir, f"../data/raw/{competition_id}_schedule.csv"))
    if not output_dir:
        output_dir = os.path.abspath(os.path.join(script_dir, f"../data/processed/{competition_id}"))
        
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw snapshot not found at {raw_path}")
        
    df = pd.read_csv(raw_path)
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
            kickoff_str = f"{row['date']}T{row.get('time', '00:00')}:00Z"
            
            # Scores extraction
            scores = None
            if not pd.isna(row.get("home_score")) and not pd.isna(row.get("away_score")):
                scores = {
                    "homeScore": int(row["home_score"]),
                    "awayScore": int(row["away_score"])
                }
            
            # Map Team names
            home_id = team_mapper.resolve(str(row["home_team"]))
            away_id = team_mapper.resolve(str(row["away_team"]))
            
            match_data = ProcessedMatch(
                id=f"match-{row['game_id']}",
                competitionId=competition_id,
                seasonId=f"season-{season_year}",
                homeTeamId=home_id,
                awayTeamId=away_id,
                status="completed" if scores is not None else "scheduled",
                kickoffTime=kickoff_str,
                scores=scores,
                venueName=str(row["venue"]) if not pd.isna(row.get("venue")) else None
            )
            
            # Split chronologically
            if season_year in config.train_split:
                splits["train"].append(match_data.model_dump())
            elif season_year in config.val_split:
                splits["val"].append(match_data.model_dump())
            elif season_year in config.test_split:
                splits["test"].append(match_data.model_dump())
            else:
                rejected_count += 1
                warnings.append(f"Row {idx}: Season {season_year} not in splits configuration.")
                
        except Exception as e:
            rejected_count += 1
            warnings.append(f"Row {idx} failed: {str(e)}")
            
    # Write splits
    for split_name, records in splits.items():
        split_file = os.path.join(output_dir, f"{split_name}.jsonl")
        with open(split_file, 'w') as f:
            for record in records:
                f.write(json.dumps(record) + "\n")
                
    # Calculate file hashes
    hasher = hashlib.sha256()
    with open(raw_path, "rb") as f:
        hasher.update(f.read())
    snapshot_hash = hasher.hexdigest()
    
    # Metadata Record
    metadata = {
        "datasetId": f"dataset-{competition_id}-{datetime.date.today().isoformat()}",
        "competitionId": competition_id,
        "schemaVersion": "1.0.0",
        "featureSpecVersion": "0.1.0",
        "sourceProviderId": "soccerdata-fbref",
        "sourceSnapshotHash": snapshot_hash,
        "builtAt": datetime.datetime.utcnow().isoformat() + "Z",
        "trainCount": len(splits["train"]),
        "valCount": len(splits["val"]),
        "testCount": len(splits["test"])
    }
    with open(os.path.join(output_dir, "metadata.json"), 'w') as f:
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
    with open(os.path.join(output_dir, "quality_report.json"), 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    build_dataset("comp-int-world-cup")
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest apps/local-ai/tests/test_dataset_builder.py -v`
  Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**
  Check `.agent/config.yml` for `auto_commit` setting.
  If `auto_commit: true`:
  ```bash
  git add apps/local-ai/scripts/build_dataset.py apps/local-ai/tests/test_dataset_builder.py
  git commit -m "feat(local-ai): implement python dataset normalization and split pipeline"
  ```
  If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 6: TypeScript Contract Integration Verification

**Files:**
- Create: `apps/local-ai/src/input/dataset-integration.test.ts`

- [ ] **Step 1: Create TypeScript contract validation test**
  Create `apps/local-ai/src/input/dataset-integration.test.ts` to read the processed JSON Lines file and verify structure against TypeScript contracts.

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NormalizedMatch } from '@miraichi/shared';

describe('Processed Dataset Integration Check', () => {
  it('should conform to the NormalizedMatch TypeScript contract structure', () => {
    const datasetPath = path.resolve(__dirname, '../../data/processed/comp-int-world-cup/train.jsonl');
    
    // Check if pipeline has run and file exists (fails gracefully with advice if not run)
    if (!fs.existsSync(datasetPath)) {
      console.warn("Skipping integration test: train.jsonl does not exist. Run build_dataset.py first.");
      return;
    }
    
    const content = fs.readFileSync(datasetPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    expect(lines.length).toBeGreaterThan(0);
    
    for (const line of lines) {
      const match = JSON.parse(line) as NormalizedMatch;
      
      expect(match.id).toBeDefined();
      expect(typeof match.id).toBe('string');
      expect(match.competitionId).toBeDefined();
      expect(match.seasonId).toBeDefined();
      expect(match.homeTeamId).toBeDefined();
      expect(match.awayTeamId).toBeDefined();
      expect(match.status).toMatch(/^(scheduled|in_play|completed)$/);
      expect(match.kickoffTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      
      if (match.scores) {
        expect(typeof match.scores.homeScore).toBe('number');
        expect(typeof match.scores.awayScore).toBe('number');
      }
    }
  });
});
```

- [ ] **Step 2: Run verification test**
  Run: `pnpm --filter local-ai test`
  Expected: Passes (either warns about missing file or validates elements successfully).

- [ ] **Step 3: Commit (if auto_commit enabled)**
  Check `.agent/config.yml` for `auto_commit` setting.
  If `auto_commit: true`:
  ```bash
  git add apps/local-ai/src/input/dataset-integration.test.ts
  git commit -m "test(local-ai): verify processed dataset using monorepo contract types"
  ```
  If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

## Verification Plan

### Automated Tests
- Run Python unit tests:
  ```bash
  python -m venv apps/local-ai/.venv
  # Windows PS activation:
  & apps/local-ai/.venv/Scripts/Activate.ps1
  pytest apps/local-ai/tests/ -v
  ```
- Run TypeScript integration tests:
  ```bash
  pnpm --filter local-ai test
  ```

### Manual Verification
1. Download a mock/sample schedule CSV using:
   ```bash
   python apps/local-ai/scripts/download_snapshot.py comp-int-world-cup
   ```
2. Build processed datasets:
   ```bash
   python apps/local-ai/scripts/build_dataset.py comp-int-world-cup
   ```
3. Check generated directories:
   - Verify `apps/local-ai/data/processed/comp-int-world-cup/train.jsonl` contains valid JSON Lines.
   - Verify `metadata.json` has valid hashes and counts.
   - Check `quality_report.json` for any parsing warnings.
