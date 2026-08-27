"""
app/services/reverse_image_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reverse Image Search & Perceptual Hashing

Implements local perceptual hash (pHash/dHash) computation for image
deduplication and similarity detection. Supports optional TinEye API
integration for web-scale reverse image search.
"""
from __future__ import annotations

import io
from typing import Dict, Any, List, Optional

import numpy as np
import structlog
from PIL import Image

log = structlog.get_logger(__name__)


def compute_phash(image_buffer: bytes, hash_size: int = 16) -> str:
    """
    Compute perceptual hash (pHash) of an image using DCT.

    Returns hex string representation of the hash.
    """
    try:
        img = Image.open(io.BytesIO(image_buffer)).convert("L")
        # Resize to hash_size*4 for DCT computation
        img_resized = img.resize((hash_size * 4, hash_size * 4), Image.BICUBIC)
        pixels = np.array(img_resized, dtype=np.float64)

        # Apply 2D DCT
        from scipy.fft import dctn
        dct = dctn(pixels, norm="ortho")

        # Keep top-left low-frequency coefficients
        dct_low = dct[:hash_size, :hash_size]

        # Compute median (excluding DC component)
        dct_low_flat = dct_low.flatten()
        median_val = np.median(dct_low_flat[1:])  # Skip DC

        # Generate hash bits
        hash_bits = (dct_low_flat >= median_val).astype(int)
        # Convert to hex string
        hash_int = int("".join(str(b) for b in hash_bits), 2)
        hex_str = format(hash_int, f"0{hash_size * hash_size // 4}x")
        return hex_str

    except Exception as e:
        log.warning("phash.computation_failed", error=str(e))
        return ""


def compute_dhash(image_buffer: bytes, hash_size: int = 16) -> str:
    """
    Compute difference hash (dHash) of an image.
    Compares adjacent pixels for gradient direction.
    """
    try:
        img = Image.open(io.BytesIO(image_buffer)).convert("L")
        img_resized = img.resize((hash_size + 1, hash_size), Image.BICUBIC)
        pixels = np.array(img_resized, dtype=np.float64)

        # Compare adjacent horizontal pixels
        diff = pixels[:, 1:] > pixels[:, :-1]
        hash_bits = diff.flatten().astype(int)
        hash_int = int("".join(str(b) for b in hash_bits), 2)
        hex_str = format(hash_int, f"0{hash_size * hash_size // 4}x")
        return hex_str

    except Exception as e:
        log.warning("dhash.computation_failed", error=str(e))
        return ""


def hamming_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two hex hash strings."""
    if not hash1 or not hash2 or len(hash1) != len(hash2):
        return -1

    try:
        int1 = int(hash1, 16)
        int2 = int(hash2, 16)
        xor = int1 ^ int2
        return bin(xor).count("1")
    except ValueError:
        return -1


def similarity_score(hash1: str, hash2: str) -> float:
    """
    Compute similarity score (0-100) between two perceptual hashes.
    100 = identical, 0 = completely different.
    """
    dist = hamming_distance(hash1, hash2)
    if dist < 0:
        return 0.0
    max_bits = len(hash1) * 4  # Each hex char = 4 bits
    similarity = (1.0 - dist / max(max_bits, 1)) * 100.0
    return round(max(0.0, similarity), 2)


async def reverse_image_search(
    image_buffer: bytes,
    known_hashes: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Perform reverse image search using perceptual hashing.

    Args:
        image_buffer: Raw image bytes
        known_hashes: Optional dict of {filename: phash} to compare against

    Returns:
        Dict with phash, dhash, matches, and match_count.
    """
    phash = compute_phash(image_buffer)
    dhash = compute_dhash(image_buffer)

    matches: List[Dict[str, Any]] = []

    # Compare against known hashes if provided
    if known_hashes:
        for name, known_hash in known_hashes.items():
            sim = similarity_score(phash, known_hash)
            if sim > 80.0:  # Threshold for "similar"
                matches.append({
                    "source": name,
                    "similarity": sim,
                    "hash": known_hash,
                })

    matches.sort(key=lambda x: x["similarity"], reverse=True)

    return {
        "phash": phash,
        "dhash": dhash,
        "match_count": len(matches),
        "matches": matches[:10],
        "is_duplicate": len(matches) > 0 and matches[0]["similarity"] > 95.0,
        "highest_similarity": matches[0]["similarity"] if matches else 0.0,
    }


async def search_tineye(image_buffer: bytes) -> Optional[Dict[str, Any]]:
    """
    Search TinEye API for web-scale reverse image matches.
    Requires TINEYE_API_KEY in settings.

    Returns None if API key not configured.
    """
    api_key = getattr(settings, "TINEYE_API_KEY", "")
    if not api_key:
        log.debug("tineye.skipped", reason="API key not configured")
        return None

    try:
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.tineye.com/rest/search/",
                headers={"x-api-key": api_key},
                files={"image": ("query.jpg", image_buffer, "image/jpeg")},
            )

            if response.status_code != 200:
                log.warning("tineye.api_error", status=response.status_code)
                return None

            data = response.json()
            results = data.get("results", {})
            matches = results.get("matches", [])

            return {
                "total_results": results.get("total_results", 0),
                "matches": [
                    {
                        "domain": m.get("domain", ""),
                        "image_url": m.get("image_url", ""),
                        "score": m.get("score", 0),
                        "size": m.get("size", {}),
                    }
                    for m in matches[:10]
                ],
                "source": "TinEye",
            }

    except Exception as e:
        log.error("tineye.error", error=str(e))
        return None


# Import settings at module level for TinEye
from app.core.config import settings as _settings


# ─── Perceptual Hash Response Cache ──────────────────────────────────────────

# Simple in-memory cache holding tuples of (phash, response_dict)
PHASH_RESPONSE_CACHE: List[Tuple[str, Dict[str, Any]]] = []

def lookup_cached_response(phash: str) -> Optional[Tuple[Dict[str, Any], float]]:
    """
    Search the local cache registry for a similar perceptual hash.
    Verdicts match if the Hamming distance is <= 2.
    """
    if not phash:
        return None
        
    for cached_phash, response_dict in PHASH_RESPONSE_CACHE:
        dist = hamming_distance(phash, cached_phash)
        if dist >= 0 and dist <= 2:
            similarity = 1.0 - (dist / 256.0)
            return response_dict, similarity
    return None

def cache_response(phash: str, response_dict: Dict[str, Any]):
    """
    Record a new verification response in the perceptual cache.
    """
    if phash and response_dict:
        PHASH_RESPONSE_CACHE.append((phash, response_dict))
