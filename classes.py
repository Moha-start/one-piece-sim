from random import shuffle
import uuid
from logOut import *

class Pile:
    def __init__(self):
        self.pile = []
        self.size = 0

    def is_empty(self):
        return self.size == 0
    
    def add(self, element):
        self.pile.append(element)
        self.size += 1

    def get(self, place="S"):
        if self.is_empty():
            raise IndexError("Cannot take an element from an empty pile.")
        
        self.size -= 1
        if place == "S":
            return self.pile.pop(-1)
        else:                
            return self.pile.pop(0)

    def __str__(self):
        # Improved formatting to prevent massive console spam
        return f"Pile (Size: {self.size})"
    
    def __len__(self):
        return self.size

class Card:
    def __init__(self, name, img, category, cost, attributes, power, counter, colors, types, effect, trigger):
        # Static/Printed properties
        self.name = name
        self.img = img
        self.category = category
        self.attributes = attributes
        self.counter = counter
        self.colors = colors
        self.types = types
        self.effect = effect
        self.trigger = trigger
        self.tapped = False
        self.id=uuid.uuid4()
        
        # Base stats
        self.base_cost = cost
        self.base_power = power

        # Current state stats
        self.current_cost = cost
        self.current_power = power
        self.attached_don = 0 

    def reset_end_of_turn(self):
        """Resets temporary buffs/debuffs at the end of the turn."""
        self.current_cost = self.base_cost
        self.current_power = self.base_power + (self.attached_don * 1000)
    
    def __str__(self):
        """Returns a detailed, multi-line view of the card."""
        colors = "/".join(self.colors) if isinstance(self.colors, list) else self.colors
        types = ", ".join(self.types) if isinstance(self.types, list) else self.types
        
        return (
            f"=== {self.name} ===\n"
            f"[{colors} {self.category}] - {types}\n"
            f"Stats: {self.current_power} Power | {self.current_cost} Cost | {self.counter} Counter\n"
            f"Attached DON!!: {self.attached_don}\n"
            f"Effect: {self.effect}\n"
            f"Trigger: {self.trigger if self.trigger else 'None'}\n"
            f"==================="
        )

def convert_card(liste_cards: list) -> tuple[Pile, Card]:
    shuffle(liste_cards)
    leader = None
    pile = Pile()
    for card_init in liste_cards:
        card = Card(
            card_init.get('card_name', 'Unknown'),
            card_init.get('img', ''),
            card_init.get('category_name', 'Unknown'),
            card_init.get('cost', 0),
            card_init.get('attributes', ''),
            card_init.get('power', 0),
            card_init.get('counter', 0),
            card_init.get('colors', []),
            card_init.get('types', []),       # <--- This was missing!
            card_init.get('effect', ''),
            card_init.get('trigger', '')
        )
        if card.category == "Leader":
            leader = card
        else:
            pile.add(card)
            
    return pile, leader

class Player:
    def __init__(self, name, deck):
        self.name = name
        self.deck, self.leader = convert_card(deck)
        
        # FIXED: Safely get base_cost just in case a deck was loaded without a leader
        self.life = self.leader.base_cost if self.leader else 0 
        self.hand = [self.deck.get() for _ in range(5)]
        
        # Board Zones
        self.character_area = []  # Max 5 CharacterCards
        self.stage_area = None    # Max 1 StageCard
        self.don_deck = ['DON!!' for _ in range(10)]
        self.active_don = []
        self.trash = []

    def draw_card(self):
        if not self.deck.is_empty():
            card = self.deck.get()
            self.hand.append(card)
            return True
        else:
            return False

    def __str__(self):
        """Returns a snapshot of the player's board and zones."""
        leader_name = self.leader.name if self.leader else "No Leader"
        return (
            f"Player: {self.name} | Leader: {leader_name} (Life: {self.life})\n"
            f"Hand: {len(self.hand)} | Deck: {len(self.deck)} | Trash: {len(self.trash)}\n"
            f"DON!!: {len(self.active_don)} Active / {len(self.don_deck)} in Deck\n"
            f"Characters on Board: {len(self.character_area)}/5"
        )


# Example Execution
