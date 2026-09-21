import json, base64

SRC = "coral-cove.html"
OUT = "/mnt/user-data/outputs/coral-cove-offline.html"
SEED_FILE = "seed2.json"
FAVICON = "winapp/favicon-256.png"

with open(SEED_FILE, "r", encoding="utf-8") as f:
    SEED = json.load(f)

seed_json = json.dumps(SEED, ensure_ascii=False)

with open(SRC, "r", encoding="utf-8") as f:
    content = f.read()

marker = '<script>\n(function(){'
assert marker in content, "script marker not found"
head_part, body_part = content.split('<div id="app">', 1)
body_part = '<div id="app">' + body_part

seed_script = '<script>\nvar SEED = ' + seed_json + ';\n</script>\n'
body_part = body_part.replace(marker, seed_script + marker, 1)

old_mem = 'var mem = { decks: [], cards: {}, stats: { streak:0, stars:0, lastReviewDateISO:null, totalReviews:0 }, settings: { pinHash:null, sessionActive:false, sessionStartedAt:null }, sessionTally: null, history: [], nextId: 1, deckListeners: [], cardListeners: {} };'
new_mem = 'var mem = { decks: SEED.decks.slice(), cards: JSON.parse(JSON.stringify(SEED.cards)), stats: Object.assign({streak:0, stars:0, lastReviewDateISO:null, totalReviews:0}, SEED.stats), settings: { pinHash:null, sessionActive:false, sessionStartedAt:null }, sessionTally: null, history: [], nextId: 1, deckListeners: [], cardListeners: {} };'
assert old_mem in body_part, "mem initializer not found"
body_part = body_part.replace(old_mem, new_mem, 1)

old_banner = '''var banner = S.store.live ? '' : '<div class="banner">🌟 Try-it-out mode — your decks won\\'t be saved after you close this page.</div>';'''
new_banner = '''var banner = S.store.live ? '' : '<div class="banner">🌟 Offline copy — starts with your current decks, but new progress here won\\'t save once you close this page.</div>';'''
assert old_banner in body_part, "banner line not found"
body_part = body_part.replace(old_banner, new_banner, 1)

favicon_tag = ""
try:
    with open(FAVICON, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    favicon_tag = '<link rel="icon" type="image/png" href="data:image/png;base64,' + b64 + '">\n'
except FileNotFoundError:
    pass

full = (
  '<!doctype html>\n'
  '<html lang="en">\n'
  '<head>\n'
  '<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + favicon_tag
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
print("decks:", len(SEED["decks"]), "card decks:", len(SEED["cards"]), "total cards:", sum(len(v) for v in SEED["cards"].values()))
