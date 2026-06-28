import json
import os
import re

class TeamMapper:
    def __init__(self):
        json_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__),
            "../../../packages/shared/src/data/team-mappings.json"
        ))
        if not os.path.exists(json_path):
            raise FileNotFoundError(f"Team mapping file not found at: {json_path}")
        
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
        import unicodedata
        normalized = unicodedata.normalize('NFKD', lower_name).encode('ascii', 'ignore').decode('utf-8')
        slug = re.sub(r'[^a-z0-9]+', '-', normalized).strip('-')
        return slug
