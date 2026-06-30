from classes import *
import json
import asyncio
import websockets

class Game:
    def __init__(self, player1:Player=None, player2:Player=None):
        self.players = [player1, player2]
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

async def handler(websocket):
    # Register the new client
    match.connected_clients.add(websocket)
    try:
        # 1. SEND THIS IMMEDIATELY to trigger the UI in game.js
        await websocket.send(json.dumps({
            "type": "CHOOSE_DECK"
        }))
        players=[]
        # 2. Listen for incoming moves from the frontend JS
        async for message in websocket:
            print(f"Received from client: {message}") 
            
            action = json.loads(message)
            
            # Handle the frontend sending the chosen deck
            if action["type"] == "PLAYER_READY":
                print(f"Player {action.get('name')} is ready with deck {action.get('deck')}")
                match.temps.append(action)
                if len(match.temps)==2:
                    print('there are 2 players')
                    print(match.temps)
                    deck1 = gpd.main(match.temps[0]['deck'][:5]) # Ensure gpd is imported or defined
                    deck2 = gpd.main(match.temps[1]['deck'][:5])
                    player1 = Player(match.temps[0]['name'], deck1)
                    player2 = Player(match.temps[1]['name'], deck2)
                    match.players=[player1, player2]
                    await match.broadcast_event('STAR GAME',match)
                # TODO later: Check if both plays are ready, then send "GAME_START"
                
            elif action["type"] == "DECLARE_ATTACK":
                await match.execute_attack(action["attacker"], action["target"])
                
    finally:
        match.connected_clients.remove(websocket)

async def main():
    print("Starting Python Game Server on ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    # Initialize game
    match = Game()
    
    # Printing the game will automatically print both players!
    print(match)
    asyncio.run(main())