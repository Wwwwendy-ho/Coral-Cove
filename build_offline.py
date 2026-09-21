import json, re

SRC = "coral-cove.html"
OUT = "/mnt/user-data/outputs/coral-cove-offline.html"

# ---- deck metadata (id -> name, emoji, order, createdAt) ----
decks_meta = [
    ("sight-words", "Splash Sight Words", "🌊", 0, 1757894400000),
    ("math-facts", "Reef Math Facts", "🐠", 1, 1757894400000),
    ("zoo-trip", "The Zoo Trip", "🐢", 2, 1757894400000),
    ("birthday-party", "The Birthday Party", "🐬", 3, 1757894400000),
    ("beach-day", "Day at the Beach", "🐳", 4, 1757894400000),
    ("baking-cookies", "Baking Cookies", "🦀", 5, 1757894400000),
    ("library-visit", "Visiting the Library", "🦈", 6, 1757894400000),
    ("planting-garden", "Planting a Garden", "🦞", 7, 1757894400000),
    ("snow-day", "Snow Day", "🐙", 8, 1757894400000),
    ("aquarium-trip", "Trip to the Aquarium", "🐚", 9, 1757894400000),
    ("soccer-practice", "Soccer Practice", "🦑", 10, 1757894400000),
    ("camping-trip", "Camping Trip", "⭐", 11, 1757894400000),
    ("math-0", "0 + ___", "🐢", 12, 1757894400000),
    ("math-1", "1 + ___", "🐬", 13, 1757894400000),
    ("math-2", "2 + ___", "🐳", 14, 1757894400000),
    ("math-3", "3 + ___", "🦀", 15, 1757894400000),
    ("math-4", "4 + ___", "🐠", 16, 1757894400000),
    ("math-5", "5 + ___", "🦈", 17, 1757894400000),
    ("math-6", "6 + ___", "🦞", 18, 1757894400000),
    ("math-7", "7 + ___", "🐙", 19, 1757894400000),
    ("math-8", "8 + ___", "🌊", 20, 1757894400000),
    ("math-9", "9 + ___", "🐚", 21, 1757894400000),
]

decks = [{"id": did, "name": name, "emoji": emoji, "order": order, "createdAt": created}
          for did, name, emoji, order, created in decks_meta]

# ---- cards per deck, exactly as currently stored live ----
cards = {}

cards["sight-words"] = [
    {"id":"because","front":"because","back":"I splashed in the tide pool because it was hot.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400000},
    {"id":"friend","front":"friend","back":"The dolphin is my friend.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400001},
    {"id":"water","front":"water","back":"Fish live in the water.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400002},
    {"id":"under","front":"under","back":"The crab hides under the rock.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400003},
    {"id":"through","front":"through","back":"We swam through the reef.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400004},
    {"id":"always","front":"always","back":"Sea turtles always return to the same beach.","note":"","due":1789580774866,"interval":1,"ease":2.5,"reps":1,"lapses":0,"createdAt":1757894400005},
    {"id":"together","front":"together","back":"The fish swim together in a school.","note":"","due":1789580779169,"interval":1,"ease":2.5,"reps":1,"lapses":0,"createdAt":1757894400006},
    {"id":"once","front":"once","back":"Once upon a time, there was a whale.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400007},
    {"id":"before","front":"before","back":"Look both ways before you dive.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400008},
    {"id":"laugh","front":"laugh","back":"The otter made us laugh.","note":"","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400009},
]

cards["math-facts"] = [
    {"id":"add-2-3","front":"2 + 3","back":"5","note":"2 starfish + 3 starfish = 5 starfish!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400010},
    {"id":"add-4-4","front":"4 + 4","back":"8","note":"4 clams + 4 clams = 8 clams!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400011},
    {"id":"add-6-2","front":"6 + 2","back":"8","note":"6 crabs + 2 crabs = 8 crabs!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400012},
    {"id":"add-7-5","front":"7 + 5","back":"12","note":"7 fish + 5 fish = 12 fish!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400013},
    {"id":"add-9-3","front":"9 + 3","back":"12","note":"9 seahorses + 3 seahorses = 12 seahorses!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400014},
    {"id":"add-8-6","front":"8 + 6","back":"14","note":"8 jellyfish + 6 jellyfish = 14 jellyfish!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400015},
    {"id":"add-5-5","front":"5 + 5","back":"10","note":"5 shells + 5 shells = 10 shells!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400016},
    {"id":"add-10-7","front":"10 + 7","back":"17","note":"10 urchins + 7 urchins = 17 urchins!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400017},
    {"id":"add-9-9","front":"9 + 9","back":"18","note":"9 eels + 9 eels = 18 eels!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400018},
    {"id":"add-6-6","front":"6 + 6","back":"12","note":"6 otters + 6 otters = 12 otters!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400019},
    {"id":"add-3-8","front":"3 + 8","back":"11","note":"3 turtles + 8 turtles = 11 turtles!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400020},
    {"id":"add-7-7","front":"7 + 7","back":"14","note":"7 dolphins + 7 dolphins = 14 dolphins!","due":1757894400000,"interval":0,"ease":2.5,"reps":0,"lapses":0,"createdAt":1757894400021},
]

reading_cards = {
    "zoo-trip": [
        ("Where is Alison going?", "The zoo", "Alison is going to the zoo with her mom."),
        ("Who is she going with?", "Her mom", "Alison is going to the zoo with her mom."),
        ("What are the zookeepers feeding the seals?", "Fish", "A zookeeper walks by carrying a bucket of fish for the seals."),
        ("What does Alison get from the gift shop?", "A stuffed elephant", "Alison picks out a stuffed elephant from the gift shop."),
    ],
    "birthday-party": [
        ("Whose birthday party is it?", "Molly's", "It is her best friend Molly's party."),
        ("Who does Alison go with?", "Her little brother", "Alison is going to a birthday party with her little brother."),
        ("What does the clown make?", "A balloon dog", "He twists a long balloon into a fluffy dog for her."),
        ("What kind of cake do they eat?", "Chocolate", "Everyone sings happy birthday and eats chocolate cake."),
    ],
    "beach-day": [
        ("Where is Amalia going?", "The beach", "Amalia is going to the beach with her grandma."),
        ("Who does she go with?", "Her grandma", "Amalia is going to the beach with her grandma."),
        ("What does Amalia love to build?", "Sandcastles", "They dig and pile wet sand until they build a tall castle with a moat."),
        ("What do they watch before leaving?", "The sunset", "They watch the sun start to set over the water."),
    ],
    "baking-cookies": [
        ("What is Amalia baking?", "Cookies", "They decided to make chocolate chip cookies from scratch."),
        ("Who is she baking with?", "Her aunt", "Amalia is baking cookies with her aunt."),
        ("What tips over on the counter?", "Chocolate chips", "The bag of chocolate chips tips over onto the counter."),
        ("What is Amalia's favorite part?", "Licking the spoon", "Her favorite part is licking the spoon."),
    ],
    "library-visit": [
        ("Where is Molly going?", "The library", "Molly is going to the library with her dad."),
        ("Who does she go with?", "Her dad", "Molly is going to the library with her dad."),
        ("What is the library having today?", "A puppet show", "The library is having a puppet show today."),
        ("How many more books does Molly pick besides the dragon book?", "Three", "Molly picks three more books to read that week."),
    ],
    "planting-garden": [
        ("What is Molly planting?", "A garden", "Molly is planting a garden with her mom."),
        ("Who helps her plant?", "Her mom", "Molly is planting a garden with her mom."),
        ("What crawls out of the dirt?", "A worm", "A fat earthworm wiggles out of the dirt."),
        ("What is Molly's favorite part of gardening?", "Watering the plants", "Her favorite part is watering the plants with the hose."),
    ],
    "snow-day": [
        ("What covers the yard?", "Snow", "It snowed all night and their whole yard is covered in white."),
        ("Who does Wendy play with?", "Her brother", "Wendy is playing outside with her brother."),
        ("What bird lands on a branch?", "A cardinal", "A bright red cardinal lands on a snowy branch nearby."),
        ("What do they use for the snowman's nose?", "A carrot", "They finish him off with a carrot nose and two button eyes."),
    ],
    "aquarium-trip": [
        ("Where is Wendy's class going?", "The aquarium", "Wendy is going to the aquarium with her class."),
        ("Why are they going there?", "A field trip", "It is a school field trip."),
        ("What does Wendy get to hold?", "A starfish", "A guide lets the class hold a starfish."),
        ("What do they watch swim by at the end?", "Sharks", "The whole class watches the sharks swim by the big glass window."),
    ],
    "soccer-practice": [
        ("Where is Alan going?", "Soccer practice", "Alan is going to soccer practice with his dad."),
        ("Who takes him?", "His dad", "Alan is going to soccer practice with his dad."),
        ("What color are the new jerseys?", "Blue", "The team just got new blue jerseys."),
        ("What does the coach set up?", "An obstacle course of cones", "The coach sets up an obstacle course of orange cones."),
    ],
    "camping-trip": [
        ("Where does Alan's family camp?", "A lake", "They are staying by a big lake."),
        ("Who does Alan go camping with?", "His family", "Alan is going camping with his family."),
        ("What animal peeks out from behind a log?", "A raccoon", "A raccoon peeks out from behind a log looking for food."),
        ("What does Alan's favorite part involve?", "Roasting marshmallows", "His favorite part is roasting marshmallows by the fire."),
    ],
}
for deck_id, qs in reading_cards.items():
    arr = []
    for i, (front, back, note) in enumerate(qs, start=1):
        arr.append({"id": f"q{i}", "front": front, "back": back, "note": note,
                     "due": 1757894400000, "interval": 0, "ease": 2.5, "reps": 0, "lapses": 0,
                     "createdAt": 1757894400000})
    cards[deck_id] = arr

for n in range(10):
    deck_id = f"math-{n}"
    arr = []
    for k in range(10):
        arr.append({"id": f"d{k}", "front": f"{n} + {k}", "back": str(n+k), "note": "",
                     "due": 1757894400000, "interval": 0, "ease": 2.5, "reps": 0, "lapses": 0,
                     "createdAt": 1757894400000})
    cards[deck_id] = arr

stats = {"streak": 0, "stars": 0, "lastReviewDateISO": None, "totalReviews": 0}

SEED = {"decks": decks, "cards": cards, "stats": stats}
seed_json = json.dumps(SEED, ensure_ascii=False)

with open(SRC, "r", encoding="utf-8") as f:
    content = f.read()

marker = '<script>\n(function(){'
assert marker in content, "script marker not found"
head_part, body_part = content.split('<div id="app">', 1)
body_part = '<div id="app">' + body_part

seed_script = '<script>\nvar SEED = ' + seed_json + ';\n</script>\n'
body_part = body_part.replace(marker, seed_script + marker, 1)

old_mem = 'var mem = { decks: [], cards: {}, stats: { streak:0, stars:0, lastReviewDateISO:null, totalReviews:0 }, settings: { pinHash:null, sessionActive:false, sessionStartedAt:null }, sessionTally: null, nextId: 1, deckListeners: [], cardListeners: {} };'
new_mem = 'var mem = { decks: SEED.decks.slice(), cards: JSON.parse(JSON.stringify(SEED.cards)), stats: Object.assign({streak:0, stars:0, lastReviewDateISO:null, totalReviews:0}, SEED.stats), settings: { pinHash:null, sessionActive:false, sessionStartedAt:null }, sessionTally: null, nextId: 1, deckListeners: [], cardListeners: {} };'
assert old_mem in body_part, "mem initializer not found"
body_part = body_part.replace(old_mem, new_mem, 1)

# tweak the offline banner text slightly for clarity in this exported context
old_banner = '''var banner = S.store.live ? '' : '<div class="banner">🌟 Try-it-out mode — your decks won\\'t be saved after you close this page.</div>';'''
new_banner = '''var banner = S.store.live ? '' : '<div class="banner">🌟 Offline copy — starts with your current decks, but new progress here won\\'t save once you close this page.</div>';'''
assert old_banner in body_part, "banner line not found"
body_part = body_part.replace(old_banner, new_banner, 1)

full = (
  '<!doctype html>\n'
  '<html lang="en">\n'
  '<head>\n'
  '<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + head_part +
  '</head>\n'
  '<body>\n'
  + body_part +
  '\n</body>\n'
  '</html>\n'
)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(full)

print("wrote", OUT, len(full), "bytes")
print("decks:", len(decks), "card decks:", len(cards), "total cards:", sum(len(v) for v in cards.values()))
