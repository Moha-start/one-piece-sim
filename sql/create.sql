CREATE TABLE pack (
    id INT,
    prefix VARCHAR(50),
    title VARCHAR(50),
    label VARCHAR(10),
    CONSTRAINT PK_pack PRIMARY KEY (id)
);

CREATE TABLE rarity(
    id SMALLINT,
    name VARCHAR(20),
    CONSTRAINT PK_rarity PRIMARY KEY (id)
);

CREATE TABLE category(
    id SMALLINT,
    name VARCHAR(20),
    CONSTRAINT PK_categroy PRIMARY KEY (id)   
);

CREATE TABLE attributes(
    id SMALLINT,
    name VARCHAR(20),
    CONSTRAINT PK_attributes PRIMARY KEY (id)
);

CREATE TABLE colors(
    id SMALLINT,
    name VARCHAR(20),
    CONSTRAINT PK_colors PRIMARY KEY (id)
);

CREATE TABLE types(
    id SMALLINT,
    name VARCHAR(30),
    CONSTRAINT PK_types PRIMARY KEY (id)
);

CREATE TABLE cards(
    id VARCHAR(20),
    pack_id INT,
    name VARCHAR(100),
    rarity SMALLINT,
    category SMALLINT,
    img VARCHAR(20),
    cost SMALLINT,
    power INT,
    counter INT,
    block_number SMALLINT,
    effect TEXT,
    trigger TEXT,
    quantity SMALLINT,
    CONSTRAINT PK_cards PRIMARY KEY (id),
    CONSTRAINT FK_cards_rarity FOREIGN KEY (rarity) REFERENCES rarity(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT FK_cards_category FOREIGN KEY (category) REFERENCES category(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT FK_cards_pack FOREIGN KEY (pack_id) REFERENCES pack(id) ON UPDATE CASCADE ON DELETE CASCADE

);

CREATE TABLE attributes_cards(
    attributes_id SMALLINT,
    card_id VARCHAR(20),
    CONSTRAINT PK_attributes_cards PRIMARY KEY (attributes_id,card_id),
    CONSTRAINT FK_attributes_cards_cards FOREIGN KEY (card_id) REFERENCES cards(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT FK_attributes_cards_attributes FOREIGN KEY (attributes_id) REFERENCES attributes(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE colors_cards(
    colors_id SMALLINT,
    card_id VARCHAR(20),
    CONSTRAINT PK_colors_cards PRIMARY KEY (colors_id,card_id),
    CONSTRAINT FK_colors_cards_cards FOREIGN KEY (card_id) REFERENCES cards(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT FK_colors_cards_colors FOREIGN KEY (colors_id) REFERENCES colors(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE types_cards(
    types_id SMALLINT,
    card_id VARCHAR(20),
    CONSTRAINT PK_types_cards PRIMARY KEY (types_id,card_id),
    CONSTRAINT FK_types_cards_cards FOREIGN KEY (card_id) REFERENCES cards(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT FK_types_cards_types FOREIGN KEY (types_id) REFERENCES types(id) ON UPDATE CASCADE ON DELETE CASCADE
);
