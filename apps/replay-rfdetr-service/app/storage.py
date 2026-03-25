from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from .schemas import VideoAsset, VideoStorage

DATA_DIR = Path(__file__).resolve().parent.parent / ".data"
ASSET_DIR = DATA_DIR / "assets"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_data_dirs() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)


async def persist_upload(file: UploadFile) -> VideoAsset:
    ensure_data_dirs()
    created_at = now_iso()
    hasher = hashlib.sha256()
    suffix = Path(file.filename or "upload.bin").suffix or ".bin"
    temp_path = ASSET_DIR / f"upload-{created_at.replace(':', '-')}{suffix}"

    total_size = 0
    with temp_path.open("wb") as stream:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_size += len(chunk)
            hasher.update(chunk)
            stream.write(chunk)

    fingerprint = hasher.hexdigest()
    final_path = ASSET_DIR / f"{fingerprint}{suffix}"
    temp_path.replace(final_path)

    return VideoAsset(
        id=f"asset_{fingerprint[:12]}",
        fingerprint=fingerprint,
        name=file.filename or final_path.name,
        mimeType=file.content_type or "video/mp4",
        sizeBytes=total_size,
        durationMs=None,
        width=None,
        height=None,
        createdAt=created_at,
        updatedAt=created_at,
        storage=VideoStorage(kind="external", fileName=file.filename or final_path.name, relinkRequired=True),
    )
