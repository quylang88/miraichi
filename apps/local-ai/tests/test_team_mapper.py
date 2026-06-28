import os
import pytest
from unittest.mock import patch
from scripts.team_mapper import TeamMapper

def test_team_mapper_resolved():
    mapper = TeamMapper()
    assert mapper.resolve("France") == "team-fra-national"
    assert mapper.resolve("Argentina") == "team-arg-national"
    assert mapper.resolve("Germany") == "team-deu-national"
    assert mapper.resolve("Portugal") == "team-prt-national"
    assert mapper.resolve("Croatia") == "team-hrv-national"
    assert mapper.resolve("Mexico") == "team-mex-national"

def test_team_mapper_unknown():
    mapper = TeamMapper()
    assert mapper.resolve("Unknown National Team") == "unknown-national-team"

def test_team_mapper_accented():
    mapper = TeamMapper()
    assert mapper.resolve("Bayern München") == "bayern-munchen"

def test_team_mapper_case_spacing():
    mapper = TeamMapper()
    assert mapper.resolve("  france  ") == "team-fra-national"
    assert mapper.resolve("  FRANCE  ") == "team-fra-national"

def test_team_mapper_file_missing():
    with patch("scripts.team_mapper.os.path.exists") as mock_exists:
        mock_exists.return_value = False
        with pytest.raises(FileNotFoundError):
            TeamMapper()
