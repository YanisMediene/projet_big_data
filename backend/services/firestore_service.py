"""
Backend services for Firestore database operations
Handles CRUD operations for corrections, sessions, users, and games
"""

from firebase_admin import firestore
from datetime import datetime
from typing import Dict, List, Optional


# Firestore client will be initialized lazily
_db = None


def get_db():
    """Lazy initialization of Firestore client"""
    global _db
    if _db is None:
        _db = firestore.client()
    return _db


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
        doc_ref = get_db().collection("corrections").document()
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
            get_db()
            .collection("corrections")
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
            get_db()
            .collection("corrections")
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
        doc_ref = get_db().collection("users").document(user_id)
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
        doc_ref = get_db().collection("users").document(user_id)
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
        doc_ref = get_db().collection("users").document(user_id)
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
        doc_ref = get_db().collection("sessions").document()
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
        doc_ref = get_db().collection("sessions").document(session_id)
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
        doc_ref = get_db().collection("games").document()
        doc_ref.set({**game_data, "createdAt": firestore.SERVER_TIMESTAMP})
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
        doc_ref = get_db().collection("games").document(game_id)
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
        doc_ref = get_db().collection("games").document(game_id)
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
            get_db()
            .collection("games")
            .document(game_id)
            .collection("turns")
            .document()
        )
        doc_ref.set({**turn_data, "timestamp": firestore.SERVER_TIMESTAMP})
        return doc_ref.id

    @staticmethod
    async def add_chat_message(game_id: str, message_data: Dict) -> str:
        """
        Add a chat message to a game (subcollection 'chat')

        Args:
            game_id: Game document ID
            message_data: Chat message information

        Returns:
            Message document ID
        """
        doc_ref = (
            get_db().collection("games").document(game_id).collection("chat").document()
        )
        doc_ref.set({**message_data, "timestamp": firestore.SERVER_TIMESTAMP})
        return doc_ref.id

    @staticmethod
    async def update_model_metadata(version: str, metadata: Dict) -> None:
        """
        Update model metadata in Firestore

        Args:
            version: Model version (e.g., 'v1.0.1')
            metadata: Model metadata (accuracy, loss, etc.)
        """
        doc_ref = get_db().collection("models").document(version)
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
        query = (
            get_db().collection("models").where("active", "==", True).limit(1).stream()
        )

        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None

    @staticmethod
    def get_games_by_status(status: str, game_type: Optional[str] = None) -> List[Dict]:
        """
        Get games by status and optionally by game type

        Args:
            status: Game status (waiting, playing, finished)
            game_type: Optional game type filter (race, guessing)

        Returns:
            List of games
        """
        query = get_db().collection("games").where("status", "==", status)

        if game_type:
            query = query.where("game_type", "==", game_type)

        games = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            games.append(data)

        return games

    # ==================== USER DRAWINGS FOR ACTIVE LEARNING ====================

    @staticmethod
    async def save_user_drawing(drawing_data: Dict) -> str:
        """
        Save a user drawing for active learning

        Args:
            drawing_data: Dictionary containing:
                - imageBase64: Base64 encoded 28x28 image
                - targetCategory: The category the user was supposed to draw
                - aiPrediction: What the AI predicted
                - aiConfidence: AI confidence score
                - wasCorrect: Whether the AI was correct
                - gameMode: Game mode (CLASSIC, RACE, TEAM, INFINITE, FREE_CANVAS)
                - modelVersion: Current model version
                - userId: Optional user ID

        Returns:
            Document ID of the created drawing
        """
        doc_ref = get_db().collection("user_drawings").document()
        doc_ref.set(
            {
                **drawing_data,
                "usedForTraining": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )
        return doc_ref.id

    @staticmethod
    async def get_drawings_for_training(limit: int = 5000) -> List[Dict]:
        """
        Fetch user drawings that haven't been used for training yet

        Args:
            limit: Maximum number of drawings to fetch

        Returns:
            List of drawing documents
        """
        query = (
            get_db()
            .collection("user_drawings")
            .where("usedForTraining", "==", False)
            .limit(limit)
            .stream()
        )

        drawings = []
        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            drawings.append(data)

        return drawings

    @staticmethod
    async def get_new_drawings_count() -> int:
        """
        Get count of drawings not yet used for training

        Returns:
            Number of new drawings available
        """
        query = (
            get_db()
            .collection("user_drawings")
            .where("usedForTraining", "==", False)
            .stream()
        )

        return sum(1 for _ in query)

    @staticmethod
    async def mark_drawings_as_used(drawing_ids: List[str]) -> int:
        """
        Mark drawings as used for training

        Args:
            drawing_ids: List of drawing document IDs to mark

        Returns:
            Number of drawings marked
        """
        batch = get_db().batch()
        count = 0

        for drawing_id in drawing_ids:
            doc_ref = get_db().collection("user_drawings").document(drawing_id)
            batch.update(doc_ref, {"usedForTraining": True})
            count += 1

            # Firestore batch limit is 500
            if count % 500 == 0:
                batch.commit()
                batch = get_db().batch()

        # Commit remaining
        if count % 500 != 0:
            batch.commit()

        return count

    @staticmethod
    async def get_category_stats_for_training() -> Dict[str, Dict]:
        """
        Get statistics about drawings per category for intelligent category selection

        Returns:
            Dict with category stats: {category: {count, avgConfidence}}
        """
        query = (
            get_db()
            .collection("user_drawings")
            .where("usedForTraining", "==", False)
            .stream()
        )

        stats = {}
        for doc in query:
            data = doc.to_dict()
            category = data.get("targetCategory", "unknown")
            confidence = data.get("aiConfidence", 0)

            if category not in stats:
                stats[category] = {"count": 0, "totalConfidence": 0}

            stats[category]["count"] += 1
            stats[category]["totalConfidence"] += confidence

        # Calculate averages
        for category in stats:
            count = stats[category]["count"]
            stats[category]["avgConfidence"] = (
                stats[category]["totalConfidence"] / count if count > 0 else 0
            )
            del stats[category]["totalConfidence"]

        return stats

    @staticmethod
    async def get_last_training_info() -> Optional[Dict]:
        """
        Get information about the last training run

        Returns:
            Dict with last training info or None
        """
        query = (
            get_db()
            .collection("training_runs")
            .order_by("completedAt", direction=firestore.Query.DESCENDING)
            .limit(1)
            .stream()
        )

        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            return data

        return None

    @staticmethod
    async def save_training_run(training_data: Dict) -> str:
        """
        Save information about a training run

        Args:
            training_data: Dictionary containing training metadata

        Returns:
            Document ID
        """
        doc_ref = get_db().collection("training_runs").document()
        doc_ref.set({**training_data, "completedAt": firestore.SERVER_TIMESTAMP})
        return doc_ref.id
