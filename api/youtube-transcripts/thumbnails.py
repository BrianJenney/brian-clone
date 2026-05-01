"""
YouTube Thumbnail Ingestion Pipeline

Fetches thumbnails from channels/videos, analyzes with Claude,
stores in Qdrant with structured metadata and performance scores.
"""

import os
import sys
import json
import uuid
import time
import base64
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

# Find yt-dlp in the venv
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent
VENV_BIN = PROJECT_ROOT / ".venv" / "bin"
YT_DLP = str(VENV_BIN / "yt-dlp") if (VENV_BIN / "yt-dlp").exists() else "yt-dlp"

import httpx
import anthropic
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
# OpenAI no longer needed - using Voyage AI for multimodal embeddings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

COLLECTION_NAME = "youtube-thumbnails"
# Using Voyage AI multimodal embeddings for image+text
VOYAGE_EMBEDDING_MODEL = "voyage-multimodal-3"
VOYAGE_EMBEDDING_DIMENSIONS = 1024

# Tracked competitor channels - mirrors libs/mcp/getCompetitorChannels.ts
DEFAULT_CHANNELS = ["@owainlewis", "@WhatsAI", "@SymoneBTech"]

# Claude prompt for thumbnail analysis
THUMBNAIL_ANALYSIS_PROMPT = """Analyze this YouTube thumbnail image and extract structured information.

Video Title: {title}
Channel: {channel}

Be precise and objective. Only include what you actually see."""

# JSON Schema for structured output
THUMBNAIL_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "description": {
            "type": "string",
            "description": "A detailed 2-3 sentence description of what the thumbnail shows and the visual approach used"
        },
        "composition": {
            "type": "object",
            "properties": {
                "layout": {
                    "type": "string",
                    "enum": ["center-focus", "thirds", "split", "asymmetric", "text-dominant"]
                },
                "focal_point": {
                    "type": "string",
                    "enum": ["face", "text", "object", "graphic", "multiple"]
                },
                "complexity": {
                    "type": "string",
                    "enum": ["minimal", "moderate", "busy"]
                }
            },
            "required": ["layout", "focal_point", "complexity"]
        },
        "text_overlay": {
            "type": "object",
            "properties": {
                "has_text": {"type": "boolean"},
                "text_content": {"type": ["string", "null"]},
                "text_style": {
                    "type": "string",
                    "enum": ["bold", "outline", "3d", "minimal", "none"]
                },
                "text_position": {
                    "type": "string",
                    "enum": ["top", "center", "bottom", "left", "right", "none"]
                }
            },
            "required": ["has_text", "text_content", "text_style", "text_position"]
        },
        "faces": {
            "type": "object",
            "properties": {
                "count": {"type": "integer", "minimum": 0, "maximum": 5},
                "expressions": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["shocked", "smiling", "serious", "confused", "excited", "none"]
                    }
                },
                "prominent": {"type": "boolean"}
            },
            "required": ["count", "expressions", "prominent"]
        },
        "colors": {
            "type": "object",
            "properties": {
                "dominant": {"type": "string"},
                "palette": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3
                },
                "mood": {
                    "type": "string",
                    "enum": ["dark", "bright", "vibrant", "muted", "high-contrast"]
                }
            },
            "required": ["dominant", "palette", "mood"]
        },
        "style_tags": {
            "type": "array",
            "items": {"type": "string"}
        },
        "clickbait_score": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10
        },
        "niche_signals": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["description", "composition", "text_overlay", "faces", "colors", "style_tags", "clickbait_score", "niche_signals"]
}


def get_qdrant_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL")
    if not url:
        raise ValueError("QDRANT_URL is required")
    return QdrantClient(
        url=url,
        api_key=os.getenv("QDRANT_API_KEY"),
        check_compatibility=False,
    )


def get_anthropic_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is required")
    return anthropic.Anthropic(api_key=api_key)


def ensure_collection(qdrant: QdrantClient) -> None:
    """Create the thumbnails collection if it doesn't exist."""
    collections = qdrant.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VOYAGE_EMBEDDING_DIMENSIONS,
                distance=Distance.COSINE,
            ),
        )
        logger.info(f"Created collection: {COLLECTION_NAME}")


def get_channel_info(channel_handle: str) -> dict:
    """Get channel info using yt-dlp."""
    try:
        # Handle both @handle and channel ID formats
        if channel_handle.startswith("@"):
            url = f"https://www.youtube.com/{channel_handle}"
        elif channel_handle.startswith("UC"):
            url = f"https://www.youtube.com/channel/{channel_handle}"
        else:
            url = f"https://www.youtube.com/@{channel_handle}"

        result = subprocess.run(
            [YT_DLP, "--dump-json", "--playlist-items", "0", url],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            # Try alternative approach - get channel page info
            result = subprocess.run(
                [YT_DLP, "-J", "--flat-playlist", "--playlist-end", "1", url],
                capture_output=True,
                text=True,
                timeout=30,
            )

        if result.stdout:
            data = json.loads(result.stdout)
            return {
                "id": data.get("channel_id") or data.get("id"),
                "name": data.get("channel") or data.get("uploader") or channel_handle,
                "subscriber_count": data.get("channel_follower_count") or 0,
            }
    except Exception as e:
        logger.warning(f"Failed to get channel info for {channel_handle}: {e}")

    return {
        "id": channel_handle,
        "name": channel_handle,
        "subscriber_count": 0,
    }


def fetch_channel_videos(channel_handle: str, max_videos: int = 50) -> list[dict]:
    """Fetch recent videos from a channel using yt-dlp."""
    try:
        if channel_handle.startswith("@"):
            url = f"https://www.youtube.com/{channel_handle}/videos"
        elif channel_handle.startswith("UC"):
            url = f"https://www.youtube.com/channel/{channel_handle}/videos"
        else:
            url = f"https://www.youtube.com/@{channel_handle}/videos"

        result = subprocess.run(
            [
                YT_DLP,
                "-J",
                "--flat-playlist",
                f"--playlist-end={max_videos}",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            logger.error(f"yt-dlp error for {channel_handle}: {result.stderr}")
            return []

        data = json.loads(result.stdout)
        entries = data.get("entries", [])

        videos = []
        for entry in entries:
            video_id = entry.get("id")
            if not video_id:
                continue
            videos.append({
                "id": video_id,
                "title": entry.get("title", ""),
                "view_count": entry.get("view_count") or 0,
                "duration": entry.get("duration") or 0,
            })

        return videos
    except Exception as e:
        logger.error(f"Failed to fetch videos for {channel_handle}: {e}")
        return []


def fetch_video_metadata(video_id: str) -> dict | None:
    """Fetch detailed metadata for a single video."""
    try:
        result = subprocess.run(
            [YT_DLP, "-J", f"https://www.youtube.com/watch?v={video_id}"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        return {
            "id": video_id,
            "title": data.get("title", ""),
            "channel": data.get("channel") or data.get("uploader", ""),
            "channel_id": data.get("channel_id", ""),
            "view_count": data.get("view_count") or 0,
            "like_count": data.get("like_count") or 0,
            "subscriber_count": data.get("channel_follower_count") or 0,
            "upload_date": data.get("upload_date", ""),
            "duration": data.get("duration") or 0,
            "description": data.get("description", "")[:500],
        }
    except Exception as e:
        logger.warning(f"Failed to fetch metadata for {video_id}: {e}")
        return None


def download_thumbnail(video_id: str) -> bytes | None:
    """Download thumbnail image for a video."""
    # Try different thumbnail resolutions - prefer smaller for embedding efficiency
    # hqdefault (480x360) is best for multimodal embeddings - lower latency & cost
    urls = [
        f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/sddefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
    ]

    with httpx.Client(timeout=10) as client:
        for url in urls:
            try:
                response = client.get(url)
                if response.status_code == 200 and len(response.content) > 1000:
                    return response.content
            except Exception:
                continue

    return None


def analyze_thumbnail(
    claude: anthropic.Anthropic,
    thumbnail_bytes: bytes,
    title: str,
    channel: str,
) -> dict | None:
    """Analyze thumbnail using Claude vision with structured output."""
    try:
        b64_image = base64.standard_b64encode(thumbnail_bytes).decode("utf-8")

        response = claude.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1000,
            tools=[
                {
                    "name": "analyze_thumbnail",
                    "description": "Extract structured analysis of a YouTube thumbnail",
                    "input_schema": THUMBNAIL_ANALYSIS_SCHEMA,
                }
            ],
            tool_choice={"type": "tool", "name": "analyze_thumbnail"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": THUMBNAIL_ANALYSIS_PROMPT.format(
                                title=title, channel=channel
                            ),
                        },
                    ],
                }
            ],
        )

        # Extract tool use result from response
        for block in response.content:
            if block.type == "tool_use":
                return block.input

        return None
    except Exception as e:
        logger.error(f"Claude analysis failed: {e}")
        return None


def calculate_performance_score(
    view_count: int,
    subscriber_count: int,
    channel_avg_views: int = 0,
) -> dict:
    """Calculate normalized performance scores."""
    # Views per subscriber (VPS)
    vps = view_count / subscriber_count if subscriber_count > 0 else 0

    # Views vs channel average
    vs_avg = view_count / channel_avg_views if channel_avg_views > 0 else 1.0

    # Combined score (weighted)
    # VPS > 0.1 is good, > 0.5 is viral
    # vs_avg > 1.5 means outperforming channel average
    raw_score = (vps * 5) + (vs_avg * 0.3)
    normalized_score = min(10, raw_score)

    return {
        "views_per_subscriber": round(vps, 4),
        "vs_channel_average": round(vs_avg, 2),
        "performance_score": round(normalized_score, 2),
        "view_count": view_count,
        "subscriber_count": subscriber_count,
    }


def get_voyage_api_key() -> str:
    """Get Voyage AI API key."""
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        raise ValueError("VOYAGE_API_KEY is required for multimodal embeddings")
    return api_key


def embed_multimodal(
    image_base64: str,
    text: str,
    max_retries: int = 3,
) -> list[float]:
    """Generate multimodal embedding for image + text using Voyage AI HTTP API."""
    api_key = get_voyage_api_key()

    # Voyage multimodal API format - inputs is a list of objects with content arrays
    payload = {
        "model": VOYAGE_EMBEDDING_MODEL,
        "inputs": [
            {
                "content": [
                    {"type": "image_base64", "image_base64": f"data:image/jpeg;base64,{image_base64}"},
                    {"type": "text", "text": text},
                ]
            }
        ],
        "input_type": "document",
    }

    for attempt in range(max_retries):
        response = httpx.post(
            "https://api.voyageai.com/v1/multimodalembeddings",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json=payload,
            timeout=60.0,
        )

        if response.status_code == 200:
            data = response.json()
            return data["data"][0]["embedding"]

        if response.status_code == 429:
            # Rate limited - wait and retry (3 RPM limit without payment)
            wait_time = 25 * (attempt + 1)  # 25s, 50s, 75s
            logger.warning(f"Rate limited, waiting {wait_time}s before retry...")
            time.sleep(wait_time)
            continue

        raise ValueError(f"Voyage API error: {response.status_code} - {response.text}")

    raise ValueError("Max retries exceeded for Voyage API")


def check_existing(qdrant: QdrantClient, video_id: str) -> bool:
    """Check if a video is already in the collection."""
    try:
        # Use search with filter instead of scroll for better compatibility
        results = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter={
                "must": [
                    {"key": "video_id", "match": {"value": video_id}}
                ]
            },
            limit=1,
        )
        return len(results[0]) > 0
    except Exception as e:
        logger.warning(f"check_existing failed for {video_id}: {e}")
        return False


def process_video(
    video_id: str,
    claude: anthropic.Anthropic,
    channel_info: dict | None = None,
    video_metadata: dict | None = None,
) -> dict | None:
    """Process a single video: fetch thumbnail, analyze, prepare for storage."""

    # Get video metadata if not provided
    if not video_metadata:
        video_metadata = fetch_video_metadata(video_id)
        if not video_metadata:
            return {"error": f"Failed to fetch metadata for {video_id}"}

    # Download thumbnail
    thumbnail_bytes = download_thumbnail(video_id)
    if not thumbnail_bytes:
        return {"error": f"Failed to download thumbnail for {video_id}"}

    # Get channel info if not provided
    channel_name = video_metadata.get("channel", "Unknown")
    subscriber_count = video_metadata.get("subscriber_count", 0)

    if channel_info:
        channel_name = channel_info.get("name", channel_name)
        subscriber_count = channel_info.get("subscriber_count", subscriber_count)

    # Analyze thumbnail with Claude
    analysis = analyze_thumbnail(
        claude,
        thumbnail_bytes,
        video_metadata.get("title", ""),
        channel_name,
    )

    if not analysis:
        return {"error": f"Failed to analyze thumbnail for {video_id}"}

    # Calculate performance score
    perf = calculate_performance_score(
        video_metadata.get("view_count", 0),
        subscriber_count,
    )

    # Build text for embedding - include rich visual details from Claude analysis
    composition = analysis.get("composition", {})
    text_overlay = analysis.get("text_overlay", {})
    faces = analysis.get("faces", {})
    colors = analysis.get("colors", {})

    embed_text_parts = [
        video_metadata.get("title", ""),
        analysis.get("description", ""),
        # Composition details
        f"layout: {composition.get('layout', '')}",
        f"focal point: {composition.get('focal_point', '')}",
        f"complexity: {composition.get('complexity', '')}",
        # Text overlay
        f"text content: {text_overlay.get('text_content', '')}" if text_overlay.get("has_text") else "",
        f"text style: {text_overlay.get('text_style', '')}" if text_overlay.get("has_text") else "",
        # Faces
        f"faces: {faces.get('count', 0)} {'prominent' if faces.get('prominent') else ''}",
        f"expressions: {' '.join(faces.get('expressions', []))}",
        # Colors
        f"dominant color: {colors.get('dominant', '')}",
        f"color palette: {' '.join(colors.get('palette', []))}",
        f"color mood: {colors.get('mood', '')}",
        # Tags and signals
        " ".join(analysis.get("style_tags", [])),
        " ".join(analysis.get("niche_signals", [])),
    ]
    text_for_embedding = " ".join(filter(None, embed_text_parts))

    # Generate multimodal embedding (image + text)
    image_base64 = base64.standard_b64encode(thumbnail_bytes).decode("utf-8")
    embedding = embed_multimodal(image_base64, text_for_embedding)

    # Build payload
    payload = {
        "video_id": video_id,
        "title": video_metadata.get("title", ""),
        "channel": channel_name,
        "channel_id": video_metadata.get("channel_id", ""),
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        "upload_date": video_metadata.get("upload_date", ""),
        "duration": video_metadata.get("duration", 0),

        # Performance metrics
        "view_count": perf["view_count"],
        "subscriber_count": perf["subscriber_count"],
        "views_per_subscriber": perf["views_per_subscriber"],
        "performance_score": perf["performance_score"],

        # Analysis results
        "description": analysis.get("description", ""),
        "composition_layout": analysis.get("composition", {}).get("layout", ""),
        "composition_focal_point": analysis.get("composition", {}).get("focal_point", ""),
        "composition_complexity": analysis.get("composition", {}).get("complexity", ""),

        "has_text": analysis.get("text_overlay", {}).get("has_text", False),
        "text_content": analysis.get("text_overlay", {}).get("text_content", ""),
        "text_style": analysis.get("text_overlay", {}).get("text_style", ""),

        "face_count": analysis.get("faces", {}).get("count", 0),
        "face_expressions": analysis.get("faces", {}).get("expressions", []),

        "dominant_color": analysis.get("colors", {}).get("dominant", ""),
        "color_palette": analysis.get("colors", {}).get("palette", []),
        "color_mood": analysis.get("colors", {}).get("mood", ""),

        "style_tags": analysis.get("style_tags", []),
        "niche_signals": analysis.get("niche_signals", []),
        "clickbait_score": analysis.get("clickbait_score", 0),

        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }

    return {
        "id": str(uuid.uuid4()),
        "vector": embedding,
        "payload": payload,
    }


def ingest_channel(
    channel_handle: str,
    max_videos: int = 30,
    min_performance_percentile: float = 0.3,
) -> dict:
    """Ingest thumbnails from a channel."""
    logger.info(f"Starting ingestion for channel: {channel_handle}")

    qdrant = get_qdrant_client()
    claude = get_anthropic_client()
    # Voyage API key will be used via HTTP directly in embed_multimodal

    ensure_collection(qdrant)

    # Get channel info
    channel_info = get_channel_info(channel_handle)
    logger.info(f"Channel: {channel_info['name']} ({channel_info['subscriber_count']} subs)")

    # Fetch videos
    videos = fetch_channel_videos(channel_handle, max_videos)
    if not videos:
        return {"error": f"No videos found for {channel_handle}", "processed": 0}

    logger.info(f"Found {len(videos)} videos")

    # Calculate performance threshold (top X%)
    view_counts = sorted([v["view_count"] for v in videos], reverse=True)
    threshold_idx = int(len(view_counts) * min_performance_percentile)
    view_threshold = view_counts[threshold_idx] if threshold_idx < len(view_counts) else 0

    # Filter to top performers
    top_videos = [v for v in videos if v["view_count"] >= view_threshold]
    logger.info(f"Processing {len(top_videos)} top-performing videos (threshold: {view_threshold} views)")

    results = {
        "channel": channel_info["name"],
        "processed": 0,
        "skipped": 0,
        "failed": 0,
        "videos": [],
    }

    points_to_upsert = []

    for video in top_videos:
        video_id = video["id"]

        # Skip if already exists
        if check_existing(qdrant, video_id):
            results["skipped"] += 1
            continue

        result = process_video(
            video_id,
            claude,
            channel_info=channel_info,
            video_metadata={
                **video,
                "channel": channel_info["name"],
                "subscriber_count": channel_info["subscriber_count"],
            },
        )

        if "error" in result:
            results["failed"] += 1
            results["videos"].append({"id": video_id, "error": result["error"]})
            continue

        points_to_upsert.append(
            PointStruct(
                id=result["id"],
                vector=result["vector"],
                payload=result["payload"],
            )
        )
        results["processed"] += 1
        results["videos"].append({
            "id": video_id,
            "title": result["payload"]["title"],
            "performance_score": result["payload"]["performance_score"],
        })

        logger.info(f"Processed: {result['payload']['title'][:50]}...")

    # Batch upsert to Qdrant
    if points_to_upsert:
        for i in range(0, len(points_to_upsert), 10):
            batch = points_to_upsert[i:i + 10]
            time.sleep(0.5)  # Small delay between batches
            qdrant.upsert(collection_name=COLLECTION_NAME, points=batch)
        logger.info(f"Upserted {len(points_to_upsert)} thumbnails to Qdrant")

    return results


def ingest_videos(video_ids: list[str]) -> dict:
    """Ingest specific videos by ID."""
    logger.info(f"Ingesting {len(video_ids)} specific videos")

    qdrant = get_qdrant_client()
    claude = get_anthropic_client()
    # Voyage API key will be used via HTTP directly in embed_multimodal

    ensure_collection(qdrant)

    results = {
        "processed": 0,
        "skipped": 0,
        "failed": 0,
        "videos": [],
    }

    points_to_upsert = []

    for video_id in video_ids:
        # Clean video ID (handle full URLs)
        if "youtube.com" in video_id or "youtu.be" in video_id:
            if "v=" in video_id:
                video_id = video_id.split("v=")[1].split("&")[0]
            elif "youtu.be/" in video_id:
                video_id = video_id.split("youtu.be/")[1].split("?")[0]

        # Skip if already exists
        if check_existing(qdrant, video_id):
            results["skipped"] += 1
            continue

        result = process_video(video_id, claude)

        if "error" in result:
            results["failed"] += 1
            results["videos"].append({"id": video_id, "error": result["error"]})
            continue

        points_to_upsert.append(
            PointStruct(
                id=result["id"],
                vector=result["vector"],
                payload=result["payload"],
            )
        )
        results["processed"] += 1
        results["videos"].append({
            "id": video_id,
            "title": result["payload"]["title"],
            "performance_score": result["payload"]["performance_score"],
        })

        logger.info(f"Processed: {result['payload']['title'][:50]}...")

    # Batch upsert
    if points_to_upsert:
        for i in range(0, len(points_to_upsert), 10):
            batch = points_to_upsert[i:i + 10]
            time.sleep(0.5)  # Small delay between batches
            qdrant.upsert(collection_name=COLLECTION_NAME, points=batch)
        logger.info(f"Upserted {len(points_to_upsert)} thumbnails to Qdrant")

    return results


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    import argparse
    parser = argparse.ArgumentParser(description="YouTube Thumbnail Ingestion")
    parser.add_argument("--channels", nargs="+", help="Channel handles to ingest")
    parser.add_argument("--videos", nargs="+", help="Video IDs to ingest")
    parser.add_argument("--max-videos", type=int, default=30, help="Max videos per channel")

    args = parser.parse_args()

    channels = args.channels
    if not channels and not args.videos:
        channels = DEFAULT_CHANNELS
        logger.info(f"No --channels/--videos provided, using defaults: {channels}")

    if channels:
        for channel in channels:
            result = ingest_channel(channel, max_videos=args.max_videos)
            print(json.dumps(result, indent=2))

    if args.videos:
        result = ingest_videos(args.videos)
        print(json.dumps(result, indent=2))
