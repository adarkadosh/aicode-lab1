# Dungeon Explorer

A turn-based roguelike in a single HTML page. Every floor is a new labyrinth: grab the gold, outlast the dark, and find the stairs.

**Play it:** [https://adarkadosh.github.io/aicode-lab1/](https://adarkadosh.github.io/aicode-lab1/)

## How to play

Press any key or tap the screen to descend. You die when your HP hits zero. Score is `gold + depth × 50 + kills × 10`, and the best score is saved in the browser.

| Action | Keyboard | Phone |
| --- | --- | --- |
| Move / attack | Arrow keys or WASD | Swipe, or the d-pad |
| Cast fireball (4 MP) | Space | FIRE button |
| Wait a turn | `.` | Centre d-pad button |
| Mute sound | M | — |
| Restart after death | R | Tap the screen |

Walking into an enemy attacks it. Walking into a wall does nothing and does not spend a turn. Fireballs fly in the direction you last faced and stop at the first enemy or wall. Casting with too little mana fizzles and does not spend a turn. Mana regenerates by 1 each turn.

## Features

- **Procedural floors.** Rooms are carved, then joined with a minimum spanning tree of corridors plus a few extra loops, so every room is reachable and the map still has choices. Stairs are placed in the room farthest from the start.
- **Depth that gets meaner.** Deeper floors spawn more enemies, tougher skeletons and demons, richer gold, and stronger fireballs. Descending heals 3 HP.
- **Three monsters.** Slimes move every other turn. Skeletons show up from depth 2. Demons start stirring at depth 3. They chase when they can see you and wander otherwise. Killing one sometimes drops gold.
- **Loot.** Gold piles, chests, and health potions sit in the rooms. Potions heal up to 8 HP.
- **Torchlight and memory.** Recursive shadowcasting hides unexplored tiles. Explored rooms stay on the map, dimmed. The torch flickers, fireballs light the corridor, and a minimap tracks what you have seen.
- **Juice.** Pixel rendering, screen shake, particles, floating damage numbers, and Web Audio sound effects.
- **Desktop and phone.** The HUD, camera, and controls adapt to screen size and touch. Overlays fade when they cover the player.

## Run it locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

The dungeon generator (`generate`, `verify`, `bfs`) is plain JavaScript and also exports for Node, so floors can be built and checked outside the browser.
