import os
import re
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests
from flask import Flask, jsonify, request
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from youtube_transcript_api import YouTubeTranscriptApi

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

BRIAN_CHANNEL_ID = "UC1LJVKQ0hp7sKyfAbKoDHMw"
COLLECTION_NAME = "brian-transcripts"
LOOKBACK_DAYS = 14
MAX_VIDEOS_TO_FETCH = 50
CHUNK_SIZE = 1500
TRANSCRIPT_BATCH_SIZE = 5
TRANSCRIPT_WORKERS = 5
EMBEDDING_BATCH_SIZE = 32
QDRANT_UPSERT_BATCH_SIZE = 64


def get_qdrant_client() -> QdrantClient:
    logger.info("Initializing Qdrant client")
    url = os.getenv("QDRANT_URL")
    if not url:
        logger.error("QDRANT_URL environment variable not set")
        raise ValueError("QDRANT_URL is required")
    logger.info(f"Connecting to Qdrant at {url}")
    return QdrantClient(
        url=url,
        api_key=os.getenv("QDRANT_API_KEY"),
        check_compatibility=False,
    )


def get_openai_client() -> OpenAI:
    logger.info("Initializing OpenAI client")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable not set")
        raise ValueError("OPENAI_API_KEY is required")
    return OpenAI(
        api_key=api_key,
        base_url="https://oai.helicone.ai/v1",
        default_headers={
            "Helicone-Auth": f"Bearer {os.getenv('HELICONE_API_KEY')}",
            "Helicone-Cache-Enabled": "true",
        },
    )


def chunk_text_with_overlap(text: str, max_chunk_size: int = CHUNK_SIZE) -> list[dict]:
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
            chunks.append({"text": " ".join(current_chunk), "index": len(chunks)})
            last_sentence = current_chunk[-1]
            current_chunk = [last_sentence, sentence]
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


def parse_yt_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fetch_channel_videos(channel_id: str, max_results: int) -> list[dict]:
    logger.info(f"Fetching videos for channel {channel_id}, max_results={max_results}")
    key = os.getenv("YOUTUBE_API_KEY")
    if not key:
        logger.error("YOUTUBE_API_KEY environment variable not set")
        raise ValueError("YOUTUBE_API_KEY is required")

    logger.info("Fetching channel details")
    channel_response = requests.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={"part": "contentDetails", "id": channel_id, "key": key},
        timeout=10,
    )
    channel_response.raise_for_status()
    items = channel_response.json().get("items", [])
    logger.info(f"Found {len(items)} channel(s)")
    if not items:
        return []

    uploads_playlist_id = (
        items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    )
    if not uploads_playlist_id:
        logger.warning("No uploads playlist found")
        return []

    logger.info(f"Fetching playlist items from {uploads_playlist_id}")
    playlist_response = requests.get(
        "https://www.googleapis.com/youtube/v3/playlistItems",
        params={
            "part": "snippet",
            "playlistId": uploads_playlist_id,
            "maxResults": max_results,
            "key": key,
        },
        timeout=10,
    )
    playlist_response.raise_for_status()
    playlist_items = playlist_response.json().get("items", [])
    logger.info(f"Found {len(playlist_items)} videos in playlist")

    videos = []
    for item in playlist_items:
        snippet = item.get("snippet", {})
        video_id = (snippet.get("resourceId") or {}).get("videoId")
        published_at = snippet.get("publishedAt")
        if not video_id or not published_at:
            continue
        videos.append(
            {
                "id": video_id,
                "title": snippet.get("title", ""),
                "publishedAt": published_at,
            }
        )
    return videos


def get_existing_transcript_video_ids(qdrant: QdrantClient) -> set[str]:
    logger.info(f"Fetching existing transcript video IDs from collection {COLLECTION_NAME}")
    seen = set()
    offset = None
    total_processed = 0
    while True:
        result, offset = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            with_payload=True,
            with_vectors=False,
            offset=offset,
        )
        total_processed += len(result)
        for point in result:
            payload = point.payload or {}
            if payload.get("contentType") != "transcript":
                continue
            video_id = payload.get("youtubeVideoId")
            if video_id:
                seen.add(video_id)
            source_url = payload.get("sourceUrl") or ""
            if "youtube.com/watch?v=" in source_url:
                match = re.search(r"[?&]v=([^&]+)", source_url)
                if match:
                    seen.add(match.group(1))
        if offset is None:
            break
    logger.info(f"Found {len(seen)} existing video IDs (processed {total_processed} points)")
    return seen


def get_new_videos(qdrant: QdrantClient) -> tuple[list[dict], int]:
    logger.info(f"Looking for videos from last {LOOKBACK_DAYS} days")
    threshold = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    logger.info(f"Threshold date: {threshold.isoformat()}")

    videos = fetch_channel_videos(BRIAN_CHANNEL_ID, MAX_VIDEOS_TO_FETCH)
    recent = [v for v in videos if parse_yt_datetime(v["publishedAt"]) >= threshold]
    logger.info(f"Found {len(recent)} recent videos (out of {len(videos)} total)")

    existing_ids = get_existing_transcript_video_ids(qdrant)
    new_videos = [v for v in recent if v["id"] not in existing_ids]
    skipped_existing = len(recent) - len(new_videos)
    logger.info(f"Found {len(new_videos)} new videos, skipping {skipped_existing} existing")
    return new_videos, skipped_existing


def fetch_transcript_text(video_id: str) -> tuple[str | None, str | None]:
    logger.info(f"Fetching transcript for video {video_id}")
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join(seg.get("text", "") for seg in transcript).strip()
        if len(text) < 200:
            logger.warning(f"Transcript too short for video {video_id}: {len(text)} chars")
            return None, "Transcript too short"
        logger.info(f"Successfully fetched transcript for video {video_id}: {len(text)} chars")
        return text, None
    except Exception as e1:
        logger.warning(f"First attempt failed for video {video_id}: {type(e1).__name__}")

    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
        text = " ".join(snippet.text for snippet in transcript).strip()
        if len(text) < 200:
            logger.warning(f"Transcript too short for video {video_id}: {len(text)} chars")
            return None, "Transcript too short"
        logger.info(f"Successfully fetched transcript (2nd attempt) for video {video_id}: {len(text)} chars")
        return text, None
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Failed to fetch transcript for video {video_id}: {error_msg}")
        return None, error_msg


def fetch_transcripts_batched(videos: list[dict]) -> tuple[list[dict], list[dict]]:
    logger.info(f"Fetching transcripts for {len(videos)} videos in batches of {TRANSCRIPT_BATCH_SIZE}")
    transcript_rows = []
    failed_videos = []

    for i in range(0, len(videos), TRANSCRIPT_BATCH_SIZE):
        batch = videos[i : i + TRANSCRIPT_BATCH_SIZE]
        logger.info(f"Processing batch {i // TRANSCRIPT_BATCH_SIZE + 1} ({len(batch)} videos)")
        with ThreadPoolExecutor(max_workers=TRANSCRIPT_WORKERS) as executor:
            results = list(executor.map(lambda v: fetch_transcript_text(v["id"]), batch))

        for video, result in zip(batch, results):
            text, error = result
            if not text:
                failed_videos.append(
                    {
                        "id": video["id"],
                        "title": video["title"],
                        "status": "failed",
                        "error": error or "Unknown transcript fetch error",
                    }
                )
                continue
            transcript_rows.append(
                {
                    "id": video["id"],
                    "title": video["title"],
                    "publishedAt": video["publishedAt"],
                    "text": text,
                }
            )

    return transcript_rows, failed_videos


def build_chunks_for_qdrant(transcript_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    logger.info(f"Building chunks for {len(transcript_rows)} transcripts")
    chunk_rows = []
    uploaded_videos = []

    for row in transcript_rows:
        full_text = f"# {row['title']}\n\n{row['text']}"
        chunks = chunk_text_with_overlap(full_text)
        if not chunks:
            logger.warning(f"No chunks generated for video {row['id']}: {row['title']}")
            continue
        logger.info(f"Generated {len(chunks)} chunks for video {row['id']}: {row['title']}")

        base_id = str(uuid.uuid4())
        source_url = f"https://www.youtube.com/watch?v={row['id']}"

        for chunk in chunks:
            chunk_rows.append(
                {
                    "text": chunk["text"],
                    "payload": {
                        "text": chunk["text"],
                        "contentType": "transcript",
                        "baseId": base_id,
                        "chunkIndex": chunk["index"],
                        "totalChunks": chunk["total_chunks"],
                        "title": row["title"],
                        "sourceUrl": source_url,
                        "youtubeVideoId": row["id"],
                        "publishedAt": row["publishedAt"],
                        "uploadedAt": datetime.now(timezone.utc).isoformat(),
                    },
                }
            )

        uploaded_videos.append(
            {
                "id": row["id"],
                "title": row["title"],
                "status": "uploaded",
                "chunks": len(chunks),
            }
        )

    return chunk_rows, uploaded_videos


def embed_and_upsert_batched(
    openai_client: OpenAI, qdrant: QdrantClient, chunk_rows: list[dict]
) -> None:
    logger.info(f"Generating embeddings for {len(chunk_rows)} chunks in batches of {EMBEDDING_BATCH_SIZE}")
    points = []

    for i in range(0, len(chunk_rows), EMBEDDING_BATCH_SIZE):
        batch = chunk_rows[i : i + EMBEDDING_BATCH_SIZE]
        batch_num = i // EMBEDDING_BATCH_SIZE + 1
        logger.info(f"Generating embeddings for batch {batch_num} ({len(batch)} chunks)")

        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=[row["text"] for row in batch],
            dimensions=512,
        )
        vectors = [d.embedding for d in response.data]
        logger.info(f"Generated {len(vectors)} embeddings")

        for row, vector in zip(batch, vectors):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=row["payload"],
                )
            )

    logger.info(f"Upserting {len(points)} points to Qdrant in batches of {QDRANT_UPSERT_BATCH_SIZE}")
    for i in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE):
        batch_num = i // QDRANT_UPSERT_BATCH_SIZE + 1
        batch_size = min(QDRANT_UPSERT_BATCH_SIZE, len(points) - i)
        logger.info(f"Upserting batch {batch_num} ({batch_size} points)")
        qdrant.upsert(
            collection_name=COLLECTION_NAME,
            points=points[i : i + QDRANT_UPSERT_BATCH_SIZE],
        )
    logger.info("Upsert completed successfully")


def sync_transcripts() -> dict:
    logger.info("=== Starting YouTube transcript sync ===")

    logger.info("Step 1: Initializing clients")
    qdrant = get_qdrant_client()
    openai_client = get_openai_client()

    logger.info("Step 2: Finding new videos")
    new_videos, skipped_existing = get_new_videos(qdrant)
    if not new_videos:
        logger.info(f"No new videos found. Skipped {skipped_existing} existing videos")
        return {
            "success": True,
            "message": f"No new videos in last {LOOKBACK_DAYS} days",
            "uploaded": 0,
            "skipped": skipped_existing,
            "failed": 0,
            "videos": [],
        }

    logger.info(f"Step 3: Fetching transcripts for {len(new_videos)} new videos")
    transcript_rows, failed_videos = fetch_transcripts_batched(new_videos)
    logger.info(f"Successfully fetched {len(transcript_rows)} transcripts, {len(failed_videos)} failed")

    logger.info("Step 4: Building chunks for Qdrant")
    chunk_rows, uploaded_videos = build_chunks_for_qdrant(transcript_rows)
    logger.info(f"Created {len(chunk_rows)} chunks from {len(uploaded_videos)} videos")

    if chunk_rows:
        logger.info("Step 5: Embedding and upserting to Qdrant")
        embed_and_upsert_batched(openai_client, qdrant, chunk_rows)
    else:
        logger.warning("No chunks to upload")

    result = {
        "success": True,
        "message": f"Processed videos from last {LOOKBACK_DAYS} days",
        "uploaded": len(uploaded_videos),
        "skipped": skipped_existing,
        "failed": len(failed_videos),
        "videos": uploaded_videos + failed_videos,
    }
    logger.info(f"=== Sync completed: {result} ===")
    return result


def verify_auth(authorization: str | None) -> bool:
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        return True
    if not authorization:
        return False
    return authorization == f"Bearer {cron_secret}"


@app.route("/api/youtube-transcripts", methods=["GET"])
@app.route("/youtube-transcripts", methods=["GET"])
@app.route("/", methods=["GET"])
def youtube_transcripts():
    logger.info(f"Received request to {request.path} from {request.remote_addr}")

    auth_header = request.headers.get("Authorization")
    logger.info(f"Authorization header present: {bool(auth_header)}")

    if not verify_auth(auth_header):
        logger.warning("Unauthorized request")
        return jsonify({"error": "Unauthorized"}), 401

    logger.info("Request authorized, starting sync")
    try:
        result = sync_transcripts()
        logger.info("Sync completed successfully")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Sync failed with error: {type(e).__name__}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to sync YouTube transcripts", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5328, debug=True)
