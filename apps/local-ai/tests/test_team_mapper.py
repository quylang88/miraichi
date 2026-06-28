import os
import pytest
from unittest.mock import patch
from scripts.team_mapper import TeamMapper

def test_team_mapper_resolved():
    mapper = TeamMapper()
    assert mapper.resolve("Man United") == "team-eng-man-united"
    assert mapper.resolve("Manchester United") == "team-eng-man-united"
    assert mapper.resolve("Arsenal") == "team-eng-arsenal"

def test_team_mapper_unknown():
    mapper = TeamMapper()
    assert mapper.resolve("Unknown Team FC") == "unknown-team-fc"

def test_team_mapper_accented():
    mapper = TeamMapper()
    assert mapper.resolve("Bayern München") == "bayern-munchen"

def test_team_mapper_case_spacing():
    mapper = TeamMapper()
    assert mapper.resolve("  man united  ") == "team-eng-man-united"
    assert mapper.resolve("  MAN UNITED  ") == "team-eng-man-united"

def test_team_mapper_file_missing():
    with patch("scripts.team_mapper.os.path.exists") as mock_exists:
        mock_exists.return_value = False
        with pytest.raises(FileNotFoundError):
            TeamMapper()
