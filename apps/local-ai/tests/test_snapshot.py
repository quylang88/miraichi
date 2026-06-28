from unittest.mock import patch, MagicMock
from scripts.download_snapshot import download_snapshot

@patch('soccerdata.FBref')
def test_download_snapshot_calls_soccerdata(mock_fbref):
    mock_fbref_instance = MagicMock()
    mock_fbref.return_value = mock_fbref_instance
    mock_fbref_instance.read_schedule.return_value = MagicMock()
    
    download_snapshot("comp-eng-pl")
    
    mock_fbref.assert_called_once_with(leagues="ENG-Premier League", seasons=[2022, 2023, 2024])
    mock_fbref_instance.read_schedule.assert_called_once()
