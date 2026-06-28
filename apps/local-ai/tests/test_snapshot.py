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
