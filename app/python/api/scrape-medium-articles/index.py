"""
Vercel Python Serverless Function for Medium Article Scraping
Uses FastAPI and Browserless.io API for lightweight scraping
"""

import asyncio
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Header, Query
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from openai import OpenAI


app = FastAPI(title="Medium Articles Scraper", port=5238)


# Configuration
MEDIUM_PROFILE_URL = "https://brianjenney.medium.com"
COLLECTION_NAME = "brian-articles"
CHUNK_SIZE = 1500
BROWSERLESS_API_TOKEN = os.getenv("BROWSERLESS_API_TOKEN")
BROWSERLESS_URL = os.getenv("BROWSERLESS_URL", "https://production-sfo.browserless.io")


class ScrapeRequest(BaseModel):
    days: int = 7
    test_mode: bool = False


class ScrapeResponse(BaseModel):
    success: bool
    message: str
    uploaded: int = 0
    failed: int = 0
    articles: list = []


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )


def get_openai_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url="https://oai.helicone.ai/v1",
        default_headers={
            "Helicone-Auth": f"Bearer {os.getenv('HELICONE_API_KEY')}",
            "Helicone-Cache-Enabled": "true",
        },
    )


def generate_embedding(client: OpenAI, text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=512,
    )
    return response.data[0].embedding


def chunk_text_with_overlap(text: str, max_chunk_size: int = CHUNK_SIZE) -> list[dict]:
    """Split text into chunks with sentence overlap"""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return []

    chunks = []
    current_chunk = []
    current_length = 0

    for sentence in sentences:
        sentence_length = len(sentence)

        if current_length + sentence_length > max_chunk_size and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({"text": chunk_text, "index": len(chunks)})

            last_sentence = current_chunk[-1] if current_chunk else ""
            current_chunk = [last_sentence, sentence] if last_sentence else [sentence]
            current_length = len(last_sentence) + sentence_length + 1
        else:
            current_chunk.append(sentence)
            current_length += sentence_length + (1 if len(current_chunk) > 1 else 0)

    if current_chunk:
        chunks.append({"text": " ".join(current_chunk), "index": len(chunks)})

    total_chunks = len(chunks)
    for chunk in chunks:
        chunk["total_chunks"] = total_chunks

    return chunks


async def fetch_rendered_html(url: str) -> Optional[str]:
    """Fetch fully rendered HTML from Browserless API"""
    if not BROWSERLESS_API_TOKEN:
        raise Exception("BROWSERLESS_API_TOKEN environment variable is required")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Use Browserless /content endpoint to get rendered HTML
        response = await client.post(
            f"{BROWSERLESS_URL}/content?token={BROWSERLESS_API_TOKEN}",
            json={
                "url": url,
                "waitFor": 2000,  # Wait 2 seconds for JS to render
            },
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 200:
            return response.text
        else:
            print(f"Browserless API error: {response.status_code} - {response.text}")
            return None


async def scrape_profile_for_articles() -> list[str]:
    """Scrape the Medium profile page to find article URLs"""
    print(f"Fetching profile page: {MEDIUM_PROFILE_URL}")

    html = await fetch_rendered_html(MEDIUM_PROFILE_URL)
    if not html:
        raise Exception("Failed to fetch profile page")

    soup = BeautifulSoup(html, "html.parser")

    # Find all article links
    urls = set[str]()
    for link in soup.find_all("a", href=True):
        href = link["href"].split("?")[0]  # Strip query params
        if href.startswith("https://brianjenney.medium.com/") and re.search(
            r"-[a-f0-9]{8,12}$", href
        ):
            urls.add(href)

    print(f"Found {len(urls)} article URLs")
    return list(urls)


def strip_medium_ui(html: str) -> str:
    """Extract article content from HTML and convert to text"""
    soup = BeautifulSoup(html, "html.parser")

    # Find article element
    article = soup.find("article")
    if not article:
        return ""

    # Remove scripts, styles, nav, footer
    for tag in article.find_all(["script", "style", "nav", "footer"]):
        tag.decompose()

    # Extract text content
    return article.get_text(separator="\n", strip=True)


async def scrape_article_content(url: str) -> Optional[dict]:
    """Scrape a single article and return its content"""
    print(f"  Scraping: {url.split('/')[-1][:50]}...")

    html = await fetch_rendered_html(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    # Extract title
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else url.split("/")[-1]

    # Extract content
    content = strip_medium_ui(html)

    # Try to extract publish date
    time_tag = soup.find("time")
    published_at = datetime.now().isoformat()
    if time_tag and time_tag.get("datetime"):
        published_at = time_tag["datetime"]

    return {"title": title, "url": url, "content": content, "publishedAt": published_at}


async def process_articles(days: int, test_mode: bool = False) -> dict:
    """Main function to scrape and store articles"""
    results = {"success": 0, "failed": 0, "articles": []}

    # Step 1: Get article URLs from profile
    urls = await scrape_profile_for_articles()

    if not urls:
        print("No articles found on profile")
        return results

    print(f"\nFound {len(urls)} articles to scrape")

    # Step 2: Scrape each article
    print("\nScraping articles...")
    scraped_articles = []

    # Process in batches to avoid overwhelming Browserless API
    batch_size = 3
    for i in range(0, len(urls), batch_size):
        batch = urls[i : i + batch_size]
        tasks = [scrape_article_content(url) for url in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in batch_results:
            if isinstance(result, Exception):
                print(f"  Error: {result}")
                results["failed"] += 1
            elif result:
                scraped_articles.append(result)

    # Step 3: Filter by date
    date_threshold = datetime.now() - timedelta(days=days)
    
    scraped_articles = [article for article in scraped_articles if article["publishedAt"] >= date_threshold.isoformat()]

    # Initialize Qdrant and OpenAI clients (skip in test mode)
    qdrant = None
    openai_client = None
    if not test_mode:
        qdrant = get_qdrant_client()
        openai_client = get_openai_client()

    for article in scraped_articles:
        content = article["content"]

        if len(content) < 200:
            print(f"  Skipping (too short): {article['title']}")
            results["failed"] += 1
            continue

        # Test mode: just record the article
        if test_mode:
            results["success"] += 1
            results["articles"].append({
                "title": article["title"],
                "url": article["url"],
                "content_length": len(content),
            })
            continue

        try:
            full_text = f"# {article['title']}\n\n{content}"
            chunks = chunk_text_with_overlap(full_text)
            base_id = str(uuid.uuid4())

            print(f"  Uploading {len(chunks)} chunks for: {article['title']}")

            for chunk in chunks:
                embedding = generate_embedding(openai_client, chunk["text"])
                point_id = str(uuid.uuid4())

                qdrant.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[
                        PointStruct(
                            id=point_id,
                            vector=embedding,
                            payload={
                                "text": chunk["text"],
                                "contentType": "article",
                                "baseId": base_id,
                                "chunkIndex": chunk["index"],
                                "totalChunks": chunk["total_chunks"],
                                "source": "browserless-medium-scraper",
                                "title": article["title"],
                                "sourceUrl": article["url"],
                                "publishedAt": article["publishedAt"],
                                "uploadedAt": datetime.now().isoformat(),
                            },
                        )
                    ],
                )

            results["success"] += 1
            results["articles"].append(
                {
                    "title": article["title"],
                    "url": article["url"],
                    "chunks": len(chunks),
                }
            )

        except Exception as e:
            print(f"  Error uploading {article['title']}: {e}")
            results["failed"] += 1

    return results

def verify_auth(authorization: str | None) -> bool:
    """Verify CRON_SECRET for security"""
    print(f"CRON_SECRET: {cron_secret}")
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        return True  # No secret configured, allow (dev mode)

    if not authorization:
        return False

    return authorization == f"Bearer {cron_secret}"

@app.get("/scrape-medium-articles", response_model=ScrapeResponse)
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
        results = await process_articles(days=request.days, test_mode=request.test_mode)

        return ScrapeResponse(
            success=True,
            message=f"Processed articles from last {request.days} days",
            uploaded=results["success"],
            failed=results["failed"],
            articles=results["articles"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
