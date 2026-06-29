# Kế Hoạch Triển Khai Phase 8.6D: Bổ Sung Dữ Liệu Raw Sofascore (Phạt Góc, Thẻ Phạt, Phút Ghi Bàn, Vòng Đấu)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng đường ống thu thập dữ liệu (ingestion pipeline) từ Sofascore Direct API để bổ sung các trường thông tin chi tiết bao gồm phạt góc, thẻ phạt (vàng/đỏ), phút ghi bàn cụ thể, và thông tin vòng đấu vào file raw CSV cũng như các phân tách dữ liệu processed JSONL.

**Architecture:** 
1. Cải tiến Python proxy client trong script chạy thu thập dữ liệu để thực hiện thêm các cuộc gọi API phụ trợ lấy thông tin `statistics` và `incidents` cho từng trận đấu của Sofascore.
2. Lưu các thông số mới thu thập được vào file raw CSV tại `apps/local-ai/data/raw/` dưới dạng các cột phẳng bổ sung.
3. Kích hoạt cache của `soccerdata` (`no_cache=False`) để lưu các JSON phản hồi cục bộ nhằm tránh bị chặn API do tần suất gọi lớn.
4. Cập nhật Parser dữ liệu `build_dataset.py` để phân tích các cột mới này và ghi vào file processed JSONL.

**Tech Stack:** Python 3 (pandas, pydantic v2, soccerdata), TypeScript (Node.js, child_process, vitest).

---

## Các Tác Vụ Cần Thực Hiện

### Tác Vụ 1: Nâng Cấp Kiểu Dữ Liệu Của Sofascore Client
Mở rộng định nghĩa kiểu dữ liệu trong codebase TypeScript để hỗ trợ các trường thông tin chi tiết mới từ Sofascore API.

**Files:**
- Modify: [sofascore-national-team-discovery.ts](file:///c:/CODE/miraichi/apps/local-ai/src/data/sofascore-national-team-discovery.ts)

- [ ] **Step 1: Viết mã nguồn mở rộng SofascoreEvent và Client interface**
  Cập nhật định nghĩa kiểu dữ liệu để bao gồm các thông số bổ sung.
  ```typescript
  export type SofascoreEvent = {
    eventId: number;
    startTimestamp: number;
    statusCode: number;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number | null;
    awayScore: number | null;
    cornersHome?: number | null;
    cornersAway?: number | null;
    yellowHome?: number | null;
    yellowAway?: number | null;
    redHome?: number | null;
    redAway?: number | null;
    goalsHome?: string | null;
    goalsAway?: string | null;
  };
  ```

- [ ] **Step 2: Chạy kiểm thử kiểu dữ liệu TypeScript**
  Run: `pnpm run typecheck`
  Expected: PASS không lỗi cú pháp.

- [ ] **Step 3: Commit (nếu auto_commit được bật)**
  Kiểm tra thiết lập `auto_commit` trong `.agent/config.yml`.
  Nếu `auto_commit: true` hoặc không có cấu hình:
  ```bash
  git add apps/local-ai/src/data/sofascore-national-team-discovery.ts
  git commit -m "chore: extend SofascoreEvent type with advanced stats"
  ```
  Nếu `auto_commit: false`: bỏ qua bước commit.

---

### Tác Vụ 2: Nâng Cấp Python Proxy Trong Ingestion Script
Cập nhật hàm `fetchEventsForRound` trong script TypeScript gọi Python để lấy thông tin chi tiết về phạt góc, thẻ phạt, và phút ghi bàn từ các endpoint `/statistics` và `/incidents`.

**Files:**
- Modify: [phase8-sofascore-national-team-ingestion-verify.ts](file:///c:/CODE/miraichi/scripts/phase8-sofascore-national-team-ingestion-verify.ts)

- [ ] **Step 1: Cập nhật hàm fetchEventsForRound của Ingestion Client**
  Sửa mã nguồn Python bên trong hàm `fetchEventsForRound` để thực hiện gọi thêm các API con và trích xuất dữ liệu, đồng thời chuyển cấu hình `no_cache` thành `False`.
  ```typescript
  export function createPythonSofascoreIngestionClient(rootDir: string): SofascoreDiscoveryClient {
    return {
      async fetchSeasons(tournamentId: number): Promise<SofascoreSeason[]> {
        return runPythonJson<SofascoreSeason[]>(
          rootDir,
          `
  import contextlib, io, json
  from soccerdata._common import BaseRequestsReader
  class Reader(BaseRequestsReader):
      pass
  with contextlib.redirect_stdout(io.StringIO()):
      reader = Reader(no_cache=False, no_store=False)
      data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/seasons"))
  print(json.dumps([
      {"name": season.get("name", ""), "year": str(season.get("year", "")), "seasonId": season.get("id")}
      for season in data.get("seasons", [])
  ]))
  `.trim()
        );
      },
      async fetchRounds(tournamentId: number, seasonId: number): Promise<SofascoreRound[]> {
        return runPythonJson<SofascoreRound[]>(
          rootDir,
          `
  import contextlib, io, json
  from soccerdata._common import BaseRequestsReader
  class Reader(BaseRequestsReader):
      pass
  with contextlib.redirect_stdout(io.StringIO()):
      reader = Reader(no_cache=False, no_store=False)
      data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/rounds"))
  print(json.dumps([
      {"round": item.get("round"), "name": item.get("name")}
      for item in data.get("rounds", [])
  ]))
  `.trim()
        );
      },
      async fetchEventsForRound(tournamentId: number, seasonId: number, round: number): Promise<SofascoreEvent[]> {
        return runPythonJson<SofascoreEvent[]>(
          rootDir,
          `
  import contextlib, io, json
  from soccerdata._common import BaseRequestsReader
  class Reader(BaseRequestsReader):
      pass
  with contextlib.redirect_stdout(io.StringIO()):
      reader = Reader(no_cache=False, no_store=False)
      data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/events/round/${round}"))
  events = []
  for event in data.get("events", []):
      event_id = event.get("id")
      corners_home = None
      corners_away = None
      yellow_home = None
      yellow_away = None
      red_home = None
      red_away = None
      
      try:
          stats_data = json.load(reader.get(f"https://api.sofascore.com/api/v1/event/{event_id}/statistics"))
          for period in stats_data.get("statistics", []):
              if period.get("period") == "ALL":
                  for group in period.get("groups", []):
                      if group.get("groupName") == "Match overview":
                          for item in group.get("statisticsItems", []):
                              if item.get("name") == "Corner kicks":
                                  corners_home = int(item.get("homeValue", 0))
                                  corners_away = int(item.get("awayValue", 0))
                              elif item.get("name") == "Yellow cards":
                                  yellow_home = int(item.get("homeValue", 0))
                                  yellow_away = int(item.get("awayValue", 0))
                              elif item.get("name") == "Red cards":
                                  red_home = int(item.get("homeValue", 0))
                                  red_away = int(item.get("awayValue", 0))
      except Exception:
          pass

      goals_home = []
      goals_away = []
      try:
          incidents_data = json.load(reader.get(f"https://api.sofascore.com/api/v1/event/{event_id}/incidents"))
          for inc in incidents_data.get("incidents", []):
              if inc.get("incidentType") == "goal":
                  time_str = str(inc.get("time"))
                  if inc.get("addedTime"):
                      time_str += f"+{inc.get('addedTime')}"
                  if inc.get("isHome"):
                      goals_home.append(time_str)
                  else:
                      goals_away.append(time_str)
      except Exception:
          pass

      goals_home.reverse()
      goals_away.reverse()

      events.append({
          "eventId": event_id,
          "startTimestamp": event.get("startTimestamp"),
          "statusCode": event.get("status", {}).get("code"),
          "homeTeamName": event.get("homeTeam", {}).get("name", ""),
          "awayTeamName": event.get("awayTeam", {}).get("name", ""),
          "homeScore": event.get("homeScore", {}).get("current"),
          "awayScore": event.get("awayScore", {}).get("current"),
          "cornersHome": corners_home,
          "cornersAway": corners_away,
          "yellowHome": yellow_home,
          "yellowAway": yellow_away,
          "redHome": red_home,
          "redAway": red_away,
          "goalsHome": ",".join(goals_home) if goals_home else "",
          "goalsAway": ",".join(goals_away) if goals_away else ""
      })
  print(json.dumps(events))
  `.trim()
        );
      }
    };
  }
  ```

- [ ] **Step 2: Commit (nếu auto_commit được bật)**
  Nếu `auto_commit: true`:
  ```bash
  git add scripts/phase8-sofascore-national-team-ingestion-verify.ts
  git commit -m "feat: upgrade python sofascore client with detailed stats & incidents query"
  ```

---

### Tác Vụ 3: Ghi Dữ Liệu Chi Tiết Ra Raw CSV
Cập nhật hàm ghi CSV `ingestSofascoreNationalTeamData` để định dạng các cột mới bổ sung.

**Files:**
- Modify: [phase8-sofascore-national-team-ingestion-verify.ts](file:///c:/CODE/miraichi/scripts/phase8-sofascore-national-team-ingestion-verify.ts)

- [ ] **Step 1: Cập nhật hàm ghi CSV với vòng đấu và thống kê**
  Thay đổi luồng xử lý `allEvents` để bao gồm cả `roundName` và ghi thêm 9 cột mới vào CSV: `round`, `corners_home`, `corners_away`, `yellow_cards_home`, `yellow_cards_away`, `red_cards_home`, `red_cards_away`, `goal_minutes_home`, `goal_minutes_away`.
  ```typescript
      const allEvents: { event: SofascoreEvent; seasonYear: number; roundName: string }[] = [];

      for (const season of completedSeasons) {
        const seasonYear = extractSeasonYear(season.year);
        try {
          const rounds = await client.fetchRounds(competition.sofascoreUniqueTournamentId, season.seasonId);
          for (const round of rounds) {
            const roundName = round.name || `Round ${round.round}`;
            try {
              const events = await client.fetchEventsForRound(
                competition.sofascoreUniqueTournamentId,
                season.seasonId,
                round.round
              );
              for (const event of events) {
                allEvents.push({ event, seasonYear, roundName });
              }
            } catch (roundError) {
              console.warn(`[Ingestion] Warning: Failed to fetch events for ${competition.competitionId} season ${season.name} round ${round.round}: ${roundError}`);
            }
          }
        } catch (roundsError) {
          console.warn(`[Ingestion] Warning: Failed to fetch rounds for ${competition.competitionId} season ${season.name}: ${roundsError}`);
        }
      }

      if (allEvents.length === 0) {
        console.warn(`[Ingestion] Warning: No events found for ${competition.competitionId}. Skipping CSV write.`);
        continue;
      }

      // Write raw CSV file
      const rawCsvDir = path.join(rootDir, 'apps/local-ai/data/raw');
      fs.mkdirSync(rawCsvDir, { recursive: true });
      const csvPath = path.join(rawCsvDir, `${competition.competitionId}_schedule.csv`);
      
      let csvContent = 'game_id,date,season,time,home_team,away_team,home_score,away_score,venue,round,corners_home,corners_away,yellow_cards_home,yellow_cards_away,red_cards_home,red_cards_away,goal_minutes_home,goal_minutes_away\n';
      
      for (const { event, seasonYear, roundName } of allEvents) {
        const dateObj = new Date(event.startTimestamp * 1000);
        const dateStr = dateObj.toISOString().split('T')[0];
        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        const homeScoreStr = event.homeScore !== null && event.homeScore !== undefined ? String(event.homeScore) : '';
        const awayScoreStr = event.awayScore !== null && event.awayScore !== undefined ? String(event.awayScore) : '';
        
        const escape = (str: string) => {
          if (!str) return '';
          return str.includes(',') ? `"${str}"` : str;
        };
        
        const cHome = event.cornersHome !== null && event.cornersHome !== undefined ? String(event.cornersHome) : '';
        const cAway = event.cornersAway !== null && event.cornersAway !== undefined ? String(event.cornersAway) : '';
        const yHome = event.yellowHome !== null && event.yellowHome !== undefined ? String(event.yellowHome) : '';
        const yAway = event.yellowAway !== null && event.yellowAway !== undefined ? String(event.yellowAway) : '';
        const rHome = event.redHome !== null && event.redHome !== undefined ? String(event.redHome) : '';
        const rAway = event.redAway !== null && event.redAway !== undefined ? String(event.redAway) : '';
        const gHome = event.goalsHome || '';
        const gAway = event.goalsAway || '';
        
        csvContent += `${event.eventId},${dateStr},${seasonYear},${timeStr},${escape(event.homeTeamName)},${escape(event.awayTeamName)},${homeScoreStr},${awayScoreStr},,${escape(roundName)},${cHome},${cAway},${yHome},${yAway},${rHome},${rAway},${escape(gHome)},${escape(gAway)}\n`;
      }

      fs.writeFileSync(csvPath, csvContent, 'utf8');
  ```

- [ ] **Step 2: Viết/Cập nhật Unit Test cho Ingestion Verifier**
  Cập nhật file kiểm thử [phase8-sofascore-national-team-ingestion-verify.test.ts](file:///c:/CODE/miraichi/scripts/phase8-sofascore-national-team-ingestion-verify.test.ts) để kiểm tra các trường mới trong mock client và file raw CSV.
  ```typescript
  // Modify scripts/phase8-sofascore-national-team-ingestion-verify.test.ts
  // Thay đổi hàm mock createFixtureIngestionClient
  export function createFixtureIngestionClient(): SofascoreDiscoveryClient {
    return {
      async fetchSeasons() {
        return [
          { name: 'Fixture Cup 2024', year: '2024', seasonId: 8000 }
        ];
      },
      async fetchRounds() {
        return [{ round: 1, name: 'Group stage' }];
      },
      async fetchEventsForRound() {
        return [
          {
            eventId: 11761871,
            startTimestamp: 1705176000,
            statusCode: 100,
            homeTeamName: 'Cote d Ivoire',
            awayTeamName: 'Guinea-Bissau',
            homeScore: 2,
            awayScore: 0,
            cornersHome: 6,
            cornersAway: 2,
            yellowHome: 2,
            yellowAway: 1,
            redHome: 0,
            redAway: 0,
            goalsHome: '4,30',
            goalsAway: ''
          }
        ];
      }
    };
  }
  ```
  Và sửa assertion cuối test:
  ```typescript
  expect(csvContent).toContain('11761871,2024-01-13,2023,20:00,Cote d Ivoire,Guinea-Bissau,2,0,,Group stage,6,2,2,1,0,0,"4,30",');
  ```

- [ ] **Step 3: Chạy Unit Test kiểm thử Ingestion**
  Run: `pnpm vitest run scripts/phase8-sofascore-national-team-ingestion-verify.test.ts`
  Expected: PASS.

- [ ] **Step 4: Commit (nếu auto_commit được bật)**
  Nếu `auto_commit: true`:
  ```bash
  git add scripts/phase8-sofascore-national-team-ingestion-verify.ts scripts/phase8-sofascore-national-team-ingestion-verify.test.ts
  git commit -m "feat: output round, corners, cards, and goal minutes to raw CSV and update verification tests"
  ```

---

### Tác Vụ 4: Nâng Cấp Dataset Builder Python
Cập nhật parser Python và định nghĩa Pydantic để phân tích cú pháp các cột bổ sung từ file raw CSV và ghi cấu trúc lồng nhau vào các split JSONL.

**Files:**
- Modify: [build_dataset.py](file:///c:/CODE/miraichi/apps/local-ai/scripts/build_dataset.py)

- [ ] **Step 1: Định nghĩa lại các Pydantic Sub-models và ProcessedMatch**
  Thêm các trường `round`, `stats` và `incidents` vào cấu trúc mô hình.
  ```python
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
  ```

- [ ] **Step 2: Cập nhật hàm trích xuất build_dataset**
  Sửa mã nguồn trích xuất dữ liệu từ các cột mới của CSV.
  ```python
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
  ```

- [ ] **Step 3: Cập nhật Unit Test cho Dataset Builder**
  Cập nhật file kiểm thử [test_dataset_builder.py](file:///c:/CODE/miraichi/apps/local-ai/tests/test_dataset_builder.py) để kiểm thử dữ liệu đầu vào chứa các cột thống kê mới này và xác nhận cấu trúc dữ liệu JSONL đầu ra chính xác.
  ```python
      # Setup raw CSV data
      raw_csv = tmp_path / "comp-int-world-cup_schedule.csv"
      data = {
          "season": [2014],
          "date": ["2014-06-16"],
          "time": ["13:00"],
          "home_team": ["Germany"],
          "away_team": ["Portugal"],
          "home_score": [4.0],
          "away_score": [0.0],
          "venue": ["Arena Fonte Nova"],
          "game_id": ["wc-2014-sample-1"],
          "round": ["Group stage"],
          "corners_home": [6.0],
          "corners_away": [2.0],
          "yellow_cards_home": [1.0],
          "yellow_cards_away": [1.0],
          "red_cards_home": [0.0],
          "red_cards_away": [1.0],
          "goal_minutes_home": ["12,45"],
          "goal_minutes_away": [""]
      }
  ```
  Và thêm assertions:
  ```python
          assert record["round"] == "Group stage"
          assert record["stats"]["corners"] == {"home": 6, "away": 2}
          assert record["stats"]["cards"]["yellow"] == {"home": 1, "away": 1}
          assert record["stats"]["cards"]["red"] == {"home": 0, "away": 1}
          assert record["incidents"]["goals"] == [
              {"time": "12", "isHome": True},
              {"time": "45", "isHome": True}
          ]
  ```

- [ ] **Step 4: Chạy Unit Test Python**
  Run: `pnpm --filter local-ai run test`
  Expected: PASS.

- [ ] **Step 5: Commit (nếu auto_commit được bật)**
  Nếu `auto_commit: true`:
  ```bash
  git add apps/local-ai/scripts/build_dataset.py apps/local-ai/tests/test_dataset_builder.py
  git commit -m "feat: parse and output advanced stats in build_dataset.py with test coverage"
  ```

---

### Tác Vụ 5: Chạy Tích Hợp Và Tải Lại Toàn Bộ Dữ Liệu
Chạy toàn bộ đường ống thu thập dữ liệu để nạp lại dữ liệu raw, biên dịch lại toàn bộ các split huấn luyện mới và chạy kiểm thử tích hợp.

**Files:**
- Modify: Không có (Chỉ thực thi lệnh)

- [ ] **Step 1: Thực thi lệnh tải lại dữ liệu từ Sofascore**
  Chạy lệnh để tải và cập nhật file raw CSV cho cả 7 giải đấu quốc gia.
  Run: `pnpm run phase8:sofascore-national-team-ingestion`
  Expected: Ingestion PASSED và dữ liệu splits được xây dựng lại thành công.

- [ ] **Step 2: Xác thực chất lượng cục bộ**
  Run: `pnpm run verify:local`
  Expected: Tất cả bài kiểm tra unit, lints, typechecks và audit guardrails đều PASS.

- [ ] **Step 3: Chạy kiểm thử tích hợp monorepo**
  Run: `pnpm run test:integration`
  Expected: PASS.

---

## Kế Hoạch Xác Minh (Verification Plan)

### Kiểm thử tự động:
1. `pnpm vitest run scripts/phase8-sofascore-national-team-ingestion-verify.test.ts`
2. `pnpm --filter local-ai run test`
3. `pnpm run verify:local`
4. `pnpm run test:integration`

### Kiểm thử thủ công:
- Mở một file JSONL bất kỳ trong thư mục `apps/local-ai/data/processed/comp-int-world-cup/train.jsonl` và xác thực rằng các trường `round`, `stats` và `incidents` đều tồn tại và có giá trị chuẩn xác.
