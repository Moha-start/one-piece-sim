from classes import *
import json
import asyncio
import websockets
import get_premad_deck as gpd

# Global lobby registry
lobbies = {}
# TODO : fro cards played chek if the number of DON is good eignef
class Game:
    def __init__(self,):
        self.players = []
        self.active_player_index = 0
        self.turn_number = 1
        self.current_phase = "RefreshPhase"
        self.connected_clients = set() # Store WebSocket connections
        self.temps=[]

    async def broadcast_event(self, event_type, payload):
        """Sends an event to all connected frontend clients."""
        if not self.connected_clients:
            return
            
        message = json.dumps({
            "type": event_type,
            "data": payload
        })
        
        # Send the JSON string to all connected websockets
        await asyncio.gather(*[client.send(message) for client in self.connected_clients])

    async def execute_attack(self, attacker_id, target_id):
        # 1. Game Logic: Calculate power, apply counters, update life, etc.
        # ... logic here ...

        # 2. Broadcast what happened so JS can animate it
        await self.broadcast_event("ATTACK_RESOLVED", {
            "attacker": attacker_id,
            "target": target_id,
            "damage_dealt": 1,
            "target_destroyed": True
        })
        
    async def attach_don(self, card_id, amount):
        # ... game logic to update self.attached_don ...
        await self.broadcast_event("DON_ATTACHED", {
            "card_id": card_id,
            "amount": amount
        })
    
    def start_game_board(self):
        data=[{},{}]
        
        # --- PLAYER 1 SETUP ---
        data[0]['name']=self.players[0].name
        data[0]["cardBackImg"]= "normal.png"
        data[0]["donImg"]= "DON.png"
        data[0]['stageImg']=None
        data[0]['lifeCount']=self.players[0].life
        
        # CHANGED: Initialize DON as [X, Y, Z] where X=usable, Y=tapped, Z=deck
        data[0]['donCards']=[0, 0, 10]
        
        data[0]['leader']={'img':self.players[0].leader.img,'power':self.players[0].leader.current_power,'is_tapped':False, 'location': 'leader', 'type': 'leader'}
        data[0]['characters']=[]
        data[0]['hand']=[]
        data[0]["is_active"]=True
        
        for card in self.players[0].hand.values():
            card:Card
            card_type = getattr(card, 'types', 'card') # Gracefully pull type (character, event, stage)
            data[0]['hand'].append({"img": card.img,"cost": card.current_cost,"power": card.current_power,"nb_don": 0,"is_tapped": False, "location": "hand", "type": card_type, "id": str(getattr(card, 'id', ''))})
            
        # --- PLAYER 2 SETUP ---
        data[1]['name']=self.players[1].name
        data[1]["cardBackImg"]= "normal.png"
        data[1]["donImg"]= "DON.png"
        data[1]['stageImg']=None
        data[1]['lifeCount']=self.players[1].life
        
        # CHANGED: Initialize DON as [X, Y, Z] where X=usable, Y=tapped, Z=deck
        data[1]['donCards']=[0, 0, 10]
        
        data[1]['leader']={'img':self.players[1].leader.img,'power':self.players[1].leader.current_power,'is_tapped':False, 'location': 'leader', 'type': 'leader'}
        data[1]['characters']=[]
        data[1]['hand']=[]
        data[1]["is_active"]=False
        
        for card in self.players[1].hand.values():
            card:Card
            card_type = getattr(card, 'types', 'card')
            data[1]['hand'].append({"img": card.img,"cost": card.current_cost,"power": card.current_power,"nb_don": 0,"is_tapped": False,"id":str(getattr(card, 'id', '')), "location": "hand", "type": card_type})
            
        return data

async def handler(websocket):
    print("\n[PYTHON] --- NEW CONNECTION DETECTED! ---")
    current_match = None
    
    try:
        # 1. Immediately tell the connected client to choose a deck
        print("[PYTHON] Attempting to send CHOOSE_DECK message...")
        await websocket.send(json.dumps({
            "type": "CHOOSE_DECK"
        }))
        print("[PYTHON] Successfully sent CHOOSE_DECK!")
        
        # 2. Listen for incoming moves from the frontend JS
        async for message in websocket:
            #print(f"[PYTHON] Received from client: {message}") 
            action = json.loads(message)
            
            # Identify the specific lobby code provided by JS
            code = action.get("code", "DEFAULT")
            if code not in lobbies:
                lobbies[code] = Game()
                
            current_match = lobbies[code]
            current_match.connected_clients.add(websocket)
            #PrettyPrint(action)
            # Initial join ping
            if action["type"] == "CONNECT_LOBBY":
                print(f"[PYTHON] Client joined lobby {code}.")
                continue
            
            if action["type"] == "PLAYER_READY":
                player_name = action.get('name', 'Unknown')
                print(f"[PYTHON] Player {player_name} is ready with deck {action['deck'][:5]} in lobby {code}!")
                
                current_match.players.append(Player(player_name, gpd.main(action['deck'][:5])))
                if len(current_match.players) == 2:
                    game_state = current_match.start_game_board()
                    #current_match.players = []
                    await current_match.broadcast_event("GAME_START", game_state)
                
            elif action["type"] == "DECLARE_ATTACK":
                await current_match.execute_attack(action["attacker"], action["target"])
            
            elif action["type"]=="CARD_ACTION":
                # Make sure these actions match the strings sent from handleCardAction in JS
                if action["action"] in ["PLAY_CARD", "PLAY_CHARACTER", "USE_EVENT", "PLAY_STAGE"]:
                    # FIX: Changed 'match' to 'current_match'
                    current_match.players[current_match.active_player_index].play_character(action['card_id'])
                    await current_match.broadcast_event("PLAY_CARD_RESPANSE", {action['card_id']:"OK"})
                    

                    
    except Exception as e:
        print(f"\n[PYTHON ERROR] Something went wrong in the handler: {e}\n")
        
    finally:
        if current_match and websocket in current_match.connected_clients:
            current_match.connected_clients.remove(websocket)
        print("[PYTHON] Client disconnected.")

async def main():
    # CHANGED TO 0.0.0.0 - This is required for WSL/Linux environments
    print("Starting Python Game Server on ws://0.0.0.0:8765")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    match = Game() # Original global variable preserved
    print(match)
    asyncio.run(main())