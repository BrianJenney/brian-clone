"""
Vercel Python Serverless Function for Medium Article Scraping
Uses Flask and Crawl4AI for AI-friendly web crawling
"""

import asyncio
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from crawl4ai import AsyncWebCrawler
from flask import Flask, jsonify, request
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from openai import OpenAI


app = Flask(__name__)


# Configuration
MEDIUM_PROFILE_URL = "https://brianjenney.medium.com"
COLLECTION_NAME = "brian-articles"
CHUNK_SIZE = 1500


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


async def crawl_url(url: str) -> Optional[dict]:
    """Crawl a URL using crawl4ai and return markdown content"""
    try:
        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url=url)

            if result.success:
                return {
                    "url": url,
                    "markdown": result.markdown,
                    "html": result.html,
                    "success": True
                }
            else:
                print(f"Failed to crawl {url}: {result.error_message}")
                return None
    except Exception as e:
        print(f"Error crawling {url}: {e}")
        return None


async def scrape_profile_for_articles() -> list[str]:
    """Scrape the Medium profile page to find article URLs"""
    print(f"Fetching profile page: {MEDIUM_PROFILE_URL}")

    result = await crawl_url(MEDIUM_PROFILE_URL)
    if not result:
        raise Exception("Failed to fetch profile page")

    # Extract URLs from the HTML
    html = result["html"]
    urls = set()

    # Find all Medium article URLs in the HTML
    url_pattern = r'href="(https://brianjenney\.medium\.com/[^"?]+)"'
    matches = re.findall(url_pattern, html)

    for url in matches:
        # Only keep URLs that look like articles (have the hash at the end)
        if re.search(r"-[a-f0-9]{8,12}$", url):
            urls.add(url)

    print(f"Found {len(urls)} article URLs")
    return list(urls)



async def scrape_article_content_async(url: str) -> Optional[dict]:
    """Scrape a single article and return its content"""
    print(f"  Scraping: {url.split('/')[-1][:50]}...")

    result = await crawl_url(url)
    if not result:
        return None

    markdown = result["markdown"]
    html = result["html"]

    # Extract title from markdown (first # heading)
    title_match = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
    title = title_match.group(1) if title_match else url.split("/")[-1]

    # Extract publish date from HTML
    time_match = re.search(r'<time[^>]*datetime="([^"]+)"', html)
    published_at = datetime.now().isoformat()
    if time_match:
        published_at = time_match.group(1)

    # Remove the title from markdown to avoid duplication
    content = re.sub(r"^#\s+.+\n+", "", markdown, count=1)

    return {
        "title": title,
        "url": url,
        "content": content,
        "publishedAt": published_at
    }


async def process_articles_async(days: int, test_mode: bool = False) -> dict:
    """Main async function to scrape and store articles"""
    results = {"success": 0, "failed": 0, "articles": []}

    urls = await scrape_profile_for_articles()

    if not urls:
        print("No articles found on profile")
        return results

    print(f"\nFound {len(urls)} articles to scrape")

    print("\nScraping articles...")
    scraped_articles = []

    # Process articles in batches of 3 using asyncio.gather
    batch_size = 3
    for i in range(0, len(urls), batch_size):
        batch = urls[i : i + batch_size]
        batch_results = await asyncio.gather(
            *[scrape_article_content_async(url) for url in batch],
            return_exceptions=True
        )
        for result in batch_results:
            if isinstance(result, Exception):
                print(f"  Error: {result}")
                results["failed"] += 1
            elif result:
                scraped_articles.append(result)
            else:
                results["failed"] += 1

    # Filter by date
    date_threshold = datetime.now() - timedelta(days=days)

    scraped_articles = [
        article
        for article in scraped_articles
        if article["publishedAt"] >= date_threshold.isoformat()
    ]

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
            results["articles"].append(
                {
                    "title": article["title"],
                    "url": article["url"],
                    "content_length": len(content),
                }
            )
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
                                "source": "crawl4ai-medium-scraper",
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


def process_articles(days: int, test_mode: bool = False) -> dict:
    """Sync wrapper for process_articles_async"""
    return asyncio.run(process_articles_async(days, test_mode))


def verify_auth(authorization: str | None) -> bool:
    """Verify CRON_SECRET for security"""
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        return True  # No secret configured, allow (dev mode)

    if not authorization:
        return False

    return authorization == f"Bearer {cron_secret}"


@app.route("/scrape-medium-articles", methods=["GET"])
def scrape_medium_articles():
    """
    GET endpoint to scrape Medium articles
    Available at /api/scrape-medium-articles
    """
    authorization = request.headers.get("Authorization")
    days = request.args.get("days", default=7, type=int)
    test_mode = request.args.get("test_mode", default="false").lower() == "true"

    if not verify_auth(authorization):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        results = process_articles(days=days, test_mode=test_mode)

        return jsonify(
            {
                "success": True,
                "message": f"Processed articles from last {days} days",
                "uploaded": results["success"],
                "failed": results["failed"],
                "articles": results["articles"],
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5328, debug=True)
