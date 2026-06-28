# Phase 8.3A National-Team Dataset Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Phase 8 dataset from World Cup-only evidence to a national-team competition dataset gate before Phase 8.4 candidate model comparison.

**Architecture:** Phase 8.3A keeps the ingestion path registry-driven and national-team-first. Provider support must be discovered and recorded before a competition is enabled; unsupported competitions such as Copa America must not be faked into the processed dataset. The output is an owner-only dataset expansion report and aggregate evaluation readiness signal; no model training, runtime prediction, betting logic, or club competition support is authorized.

**Tech Stack:** Python for local offline `soccerdata` discovery/snapshot/build scripts, JSON registry and JSONL processed datasets, TypeScript/Vitest for evaluation loader aggregation, `tsx` for phase verification scripts. No new provider, paid API, secret, database, or external metrics dependency is allowed.

---

## Scope Boundary

### Allowed

- Add national-team competition metadata to `apps/local-ai/config/competition-registry.json`.
- Discover `soccerdata.FBref.available_leagues()` support and record unsupported national-team competitions separately.
- Add enabled national-team competitions only when the local provider confirms support.
- Build processed JSONL snapshots for enabled national-team competitions.
- Extend Phase 8.3 evaluation loading to aggregate multiple national-team processed datasets.
- Generate an owner-only Phase 8.3A dataset expansion report before Phase 8.4.

### Blocked

- No club competitions, including Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, or domestic cups.
- No fake Copa America dataset if `soccerdata` does not expose a clean source.
- No model training, model selection, candidate bake-off, ONNX, Elo/Poisson model implementation, LightGBM, CatBoost, XGBoost, or logistic regression.
- No runtime prediction route, public prediction surface, model-ready label, betting recommendation, stake sizing, Kelly, bankroll, ROI, or CLV logic.
- No paid providers, secrets, production database schema, staging deploy, or production promotion.

## Provider Reality Check

Current local `soccerdata` 1.9.0 discovery showed these relevant FBref leagues:

- `INT-World Cup`
- `INT-European Championship`
- `INT-Women's World Cup`

It did not list Copa America. Therefore Copa America is a desired future candidate, not an enabled dataset source, unless a later provider discovery report proves clean support.

## File Map

- Modify: `apps/local-ai/config/competition-registry.json` - add national-team metadata and enabled provider-confirmed competitions.
- Modify: `apps/local-ai/scripts/config.py` - type registry metadata and expose enabled national-team configs.
- Create: `apps/local-ai/scripts/discover_national_team_sources.py` - discover provider-supported national-team competitions.
- Create: `apps/local-ai/tests/test_discover_national_team_sources.py` - source discovery tests.
- Modify: `apps/local-ai/tests/test_config.py` - registry guardrail tests.
- Modify: `apps/local-ai/scripts/download_snapshot.py` - keep competition-specific downloads config-driven.
- Create: `apps/local-ai/scripts/build_national_team_datasets.py` - build all enabled national-team datasets.
- Create: `apps/local-ai/tests/test_build_national_team_datasets.py` - multi-dataset build tests.
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.ts` - add aggregate multi-competition loader.
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.test.ts` - aggregate loader tests.
- Modify: `scripts/phase8-evaluation-harness-verify.ts` - evaluate aggregate enabled national-team datasets.
- Create: `scripts/phase8-national-team-expansion-verify.ts` - Phase 8.3A verification report script.
- Modify: `package.json` - add `phase8:national-team-expansion`.
- Create: `apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json` - generated dataset expansion report.
- Create: `docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md` - generated owner report.
- Modify: `PROJECT_PLAN.md` - insert Phase 8.3A before Phase 8.4.

---

### Task 1: Add Provider Discovery For National-Team Competitions

**Files:**
- Create: `apps/local-ai/tests/test_discover_national_team_sources.py`
- Create: `apps/local-ai/scripts/discover_national_team_sources.py`

- [ ] **Step 1: Write the failing provider discovery tests**

Create `apps/local-ai/tests/test_discover_national_team_sources.py`:

```python
from scripts.discover_national_team_sources import classify_national_team_sources


def test_classify_national_team_sources_marks_provider_supported_leagues():
    report = classify_national_team_sources([
        "INT-World Cup",
        "INT-European Championship",
        "ENG-Premier League",
    ])

    world_cup = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-world-cup")
    euro = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-euro")
    copa = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-copa-america")
    premier_league = next(item for item in report["blockedClubCompetitions"] if item["providerLeague"] == "ENG-Premier League")

    assert world_cup["providerStatus"] == "supported"
    assert euro["providerStatus"] == "supported"
    assert copa["providerStatus"] == "unsupported"
    assert premier_league["blockedReason"] == "club_competition"


def test_classify_national_team_sources_does_not_enable_unsupported_copa_america():
    report = classify_national_team_sources(["INT-World Cup", "INT-European Championship"])
    copa = next(item for item in report["competitions"] if item["competitionId"] == "comp-int-copa-america")

    assert copa["enabledByDefault"] is False
    assert "not available from current FBref soccerdata discovery" in copa["blockedReason"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
apps\local-ai\.venv\Scripts\pytest apps/local-ai/tests/test_discover_national_team_sources.py -v
```

Expected: FAIL because `scripts.discover_national_team_sources` does not exist.

- [ ] **Step 3: Implement source discovery**

Create `apps/local-ai/scripts/discover_national_team_sources.py`:

```python
import json
import os
from typing import Iterable

import soccerdata as sd


DESIRED_NATIONAL_TEAM_COMPETITIONS = [
    {
        "competitionId": "comp-int-world-cup",
        "providerLeague": "INT-World Cup",
        "priority": "enabled",
    },
    {
        "competitionId": "comp-int-euro",
        "providerLeague": "INT-European Championship",
        "priority": "enabled",
    },
    {
        "competitionId": "comp-int-womens-world-cup",
        "providerLeague": "INT-Women's World Cup",
        "priority": "candidate",
    },
    {
        "competitionId": "comp-int-copa-america",
        "providerLeague": "INT-Copa America",
        "priority": "desired_future",
    },
]

BLOCKED_CLUB_PROVIDER_LEAGUES = [
    "ENG-Premier League",
    "ESP-La Liga",
    "GER-Bundesliga",
    "ITA-Serie A",
    "FRA-Ligue 1",
]


def classify_national_team_sources(provider_leagues: Iterable[str]) -> dict:
    provider_league_set = set(provider_leagues)
    competitions = []

    for item in DESIRED_NATIONAL_TEAM_COMPETITIONS:
        supported = item["providerLeague"] in provider_league_set
        competitions.append({
            "competitionId": item["competitionId"],
            "providerLeague": item["providerLeague"],
            "competitionType": "national_team",
            "providerStatus": "supported" if supported else "unsupported",
            "enabledByDefault": supported and item["priority"] == "enabled",
            "blockedReason": None if supported else f"{item['providerLeague']} is not available from current FBref soccerdata discovery.",
        })

    blocked_club_competitions = [
        {
            "providerLeague": league,
            "competitionType": "club",
            "blockedReason": "club_competition",
        }
        for league in BLOCKED_CLUB_PROVIDER_LEAGUES
        if league in provider_league_set
    ]

    return {
        "sourceProviderId": "soccerdata-fbref",
        "competitions": competitions,
        "blockedClubCompetitions": blocked_club_competitions,
    }


def discover_national_team_sources() -> dict:
    return classify_national_team_sources(sd.FBref.available_leagues())


def write_discovery_report(output_path: str) -> dict:
    report = discover_national_team_sources()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    return report


if __name__ == "__main__":
    report_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__),
        "../reports/phase-8-3a-national-team-source-discovery.json",
    ))
    report = write_discovery_report(report_path)
    print(f"[Phase 8.3A Source Discovery] Wrote {report_path}")
    print(json.dumps(report, indent=2))
```

- [ ] **Step 4: Run the discovery tests**

Run:

```bash
apps\local-ai\.venv\Scripts\pytest apps/local-ai/tests/test_discover_national_team_sources.py -v
```

Expected: PASS.

---

### Task 2: Extend Registry Metadata Without Enabling Club Competitions

**Files:**
- Modify: `apps/local-ai/config/competition-registry.json`
- Modify: `apps/local-ai/scripts/config.py`
- Modify: `apps/local-ai/tests/test_config.py`

- [ ] **Step 1: Write failing registry tests**

Append these tests to `apps/local-ai/tests/test_config.py`:

```python
def test_registry_marks_enabled_competitions_as_national_team_only():
    enabled = config.get_enabled_national_team_configs()

    assert {item.competition_id for item in enabled} == {"comp-int-world-cup", "comp-int-euro"}
    assert all(item.competition_type == "national_team" for item in enabled)
    assert all(item.enabled is True for item in enabled)


def test_copa_america_is_not_enabled_without_provider_support():
    cfg = get_competition_config("comp-int-copa-america")

    assert cfg is not None
    assert cfg.competition_type == "national_team"
    assert cfg.enabled is False
    assert cfg.provider_status == "unsupported"


def test_registry_rejects_enabled_club_competitions():
    with pytest.raises(ValidationError):
        IngestionConfig(
            competition_id="comp-eng-premier-league",
            soccerdata_league="ENG-Premier League",
            seasons=[2022, 2023, 2024],
            train_split=[2022],
            val_split=[2023],
            test_split=[2024],
            competition_type="club",
            provider_status="supported",
            enabled=True,
        )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
apps\local-ai\.venv\Scripts\pytest apps/local-ai/tests/test_config.py -v
```

Expected: FAIL because `IngestionConfig` does not expose the new fields and `get_enabled_national_team_configs` does not exist.

- [ ] **Step 3: Extend registry config types**

Modify `apps/local-ai/scripts/config.py`:

```python
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
```

- [ ] **Step 4: Extend the registry**

Modify `apps/local-ai/config/competition-registry.json`:

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
      "test_split": [2022],
      "competition_type": "national_team",
      "provider_status": "supported",
      "enabled": true
    },
    {
      "competition_id": "comp-int-euro",
      "soccerdata_league": "INT-European Championship",
      "seasons": [2016, 2021, 2024],
      "train_split": [2016],
      "val_split": [2021],
      "test_split": [2024],
      "competition_type": "national_team",
      "provider_status": "supported",
      "enabled": true
    },
    {
      "competition_id": "comp-int-copa-america",
      "soccerdata_league": "INT-Copa America",
      "seasons": [],
      "train_split": [],
      "val_split": [],
      "test_split": [],
      "competition_type": "national_team",
      "provider_status": "unsupported",
      "enabled": false
    }
  ]
}
```

- [ ] **Step 5: Run registry tests**

Run:

```bash
apps\local-ai\.venv\Scripts\pytest apps/local-ai/tests/test_config.py -v
```

Expected: PASS.

---

### Task 3: Build All Enabled National-Team Datasets Offline

**Files:**
- Create: `apps/local-ai/scripts/build_national_team_datasets.py`
- Create: `apps/local-ai/tests/test_build_national_team_datasets.py`

- [ ] **Step 1: Write failing multi-build tests**

Create `apps/local-ai/tests/test_build_national_team_datasets.py`:

```python
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
    ]

    for cfg in configs:
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

    with open(processed_root / "comp-int-euro" / "metadata.json", "r", encoding="utf-8") as f:
        metadata = json.load(f)
    assert metadata["competitionId"] == "comp-int-euro"
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
apps\local-ai\.venv\Scripts\pytest apps/local-ai/tests/test_build_national_team_datasets.py -v
```

Expected: FAIL because `build_national_team_datasets.py` does not exist.

- [ ] **Step 3: Implement the multi-build script**

Create `apps/local-ai/scripts/build_national_team_datasets.py`:

```python
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
    configs = list(configs or get_enabled_national_team_configs())

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
```

- [ ] **Step 4: Run the multi-build tests**

Run:

```bash
apps\local-ai\.venv\Scripts\pytest apps/local-ai/tests/test_build_national_team_datasets.py -v
```

Expected: PASS.

---

### Task 4: Aggregate Multiple National-Team Evaluation Datasets

**Files:**
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.ts`
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.test.ts`

- [ ] **Step 1: Write the failing aggregate loader test**

Append this test to `apps/local-ai/src/evaluation/evaluation-dataset.test.ts`:

```typescript
import { loadEvaluationDatasets } from './evaluation-dataset.js';

it('aggregates multiple national-team processed datasets', () => {
  const worldCupDir = path.resolve(__dirname, '../../data/processed/comp-int-world-cup');
  const dataset = loadEvaluationDatasets([worldCupDir, worldCupDir]);

  expect(dataset.competitionIds).toEqual(['comp-int-world-cup', 'comp-int-world-cup']);
  expect(dataset.train).toHaveLength(2);
  expect(dataset.validation).toHaveLength(2);
  expect(dataset.test).toHaveLength(2);
  expect(dataset.skippedRecordCount).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-dataset.test.ts
```

Expected: FAIL because `loadEvaluationDatasets` is not exported.

- [ ] **Step 3: Implement aggregate loader**

Add this type and function to `apps/local-ai/src/evaluation/evaluation-dataset.ts`:

```typescript
export type AggregateEvaluationDataset = EvaluationDataset & {
  competitionIds: string[];
};

export function loadEvaluationDatasets(processedDirs: readonly string[]): AggregateEvaluationDataset {
  if (processedDirs.length === 0) {
    throw new Error('At least one processed dataset directory is required.');
  }

  const datasets = processedDirs.map((processedDir) => loadEvaluationDataset(processedDir));
  const first = datasets[0];

  return {
    metadata: first.metadata,
    competitionId: first.competitionId,
    competitionIds: datasets.map((dataset) => dataset.competitionId),
    train: datasets.flatMap((dataset) => dataset.train),
    validation: datasets.flatMap((dataset) => dataset.validation),
    test: datasets.flatMap((dataset) => dataset.test),
    skippedRecordCount: datasets.reduce((sum, dataset) => sum + dataset.skippedRecordCount, 0),
  };
}
```

- [ ] **Step 4: Run the aggregate loader tests**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-dataset.test.ts
```

Expected: PASS.

---

### Task 5: Verify Phase 8.3A Dataset Expansion Readiness

**Files:**
- Create: `scripts/phase8-national-team-expansion-verify.ts`
- Modify: `package.json`
- Create: `apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json`
- Create: `docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md`

- [ ] **Step 1: Run the missing phase script to verify it fails**

Run:

```bash
pnpm exec tsx scripts/phase8-national-team-expansion-verify.ts
```

Expected: FAIL because the script does not exist.

- [ ] **Step 2: Implement the verification script**

Create `scripts/phase8-national-team-expansion-verify.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { loadEvaluationDatasets } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';

type RegistryCompetition = {
  competition_id: string;
  soccerdata_league: string;
  competition_type: 'national_team';
  provider_status: 'supported' | 'unsupported';
  enabled: boolean;
};

const rootDir = process.cwd();
const registryPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');
const processedRoot = path.join(rootDir, 'apps/local-ai/data/processed');
const reportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json');
const docsPath = path.join(rootDir, 'docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { competitions: RegistryCompetition[] };
const enabledCompetitions = registry.competitions.filter(
  (competition) =>
    competition.enabled &&
    competition.competition_type === 'national_team' &&
    competition.provider_status === 'supported'
);

const processedDirs = enabledCompetitions.map((competition) =>
  path.join(processedRoot, competition.competition_id)
);
const missingProcessedDirs = processedDirs.filter((processedDir) => !fs.existsSync(processedDir));

const dataset = missingProcessedDirs.length === 0
  ? loadEvaluationDatasets(processedDirs)
  : null;

const totalTestCount = dataset ? dataset.test.length : 0;
const phase84DataReady = missingProcessedDirs.length === 0 && totalTestCount >= 100;
const warnings = [];

if (enabledCompetitions.length < 2) {
  warnings.push('Fewer than two enabled national-team competitions are available.');
}

if (missingProcessedDirs.length > 0) {
  warnings.push(`Missing processed dataset directories: ${missingProcessedDirs.join(', ')}`);
}

if (totalTestCount < 100) {
  warnings.push('Aggregate national-team test sample count is below 100; Phase 8.4 remains blocked for meaningful model comparison.');
}

const report = {
  reportId: 'phase-8-3a-national-team-dataset-expansion',
  phase: '8.3A',
  status: phase84DataReady ? 'pass' : 'blocked_for_phase_8_4',
  enabledCompetitionIds: enabledCompetitions.map((competition) => competition.competition_id),
  totalTrainCount: dataset ? dataset.train.length : 0,
  totalValidationCount: dataset ? dataset.validation.length : 0,
  totalTestCount,
  missingProcessedDirs,
  phase84DataReady,
  warnings,
  blockedScope: [
    'club_competition_expansion',
    'candidate_model_bake_off_until_phase84DataReady',
    'runtime_prediction',
    'betting_recommendation',
  ],
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdown = `# Phase 8.3A National-Team Dataset Expansion Report

## Status
- **Status**: ${report.status}
- **Date**: 2026-06-28
- **Scope**: National-team dataset expansion before Phase 8.4.

## Evidence
- Enabled national-team competitions: ${report.enabledCompetitionIds.map((id) => `\`${id}\``).join(', ')}
- Total train count: ${report.totalTrainCount}
- Total validation count: ${report.totalValidationCount}
- Total test count: ${report.totalTestCount}
- Phase 8.4 data ready: ${report.phase84DataReady ? 'yes' : 'no'}

## Warnings
${report.warnings.map((warning) => `- ${warning}`).join('\n')}

## Blocked Scope
${report.blockedScope.map((scope) => `- ${scope}`).join('\n')}
`;

fs.writeFileSync(docsPath, markdown, 'utf8');

if (!phase84DataReady) {
  console.error(`[Phase 8.3A] BLOCKED for Phase 8.4. Report: ${reportPath}`);
  process.exit(1);
}

console.log(`[Phase 8.3A] PASSED. Report: ${reportPath}`);
```

- [ ] **Step 3: Add the package script**

Modify root `package.json` scripts:

```json
"phase8:national-team-expansion": "tsx scripts/phase8-national-team-expansion-verify.ts"
```

- [ ] **Step 4: Run the phase script before full snapshots exist**

Run:

```bash
pnpm run phase8:national-team-expansion
```

Expected: FAIL with `blocked_for_phase_8_4` until enabled processed datasets exist and aggregate test count is at least 100. This failure is correct before full national-team snapshots are built.

---

### Task 6: Generate Expanded Snapshots And Re-Run Phase 8.3 Evaluation

**Files:**
- Generated or updated under `apps/local-ai/data/raw/`
- Generated or updated under `apps/local-ai/data/processed/`
- Modify: `scripts/phase8-evaluation-harness-verify.ts`
- Modify: `docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md`

- [ ] **Step 1: Download enabled national-team snapshots locally**

Run:

```bash
apps\local-ai\.venv\Scripts\python.exe apps/local-ai/scripts/download_snapshot.py comp-int-world-cup
apps\local-ai\.venv\Scripts\python.exe apps/local-ai/scripts/download_snapshot.py comp-int-euro
```

Expected: raw CSV files exist:

- `apps/local-ai/data/raw/comp-int-world-cup_schedule.csv`
- `apps/local-ai/data/raw/comp-int-euro_schedule.csv`

- [ ] **Step 2: Build enabled national-team datasets**

Run:

```bash
apps\local-ai\.venv\Scripts\python.exe apps/local-ai/scripts/build_national_team_datasets.py
```

Expected: processed directories exist:

- `apps/local-ai/data/processed/comp-int-world-cup`
- `apps/local-ai/data/processed/comp-int-euro`

- [ ] **Step 3: Update Phase 8.3 harness to load enabled processed datasets**

Modify `scripts/phase8-evaluation-harness-verify.ts` to read enabled supported national-team competitions from the registry and call `loadEvaluationDatasets(processedDirs)` instead of loading only `comp-int-world-cup`.

```typescript
const registryPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
  competitions: Array<{
    competition_id: string;
    competition_type: 'national_team';
    provider_status: 'supported' | 'unsupported';
    enabled: boolean;
  }>;
};
const processedDirs = registry.competitions
  .filter((competition) =>
    competition.enabled &&
    competition.competition_type === 'national_team' &&
    competition.provider_status === 'supported'
  )
  .map((competition) => path.join(rootDir, 'apps/local-ai/data/processed', competition.competition_id));

const dataset = loadEvaluationDatasets(processedDirs);
```

- [ ] **Step 4: Run expansion and evaluation gates**

Run:

```bash
pnpm run phase8:national-team-expansion
pnpm run phase8:evaluation-harness
```

Expected:

- `phase8:national-team-expansion`: PASS only when aggregate test count is at least 100.
- `phase8:evaluation-harness`: PASS and report uses aggregate national-team data.

---

### Task 7: Close Phase 8.3A With Verification Evidence

**Files:**
- Modify: `PROJECT_PLAN.md`
- Modify: `docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md`

- [ ] **Step 1: Run full local verification**

Run:

```bash
pnpm --filter local-ai run test:python
pnpm --filter local-ai test
pnpm run phase8:national-team-expansion
pnpm run phase8:evaluation-harness
pnpm run verify:local
```

Expected: all commands pass. `phase8:national-team-expansion` must not pass unless `phase84DataReady` is true.

- [ ] **Step 2: Run integration gate**

Run:

```bash
pnpm run test:integration
```

Expected: PASS.

- [ ] **Step 3: Update Project Plan**

Modify `PROJECT_PLAN.md` after Phase 8.3 completion:

```markdown
- [x] Create `phase:implementation-plan Phase 8.3A National-Team Dataset Expansion`.
- [x] Complete Phase 8.3A National-Team Dataset Expansion before Phase 8.4, with provider-confirmed national-team competitions and aggregate evaluation readiness evidence.
- [ ] Create and complete Phase 8.4 Candidate Model Bake-Off before selecting any real model.
```

- [ ] **Step 4: Keep Copa America status honest**

In `docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md`, ensure the report states:

```markdown
Copa America remains desired future national-team scope, but it is not enabled until a clean provider source is confirmed.
```

## Self-Review Checklist

- Spec coverage: covers source discovery, registry expansion, offline builds, aggregate evaluation loading, readiness reporting, and Phase 8.4 blocking.
- Placeholder scan: no banned placeholder markers or vague test instructions.
- Type consistency: `competition_type`, `provider_status`, `enabled`, `loadEvaluationDatasets`, and `phase84DataReady` are consistent across tasks.
- Guardrails: no model training, no club competitions, no fake Copa America source, no runtime prediction, no betting logic, no paid provider, no secrets.
