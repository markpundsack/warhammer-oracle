<!-- mcp-name: io.github.gregario/warhammer-oracle -->
<p align="center">
  <h1 align="center">Warhammer Oracle</h1>
  <p align="center">Warhammer 40K rules, unit stats, and game flow. An MCP server.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/warhammer-oracle"><img src="https://img.shields.io/npm/v/warhammer-oracle.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/warhammer-oracle"><img src="https://img.shields.io/npm/dm/warhammer-oracle.svg" alt="npm downloads"></a>
  <a href="https://github.com/gregario/warhammer-oracle/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT Licence"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible"></a>
  <a href="https://github.com/sponsors/gregario"><img src="https://img.shields.io/badge/sponsor-♥-ea4aaa.svg" alt="Sponsor"></a>
  <a href="https://glama.ai/mcp/servers/gregario/warhammer-oracle"><img src="https://glama.ai/mcp/servers/gregario/warhammer-oracle/badges/score.svg" alt="warhammer-oracle MCP server"></a>
</p>

---

Ask your AI assistant about datasheets, stratagems, detachments, enhancements, keywords, phase sequences, wound math, and more. Covers Warhammer 40,000 (10th and 11th Edition), Combat Patrol, Kill Team, and Horus Heresy (3rd edition).

[![warhammer-oracle MCP server](https://glama.ai/mcp/servers/gregario/warhammer-oracle/badges/card.svg)](https://glama.ai/mcp/servers/gregario/warhammer-oracle)

**Editions:** 40K unit/detachment/enhancement lookups default to **11th Edition**. Pass `game_mode: "40k_10e"` to any tool for 10th Edition data instead — 10th Edition support isn't going away. Turn sequences/phases, core keywords, and Core Stratagems are hand-curated from the 11th Edition Core Rules. Detachment-specific stratagems are hand-curated per faction, layered the same way the tabletop rules are layered: an 11th Edition Faction Pack detachment overrides the base Codex where the pack details it in full, and the unrevised Codex baseline applies everywhere else.

## Installation

```bash
npx warhammer-oracle
```

Or install globally:

```bash
npm install -g warhammer-oracle
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "warhammer-oracle": {
      "command": "npx",
      "args": ["-y", "warhammer-oracle"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add warhammer-oracle -- npx -y warhammer-oracle
```

### HTTP / Cloud Run

The default `warhammer-oracle-11e` binary uses stdio for local MCP clients. For remote hosting, the package also includes a Streamable HTTP entry point:

```bash
npm run build
npm run start:http
```

By default this listens on `0.0.0.0:8080` with the Streamable HTTP MCP endpoint at:

```text
http://localhost:8080/mcp
```

It also exposes the older HTTP+SSE transport for clients that have not moved to Streamable HTTP yet:

```text
http://localhost:8080/sse
```

Set `MCP_AUTH_TOKEN` to require a shared secret for MCP requests. Clients can send it as `Authorization: Bearer <token>`, or, for clients that only accept a server URL, append it as a query parameter:

```text
https://your-service-url.run.app/sse?token=<token>
```

Cloud Run sets the `PORT` environment variable automatically, and the Docker image runs the HTTP entry point:

```bash
printf '%s' '<token>' | gcloud secrets create warhammer-oracle-token --data-file=-

gcloud run deploy warhammer-oracle \
  --source . \
  --region us-central1 \
  --set-secrets MCP_AUTH_TOKEN=warhammer-oracle-token:latest \
  --allow-unauthenticated
```

Use the deployed `/mcp` URL with MCP clients that support Streamable HTTP, or `/sse?token=<token>` with older SSE clients. The root path and `/healthz` return a simple health response. For private deployments with clients that can send Google identity tokens, omit `--allow-unauthenticated` and configure Cloud Run IAM instead.

## Tools

### `lookup_unit`

Look up a unit datasheet by name. Returns stat profiles, unit size (model count) and composition (how many of each model, e.g. 1 Intercessor Sergeant + 4-9 Intercessors), ranged and melee weapons, wargear options (each model's default loadout and what it can swap to or add), abilities, and keywords.

```
"Look up the Intercessor Squad datasheet"
"What are the stats for a Leman Russ Battle Tank?"
```

**Parameters:** `unit_name` (required), `faction` (optional), `datasheet_id` (optional, exact ID shown for same-faction variants), `game_mode` (optional: `40k`/`40k_11e` (default, 11th Edition), `40k_10e`, `combat_patrol`, `kill_team`, `heresy`)

### `lookup_weapon`

Look up a weapon's stats by weapon name, ranged or melee. Collects the weapon from every datasheet that carries it, groups identical profiles, and leads with the standard (most common) profile: range, attacks, strength, AP, damage, and keywords. Datasheet-specific variants follow, each with the stats that differ. BS/WS belongs to the bearer, so it's noted separately rather than treated as part of the profile.

```
"What are the stats of a plasma gun?"
"What's the strength of a lascannon?"
```

Matching is on the weapon's own name, so "plasma gun" doesn't pull in "Twin plasma gun". If nothing matches exactly, the tool suggests close weapon names.

**Parameters:** `weapon_name` (required), `faction` (optional, only that faction's datasheets), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`, `combat_patrol`, `kill_team`, `heresy`)

### `lookup_keyword`

Look up a keyword or rule. Returns the official definition, a plain English explanation, examples, and which game modes it applies to.

```
"What does Devastating Wounds do?"
"Explain the Feel No Pain keyword"
```

**Parameters:** `keyword` (required), `game_mode` (optional; `heresy` looks up Horus Heresy rules instead — special rules, Reactions, Gambits, Statuses, phases, detachments, missions; see [Horus Heresy](#horus-heresy-3rd-edition))

### `lookup_phase`

Look up a game phase by name. Returns step-by-step instructions and tips.

```
"Walk me through the Shooting phase"
"How does the Firefight phase work in Kill Team?"
```

**Parameters:** `phase_name` (required), `game_mode` (optional, default: `40k`)

### `search_units`

Search units by name, faction, keywords, or ability text. Returns a compact list (max 10 results) with faction, points, and keywords.

```
"Find all Necron units under 100 points"
"Search for units with the Fly keyword"
"Show me units with Deep Strike"
```

**Parameters:** `query` (required), `faction` (optional), `ability` (optional), `max_points` (optional), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`, `combat_patrol`, `kill_team`, `heresy`)

### `compare_units`

Compare 2-4 units side by side. Shows full datasheets for each unit in a single response.

```
"Compare Intercessors vs Tactical Marines"
"Compare the Leman Russ, Predator, and Hammerhead side by side"
```

**Parameters:** `units` (required, array of 2-4 unit names), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`, `combat_patrol`, `kill_team`)

### `game_flow`

Show the full turn sequence for a game mode, or highlight where you are in the turn and what comes next.

```
"Show me the 40K turn sequence"
"I'm in the Shooting phase — what's next?"
"Show the Kill Team turn sequence"
```

**Parameters:** `current_phase` (optional), `game_mode` (optional, default: `40k`)

### `lookup_stratagem`

Look up a Warhammer 40,000 stratagem by name. Returns CP cost, phase timing, target, and effect.

```
"What does Fire Overwatch do?"
"Show me the Command Re-roll stratagem"
```

**Parameters:** `name` (required), `faction` (optional), `phase` (optional), `detachment` (optional)

### `search_stratagems`

Search stratagems by name, faction, phase, or detachment. Returns a compact list (max 10).

```
"What stratagems can I use in the Fight phase?"
"Show me Gladius Task Force stratagems"
```

**Parameters:** `query` (required), `faction` (optional), `phase` (optional), `detachment` (optional)

### `lookup_detachment`

Look up a detachment by name. Returns the detachment ability, available enhancements, and associated stratagems.

```
"Show me the Gladius Task Force detachment"
"What does the Warhost detachment do for Aeldari?"
```

**Parameters:** `name` (required), `faction` (optional), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`)

### `lookup_enhancement`

Look up a character enhancement by name. Returns points cost, detachment, and effect.

```
"What does Adept of the Codex do?"
"Show me Aeldari enhancements"
```

**Parameters:** `name` (required), `faction` (optional), `detachment` (optional), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`)

### `lookup_ploy`

Look up a Kill Team ploy by name. Returns type (strategic/tactical), CP cost, timing, and effect.

```
"What does the Bolster ploy do in Kill Team?"
"Show me Legionaries ploys"
```

**Parameters:** `name` (required), `faction` (optional), `type` (optional: `strategic`, `tactical`)

### `wound_calculator`

Calculate expected damage output for an attack profile against a target. Handles re-rolls, weapon keywords (Lethal Hits, Devastating Wounds, Sustained Hits, Torrent), invulnerable saves, and Feel No Pain.

```
"Calculate damage: 10 attacks, BS3+, S5 AP-1 D2 vs T4 Sv3+"
"How much damage does a lascannon do to a Leman Russ?"
```

**Parameters:** `attacks`, `hit_skill`, `strength`, `toughness`, `armour_save`, `damage` (all required); `armour_penetration`, `invulnerable_save`, `feel_no_pain`, `reroll_hits`, `reroll_wounds`, `weapon_keywords`, `wounds_per_model`, `game_mode` (all optional)

### `heresy_attack_calculator`

The Horus Heresy (3rd edition) counterpart: expected hits, wounds, saves and damage from Heresy's own tables — the Ranged Hit Test Table (BS, including the CX+ Critical Hit and Automatic entries and Snap Shots), the Melee Hit Table (WS vs WS) and the Wound Table (S vs T) — or Armour Penetration Tests (Glancing / Penetrating Hits) against a vehicle facing. AP denies an Armour Save when it is equal to or lower than the save; one best Saving Throw per wound; Cover only against shooting.

```
"10 bolter shots at Legionaries in the Heresy — how many die?"
"Power fist against a Cataphractii Terminator?"
```

**Parameters:** `attack_type` (`ranged`/`melee`), `attacks`, `strength`, `damage` (required); `ballistic_skill`, `snap_shots`, `weapon_skill`, `target_weapon_skill`, `toughness` or `target_armour`, `ap`, `armour_save`, `invulnerable_save`, `cover_save`, `damage_mitigation`, `wounds_per_model`, `special_rules` (optional). `special_rules` takes the weapon's rules as its profile lists them. Rending (X), Critical Hit (X) (and the table's CX+ / Automatic results), Breaching (X), Shred (X) and Armourbane are modelled exactly, die by die; any other rule is named as not modelled. Characteristic modifiers and re-rolls are not modelled.

### `determine_primary_mission`

Determine each player's Primary Mission from their Force Dispositions (11th Edition Matched Play). Each player's mission is looked up from their *opponent's* Force Disposition — in a non-mirror matchup, the two players get different missions. Returns mission names only, not full scoring/objective text.

```
"I picked Take and Hold, my opponent picked Purge the Foe — what are our missions?"
"What's my Primary Mission if I'm Reconnaissance and they're Priority Assets?"
```

**Parameters:** `your_disposition`, `opponent_disposition` (both required, one of: `Take and Hold`, `Purge the Foe`, `Reconnaissance`, `Priority Assets`, `Disruption`)

### `lookup_crusade`

Look up Crusade content (narrative play). Returns Crusade rules, relics, battle traits, and upgrades.

```
"What Crusade relics can Space Marines take?"
"Show me the Crusade battle traits"
```

**Parameters:** `query` (required), `faction` (optional)

## Horus Heresy (3rd edition)

Pass `game_mode: "heresy"` to `lookup_unit`, `lookup_weapon`, `search_units`, `compare_units`, `lookup_keyword`, `lookup_phase` or `game_flow` for Horus Heresy 3rd edition ("30K") data. Heresy responses start with `[Mode: Horus Heresy (3rd edition)]`, as 40K responses start with `[Mode: 40k 11e]`, use Heresy's own stat names, and never mix in 40K content.

**Which game?** People rarely say. With no `game_mode`, `lookup_unit`, `lookup_weapon` and `lookup_keyword` answer from 40K when 40K has a good match (exact, plural, or the start of the name), and otherwise from Horus Heresy when Heresy has one, with the Heresy stamp and one line: "Found in Horus Heresy, not 40K." A name in both games answers from 40K with a one-line pointer to `game_mode: "heresy"`. With an explicit `game_mode`, the other game is never substituted: a miss returns that game's not-found answer plus one line such as `Not in Warhammer 40,000; Horus Heresy has "Contemptor Dreadnought" (game_mode "heresy").`

```
"What's the Toughness of a Tactical Squad in Horus Heresy?"   → lookup_unit, game_mode heresy
"Show me Legion units with Deep Strike"                         → search_units, game_mode heresy
"What does Bulky (6) do in the Heresy?"                         → lookup_keyword, game_mode heresy
"How does Return Fire work?" / "What does Pinned do?"           → lookup_keyword, game_mode heresy
"What's in a Crusade Primary Detachment?"                      → lookup_keyword, game_mode heresy
"What happens in the Assault Phase?"                            → lookup_phase, game_mode heresy
"What's the Night Lords Rite of War?"                           → lookup_keyword, game_mode heresy
"What's the profile of a graviton gun?"                         → lookup_weapon (no game_mode: Heresy-only, so answered from Heresy)
```

- **`lookup_unit`**: the full Heresy stat line (Type, M, WS, BS, S, T, W, I, A, LD, CL, WP, IN, SAV, INV), or armour profiles for Vehicles, Knights, Titans and fortifications; unit composition and size; special rules with their values (`Bulky (6)`, `Line (2)`); ranged weapons (R, FP, RS, AP, D, special rules, traits); melee weapons; wargear options with points; base points; traits; and the armies that can field the unit. Melee weapons in Heresy modify the bearer's characteristics, so they are written that way: a power fist is "Initiative user -3, Attacks as user, Strength user +4".
- **`lookup_weapon`**: every profile of the weapon (a plasma gun's Maximal and Sustained), as R, FP, RS, AP, D, special rules and traits, or melee modifiers to the bearer.
- **`search_units`**: matches unit names, factions (a Legion such as `Ultramarines` also finds the generic Legion units it can field), special rules, traits and weapon names.
- **`lookup_keyword`**: any Heresy rule by name, with its full text:
  - special rules from BSData (`Bulky (6)`, `bulky` and `Bulky (X)` all find `Bulky (X)`);
  - from BSData profiles: Reactions and Gambits (including Legion and unit ones, with what grants them), psychic powers and psychic reactions, wargear, battlefield assets, and the detachments of the Crusade Force Organisation Chart with their slots;
  - from the core rulebook (via [Wahapedia](https://wahapedia.ru/heresy3/the-rules/core-rules/), since BSData has no core rules): the turn sequence and every sub-phase, Statuses (Pinned, Suppressed, Stunned, Routed), core and advanced Reactions, Reaction Allotments, challenges and the core Gambits, principles of combat (tests, saves, vehicles, flyers, transports, terrain, psychic powers and Perils of the Warp), army building and detachment types, and the core missions (deployment maps, objectives, mission special rules). Each answer links the Wahapedia section.
  - from each army list (Wahapedia faction pages): every Legion's Rite of War and Legion Tactica (`Night Lords Rite of War` and `Night Lords Legion Tactica` both work), Legion Advanced Reactions and extra detachments, armouries and wargear lists, Prime Advantages, Solar Auxilia Cohort Doctrines, and the Mechanicum, Militia, Knight, Titan, Custodes, Daemon and Cult army rules.
- **`lookup_phase` / `game_flow`**: the Heresy turn sequence (Start, Movement, Shooting, Assault, End) with each phase's sub-phases and the Core Reaction the Reactive Player may use in it, generated from the core rules data.
- Generic Legion units (Tactical Squad, Contemptor Dreadnought, Rhino, ...) are listed once, under **Legiones Astartes**, with every Legion that can field them. Legion catalogue names are cleaned up (`XIII - Ultramarines` → `Ultramarines`, XIII Legion). Units are named as in the data: the Legion Tactical Squad is `Tactical Squad`.
- **`heresy_attack_calculator`**: Heresy attack maths (see above).
- **`compare_units`**: 2–4 Heresy units with one stat table across every model, points and size, armour profiles for vehicles, and each unit's special rules and weapons.
- **Model names find their unit** in `lookup_unit` and `compare_units` when no unit is named that: "Legionaries" → the Tactical Squad (the unit fielding the most Legionaries), with a note listing the other units that field the model.
- **Army-dependent rules:** Rules and options that depend on army choices (a Rite of War, a particular Legion, an upgrade) are listed separately or left out. Points are base costs before options.

## Data

All data is embedded at build time — no network calls at runtime. Data is synced daily from BSData via GitHub Actions.

| Category | Count | Source |
|---|---|---|
| 40K unit datasheets (11th Edition, default) | 2,695 | [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) |
| 40K unit datasheets (10th Edition) | 2,666 | [BSData/wh40k-10e](https://github.com/BSData/wh40k-10e) |
| Kill Team operatives | 519 | [BSData/wh40k-killteam](https://github.com/BSData/wh40k-killteam) |
| Horus Heresy (3rd edition) units | 544 | [BSData/horus-heresy-3rd-edition](https://github.com/BSData/horus-heresy-3rd-edition) |
| Horus Heresy weapons / special rules | 741 / 221 | BSData (auto-extracted) |
| Horus Heresy Reactions, Gambits, powers, wargear, assets, detachments | 356 | BSData profiles (auto-extracted) |
| Horus Heresy core rules sections | 365 | [Wahapedia](https://wahapedia.ru/heresy3/the-rules/core-rules/) (`scripts/fetch-heresy-core-rules.ts`) |
| Horus Heresy army list rules (Rites of War, Doctrines, armouries, …) | 994 | Wahapedia faction pages (same script) |
| Detachments (11th / 10th Edition) | 259 / 208 | BSData (auto-extracted) |
| Enhancements (11th / 10th Edition) | 895 / 827 | BSData (auto-extracted) |
| Stratagems | 1,316 | Hand-curated (Core Rules + detachment-specific per faction) |
| Kill Team ploys | 14 | Hand-curated (universal + popular factions) |
| Shared rules (11th / 10th Edition) | 35 / 33 | BSData |
| Shared rules (Kill Team) | 22 | BSData |
| Curated keywords | 25 | Hand-written, plain English, 11th Edition Core Rules |
| Game mode sequences | 3 | Hand-curated (40K, Combat Patrol, Kill Team) |
| Force Disposition mission matchups | 15 | Hand-curated (5 dispositions, full grid) |

### Game modes

- **Warhammer 40,000** (`40k` / `40k_11e`, default) — full-scale battles, 11th Edition rules
- **Warhammer 40,000, 10th Edition** (`40k_10e`) — full-scale battles, 10th Edition rules (permanently supported)
- **Combat Patrol** (`combat_patrol`) — smaller, starter-friendly format
- **Kill Team** (`kill_team`) — squad-level skirmish game
- **Horus Heresy, 3rd edition** (`heresy`) — the 30K setting's own rules and datasheets (`lookup_unit`, `search_units`, `lookup_keyword`)

10th Edition support isn't going away when a newer edition is added — every `game_mode` value, once added, keeps working.

## Development

```bash
npm install
npm run build
npm test
```

To refresh unit data from BSData:

```bash
npm run fetch-data
npm run build
```

To refresh only the Horus Heresy data (optionally from a local clone of the BSData repo):

```bash
npm run fetch-data -- --only=heresy
npm run fetch-data -- --only=heresy --heresy-dir=/path/to/horus-heresy-3rd-edition
npx tsx scripts/fetch-heresy-core-rules.ts          # the Heresy core rules and army list rules, from Wahapedia
```

## License

MIT (for the MCP server code).

Unit data sourced from the [BSData](https://github.com/BSData) community project — [wh40k-10e](https://github.com/BSData/wh40k-10e), [wh40k-11e](https://github.com/BSData/wh40k-11e), [wh40k-killteam](https://github.com/BSData/wh40k-killteam), and [horus-heresy-3rd-edition](https://github.com/BSData/horus-heresy-3rd-edition). Game rules and army rules (including Horus Heresy) are the intellectual property of Games Workshop. This tool provides reference data for personal use during gameplay.
