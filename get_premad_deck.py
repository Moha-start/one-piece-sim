import logOut as logOut
from questionary import Choice, select
from execute_sql import execute_query

original_print = print
print = logOut.PrettyPrint

def get_list_packs(flag="P"):
    command = "SELECT * FROM pack"
    if flag == "P":
        command += " WHERE label LIKE 'ST%'"
    command += " ORDER BY label;"
    return execute_query(command)

def choose_pack(data):
    packs = []
    for value in data:
        packs.append(Choice(title=f"{value['prefix']} - {value['title']} - {value['label']}", value=value['id']))

    pack_id = select(
        "What pack do you want to see?",
        choices=packs
    ).ask()
    return pack_id

def create_pack(pack_id):
    command = """SELECT 
            C.id AS card_id,
            C.name AS card_name,
            C.pack_id,
            C.img,
            C.cost,
            C.power,
            C.counter,
            C.block_number,
            C.effect,
            C.trigger,
            C.quantity,
            R.name AS rarity_name,
            CA.name AS category_name
        FROM cards C
        JOIN rarity R ON C.rarity = R.id
        JOIN category CA ON C.category = CA.id
        WHERE C.pack_id = %s;"""
        
    liste_cards = execute_query(command, (pack_id,))
    
    # 1. Filter out parallel/alternate arts to get unique base cards
    seen_base_ids = set()
    filtered_cards = []

    for card in liste_cards:
        base_id = card['card_id'].split('_')[0]
        if base_id in seen_base_ids:
            continue
        seen_base_ids.add(base_id)
        filtered_cards.append(card)

        # Fetch Attributes
        commande_attributes = """SELECT A.name
        FROM attributes_cards AC
        JOIN attributes A on A.id=AC.attributes_id
        WHERE card_id=%s;"""
        raw_results_attributes = execute_query(commande_attributes, (card['card_id'],))
        card['attributes'] = [row['name'] for row in raw_results_attributes] if raw_results_attributes else []

        # Fetch Colors
        commande_colors = """SELECT A.name
        FROM colors_cards AC
        JOIN colors A on A.id=AC.colors_id
        WHERE card_id=%s;"""
        raw_results_colors = execute_query(commande_colors, (card['card_id'],))
        card['colors'] = [row['name'] for row in raw_results_colors] if raw_results_colors else []

        # Fetch Types
        commande_types = """SELECT A.name
        FROM types_cards AC
        JOIN types A on A.id=AC.types_id
        WHERE card_id=%s;"""
        raw_results_types = execute_query(commande_types, (card['card_id'],))
        card['types'] = [row['name'] for row in raw_results_types] if raw_results_types else []

    # 2. Separate into Leaders and Main Deck
    leaders = [c for c in filtered_cards if c['category_name'] == 'Leader']
    main_cards = [c for c in filtered_cards if c['category_name'] != 'Leader']

    final_pack = []

    # Add exactly 1 Leader
    if leaders:
        final_pack.append(leaders[0])

    # 3. Force the Main Deck to be EXACTLY 50 cards
    main_deck = []
    
    # Pass 1: Add based on the specified quantity in the database
    for card in main_cards:
        qty = card.get('quantity')
        if not qty or qty < 1:
            qty = 2
            
        for _ in range(qty):
            if len(main_deck) < 50:
                main_deck.append(card)

    # Pass 2: If the DB is incomplete (e.g. ST-30 stops at 32), add round-robin until 50
    if main_cards: 
        while len(main_deck) < 50:
            for card in main_cards:
                if len(main_deck) < 50:
                    main_deck.append(card)
                else:
                    break

    final_pack.extend(main_deck)
    return final_pack

def get_id_by_name(name):
    command = "SELECT * FROM pack"
    command += " WHERE label LIKE %s"
    command += " ORDER BY label;"
    return execute_query(command,(name,))

def main(name=None):
    if name is None:
        data = get_list_packs()
        pack_id = choose_pack(data)
    else :
        pack_id=get_id_by_name(name)[0]['id']
    print(pack_id)
    pack = create_pack(pack_id)
    
    leaders_count = sum(1 for c in pack if c['category_name'] == 'Leader')
    main_deck_count = len(pack) - leaders_count
    
    print(f"Total cards in pack: {len(pack)} ({leaders_count} Leader + {main_deck_count} Main Deck)")
    #print(pack[:10])
    return pack

if __name__ == "__main__":
    main()