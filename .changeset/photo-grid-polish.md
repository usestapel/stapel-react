---
"@stapel/cdn-react": patch
---

The add tile is actually square, and the overlay chrome fits the tile.

Three things the first grid build got wrong on a 390px phone, where a cell is
about 120px: the gate's own wrapper stands between the cell and the picker and
did not pass the height through, so the add tile collapsed to a wide 28px
strip; the overlay controls were filled rectangles, which over a photograph
read as holes punched in it, and are circles on the raised surface now; and a
one-photo gallery drew two permanently dimmed move arrows over the only
picture on the composer's first screen. The arrows appear from two tiles up,
where there is an order to change — and there both are always drawn, the one
that cannot move dimmed rather than removed.
