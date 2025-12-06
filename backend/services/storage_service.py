"""
Backend services for Firebase Storage operations
Handles file uploads and downloads for drawings and models
"""

from firebase_admin import storage
from typing import Optional, BinaryIO
import base64
import io


# Initialize Storage client
bucket = storage.bucket()


class StorageService:
    """Service class for Firebase Storage operations"""

    @staticmethod
    async def upload_drawing(
        drawing_data: str, drawing_id: str, folder: str = "corrections"
    ) -> str:
        """
        Upload drawing image to Firebase Storage

        Args:
            drawing_data: Base64 encoded image data (data:image/png;base64,...)
            drawing_id: Unique drawing identifier
            folder: Storage folder ('corrections', 'raw', 'processed')

        Returns:
            Storage path of uploaded file
        """
        # Remove data URL prefix if present
        if "," in drawing_data:
            drawing_data = drawing_data.split(",")[1]

        # Decode base64
        image_bytes = base64.b64decode(drawing_data)

        # Upload to Storage
        blob_path = f"drawings/{folder}/{drawing_id}.png"
        blob = bucket.blob(blob_path)
        blob.upload_from_string(image_bytes, content_type="image/png")

        return blob_path

    @staticmethod
    async def download_drawing(storage_path: str) -> bytes:
        """
        Download drawing from Firebase Storage

        Args:
            storage_path: Path to file in Storage

        Returns:
            Raw image bytes
        """
        blob = bucket.blob(storage_path)
        return blob.download_as_bytes()

    @staticmethod
    async def upload_model(
        model_file: BinaryIO, version: str, folder: str = "production"
    ) -> str:
        """
        Upload trained model to Firebase Storage

        Args:
            model_file: File object containing model (.h5)
            version: Model version (e.g., 'v1.0.1')
            folder: Storage folder ('production', 'training')

        Returns:
            Storage path of uploaded model
        """
        blob_path = f"models/{folder}/{version}/quickdraw_{version}.h5"
        blob = bucket.blob(blob_path)

        # Upload model file
        blob.upload_from_file(model_file, content_type="application/x-hdf5")

        return blob_path

    @staticmethod
    async def download_model(version: str, folder: str = "production") -> bytes:
        """
        Download model from Firebase Storage

        Args:
            version: Model version to download
            folder: Storage folder

        Returns:
            Model file bytes
        """
        blob_path = f"models/{folder}/{version}/quickdraw_{version}.h5"
        blob = bucket.blob(blob_path)

        return blob.download_as_bytes()

    @staticmethod
    async def upload_model_metadata(
        metadata: dict, version: str, folder: str = "production"
    ) -> str:
        """
        Upload model metadata JSON to Firebase Storage

        Args:
            metadata: Model metadata dictionary
            version: Model version
            folder: Storage folder

        Returns:
            Storage path of metadata file
        """
        import json

        blob_path = f"models/{folder}/{version}/metadata.json"
        blob = bucket.blob(blob_path)

        # Convert dict to JSON bytes
        metadata_json = json.dumps(metadata, indent=2)
        blob.upload_from_string(metadata_json, content_type="application/json")

        return blob_path

    @staticmethod
    async def list_corrections(limit: int = 1000) -> list:
        """
        List all correction images in Storage

        Args:
            limit: Maximum number of files to list

        Returns:
            List of blob paths
        """
        blobs = bucket.list_blobs(prefix="drawings/corrections/", max_results=limit)
        return [blob.name for blob in blobs]

    @staticmethod
    async def delete_file(storage_path: str) -> None:
        """
        Delete file from Firebase Storage

        Args:
            storage_path: Path to file in Storage
        """
        blob = bucket.blob(storage_path)
        blob.delete()

    @staticmethod
    async def file_exists(storage_path: str) -> bool:
        """
        Check if file exists in Storage

        Args:
            storage_path: Path to check

        Returns:
            True if file exists, False otherwise
        """
        blob = bucket.blob(storage_path)
        return blob.exists()

    @staticmethod
    async def get_public_url(storage_path: str) -> str:
        """
        Get public URL for a file (if public access enabled)

        Args:
            storage_path: Path to file

        Returns:
            Public URL
        """
        blob = bucket.blob(storage_path)
        return blob.public_url

    @staticmethod
    async def get_signed_url(storage_path: str, expiration_minutes: int = 60) -> str:
        """
        Generate signed URL for temporary access

        Args:
            storage_path: Path to file
            expiration_minutes: URL expiration time

        Returns:
            Signed URL
        """
        from datetime import timedelta

        blob = bucket.blob(storage_path)
        url = blob.generate_signed_url(
            version="v4", expiration=timedelta(minutes=expiration_minutes), method="GET"
        )
        return url
