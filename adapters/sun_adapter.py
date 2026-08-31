import datetime
from adapters.base import Adapter
from engine.models import SignalValue
from astral import LocationInfo
from astral.sun import sun
import pytz

class SunAdapter(Adapter):
    def fetch(self, lat: float, lon: float, when: datetime.datetime) -> tuple[SignalValue, SignalValue]:
        try:
            # Astral localized
            city = LocationInfo("Local", "Region", "Asia/Kolkata", lat, lon)
            s = sun(city.observer, date=when.date(), tzinfo=pytz.timezone("Asia/Kolkata"))

            sr = s['sunrise'].strftime("%H:%M")
            ss = s['sunset'].strftime("%H:%M")

            return (
                SignalValue(value=sr, source="live", confidence=1.0, freshness_min=0),
                SignalValue(value=ss, source="live", confidence=1.0, freshness_min=0)
            )
        except Exception as e:
            return (
                self.make_unavailable_signal(),
                self.make_unavailable_signal()
            )
