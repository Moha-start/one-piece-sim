from classes import *
import json
import asyncio
import websockets
import get_premad_deck as gpd

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
        data[0]['name']=self.players[0].name
        data[0]["cardBackImg"]= "normal.png"
        data[0]["donImg"]= "DON.png"
        data[0]['stageImg']=None
        data[0]['lifeCount']=self.players[0].life
        data[0]['donCards']=[]
        data[0]['leader']={'img':self.players[0].leader.img,'power':self.players[0].leader.current_power,'is_tapped':False}
        data[0]['characters']=[]
        data[0]['hand']=[]
        data[0]["is_active"]=True
        for card in self.players[0].hand:
            card:Card
            data[0]['hand'].append({"img": card.img,"cost": card.current_cost,"power": card.current_power,"nb_don": 0,"is_tapped": False})
        data[1]['name']=self.players[1].name
        data[1]["cardBackImg"]= "normal.png"
        data[1]["donImg"]= "DON.png"
        data[1]['stageImg']=None
        data[1]['lifeCount']=self.players[1].life
        data[1]['donCards']=[]
        data[1]['leader']={'img':self.players[1].leader.img,'power':self.players[1].leader.current_power,'is_tapped':False}
        data[1]['characters']=[]
        data[1]['hand']=[]
        data[1]["is_active"]=False
        for card in self.players[1].hand:
            card:Card
            data[1]['hand'].append({"img": card.img,"cost": card.current_cost,"power": card.current_power,"nb_don": 0,"is_tapped": False,"id":str(card.id)})
        return data

async def handler(websocket):
    print("\n[PYTHON] --- NEW CONNECTION DETECTED! ---")
    
    try:
        # Register the new client
        match.connected_clients.add(websocket)
        print("[PYTHON] Client added to game state.")
        
        # 1. Immediately tell the connected client to choose a deck
        print("[PYTHON] Attempting to send CHOOSE_DECK message...")
        await websocket.send(json.dumps({
            "type": "CHOOSE_DECK"
        }))
        print("[PYTHON] Successfully sent CHOOSE_DECK!")
        
        # 2. Listen for incoming moves from the frontend JS
        async for message in websocket:
            print(f"[PYTHON] Received from client: {message}") 
            action = json.loads(message)
            
            # Handle the player submitting their deck
            if action["type"] == "PLAYER_READY":
                print(f"[PYTHON] Player {action['name']} is ready with deck {action['deck'][:5]}!")
                match.players.append(Player(action['name'],gpd.main(action['deck'][:5])))
                if len(match.players)==2:
                    game_state=match.start_game_board()
                    match.players=[]
                    await match.broadcast_event("GAME_START",game_state)
                

            elif action["type"] == "DECLARE_ATTACK":
                await match.execute_attack(action["attacker"], action["target"])
                
    except Exception as e:
        print(f"\n[PYTHON ERROR] Something went wrong in the handler: {e}\n")
        
    finally:
        if websocket in match.connected_clients:
            match.connected_clients.remove(websocket)
        print("[PYTHON] Client disconnected.")

async def main():
    # CHANGED TO 0.0.0.0 - This is required for WSL/Linux environments
    print("Starting Python Game Server on ws://0.0.0.0:8765")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    match = Game()
    print(match)
    asyncio.run(main())