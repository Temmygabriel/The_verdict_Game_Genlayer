# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Correction 1 (AI_Town): import gl this way — gl is NOT a direct export from genlayer
import genlayer.gl as gl
# Correction 1 (AI_Town): TreeMap and u256 imported separately
from genlayer import TreeMap, u256
import json

WINS_NEEDED = 3


class TheVerdict(gl.Contract):

    game_count: u256
    games: TreeMap[u256, str]

    def __init__(self):
        self.game_count = u256(0)

    # Correction 2 (corrections.txt): write methods return None, not typing.Any
    @gl.public.write
    def create_game(self, player_name: str) -> None:
        game_id = int(self.game_count) + 1
        self.game_count = u256(game_id)

        # Correction 3 (corrections.txt): first arg to prompt_non_comparative is a function.
        # Correction 3 (AI_Town): function returns raw string — json.loads goes OUTSIDE.
        # Full prompt goes inside gl.nondet.exec_prompt(), task= is just a short summary.
        def generate_topic():
            return gl.nondet.exec_prompt(
                "You create absurd, funny, wildly controversial statements for a debate party game called THE VERDICT. "
                "Generate ONE single absurd statement that two players will argue for and against. "
                "Requirements: ridiculous, funny, relatable to everyday life, 8 to 15 words long, debatable. "
                "Examples of the style: "
                "'Pigeons are secretly government surveillance drones deployed since 1986', "
                "'Everyone should be legally required to narrate their own life like a nature documentary', "
                "'Breakfast food tastes better at midnight and scientists are hiding this from us', "
                "'Mondays should be abolished and replaced with a second Sunday by international law'. "
                "Return ONLY the statement itself. No quotes around it. No explanation. Nothing else."
            ).strip().strip('"').strip("'").strip()

        topic = gl.eq_principle.prompt_non_comparative(
            generate_topic,
            task="Generate one absurd funny debate topic statement",
            criteria="Single statement, absurd, funny, 8-15 words, debatable, no surrounding quotes"
        )

        if not topic or len(topic) < 5:
            topic = "Everyone should be legally required to narrate their life like a nature documentary"

        state = {
            "game_id": game_id,
            "status": "waiting",
            "players": [player_name],
            "scores": {player_name: 0},
            "current_round": 1,
            "current_topic": topic,
            "arguments": {},
            "round_winner": None,
            "round_verdict": None,
            "game_winner": None,
            "history": []
        }
        self.games[u256(game_id)] = json.dumps(state)

    @gl.public.write
    def join_game(self, game_id: int, player_name: str) -> None:
        key = u256(game_id)
        # Correction 4 (corrections.txt): TreeMap has no .get() — use `if key in` then brackets
        if key not in self.games:
            return
        state = json.loads(self.games[key])

        if state["status"] != "waiting":
            return
        if len(state["players"]) >= 2:
            return
        if player_name in state["players"]:
            return

        state["players"].append(player_name)
        state["scores"][player_name] = 0
        state["status"] = "arguing"
        self.games[key] = json.dumps(state)

    @gl.public.write
    def submit_argument(self, game_id: int, player_name: str, argument: str) -> None:
        key = u256(game_id)
        if key not in self.games:
            return
        state = json.loads(self.games[key])

        if state["status"] != "arguing":
            return
        if player_name not in state["players"]:
            return
        if player_name in state["arguments"]:
            return  # already submitted this round

        state["arguments"][player_name] = argument

        # When BOTH players have submitted — trigger the AI judge
        if len(state["arguments"]) == 2:
            p1 = state["players"][0]
            p2 = state["players"][1]
            arg1 = state["arguments"][p1]
            arg2 = state["arguments"][p2]
            topic = state["current_topic"]

            # --- JUDGE THE ROUND ---
            # Correction 3: function returns raw string, parse outside
            def judge():
                return gl.nondet.exec_prompt(
                    f"You are the Supreme Absurdity Judge — the most entertaining, unhinged AI judge in existence. "
                    f"You decide winners based on creativity, humour, chaos energy, and sheer entertainment value. "
                    f"Logic does NOT win. Charisma and absurdity do. "
                    f"The topic being debated is: {topic} "
                    f"Player named {p1} argues: {arg1} "
                    f"Player named {p2} argues: {arg2} "
                    f"Pick the winner. Be funny and dramatic in your verdict. "
                    f"Respond ONLY with this exact JSON and nothing else: "
                    f'{{\"winner\": \"NAME\", \"verdict\": \"Your funny 1-2 sentence ruling\"}} '
                    f"Replace NAME with exactly {p1} or exactly {p2}. No other text outside the JSON."
                ).replace("```json", "").replace("```", "").strip()

            judgment_str = gl.eq_principle.prompt_non_comparative(
                judge,
                task="Judge which argument is more creative and entertaining",
                criteria=f"JSON object with winner being exactly '{p1}' or '{p2}' and a funny verdict under 50 words"
            )

            # Parse judgment — correction 3: json.loads OUTSIDE the function
            try:
                judgment = json.loads(judgment_str)
                winner = str(judgment.get("winner", "")).strip()
                verdict = str(judgment.get("verdict", "The judge is too stunned to speak."))
                # Validate winner is one of the two players
                if winner not in [p1, p2]:
                    if p1.lower() in winner.lower():
                        winner = p1
                    elif p2.lower() in winner.lower():
                        winner = p2
                    else:
                        winner = p1
            except Exception:
                winner = p1
                verdict = "The judge's brain short-circuited. Point awarded by cosmic coin flip."

            # Record this round in history
            state["history"].append({
                "round": state["current_round"],
                "topic": topic,
                "arguments": {p1: arg1, p2: arg2},
                "winner": winner,
                "verdict": verdict
            })

            # Update scores
            state["scores"][winner] = state["scores"].get(winner, 0) + 1
            state["round_winner"] = winner
            state["round_verdict"] = verdict

            # Check if someone won the game
            if state["scores"][winner] >= WINS_NEEDED:
                state["status"] = "finished"
                state["game_winner"] = winner

            else:
                # --- START NEXT ROUND with a fresh topic ---
                next_round = state["current_round"] + 1

                def generate_next_topic():
                    return gl.nondet.exec_prompt(
                        f"Generate a NEW absurd funny debate topic for round {next_round} of THE VERDICT party game. "
                        f"The previous topic was: {topic}. Make this one completely different and even more ridiculous. "
                        f"Requirements: single statement, absurd, funny, 8-15 words, debatable. "
                        f"Return ONLY the statement. No quotes. No explanation. Nothing else."
                    ).strip().strip('"').strip("'").strip()

                new_topic = gl.eq_principle.prompt_non_comparative(
                    generate_next_topic,
                    task="Generate a new absurd funny debate topic different from the previous one",
                    criteria="Single statement, absurd, funny, 8-15 words, clearly different from previous topic, no quotes"
                )

                if not new_topic or len(new_topic) < 5:
                    new_topic = "All chairs should come with a dramatic entrance theme song by law"

                state["current_round"] = next_round
                state["arguments"] = {}
                state["current_topic"] = new_topic
                # Clear round_winner so frontend can detect new round cleanly
                state["round_winner"] = None
                state["round_verdict"] = None
                state["status"] = "arguing"

        self.games[key] = json.dumps(state)

    # --- VIEW METHODS ---

    @gl.public.view
    def get_game(self, game_id: int) -> str:
        key = u256(game_id)
        if key in self.games:
            return self.games[key]
        return ""

    @gl.public.view
    def get_game_count(self) -> int:
        return int(self.game_count)
