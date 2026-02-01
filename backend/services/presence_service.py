"""
Presence Service for Firebase Realtime Database
Handles player online/offline detection and game cleanup for multiplayer games
"""

import os
import logging
import random
from typing import Dict, List
from datetime import datetime, timedelta
from firebase_admin import db as rtdb
from firebase_admin import firestore

logger = logging.getLogger(__name__)

# RTDB instance will be initialized lazily
_rtdb_ref = None
_firestore_db = None


def get_rtdb():
    """Lazy initialization of Realtime Database reference"""
    global _rtdb_ref
    if _rtdb_ref is None:
        database_url = os.getenv("FIREBASE_DATABASE_URL")
        if database_url:
            _rtdb_ref = rtdb.reference("/", url=database_url)
        else:
            _rtdb_ref = rtdb.reference("/")
    return _rtdb_ref


def get_firestore_db():
    """Lazy initialization of Firestore client"""
    global _firestore_db
    if _firestore_db is None:
        _firestore_db = firestore.client()
    return _firestore_db


class PresenceService:
    """Service class for player presence management using RTDB"""

    # Timeout en secondes pour considérer un joueur déconnecté
    PRESENCE_TIMEOUT = 30  # 30 secondes sans heartbeat = déconnecté
    CLEANUP_THRESHOLD = 60  # 60 secondes pour cleanup automatique

    @staticmethod
    async def set_player_online(game_id: str, player_id: str, player_name: str) -> bool:
        """
        Mark a player as online in a game

        Args:
            game_id: Game document ID
            player_id: Player's Firebase UID
            player_name: Player's display name

        Returns:
            True if successful
        """
        try:
            presence_ref = get_rtdb().child(f"presence/{game_id}/{player_id}")
            presence_ref.set(
                {
                    "online": True,
                    "lastSeen": {".sv": "timestamp"},  # Server timestamp
                    "playerName": player_name,
                    "joinedAt": {".sv": "timestamp"},
                }
            )

            logger.info(
                f"Player {player_name} ({player_id}) marked online in game {game_id}"
            )
            return True
        except Exception as e:
            logger.error(f"Error setting player online: {e}")
            return False

    @staticmethod
    async def set_player_offline(game_id: str, player_id: str) -> bool:
        """
        Mark a player as offline

        Args:
            game_id: Game document ID
            player_id: Player's Firebase UID

        Returns:
            True if successful
        """
        try:
            presence_ref = get_rtdb().child(f"presence/{game_id}/{player_id}")
            presence_ref.update({"online": False, "lastSeen": {".sv": "timestamp"}})
            logger.info(f"Player {player_id} marked offline in game {game_id}")
            return True
        except Exception as e:
            logger.error(f"Error setting player offline: {e}")
            return False

    @staticmethod
    async def remove_player_presence(game_id: str, player_id: str) -> bool:
        """
        Remove player presence data entirely

        Args:
            game_id: Game document ID
            player_id: Player's Firebase UID

        Returns:
            True if successful
        """
        try:
            presence_ref = get_rtdb().child(f"presence/{game_id}/{player_id}")
            presence_ref.delete()
            logger.info(f"Presence removed for player {player_id} in game {game_id}")
            return True
        except Exception as e:
            logger.error(f"Error removing player presence: {e}")
            return False

    @staticmethod
    async def heartbeat(game_id: str, player_id: str) -> bool:
        """
        Update player's lastSeen timestamp (heartbeat)

        Args:
            game_id: Game document ID
            player_id: Player's Firebase UID

        Returns:
            True if successful
        """
        try:
            presence_ref = get_rtdb().child(f"presence/{game_id}/{player_id}")
            presence_ref.update({"lastSeen": {".sv": "timestamp"}, "online": True})
            return True
        except Exception as e:
            logger.error(f"Error updating heartbeat: {e}")
            return False

    @staticmethod
    async def get_game_presence(game_id: str) -> Dict:
        """
        Get all players' presence status in a game

        Args:
            game_id: Game document ID

        Returns:
            Dict of player_id -> presence data
        """
        try:
            presence_ref = get_rtdb().child(f"presence/{game_id}")
            presence_data = presence_ref.get()
            return presence_data or {}
        except Exception as e:
            logger.error(f"Error getting game presence: {e}")
            return {}

    @staticmethod
    async def get_online_players(game_id: str) -> List[str]:
        """
        Get list of online player IDs in a game

        Args:
            game_id: Game document ID

        Returns:
            List of online player IDs
        """
        presence_data = await PresenceService.get_game_presence(game_id)
        current_time = datetime.utcnow().timestamp() * 1000  # milliseconds
        timeout_threshold = current_time - (PresenceService.PRESENCE_TIMEOUT * 1000)

        online_players = []
        for player_id, data in presence_data.items():
            if data.get("online", False):
                last_seen = data.get("lastSeen", 0)
                if last_seen > timeout_threshold:
                    online_players.append(player_id)

        return online_players

    @staticmethod
    async def cleanup_stale_players(game_id: str) -> List[str]:
        """
        Remove players who haven't sent heartbeat in CLEANUP_THRESHOLD seconds

        Args:
            game_id: Game document ID

        Returns:
            List of removed player IDs
        """
        presence_data = await PresenceService.get_game_presence(game_id)
        current_time = datetime.utcnow().timestamp() * 1000
        cleanup_threshold = current_time - (PresenceService.CLEANUP_THRESHOLD * 1000)

        removed_players = []
        for player_id, data in presence_data.items():
            last_seen = data.get("lastSeen", 0)
            if last_seen < cleanup_threshold:
                await PresenceService.remove_player_presence(game_id, player_id)
                removed_players.append(player_id)
                logger.info(f"Cleaned up stale player {player_id} from game {game_id}")

        return removed_players

    @staticmethod
    async def cleanup_game_presence(game_id: str) -> bool:
        """
        Remove all presence data for a game (when game ends)

        Args:
            game_id: Game document ID

        Returns:
            True if successful
        """
        try:
            presence_ref = get_rtdb().child(f"presence/{game_id}")
            presence_ref.delete()
            logger.info(f"Cleaned up all presence data for game {game_id}")
            return True
        except Exception as e:
            logger.error(f"Error cleaning up game presence: {e}")
            return False


class GameCleanupService:
    """Service for cleaning up abandoned games and removing disconnected players"""

    @staticmethod
    async def remove_player_from_game(game_id: str, player_id: str) -> Dict:
        """
        Remove a player from a Firestore game document

        Args:
            game_id: Game document ID
            player_id: Player's Firebase UID

        Returns:
            Updated game data or error info
        """
        try:
            db = get_firestore_db()
            game_ref = db.collection("games").document(game_id)
            game_doc = game_ref.get()

            if not game_doc.exists:
                return {"error": "Game not found"}

            game_data = game_doc.to_dict()

            # Remove player from players list
            original_players = game_data.get("players", [])
            updated_players = [
                p for p in original_players if p.get("player_id") != player_id
            ]

            if len(updated_players) == len(original_players):
                return {"error": "Player not in game"}

            # Check if game should be deleted (no players left)
            if len(updated_players) == 0:
                game_ref.delete()
                # Clean up presence data too
                await PresenceService.cleanup_game_presence(game_id)
                return {
                    "status": "game_deleted",
                    "message": "Game deleted - no players remaining",
                }

            # Check if creator left - transfer to next player
            was_creator = game_data.get("creator_id") == player_id
            update_data = {"players": updated_players}

            if was_creator and len(updated_players) > 0:
                new_creator = updated_players[0]
                update_data["creator_id"] = new_creator["player_id"]
                logger.info(
                    f"Creator left, transferred to {new_creator['player_name']}"
                )

            # Handle guessing game specific - if drawer left during playing
            if (
                game_data.get("game_type") == "guessing"
                and game_data.get("status") == "playing"
            ):
                current_drawer = game_data.get("current_drawer", {})
                if current_drawer.get("player_id") == player_id:
                    # Drawer left - skip to next round or end game
                    if len(updated_players) < 2:
                        update_data["status"] = "finished"
                        update_data["winner"] = "abandoned"
                    else:
                        # Select new drawer from remaining players
                        new_drawer = random.choice(updated_players)
                        update_data["current_drawer"] = {
                            "player_id": new_drawer["player_id"],
                            "player_name": new_drawer["player_name"],
                        }
                        # Reset canvas for new drawer
                        update_data["canvas_state"] = None

            # Handle race game specific - check if enough players remain
            if (
                game_data.get("game_type") == "race"
                and game_data.get("status") == "playing"
            ):
                if len(updated_players) < 2:
                    # Not enough players - end game
                    update_data["status"] = "finished"
                    if len(updated_players) == 1:
                        update_data["champion"] = {
                            "player_id": updated_players[0]["player_id"],
                            "player_name": updated_players[0]["player_name"],
                            "rounds_won": updated_players[0].get("rounds_won", 0),
                        }

            game_ref.update(update_data)

            # Remove presence data
            await PresenceService.remove_player_presence(game_id, player_id)

            return {
                "status": "player_removed",
                "remaining_players": len(updated_players),
                "was_creator": was_creator,
            }

        except Exception as e:
            logger.error(f"Error removing player from game: {e}")
            return {"error": str(e)}

    @staticmethod
    async def cleanup_abandoned_games(max_age_minutes: int = 30) -> Dict:
        """
        Clean up games that have been waiting/playing for too long

        Args:
            max_age_minutes: Maximum age in minutes before cleanup

        Returns:
            Cleanup statistics
        """
        try:
            db = get_firestore_db()
            cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)

            # Query for old waiting games
            waiting_query = (
                db.collection("games").where("status", "==", "waiting").stream()
            )

            deleted_count = 0
            for doc in waiting_query:
                game_data = doc.to_dict()
                created_at = game_data.get("created_at") or game_data.get("createdAt")

                if created_at:
                    # Handle both datetime and Firestore timestamp
                    if hasattr(created_at, "timestamp"):
                        game_time = datetime.fromtimestamp(created_at.timestamp())
                    else:
                        game_time = created_at

                    if game_time < cutoff_time:
                        doc.reference.delete()
                        await PresenceService.cleanup_game_presence(doc.id)
                        deleted_count += 1
                        logger.info(f"Deleted abandoned game: {doc.id}")

            return {"status": "cleanup_complete", "deleted_games": deleted_count}

        except Exception as e:
            logger.error(f"Error cleaning up abandoned games: {e}")
            return {"error": str(e)}

    @staticmethod
    async def sync_presence_to_firestore(game_id: str) -> Dict:
        """
        Sync RTDB presence data to Firestore game document
        Useful for updating player list based on actual presence

        Args:
            game_id: Game document ID

        Returns:
            Sync result
        """
        try:
            # Get online players from RTDB
            online_players = await PresenceService.get_online_players(game_id)

            # Get game from Firestore
            db = get_firestore_db()
            game_ref = db.collection("games").document(game_id)
            game_doc = game_ref.get()

            if not game_doc.exists:
                return {"error": "Game not found"}

            game_data = game_doc.to_dict()

            # Only sync if game is waiting (not in progress)
            if game_data.get("status") != "waiting":
                return {"status": "skipped", "message": "Game in progress"}

            # Filter players to only include online ones
            current_players = game_data.get("players", [])
            synced_players = [
                p for p in current_players if p["player_id"] in online_players
            ]

            if len(synced_players) != len(current_players):
                game_ref.update({"players": synced_players})
                return {
                    "status": "synced",
                    "removed": len(current_players) - len(synced_players),
                }

            return {"status": "no_change"}

        except Exception as e:
            logger.error(f"Error syncing presence to Firestore: {e}")
            return {"error": str(e)}
