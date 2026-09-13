"""
Local backfill for the YouTube transcript cron.

The Vercel-hosted cron (index.py) has been running "successfully" every week
but uploading 0 transcripts since ~2026-04-30: YouTube blocks
youtube-transcript-api requests from Vercel's cloud IP range (RequestBlocked).
Works fine from a home/non-cloud IP, so run it here until a proxy fix lands.

Usage: .venv/bin/python api/youtube-transcripts/backfill.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import index  # noqa: E402

# Cover everything missed since the last successful run (2026-04-30).
index.LOOKBACK_DAYS = 150
index.MAX_VIDEOS_TO_FETCH = 100

if __name__ == "__main__":
    result = index.sync_transcripts()
    print(result)
