"""
Vercel Python Serverless Function for Medium Article Scraping
"""

import json
import os
import re
import uuid
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

# Configuration
MEDIUM_PROFILE_URL = "https://brianjenney.medium.com"
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


def fetch_article_urls(profile_url: str) -> list[str]:
    """Fetch article URLs from Medium profile using requests"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    response = requests.get(profile_url, headers=headers, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Find all article links
    urls = set()
    for link in soup.find_all("a", href=True):
        href = link["href"].split("?")[0]  # Strip query params
        if href.startswith("https://brianjenney.medium.com/") and re.search(
            r"-[a-f0-9]{8,12}$", href
        ):
            urls.add(href)

    return list(urls)


def fetch_article_content(url: str) -> dict | None:
    """Fetch and parse a single Medium article"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Failed to fetch {url}: {e}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract title
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else url.split("/")[-1]

    # Extract article content
    article = soup.find("article")
    if not article:
        return None

    # Get text content, excluding scripts and styles
    for tag in article.find_all(["script", "style", "nav", "footer"]):
        tag.decompose()

    content = article.get_text(separator="\n", strip=True)

    # Try to extract publish date
    time_tag = soup.find("time")
    published_at = datetime.now().isoformat()
    if time_tag and time_tag.get("datetime"):
        published_at = time_tag["datetime"]

    return {
        "title": title,
        "url": url,
        "content": content,
        "publishedAt": published_at,
    }


def process_articles(days: int = 7, test_mode: bool = False) -> dict:
    """Main function to scrape and store articles"""
    results = {"success": 0, "failed": 0, "articles": []}

    # Fetch article URLs
    urls = fetch_article_urls(MEDIUM_PROFILE_URL)
    print(f"Found {len(urls)} article URLs")

    if not urls:
        return results

    # Calculate date threshold
    date_threshold = datetime.now() - timedelta(days=days)

    # Initialize clients (skip in test mode)
    qdrant = None
    openai_client = None
    if not test_mode:
        qdrant = get_qdrant_client()
        openai_client = get_openai_client()

    for url in urls:
        article = fetch_article_content(url)
        if not article:
            results["failed"] += 1
            continue

        # Check date
        try:
            pub_date = datetime.fromisoformat(article["publishedAt"].replace("Z", ""))
            if pub_date < date_threshold:
                print(f"Skipping (too old): {article['title']}")
                continue
        except (ValueError, TypeError):
            pass

        content = article["content"]
        if len(content) < 200:
            print(f"Skipping (too short): {article['title']}")
            results["failed"] += 1
            continue

        if test_mode:
            results["success"] += 1
            results["articles"].append({
                "title": article["title"],
                "url": article["url"],
                "content_length": len(content),
            })
            continue

        # Upload to Qdrant
        try:
            full_text = f"# {article['title']}\n\n{content}"
            chunks = chunk_text_with_overlap(full_text)
            base_id = str(uuid.uuid4())

            print(f"Uploading {len(chunks)} chunks for: {article['title']}")

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
                                "source": "vercel-medium-scraper",
                                "title": article["title"],
                                "sourceUrl": article["url"],
                                "publishedAt": article["publishedAt"],
                                "uploadedAt": datetime.now().isoformat(),
                            },
                        )
                    ],
                )

            results["success"] += 1
            results["articles"].append({
                "title": article["title"],
                "url": article["url"],
                "chunks": len(chunks),
            })
        except Exception as e:
            print(f"Error uploading {article['title']}: {e}")
            results["failed"] += 1

    return results


class handler(BaseHTTPRequestHandler):
    def _check_auth(self) -> bool:
        """Verify CRON_SECRET for security"""
        cron_secret = os.getenv("CRON_SECRET")
        if not cron_secret:
            return True  # No secret configured, allow (dev mode)

        auth_header = self.headers.get("Authorization", "")
        return auth_header == f"Bearer {cron_secret}"

    def _send_unauthorized(self):
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Unauthorized"}).encode())

    def do_GET(self):
        """Handle GET requests - scrape with default 7 days"""
        if not self._check_auth():
            return self._send_unauthorized()
        self._handle_request(days=7)

    def do_POST(self):
        """Handle POST requests - scrape with custom days"""
        if not self._check_auth():
            return self._send_unauthorized()

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"

        try:
            data = json.loads(body)
            days = data.get("days", 7)
        except json.JSONDecodeError:
            days = 7

        self._handle_request(days=days)

    def _handle_request(self, days: int):
        try:
            results = process_articles(days=days)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            response = {
                "success": True,
                "message": f"Processed articles from last {days} days",
                "uploaded": results["success"],
                "failed": results["failed"],
                "articles": results["articles"],
            }
            self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            response = {
                "success": False,
                "error": str(e),
            }
            self.wfile.write(json.dumps(response).encode())
