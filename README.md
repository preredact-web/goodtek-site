# GoodTek — Site MVP (Mini Cortex Orbs)

Final MVP of the GoodTek site with intricate Mini Cortex orbs wired up in the
nav, hero pill, and footer.

## Files

- `index.html` — the site
- `brain-sphere.jsx` — the cortex/BrainSphere renderer
- `privacy.html`, `terms.html` — legal pages

## Running

It's a static site. Serve with anything:

```
python3 -m http.server 8765
```

Then open <http://127.0.0.1:8765/>.

Loads React/ReactDOM/Babel from unpkg at runtime (no build step). `brain-sphere.jsx`
is fetched by Babel-standalone via XHR — so the page must be served over HTTP,
not opened directly via `file://`.

## Orb placements

| Where | Color | Display size |
|---|---|---|
| Nav `hi@goodtek.co` CTA | blue | 32px |
| Hero "Studio open" pill | green | 32px |
| Footer "GoodTek." period | blue | 22px |

## How the orbs preserve detail at small sizes

The BrainSphere component is rendered at its native 160px (where the 28 filaments
draw with full detail) and CSS-transform-scaled down to the display size. This
gives one high-quality GPU bilinear downsample, so filament intricacy survives
even at 22px display.

Two notable patches make this work:

1. **`BrainSphere` trusts its `size` prop directly** instead of measuring with
   `getBoundingClientRect`. Without this, a parent `transform: scale()` would
   shrink the bounding rect, BrainSphere would size its canvas to the
   post-transform pixels, and filaments would collapse.

2. **`tintColor` prop bakes color into the canvas** via
   `globalCompositeOperation = 'source-atop'`. CSS `filter: hue-rotate` and
   `mix-blend-mode` are unreliable on canvas in some browsers because the
   canvas can live on a separate compositor layer; in-canvas tinting always
   works.

Also worth noting: the original `.hero canvas { ... }` selector was matching
the orb canvas inside the hero pill (because of CSS descendant selection),
positioning it absolute at 640×420 and masking it. The fix scopes those
styles to `.hero #wave` only.
