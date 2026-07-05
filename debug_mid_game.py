import asyncio
import websockets
import json
import uuid
import get_premad_deck as gpd

# Import your existing classes
from classes import Player, Card, Pile, convert_card

# Global lobby registry
lobbies = {}

class DebugGame:
    def __init__(self):
        self.players = []
        self.active_player_index = 0
        self.turn_number = 5 # Set to a later turn
        self.current_phase = "MainPhase"
        self.connected_clients = set() 
        self.temps = []

    async def broadcast_event(self, event_type, payload):
        """Sends an event to all connected frontend clients."""
        if not self.connected_clients:
            return
            
        message = json.dumps({
            "type": event_type,
            "data": payload
        })
        
        await asyncio.gather(*[client.send(message) for client in self.connected_clients])

    async def execute_attack(self, attacker_id, target_id):
        # Placeholder for your attack logic
        await self.broadcast_event("ATTACK_RESOLVED", {
            "attacker": attacker_id,
            "target": target_id,
            "damage_dealt": 1,
            "target_destroyed": True
        })
        
    def force_mid_game_state(self):
        """Forces the board into a mid-game state for testing and prints the status."""
        print("\n" + "="*50)
        print("[DEBUG] 🛠️ INJECTING MID-GAME BOARD STATE...")
        print("="*50)
        
        p1 = self.players[0]
        p2 = self.players[1]
        
        # --- MANIPULATE PLAYER 1 ---
        p1.life -= 2 # Took some damage
        p1.don_deck = [4, 3, 3] # 4 usable, 3 tapped, 3 left in deck
        
        # Move up to 2 cards from Hand to Character Area
        keys_to_move = list(p1.hand.keys())[:2]
        for key in keys_to_move:
            card = p1.hand.pop(key)
            card.is_tapped = False
            p1.character_area[card.id] = card

        # --- MANIPULATE PLAYER 2 ---
        p2.life -= 1
        p2.don_deck = [2, 6, 2] # 2 usable, 6 tapped, 2 left in deck
        
        # Move 1 card from Hand to Character Area and tap it
        if p2.hand:
            key = list(p2.hand.keys())[0]
            card = p2.hand.pop(key)
            card.is_tapped = True # Simulating it attacked last turn
            p2.character_area[card.id] = card

        # --- TERMINAL VERIFICATION PRINTOUT ---
        for i, p in enumerate([p1, p2]):
            print(f"\n---> PLAYER {i+1}: {p.name} <---")
            print(f"Life: {p.life}")
            print(f"DON!! (Usable/Tapped/Deck): {p.don_deck}")
            print(f"Cards in Hand: {len(p.hand)}")
            print(f"Characters on Board ({len(p.character_area)}/5):")
            
            if not p.character_area:
                print("  [None]")
            for cid, char_card in p.character_area.items():
                state = "TAPPED" if getattr(char_card, 'is_tapped', False) else "ACTIVE"
                print(f"  - {char_card.name} | Power: {char_card.current_power} | Cost: {char_card.current_cost} [{state}]")
                
        print("\n" + "="*50)
        print("[DEBUG] ✅ INJECTION COMPLETE. SENDING TO FRONTEND...")
        print("="*50 + "\n")

    def start_game_board(self):
        """Generates the payload, now dynamically reading the forced mid-game stats."""
        data = [{}, {}]
        
        for i in range(2):
            p = self.players[i]
            data[i]['name'] = p.name
            data[i]["cardBackImg"] = "normal.png"
            data[i]["donImg"] = "DON.png"
            data[i]['stageImg'] = None
            data[i]['lifeCount'] = p.life
            
            # READ DYNAMIC DON INSTEAD OF HARDCODING [0, 0, 10]
            data[i]['donCards'] = p.don_deck
            
            data[i]['leader'] = {
                'img': p.leader.img, 
                'power': p.leader.current_power,
                'is_tapped': False, 
                'location': 'leader', 
                'type': 'leader'
            }
            
            # READ DYNAMIC CHARACTERS INSTEAD OF []
            data[i]['characters'] = []
            for char_card in p.character_area.values():
                char_type = getattr(char_card, 'types', 'character')
                data[i]['characters'].append({
                    "img": char_card.img,
                    "cost": char_card.current_cost,
                    "power": char_card.current_power,
                    "nb_don": char_card.attached_don,
                    "is_tapped": getattr(char_card, 'is_tapped', False),
                    "id": str(char_card.id),
                    "location": "character",
                    "type": char_type
                })
            
            # READ DYNAMIC HAND
            data[i]['hand'] = []
            for card in p.hand.values():
                card_type = getattr(card, 'types', 'card')
                data[i]['hand'].append({
                    "img": card.img,
                    "cost": card.current_cost,
                    "power": card.current_power,
                    "nb_don": 0,
                    "is_tapped": False, 
                    "location": "hand", 
                    "type": card_type, 
                    "id": str(getattr(card, 'id', ''))
                })
                
            data[i]["is_active"] = (i == self.active_player_index)
            
        return data

async def handler(websocket):
    print("\n[PYTHON] --- NEW CONNECTION DETECTED! ---")
    current_match = None
    
    try:
        await websocket.send(json.dumps({"type": "CHOOSE_DECK"}))
        
        async for message in websocket:
            action = json.loads(message)
            code = action.get("code", "DEFAULT")
            
            if code not in lobbies:
                lobbies[code] = DebugGame() 
                
            current_match = lobbies[code]
            current_match.connected_clients.add(websocket)
            
            if action["type"] == "CONNECT_LOBBY":
                print(f"[PYTHON] Client joined lobby {code}.")
                continue
            
            if action["type"] == "PLAYER_READY":
                player_name = action.get('name', 'Unknown')
                deck_id = action['deck'][:5]
                print(f"[PYTHON] Player {player_name} is ready with deck {deck_id}!")
                
                # Setup player
                current_match.players.append(Player(player_name, gpd.main(deck_id)))
                
                # Check if both players are ready
                if len(current_match.players) == 2:
                    # 1. FORCE THE MID-GAME STATE AND PRINT IT
                    current_match.force_mid_game_state()
                    
                    # 2. GENERATE BOARD DATA
                    game_state = current_match.start_game_board()
                    
                    # 3. BROADCAST TO FRONTEND
                    await current_match.broadcast_event("GAME_START", game_state)
                
            elif action["type"] == "DECLARE_ATTACK":
                await current_match.execute_attack(action["attacker"], action["target"])
            
            elif action["type"] == "CARD_ACTION":
                if action["action"] in ["PLAY_CARD", "PLAY_CHARACTER", "USE_EVENT", "PLAY_STAGE"]:
                    active_p = current_match.players[current_match.active_player_index]
                    active_p.play_character(action['card_id'])
                    await current_match.broadcast_event("PLAY_CARD_RESPANSE", {action['card_id']: "OK"})
                    
    except Exception as e:
        print(f"\n[PYTHON ERROR] Something went wrong in the handler: {e}\n")
        
    finally:
        if current_match and websocket in current_match.connected_clients:
            current_match.connected_clients.remove(websocket)
        print("[PYTHON] Client disconnected.")

async def main():
    print("Starting Mid-Game Debug Server on ws://0.0.0.0:8765")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())