"""
Backend services for Firestore database operations
Handles CRUD operations for corrections, sessions, users, and games
"""

from firebase_admin import firestore
from datetime import datetime
from typing import Dict, List, Optional


# Initialize Firestore client
db = firestore.client()


class FirestoreService:
    """Service class for Firestore operations"""

    @staticmethod
    async def create_correction(correction_data: Dict) -> str:
        """
        Create a new correction document

        Args:
            correction_data: Dictionary containing correction information

        Returns:
            Document ID of the created correction
        """
        doc_ref = db.collection("corrections").document()
        doc_ref.set({**correction_data, "createdAt": firestore.SERVER_TIMESTAMP})
        return doc_ref.id

    @staticmethod
    async def get_corrections(
        min_count: int = 500, model_version: str = "v1.0.0"
    ) -> List[Dict]:
        """
        Fetch corrections for retraining

        Args:
            min_count: Minimum number of corrections to fetch
            model_version: Model version to filter by

        Returns:
            List of correction documents
        """
        query = (
            db.collection("corrections")
            .where("modelVersion", "==", model_version)
            .limit(min_count)
            .stream()
        )

        corrections = []
        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            corrections.append(data)

        return corrections

    @staticmethod
    async def get_corrections_count(model_version: str = "v1.0.0") -> int:
        """
        Get count of corrections for a specific model version

        Args:
            model_version: Model version to count

        Returns:
            Number of corrections
        """
        query = (
            db.collection("corrections")
            .where("modelVersion", "==", model_version)
            .stream()
        )

        return sum(1 for _ in query)

    @staticmethod
    async def create_user_profile(user_id: str, user_data: Dict) -> None:
        """
        Create or update user profile

        Args:
            user_id: Firebase Auth UID
            user_data: User profile data
        """
        doc_ref = db.collection("users").document(user_id)
        doc_ref.set(user_data, merge=True)

    @staticmethod
    async def get_user_profile(user_id: str) -> Optional[Dict]:
        """
        Get user profile by ID

        Args:
            user_id: Firebase Auth UID

        Returns:
            User profile data or None
        """
        doc_ref = db.collection("users").document(user_id)
        doc = doc_ref.get()

        if doc.exists:
            return doc.to_dict()
        return None

    @staticmethod
    async def update_user_statistics(user_id: str, stats_update: Dict) -> None:
        """
        Update user statistics

        Args:
            user_id: Firebase Auth UID
            stats_update: Statistics to update
        """
        doc_ref = db.collection("users").document(user_id)
        doc_ref.update(
            {f"statistics.{key}": value for key, value in stats_update.items()}
        )

    @staticmethod
    async def create_session(session_data: Dict) -> str:
        """
        Create a new session document

        Args:
            session_data: Session information

        Returns:
            Document ID of the created session
        """
        doc_ref = db.collection("sessions").document()
        doc_ref.set(
            {
                **session_data,
                "startTime": firestore.SERVER_TIMESTAMP,
                "status": "active",
            }
        )
        return doc_ref.id

    @staticmethod
    async def update_session(session_id: str, update_data: Dict) -> None:
        """
        Update session document

        Args:
            session_id: Session document ID
            update_data: Data to update
        """
        doc_ref = db.collection("sessions").document(session_id)
        doc_ref.update(update_data)

    @staticmethod
    async def create_game(game_data: Dict) -> str:
        """
        Create a new multiplayer game

        Args:
            game_data: Game configuration

        Returns:
            Document ID of the created game
        """
        doc_ref = db.collection("games").document()
        doc_ref.set(
            {**game_data, "startTime": firestore.SERVER_TIMESTAMP, "status": "active"}
        )
        return doc_ref.id

    @staticmethod
    async def get_game(game_id: str) -> Optional[Dict]:
        """
        Get game by ID

        Args:
            game_id: Game document ID

        Returns:
            Game data or None
        """
        doc_ref = db.collection("games").document(game_id)
        doc = doc_ref.get()

        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None

    @staticmethod
    async def update_game(game_id: str, update_data: Dict) -> None:
        """
        Update game document

        Args:
            game_id: Game document ID
            update_data: Data to update
        """
        doc_ref = db.collection("games").document(game_id)
        doc_ref.update(update_data)

    @staticmethod
    async def add_game_turn(game_id: str, turn_data: Dict) -> str:
        """
        Add a turn to a game (subcollection)

        Args:
            game_id: Game document ID
            turn_data: Turn information

        Returns:
            Turn document ID
        """
        doc_ref = (
            db.collection("games").document(game_id).collection("turns").document()
        )
        doc_ref.set({**turn_data, "timestamp": firestore.SERVER_TIMESTAMP})
        return doc_ref.id

    @staticmethod
    async def update_model_metadata(version: str, metadata: Dict) -> None:
        """
        Update model metadata in Firestore

        Args:
            version: Model version (e.g., 'v1.0.1')
            metadata: Model metadata (accuracy, loss, etc.)
        """
        doc_ref = db.collection("models").document(version)
        doc_ref.set(
            {
                "version": version,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "active": metadata.get("active", True),
                "metrics": metadata.get("metrics", {}),
                "storagePath": metadata.get("storagePath", ""),
            },
            merge=True,
        )

    @staticmethod
    async def get_active_model() -> Optional[Dict]:
        """
        Get currently active model version

        Returns:
            Active model metadata or None
        """
        query = db.collection("models").where("active", "==", True).limit(1).stream()

        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None
