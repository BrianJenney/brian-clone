"""
Vercel Python Serverless Function for Medium Article Scraping
Uses FastAPI and wraps crawl_medium.py functionality
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add scripts directory to path to import crawl_medium
scripts_dir = Path(__file__).parent.parent / "scripts" / "python"
sys.path.insert(0, str(scripts_dir))

# Import crawl_medium_browserless module (lightweight, uses Browserless API)
import crawl_medium_browserless as crawl_medium

# FastAPI app - Vercel will automatically detect this
app = FastAPI(title="Medium Articles Scraper")


class ScrapeRequest(BaseModel):
    days: int = 7
    test_mode: bool = False


class ScrapeResponse(BaseModel):
    success: bool
    message: str
    uploaded: int = 0
    failed: int = 0
    articles: list = []


def verify_auth(authorization: str | None) -> bool:
    """Verify CRON_SECRET for security"""
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        return True  # No secret configured, allow (dev mode)

    if not authorization:
        return False

    return authorization == f"Bearer {cron_secret}"


@app.get("/", response_model=ScrapeResponse)
async def scrape_medium_get(
    days: int = Query(7, description="Number of days to look back"),
    authorization: str | None = Header(None, alias="Authorization"),
):
    """
    GET endpoint to scrape Medium articles
    This endpoint will be available at /api/medium-articles
    """
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        # Temporarily override DAYS_TO_SCRAPE in the module
        original_days = crawl_medium.DAYS_TO_SCRAPE
        crawl_medium.DAYS_TO_SCRAPE = days

        # Run the scraping function
        results = await crawl_medium.main(test_mode=False)

        # Restore original value
        crawl_medium.DAYS_TO_SCRAPE = original_days

        return ScrapeResponse(
            success=True,
            message=f"Processed articles from last {days} days",
            uploaded=results["success"],
            failed=results["failed"],
            articles=results["articles"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/", response_model=ScrapeResponse)
async def scrape_medium_post(
    request: ScrapeRequest,
    authorization: str | None = Header(None, alias="Authorization"),
):
    """
    POST endpoint to scrape Medium articles with custom parameters
    This endpoint will be available at /api/medium-articles
    """
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        # Temporarily override DAYS_TO_SCRAPE in the module
        original_days = crawl_medium.DAYS_TO_SCRAPE
        crawl_medium.DAYS_TO_SCRAPE = request.days

        # Run the scraping function
        results = await crawl_medium.main(test_mode=request.test_mode)

        # Restore original value
        crawl_medium.DAYS_TO_SCRAPE = original_days

        return ScrapeResponse(
            success=True,
            message=f"Processed articles from last {request.days} days",
            uploaded=results["success"],
            failed=results["failed"],
            articles=results["articles"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
