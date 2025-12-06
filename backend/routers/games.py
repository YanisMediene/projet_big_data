"""
Multiplayer Game Routes for AI Pictionary
Handles Race Mode and Guessing Game (Humans vs AI)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from services.firestore_service import FirestoreService
import random

router = APIRouter(prefix="/games", tags=["multiplayer"])
firestore_service = FirestoreService()


# ==================== Pydantic Models ====================


class CreateGameRequest(BaseModel):
    game_type: str  # "race" or "guessing"
    max_players: int = 4
    creator_id: str
    creator_name: str
    settings: Optional[Dict] = None


class JoinGameRequest(BaseModel):
    game_id: str
    player_id: str
    player_name: str


class StartGameRequest(BaseModel):
    game_id: str


class SubmitDrawingRequest(BaseModel):
    game_id: str
    player_id: str
    round_number: int
    drawing_data: str  # Base64 encoded image
    prediction: str
    confidence: float


class GameResponse(BaseModel):
    game_id: str
    game_type: str
    status: str
    players: List[Dict]
    current_round: int
    max_rounds: int
    settings: Dict


# ==================== Race Mode Endpoints ====================


@router.post("/race/create", response_model=GameResponse)
async def create_race_game(request: CreateGameRequest):
    """
    Create a new Race Mode game lobby
    
    **Race Mode Rules:**
    - 2-4 players compete simultaneously
    - Same category for all players each round
    - First to reach target confidence (default: 85%) wins the round
    - 5 rounds total, player with most wins is champion
    - Timer: 60 seconds per round
    """
    
    if request.game_type != "race":
        raise HTTPException(status_code=400, detail="Invalid game type for race endpoint")
    
    # Default settings for Race Mode
    default_settings = {
        "max_rounds": 5,
        "round_duration": 60,  # seconds
        "target_confidence": 0.85,
        "categories": [
            "apple", "sun", "tree", "house", "car", "cat", "fish", "star",
            "umbrella", "flower", "moon", "airplane", "bicycle", "clock"
        ]
    }
    
    settings = {**default_settings, **(request.settings or {})}
    
    # Create game in Firestore
    game_data = {
        "game_type": "race",
        "status": "waiting",  # waiting → playing → finished
        "created_at": datetime.utcnow(),
        "creator_id": request.creator_id,
        "max_players": min(request.max_players, 4),  # Cap at 4 players
        "players": [
            {
                "player_id": request.creator_id,
                "player_name": request.creator_name,
                "ready": False,
                "score": 0,
                "rounds_won": 0
            }
        ],
        "current_round": 0,
        "max_rounds": settings["max_rounds"],
        "settings": settings,
        "round_winners": [],  # Track winner of each round
        "current_category": None,
        "round_start_time": None
    }
    
    game_id = firestore_service.create_game(game_data)
    
    return GameResponse(
        game_id=game_id,
        game_type="race",
        status="waiting",
        players=game_data["players"],
        current_round=0,
        max_rounds=settings["max_rounds"],
        settings=settings
    )


@router.post("/race/join")
async def join_race_game(request: JoinGameRequest):
    """
    Join an existing Race Mode lobby
    """
    
    # Get game from Firestore
    game = firestore_service.get_game(request.game_id)
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game already started")
    
    if len(game["players"]) >= game["max_players"]:
        raise HTTPException(status_code=400, detail="Game is full")
    
    # Check if player already in game
    if any(p["player_id"] == request.player_id for p in game["players"]):
        raise HTTPException(status_code=400, detail="Already in this game")
    
    # Add player
    new_player = {
        "player_id": request.player_id,
        "player_name": request.player_name,
        "ready": False,
        "score": 0,
        "rounds_won": 0
    }
    
    game["players"].append(new_player)
    
    # Update Firestore
    firestore_service.update_game(request.game_id, {"players": game["players"]})
    
    return {"status": "joined", "game": game}


@router.post("/race/start")
async def start_race_game(request: StartGameRequest):
    """
    Start the Race Mode game
    
    Requirements:
    - At least 2 players
    - All players must be ready
    """
    
    game = firestore_service.get_game(request.game_id)
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game already started")
    
    if len(game["players"]) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")
    
    # Select first category randomly
    categories = game["settings"]["categories"]
    first_category = random.choice(categories)
    
    # Update game state
    update_data = {
        "status": "playing",
        "current_round": 1,
        "current_category": first_category,
        "round_start_time": datetime.utcnow()
    }
    
    firestore_service.update_game(request.game_id, update_data)
    
    return {
        "status": "started",
        "current_round": 1,
        "category": first_category,
        "round_duration": game["settings"]["round_duration"]
    }


@router.post("/race/submit-drawing")
async def submit_race_drawing(request: SubmitDrawingRequest):
    """
    Submit a drawing for the current race round
    
    **Win Condition:**
    - First player to reach target confidence wins the round
    - If time expires, player with highest confidence wins
    """
    
    game = firestore_service.get_game(request.game_id)
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Game not in playing state")
    
    if request.round_number != game["current_round"]:
        raise HTTPException(status_code=400, detail="Invalid round number")
    
    target_confidence = game["settings"]["target_confidence"]
    
    # Check if prediction matches current category
    if request.prediction.lower() != game["current_category"].lower():
        return {
            "status": "incorrect_category",
            "message": f"Draw a {game['current_category']}!",
            "confidence": request.confidence
        }
    
    # Check if player won this round (reached target confidence)
    if request.confidence >= target_confidence:
        # Player wins this round!
        winner = next(
            (p for p in game["players"] if p["player_id"] == request.player_id),
            None
        )
        
        if winner:
            winner["rounds_won"] += 1
            winner["score"] += 100  # Points for winning a round
            
            # Record round winner
            round_winners = game.get("round_winners", [])
            round_winners.append({
                "round": game["current_round"],
                "winner_id": request.player_id,
                "winner_name": winner["player_name"],
                "confidence": request.confidence,
                "category": game["current_category"]
            })
            
            # Check if game is over
            if game["current_round"] >= game["max_rounds"]:
                # Game finished - determine champion
                champion = max(game["players"], key=lambda p: p["rounds_won"])
                
                firestore_service.update_game(request.game_id, {
                    "status": "finished",
                    "round_winners": round_winners,
                    "players": game["players"],
                    "champion": {
                        "player_id": champion["player_id"],
                        "player_name": champion["player_name"],
                        "rounds_won": champion["rounds_won"]
                    },
                    "finished_at": datetime.utcnow()
                })
                
                return {
                    "status": "game_finished",
                    "round_winner": winner,
                    "champion": champion,
                    "final_standings": sorted(
                        game["players"],
                        key=lambda p: p["rounds_won"],
                        reverse=True
                    )
                }
            else:
                # Start next round
                next_round = game["current_round"] + 1
                categories = game["settings"]["categories"]
                next_category = random.choice(categories)
                
                firestore_service.update_game(request.game_id, {
                    "current_round": next_round,
                    "current_category": next_category,
                    "round_start_time": datetime.utcnow(),
                    "round_winners": round_winners,
                    "players": game["players"]
                })
                
                return {
                    "status": "round_won",
                    "round_winner": winner,
                    "next_round": next_round,
                    "next_category": next_category
                }
    
    # Player hasn't won yet, keep trying
    return {
        "status": "keep_drawing",
        "confidence": request.confidence,
        "target": target_confidence,
        "message": f"Keep drawing! Target: {int(target_confidence * 100)}%"
    }


@router.get("/race/{game_id}")
async def get_race_game(game_id: str):
    """
    Get current state of a race game
    Used for real-time updates via polling or WebSocket
    """
    
    game = firestore_service.get_game(game_id)
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return game


@router.get("/race/lobby/list")
async def list_race_lobbies():
    """
    List all available race game lobbies (waiting status)
    """
    
    # Query Firestore for waiting games
    lobbies = firestore_service.get_games_by_status("waiting", game_type="race")
    
    return {"lobbies": lobbies}
