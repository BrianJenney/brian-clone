#!/usr/bin/env python3
"""
Medium Article Scraper using Crawl4AI
Scrapes recent articles from a Medium profile and stores them in Qdrant
"""

import argparse
import asyncio
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

load_dotenv()

# Configuration
MEDIUM_PROFILE_URL = "https://brianjenney.medium.com"
DAYS_TO_SCRAPE = int(os.getenv("DAYS_TO_SCRAPE", "7"))
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"
COLLECTION_NAME = "brian-articles"
VECTOR_SIZE = 512
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


async def scrape_profile_for_articles(crawler: AsyncWebCrawler) -> list[str]:
    """Scrape the Medium profile page to find article URLs"""
    print(f"Fetching profile page: {MEDIUM_PROFILE_URL}")

    result = await crawler.arun(
        url=MEDIUM_PROFILE_URL,
        config=CrawlerRunConfig(
            wait_until="domcontentloaded",
            exclude_all_images=True
        ),
    )

    if not result.success:
        raise Exception(f"Failed to fetch profile: {result.error_message}")

    all_links = result.links.get("internal", []) + result.links.get("external", [])

    # Extract unique article URLs
    seen = set()
    urls = []
    for link in all_links:
        url = link.get("href", "").split("?")[0]  # Strip query params
        if url in seen:
            continue
        # Must be article URL with hash slug
        if url.startswith("https://brianjenney.medium.com/") and re.search(r"-[a-f0-9]{8,12}$", url):
            seen.add(url)
            urls.append(url)

    print(f"Found {len(urls)} article URLs")
    return urls


def strip_medium_ui(markdown: str) -> str:
    """Remove Medium UI elements from the beginning and end of content"""
    lines = markdown.split("\n")

    # Header patterns to skip at the start
    header_patterns = [
        r"^Sitemap$",
        r"^Open in app$",
        r"^Sign up$",
        r"^Sign in$",
        r"^Medium Logo$",
        r"^Search$",
        r"^Home$",
        r"^Notifications$",
        r"^Lists$",
        r"^Stories$",
    ]

    # Footer patterns to stop at
    footer_patterns = [
        r"^## Written by",
        r"^## Responses",
        r"^Write a response",
        r"^Help$",
        r"^Status$",
        r"^About$",
        r"^Careers$",
        r"^Press$",
        r"^Blog$",
        r"^Privacy$",
        r"^Rules$",
        r"^Terms$",
        r"^Text to speech$",
        r"^Follow$",
        r"^\d+K? followers",
        r"^Get .* stories in your inbox",
        r"^Subscribe$",
        r"^Join Medium",
    ]

    # Find where content starts (after header UI)
    start_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        # Check if this looks like the title (# Title)
        if stripped.startswith("# ") and len(stripped) > 10:
            start_idx = i
            break
        # Skip header patterns
        if any(re.match(p, stripped, re.IGNORECASE) for p in header_patterns):
            continue
        # If we hit substantial content before a title, start here
        if len(stripped) > 50 and not any(re.match(p, stripped, re.IGNORECASE) for p in header_patterns):
            start_idx = i
            break

    # Find where content ends (before footer UI)
    end_idx = len(lines)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if any(re.match(p, stripped, re.IGNORECASE) for p in footer_patterns):
            end_idx = i
            break

    # Extract content between start and end
    content_lines = lines[start_idx:end_idx]

    # Remove inline UI elements
    cleaned_lines = []
    skip_patterns = [
        r"^\d+ min read$",
        r"^Listen$",
        r"^Share$",
        r"^Follow$",
        r"^--$",
        r"^\d+$",
        r"^Press enter or click",
    ]

    for line in content_lines:
        stripped = line.strip()
        if any(re.match(p, stripped, re.IGNORECASE) for p in skip_patterns):
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


async def scrape_article_content(crawler: AsyncWebCrawler, url: str) -> Optional[dict]:
    """Scrape a single article and return its content"""
    print(f"  Scraping: {url.split('/')[-1][:50]}...")

    md_generator = DefaultMarkdownGenerator(
        options={"ignore_links": True, "escape_html": False, "body_width": 80}
    )

    result = await crawler.arun(
        url=url,
        config=CrawlerRunConfig(
            markdown_generator=md_generator,
            wait_until="domcontentloaded",
            exclude_all_images=True
        ),
    )

    if not result.success:
        print(f"  Failed: {result.error_message}")
        return None

    markdown = result.markdown or ""
    content = strip_medium_ui(markdown)

    # Extract title from first # heading
    title_match = re.search(r"^# (.+)$", content, re.MULTILINE)
    title = title_match.group(1) if title_match else url.split("/")[-1]

    # Extract publish date
    date_match = re.search(r"(\w+ \d{1,2}, \d{4})", markdown)
    published_at = datetime.now().isoformat()
    if date_match:
        try:
            published_at = datetime.strptime(date_match.group(1), "%b %d, %Y").isoformat()
        except ValueError:
            pass

    return {"title": title, "url": url, "content": content, "publishedAt": published_at}


async def main(test_mode: bool = False):
    print("=" * 60)
    print("Medium Article Scraper (Crawl4AI)")
    print(f"Looking for articles from the last {DAYS_TO_SCRAPE} days")
    if test_mode:
        print(">>> TEST MODE: Will NOT upload to Qdrant <<<")
    print("=" * 60)

    browser_config = BrowserConfig(
        headless=True,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    )

    results = {"success": 0, "failed": 0, "articles": []}

    async with AsyncWebCrawler(config=browser_config) as crawler:
        # Step 1: Get article URLs from profile
        urls = await scrape_profile_for_articles(crawler)

        if not urls:
            print("No articles found on profile")
            return results

        print(f"\nFound {len(urls)} articles to scrape")

        # Step 2: Scrape each article in batches
        print("\nScraping articles...")
        batch_size = 3
        scraped_articles = []

        for i in range(0, len(urls), batch_size):
            batch = urls[i : i + batch_size]
            tasks = [scrape_article_content(crawler, url) for url in batch]
            batch_results = await asyncio.gather(*tasks)
            scraped_articles.extend([r for r in batch_results if r])

    # Step 3: Filter by date
    date_threshold = datetime.now() - timedelta(days=DAYS_TO_SCRAPE)
    print(f"\nFiltering articles published after {date_threshold.date()}")

    # Initialize Qdrant and OpenAI clients (skip in test mode)
    if not test_mode:
        qdrant = get_qdrant_client()
        openai_client = get_openai_client()
        

    for article in scraped_articles:
        try:
            pub_date = datetime.fromisoformat(article["publishedAt"].replace("Z", ""))
            if pub_date < date_threshold:
                print(f"  Skipping (too old): {article['title']}")
                continue
        except (ValueError, TypeError):
            pass  # Include if we can't parse date

        content = article["content"]

        if len(content) < 200:
            print(f"  Skipping (too short): {article['title']}")
            results["failed"] += 1
            continue

        # Test mode: print content for verification
        if test_mode:
            print(f"\n{'='*60}")
            print(f"ARTICLE: {article['title']}")
            print(f"URL: {article['url']}")
            print(f"Content length: {len(content)} chars")
            print(f"{'='*60}")
            print(content)
            print(f"{'='*60}\n")
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
                                "source": "crawl4ai-medium",
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

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    if test_mode:
        print(f"Articles processed (test mode): {results['success']}")
    else:
        print(f"Successfully uploaded: {results['success']}")
    print(f"Failed: {results['failed']}")

    if results["articles"]:
        print("\nArticles:")
        for article in results["articles"]:
            if test_mode:
                print(f"  - {article['title']} ({article.get('content_length', 0)} chars)")
            else:
                print(f"  - {article['title']} ({article['chunks']} chunks)")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Medium articles")
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: scrape and show content without uploading to Qdrant",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=DAYS_TO_SCRAPE,
        help=f"Number of days to look back (default: {DAYS_TO_SCRAPE})",
    )
    args = parser.parse_args()

    # Override DAYS_TO_SCRAPE if provided
    if args.days != DAYS_TO_SCRAPE:
        globals()["DAYS_TO_SCRAPE"] = args.days

    asyncio.run(main(test_mode=args.test or TEST_MODE))
