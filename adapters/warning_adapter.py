import datetime
import os
from adapters.base import Adapter

class WarningAdapter(Adapter):
    def fetch(self, lat: float, lon: float, when: datetime.datetime) -> list:
        scenario = os.getenv("FIXTURE_SCENARIO", "normal")
        filepath = os.path.join(os.path.dirname(__file__), "fixtures", f"warning_{scenario}.json")
        data = self.load_fixture(filepath)
        if data is None:
            return []
        return data
