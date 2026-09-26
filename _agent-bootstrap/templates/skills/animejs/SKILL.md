---
name: animejs
description: Use when implementing or reviewing UI motion with Anime.js in this React/Tauri app. Covers lifecycle-safe scopes, reduced motion, compositor-friendly animation, and keeping animation separate from domain state.
---

# Anime.js in React/Tauri

Before changing Anime.js usage, check the current official documentation.

## Rules

- Use React lifecycle-safe Anime.js scopes (`createScope`) rooted to the component where appropriate.
- Cleanup/revert animations when the component unmounts.
- Respect `prefers-reduced-motion` through Anime.js scope media queries or equivalent logic.
- Prefer `transform` and `opacity` for frequent motion.
- Do not animate layout properties continuously unless the interaction genuinely requires them.
- Animation state is presentation state. Domain values and graph geometry remain authoritative outside Anime.js.
- Do not animate every state change. Use motion for initial analysis reveal, editor collapse/expand, selection emphasis, and deliberate graph transitions.
- Dragging a graph point must remain responsive; do not fight pointer input with a competing animation.
- A hard semantic `drop`/`spike` may animate into view, but its final geometry must remain hard/steep.

## Sources

- User skill: https://github.com/wilfreud/skills-or-something/tree/main/animejs
- React usage: https://animejs.com/documentation/getting-started/using-with-react/
- Scopes: https://animejs.com/documentation/scope/
