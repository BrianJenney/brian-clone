import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests
from flask import Flask, jsonify, request
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from youtube_transcript_api import YouTubeTranscriptApi

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
    key = os.getenv("YOUTUBE_API_KEY")
    if not key:
        raise ValueError("YOUTUBE_API_KEY is required")

    channel_response = requests.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={"part": "contentDetails", "id": channel_id, "key": key},
        timeout=10,
    )
    channel_response.raise_for_status()
    items = channel_response.json().get("items", [])
    if not items:
        return []

    uploads_playlist_id = (
        items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    )
    if not uploads_playlist_id:
        return []

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
    seen = set()
    offset = None
    while True:
        result, offset = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            with_payload=True,
            with_vectors=False,
            offset=offset,
        )
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
    return seen


def get_new_videos(qdrant: QdrantClient) -> tuple[list[dict], int]:
    threshold = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    videos = fetch_channel_videos(BRIAN_CHANNEL_ID, MAX_VIDEOS_TO_FETCH)
    recent = [v for v in videos if parse_yt_datetime(v["publishedAt"]) >= threshold]

    existing_ids = get_existing_transcript_video_ids(qdrant)
    new_videos = [v for v in recent if v["id"] not in existing_ids]
    skipped_existing = len(recent) - len(new_videos)
    return new_videos, skipped_existing


def fetch_transcript_text(video_id: str) -> tuple[str | None, str | None]:
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join(seg.get("text", "") for seg in transcript).strip()
        if len(text) < 200:
            return None, "Transcript too short"
        return text, None
    except Exception:
        pass

    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
        text = " ".join(snippet.text for snippet in transcript).strip()
        if len(text) < 200:
            return None, "Transcript too short"
        return text, None
    except Exception as e:
        return None, f"{type(e).__name__}: {str(e)}"


def fetch_transcripts_batched(videos: list[dict]) -> tuple[list[dict], list[dict]]:
    transcript_rows = []
    failed_videos = []

    for i in range(0, len(videos), TRANSCRIPT_BATCH_SIZE):
        batch = videos[i : i + TRANSCRIPT_BATCH_SIZE]
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
    chunk_rows = []
    uploaded_videos = []

    for row in transcript_rows:
        full_text = f"# {row['title']}\n\n{row['text']}"
        chunks = chunk_text_with_overlap(full_text)
        if not chunks:
            continue

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
    points = []

    for i in range(0, len(chunk_rows), EMBEDDING_BATCH_SIZE):
        batch = chunk_rows[i : i + EMBEDDING_BATCH_SIZE]
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=[row["text"] for row in batch],
            dimensions=512,
        )
        vectors = [d.embedding for d in response.data]

        for row, vector in zip(batch, vectors):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=row["payload"],
                )
            )

    for i in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE):
        qdrant.upsert(
            collection_name=COLLECTION_NAME,
            points=points[i : i + QDRANT_UPSERT_BATCH_SIZE],
        )


def sync_transcripts() -> dict:
    qdrant = get_qdrant_client()
    openai_client = get_openai_client()

    new_videos, skipped_existing = get_new_videos(qdrant)
    if not new_videos:
        return {
            "success": True,
            "message": f"No new videos in last {LOOKBACK_DAYS} days",
            "uploaded": 0,
            "skipped": skipped_existing,
            "failed": 0,
            "videos": [],
        }

    transcript_rows, failed_videos = fetch_transcripts_batched(new_videos)
    chunk_rows, uploaded_videos = build_chunks_for_qdrant(transcript_rows)

    if chunk_rows:
        embed_and_upsert_batched(openai_client, qdrant, chunk_rows)

    return {
        "success": True,
        "message": f"Processed videos from last {LOOKBACK_DAYS} days",
        "uploaded": len(uploaded_videos),
        "skipped": skipped_existing,
        "failed": len(failed_videos),
        "videos": uploaded_videos + failed_videos,
    }


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
    if not verify_auth(request.headers.get("Authorization")):
        return jsonify({"error": "Unauthorized"}), 401
    try:
        return jsonify(sync_transcripts())
    except Exception as e:
        return jsonify({"error": "Failed to sync YouTube transcripts", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5328, debug=True)
