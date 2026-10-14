# Dungeon Explorer

A turn-based dungeon game in the browser. Each floor is a new maze. Collect gold, fight monsters, and find the stairs.

**Play:** [https://adarkadosh.github.io/aicode-lab1/](https://adarkadosh.github.io/aicode-lab1/)

Press any key or tap to start. You die at 0 HP. Score is `gold + depth × 50 + kills × 10`. Your best score is saved in the browser.

## Controls

| Action | Keyboard | Phone |
| --- | --- | --- |
| Move | Arrows or WASD | Swipe or d-pad |
| Fireball (4 MP) | Space | FIRE |
| Wait | `.` | Centre button |
| Mute | M | — |
| Restart | R | Tap |

Touching a monster hurts you; the fireball (Space) is your only weapon. A fireball flies the way you last moved and stops at the first monster or wall. Mana comes back 1 per turn. Casting without enough mana does nothing.

## What you find

- **Gold, chests, and potions.** Potions heal up to 8 HP.
- **Three monsters.** Slimes move slowly. Skeletons appear from depth 2, demons from depth 3. They chase when they see you. Kills sometimes drop gold.
- **Stairs.** Going down heals 3 HP. Deeper floors have more monsters, tougher fights, and more gold.
- **Darkness.** You only see nearby tiles. Explored rooms stay dim on the map and the minimap.

Open `index.html` to run it locally.
