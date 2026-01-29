"""
Multiplayer Game Routes for AI Pictionary
Handles Race Mode and Guessing Game (Humans vs AI)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from services.firestore_service import FirestoreService
from firebase_admin import firestore
import random

router = APIRouter(prefix="/games", tags=["multiplayer"])
firestore_service = FirestoreService()


# Helper function to generate room codes
def generate_room_code():
    """Generate a 4-character room code (uppercase letters and numbers)"""
    import string

    chars = string.ascii_uppercase + string.digits
    return "".join(random.choice(chars) for _ in range(4))


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
        raise HTTPException(
            status_code=400, detail="Invalid game type for race endpoint"
        )

    # Default settings for Race Mode
    default_settings = {
        "max_rounds": 5,
        "round_duration": 60,  # seconds
        "target_confidence": 0.85,
        "categories": [
            "apple",
            "sun",
            "tree",
            "house",
            "car",
            "cat",
            "fish",
            "star",
            "umbrella",
            "flower",
            "moon",
            "airplane",
            "bicycle",
            "clock",
        ],
    }

    settings = {**default_settings, **(request.settings or {})}

    # Generate room code
    room_code = generate_room_code()

    # Create game in Firestore
    game_data = {
        "game_type": "race",
        "status": "waiting",  # waiting → playing → finished
        "created_at": firestore.SERVER_TIMESTAMP,
        "creator_id": request.creator_id,
        "room_code": room_code,  # Add room code
        "max_players": min(request.max_players, 4),  # Cap at 4 players
        "players": [
            {
                "player_id": request.creator_id,
                "player_name": request.creator_name,
                "ready": False,
                "score": 0,
                "rounds_won": 0,
            }
        ],
        "current_round": 0,
        "max_rounds": settings["max_rounds"],
        "settings": settings,
        "round_winners": [],  # Track winner of each round
        "current_category": None,
        "round_start_time": None,
        "round_submissions": {},  # Track best confidence per player for current round
    }

    game_id = await firestore_service.create_game(game_data)

    return {
        "game_id": game_id,
        "room_code": room_code,
        "game_type": "race",
        "status": "waiting",
        "players": game_data["players"],
        "current_round": 0,
        "max_rounds": settings["max_rounds"],
        "settings": settings,
    }


@router.post("/race/join")
async def join_race_game(request: JoinGameRequest):
    """
    Join an existing Race Mode lobby
    """

    # Get game from Firestore
    game = await firestore_service.get_game(request.game_id)

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
        "rounds_won": 0,
    }

    game["players"].append(new_player)

    # Update Firestore
    await firestore_service.update_game(request.game_id, {"players": game["players"]})

    return {"status": "joined", "game": game}


@router.post("/race/start")
async def start_race_game(request: StartGameRequest):
    """
    Start the Race Mode game

    Requirements:
    - At least 2 players
    - All players must be ready
    """

    game = await firestore_service.get_game(request.game_id)

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
        "round_start_time": firestore.SERVER_TIMESTAMP,
        "round_submissions": {},  # Reset submissions for new round
    }

    await firestore_service.update_game(request.game_id, update_data)

    return {
        "status": "started",
        "current_round": 1,
        "category": first_category,
        "round_duration": game["settings"]["round_duration"],
    }


@router.post("/race/submit-drawing")
async def submit_race_drawing(request: SubmitDrawingRequest):
    """
    Submit a drawing for the current race round

    **Win Condition:**
    - First player to reach target confidence wins the round
    - If time expires, player with highest confidence wins
    """

    game = await firestore_service.get_game(request.game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Game not in playing state")

    if request.round_number != game["current_round"]:
        raise HTTPException(status_code=400, detail="Invalid round number")

    target_confidence = game["settings"]["target_confidence"]

    # Track this player's submission (update if better than previous)
    round_submissions = game.get("round_submissions", {})
    current_best = round_submissions.get(request.player_id, {}).get("confidence", 0)

    if (
        request.prediction.lower() == game["current_category"].lower()
        and request.confidence > current_best
    ):
        round_submissions[request.player_id] = {
            "player_name": next(
                (
                    p["player_name"]
                    for p in game["players"]
                    if p["player_id"] == request.player_id
                ),
                "Unknown",
            ),
            "confidence": request.confidence,
            "prediction": request.prediction,
        }
        # Update submissions in game
        await firestore_service.update_game(
            request.game_id, {"round_submissions": round_submissions}
        )

    # Check if prediction matches current category
    if request.prediction.lower() != game["current_category"].lower():
        return {
            "status": "incorrect_category",
            "message": f"Draw a {game['current_category']}!",
            "confidence": request.confidence,
        }

    # Check if player won this round (reached target confidence)
    if request.confidence >= target_confidence:
        # Player wins this round!
        winner = next(
            (p for p in game["players"] if p["player_id"] == request.player_id), None
        )

        if winner:
            winner["rounds_won"] += 1
            winner["score"] += 100  # Points for winning a round

            # Record round winner
            round_winners = game.get("round_winners", [])
            round_winners.append(
                {
                    "round": game["current_round"],
                    "winner_id": request.player_id,
                    "winner_name": winner["player_name"],
                    "confidence": request.confidence,
                    "category": game["current_category"],
                }
            )

            # Check if game is over
            if game["current_round"] >= game["max_rounds"]:
                # Game finished - determine champion
                champion = max(game["players"], key=lambda p: p["rounds_won"])

                await firestore_service.update_game(
                    request.game_id,
                    {
                        "status": "finished",
                        "round_winners": round_winners,
                        "players": game["players"],
                        "champion": {
                            "player_id": champion["player_id"],
                            "player_name": champion["player_name"],
                            "rounds_won": champion["rounds_won"],
                        },
                        "finished_at": firestore.SERVER_TIMESTAMP,
                    },
                )

                return {
                    "status": "game_finished",
                    "round_winner": winner,
                    "champion": champion,
                    "final_standings": sorted(
                        game["players"], key=lambda p: p["rounds_won"], reverse=True
                    ),
                }
            else:
                # Start next round
                next_round = game["current_round"] + 1
                categories = game["settings"]["categories"]
                next_category = random.choice(categories)

                await firestore_service.update_game(
                    request.game_id,
                    {
                        "current_round": next_round,
                        "current_category": next_category,
                        "round_start_time": firestore.SERVER_TIMESTAMP,
                        "round_winners": round_winners,
                        "players": game["players"],
                        "round_submissions": {},  # Reset submissions for new round
                    },
                )

                return {
                    "status": "round_won",
                    "round_winner": winner,
                    "next_round": next_round,
                    "next_category": next_category,
                }

    # Player hasn't won yet, keep trying
    return {
        "status": "keep_drawing",
        "confidence": request.confidence,
        "target": target_confidence,
        "message": f"Keep drawing! Target: {int(target_confidence * 100)}%",
    }


@router.get("/race/{game_id}")
async def get_race_game(game_id: str):
    """
    Get current state of a race game
    Used for real-time updates via polling or WebSocket
    """

    game = await firestore_service.get_game(game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return game


@router.post("/race/timeout")
async def race_timeout(request: StartGameRequest):
    """
    Handle race round timeout - award point to player with highest confidence
    """

    game = await firestore_service.get_game(request.game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Game not in playing state")

    round_winners = game.get("round_winners", [])

    # Find player with highest confidence for current category
    round_submissions = game.get("round_submissions", {})

    best_player = None
    best_confidence = 0

    if round_submissions:
        # Find submission with highest confidence
        for player_id, submission in round_submissions.items():
            if submission["confidence"] > best_confidence:
                best_confidence = submission["confidence"]
                best_player = next(
                    (p for p in game["players"] if p["player_id"] == player_id), None
                )

    # Award point to best player if any submissions exist
    if best_player and best_confidence > 0:
        best_player["rounds_won"] += 1
        best_player["score"] += 50  # Lower score for timeout win

        round_winners.append(
            {
                "round": game["current_round"],
                "winner_id": best_player["player_id"],
                "winner_name": best_player["player_name"],
                "confidence": best_confidence,
                "category": game["current_category"],
                "timeout": True,
            }
        )

    # Check if game is finished
    if game["current_round"] >= game["max_rounds"]:
        # Game finished - determine champion
        player_wins = {}
        for player in game["players"]:
            player_wins[player["player_id"]] = player["rounds_won"]

        champion_id = max(player_wins, key=player_wins.get)
        champion = next(p for p in game["players"] if p["player_id"] == champion_id)

        await firestore_service.update_game(
            request.game_id,
            {
                "status": "finished",
                "round_winners": round_winners,
                "players": game["players"],
                "champion": {
                    "player_id": champion["player_id"],
                    "player_name": champion["player_name"],
                    "rounds_won": champion["rounds_won"],
                },
                "finished_at": firestore.SERVER_TIMESTAMP,
            },
        )

        return {
            "status": "game_finished",
            "champion": champion,
            "round_winners": round_winners,
        }

    # Start next round
    next_round = game["current_round"] + 1
    categories = game["settings"]["categories"]
    next_category = random.choice(categories)

    await firestore_service.update_game(
        request.game_id,
        {
            "current_round": next_round,
            "current_category": next_category,
            "round_start_time": firestore.SERVER_TIMESTAMP,
            "round_winners": round_winners,
            "players": game["players"],
            "round_submissions": {},  # Reset submissions for new round
        },
    )

    return {
        "status": "next_round",
        "current_round": next_round,
        "category": next_category,
        "round_winner": {
            "player_name": best_player["player_name"],
            "confidence": best_confidence,
        }
        if best_player
        else None,
        "message": f"Round terminé - {best_player['player_name']} gagne avec {int(best_confidence * 100)}%"
        if best_player
        else "Round terminé - aucun gagnant",
    }


@router.get("/race/lobby/list")
async def list_race_lobbies():
    """
    List all available race game lobbies (waiting status)
    """

    # Query Firestore for waiting games
    lobbies = firestore_service.get_games_by_status("waiting", game_type="race")

    return {"lobbies": lobbies}


# ==================== Guessing Game Endpoints ====================


class SubmitGuessRequest(BaseModel):
    game_id: str
    player_id: str
    player_name: str
    guess: str
    round_number: int


class SendChatMessageRequest(BaseModel):
    game_id: str
    player_id: str
    player_name: str
    message: str


class UpdateCanvasRequest(BaseModel):
    game_id: str
    canvas_state: str  # Base64 encoded image


class AiPredictionRequest(BaseModel):
    game_id: str
    round_number: int
    prediction: str
    confidence: float


class SubmitStrokeRequest(BaseModel):
    game_id: str
    player_id: str
    round_number: int
    stroke: Dict  # {x, y, timestamp}


@router.post("/guessing/create")
async def create_guessing_game(request: CreateGameRequest):
    """
    Create a new Guessing Game (Humans vs AI)

    **Rules:**
    - Team of 2-5 humans vs AI
    - One human draws, others try to guess
    - AI makes predictions every 500ms
    - Humans win if they guess before AI reaches 85% confidence
    - Round duration: 90 seconds
    - 5 rounds total, team with most wins = winner
    """

    if request.game_type != "guessing":
        raise HTTPException(status_code=400, detail="Invalid game type")

    default_settings = {
        "max_rounds": 5,
        "round_duration": 90,  # seconds
        "ai_confidence_threshold": 0.85,
        "prediction_interval": 500,  # ms
        "categories": [
            "apple",
            "sun",
            "tree",
            "house",
            "car",
            "cat",
            "fish",
            "star",
            "umbrella",
            "flower",
            "moon",
            "airplane",
            "bicycle",
            "clock",
        ],
    }

    settings = {**default_settings, **(request.settings or {})}

    game_data = {
        "game_type": "guessing",
        "status": "waiting",
        "created_at": datetime.utcnow(),
        "creator_id": request.creator_id,
        "max_players": min(request.max_players, 5),
        "players": [
            {
                "player_id": request.creator_id,
                "player_name": request.creator_name,
                "ready": False,
                "team_score": 0,
                "individual_guesses": 0,
            }
        ],
        "current_round": 0,
        "max_rounds": settings["max_rounds"],
        "settings": settings,
        "current_category": None,
        "current_drawer": None,
        "round_start_time": None,
        "round_winners": [],
        "team_humans": {"score": 0, "rounds_won": 0},
        "team_ai": {"score": 0, "rounds_won": 0, "predictions": []},
    }

    game_id = await firestore_service.create_game(game_data)

    return {
        "game_id": game_id,
        "game_type": "guessing",
        "status": "waiting",
        "players": game_data["players"],
        "settings": settings,
    }


@router.post("/guessing/join")
async def join_guessing_game(request: JoinGameRequest):
    """Join an existing Guessing Game lobby"""

    game = await firestore_service.get_game(request.game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game already started")

    if len(game["players"]) >= game["max_players"]:
        raise HTTPException(status_code=400, detail="Game is full")

    if any(p["player_id"] == request.player_id for p in game["players"]):
        raise HTTPException(status_code=400, detail="Already in this game")

    new_player = {
        "player_id": request.player_id,
        "player_name": request.player_name,
        "ready": False,
        "team_score": 0,
        "individual_guesses": 0,
    }

    game["players"].append(new_player)
    await firestore_service.update_game(request.game_id, {"players": game["players"]})

    return {"status": "joined", "game": game}


@router.post("/guessing/start")
async def start_guessing_game(request: StartGameRequest):
    """Start the Guessing Game"""

    game = await firestore_service.get_game(request.game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game already started")

    if len(game["players"]) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")

    # Select first drawer (random)
    first_drawer = random.choice(game["players"])
    first_category = random.choice(game["settings"]["categories"])

    update_data = {
        "status": "playing",
        "current_round": 1,
        "current_category": first_category,
        "current_drawer": {
            "player_id": first_drawer["player_id"],
            "player_name": first_drawer["player_name"],
        },
        "round_start_time": firestore.SERVER_TIMESTAMP,
    }

    await firestore_service.update_game(request.game_id, update_data)

    return {
        "status": "started",
        "drawer": first_drawer,
        "category": first_category,
        "round_duration": game["settings"]["round_duration"],
    }


@router.post("/guessing/submit-guess")
async def submit_guess(request: SubmitGuessRequest):
    """
    Submit a player's guess

    **Win Condition:**
    - If guess is correct and before AI reaches 85%, humans win the round
    """

    game = await firestore_service.get_game(request.game_id)

    if not game or game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Invalid game state")

    if request.round_number != game["current_round"]:
        raise HTTPException(status_code=400, detail="Invalid round number")

    # Check if guess is correct
    if request.guess.lower() == game["current_category"].lower():
        # Check if AI already won
        ai_predictions = game["team_ai"].get("predictions", [])
        ai_won = any(
            p.get("confidence", 0) >= game["settings"]["ai_confidence_threshold"]
            for p in ai_predictions
        )

        if not ai_won:
            # Humans win this round!
            game["team_humans"]["score"] += 100
            game["team_humans"]["rounds_won"] += 1

            # Update player stats
            for player in game["players"]:
                if player["player_id"] == request.player_id:
                    player["individual_guesses"] += 1
                    player["team_score"] += 50

            round_winner = {
                "round": game["current_round"],
                "winner": "humans",
                "guesser": request.player_name,
            }

            game["round_winners"].append(round_winner)

            # Check if game over
            if game["current_round"] >= game["max_rounds"]:
                game["status"] = "finished"
                game["winner"] = (
                    "humans"
                    if game["team_humans"]["rounds_won"] > game["team_ai"]["rounds_won"]
                    else "ai"
                )
            else:
                # Next round
                game["current_round"] += 1
                next_drawer = random.choice(game["players"])
                next_category = random.choice(game["settings"]["categories"])
                game["current_drawer"] = {
                    "player_id": next_drawer["player_id"],
                    "player_name": next_drawer["player_name"],
                }
                game["current_category"] = next_category
                game["round_start_time"] = firestore.SERVER_TIMESTAMP
                game["team_ai"]["predictions"] = []

            await firestore_service.update_game(request.game_id, game)

            return {
                "status": "correct_guess",
                "round_winner": "humans",
                "guesser": request.player_name,
                "next_round": game.get("current_round"),
                "game_over": game["status"] == "finished",
            }

    return {"status": "incorrect_guess", "message": "Essayez encore !"}


@router.post("/guessing/chat")
async def send_chat_message(request: SendChatMessageRequest):
    """Send a chat message to the team"""

    # Add message to chat subcollection
    chat_data = {
        "player_id": request.player_id,
        "player_name": request.player_name,
        "message": request.message,
        "timestamp": firestore.SERVER_TIMESTAMP,
    }

    # Use Firestore subcollection for chat (changed from 'turns' to 'chat')
    await firestore_service.add_chat_message(request.game_id, chat_data)

    return {"status": "message_sent"}


@router.post("/guessing/update-canvas")
async def update_canvas_state(request: UpdateCanvasRequest):
    """Update the canvas state so guessers can see the drawer's drawing"""

    # Update canvas_state field in game document
    await firestore_service.update_game(
        request.game_id, {"canvas_state": request.canvas_state}
    )

    return {"status": "canvas_updated"}


@router.post("/guessing/ai-prediction")
async def submit_ai_prediction(request: AiPredictionRequest):
    """
    Submit an AI prediction during the guessing game

    **Win Condition:**
    - If AI prediction confidence >= 85%, AI wins the round
    """

    game = await firestore_service.get_game(request.game_id)

    if not game or game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Invalid game state")

    if request.round_number != game["current_round"]:
        return {"status": "ignored", "message": "Old round prediction"}

    # Add prediction to AI's prediction list using arrayUnion
    import time

    ai_prediction = {
        "timestamp": int(time.time() * 1000),  # Milliseconds since epoch
        "prediction": request.prediction,
        "confidence": request.confidence,
    }

    # Use Firestore arrayUnion to avoid race conditions
    from firebase_admin import firestore as fb_firestore

    db = fb_firestore.client()
    game_ref = db.collection("games").document(request.game_id)

    game_ref.update({"team_ai.predictions": fb_firestore.ArrayUnion([ai_prediction])})

    # Check if AI won (confidence >= threshold and prediction matches category)
    ai_confidence_threshold = game["settings"].get("ai_confidence_threshold", 0.85)

    if (
        request.confidence >= ai_confidence_threshold
        and request.prediction.lower() == game["current_category"].lower()
    ):
        # AI wins this round!
        game["team_ai"]["rounds_won"] += 1

        round_winner = {
            "round": game["current_round"],
            "winner": "ai",
            "confidence": request.confidence,
        }

        game["round_winners"].append(round_winner)

        # Check if game over
        if game["current_round"] >= game["max_rounds"]:
            game["status"] = "finished"
            game["winner"] = (
                "humans"
                if game["team_humans"]["rounds_won"] > game["team_ai"]["rounds_won"]
                else "ai"
            )
        else:
            # Next round
            game["current_round"] += 1
            next_drawer = random.choice(game["players"])
            next_category = random.choice(game["settings"]["categories"])
            game["current_drawer"] = {
                "player_id": next_drawer["player_id"],
                "player_name": next_drawer["player_name"],
            }
            game["current_category"] = next_category
            game["round_start_time"] = firestore.SERVER_TIMESTAMP
            game["team_ai"]["predictions"] = []
            game["canvas_state"] = None  # Clear canvas for new round

        await firestore_service.update_game(request.game_id, game)

        return {
            "status": "ai_won_round",
            "confidence": request.confidence,
            "next_round": game.get("current_round"),
            "game_over": game["status"] == "finished",
        }

    # Prediction added successfully
    return {"status": "prediction_added", "confidence": request.confidence}


@router.get("/guessing/{game_id}")
async def get_guessing_game(game_id: str):
    """Get current state of guessing game"""

    game = await firestore_service.get_game(game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return game


@router.get("/guessing/lobby/list")
async def list_guessing_lobbies():
    """List all available guessing game lobbies"""

    lobbies = firestore_service.get_games_by_status("waiting", game_type="guessing")

    return {"lobbies": lobbies}


@router.post("/guessing/timeout")
async def guessing_timeout(request: StartGameRequest):
    """
    Handle guessing game round timeout - AI wins if they reached threshold
    """

    game = await firestore_service.get_game(request.game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Game not in playing state")

    # Check if AI won this round
    ai_predictions = game.get("team_ai", {}).get("predictions", [])
    ai_won = any(
        p.get("confidence", 0) >= game["settings"]["ai_confidence_threshold"]
        for p in ai_predictions
    )

    if ai_won:
        # AI wins this round
        game["team_ai"]["score"] += 100
        game["team_ai"]["rounds_won"] += 1

        round_winner = {
            "round": game["current_round"],
            "winner": "ai",
            "reason": "timeout_with_prediction",
        }
    else:
        # Nobody wins - timeout without winner
        round_winner = {
            "round": game["current_round"],
            "winner": "none",
            "reason": "timeout_no_guess",
        }

    game["round_winners"].append(round_winner)

    # Check if game over
    if game["current_round"] >= game["max_rounds"]:
        game["status"] = "finished"
        game["winner"] = (
            "humans"
            if game["team_humans"]["rounds_won"] > game["team_ai"]["rounds_won"]
            else "ai"
            if game["team_ai"]["rounds_won"] > game["team_humans"]["rounds_won"]
            else "draw"
        )

        await firestore_service.update_game(request.game_id, game)

        return {
            "status": "game_finished",
            "winner": game["winner"],
            "team_humans": game["team_humans"],
            "team_ai": game["team_ai"],
        }

    # Next round
    game["current_round"] += 1
    next_drawer = random.choice(game["players"])
    next_category = random.choice(game["settings"]["categories"])
    game["current_drawer"] = {
        "player_id": next_drawer["player_id"],
        "player_name": next_drawer["player_name"],
    }
    game["current_category"] = next_category
    game["round_start_time"] = firestore.SERVER_TIMESTAMP
    game["team_ai"]["predictions"] = []

    await firestore_service.update_game(request.game_id, game)

    return {
        "status": "next_round" if not ai_won else "ai_won_round",
        "round_winner": round_winner,
        "current_round": game["current_round"],
        "new_drawer": next_drawer,
        "new_category": next_category,
    }
