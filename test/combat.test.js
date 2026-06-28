import { describe, it, expect } from 'vitest';
import {
  inEllipse,
  nearestEnemyInRange,
  pickDefenderTarget,
  stepToward,
  closestPointOnPath,
  pointAlongPath,
  pathProgress,
  tickCooldown,
  resolveMelee,
  arrowHits,
  nearestDefenderInRange,
  enemiesInRadius,
  applyHeal,
  clampToEllipse,
  nearestPath,
  arcPosition,
  defenderShouldDropTarget,
  withinMelee,
} from '../src/logic/combat.js';

describe('inEllipse', () => {
  // The turret range test: sqrt((dx/range)^2 + (dy/(range*0.5))^2) <= 1.
  // The ellipse is twice as wide (x) as it is tall (y).
  it('returns true at the center', () => {
    expect(inEllipse(0, 0, 100)).toBe(true);
  });

  it('treats the horizontal semi-axis as `range`', () => {
    expect(inEllipse(100, 0, 100)).toBe(true);   // exactly on the edge
    expect(inEllipse(101, 0, 100)).toBe(false);  // just outside
  });

  it('treats the vertical semi-axis as half of `range`', () => {
    expect(inEllipse(0, 50, 100)).toBe(true);    // exactly on the edge
    expect(inEllipse(0, 51, 100)).toBe(false);   // just outside
  });
});

describe('nearestEnemyInRange', () => {
  const pos = { x: 0, y: 0 };
  const range = 100;

  it('returns null when there are no enemies', () => {
    expect(nearestEnemyInRange(pos, [], range)).toBe(null);
  });

  it('returns null when every enemy is out of range', () => {
    const enemies = [{ id: 10, x: 500, y: 0, dying: false, blocked: false }];
    expect(nearestEnemyInRange(pos, enemies, range)).toBe(null);
  });

  it('picks the nearest in-range enemy', () => {
    const near = { id: 10, x: 40, y: 0, dying: false, blocked: false };
    const far  = { id: 11, x: 90, y: 0, dying: false, blocked: false };
    expect(nearestEnemyInRange(pos, [far, near], range)).toBe(near);
  });

  it('skips dying enemies', () => {
    const dying     = { id: 10, x: 30, y: 0, dying: true,  blocked: false };
    const available = { id: 11, x: 60, y: 0, dying: false, blocked: false };
    expect(nearestEnemyInRange(pos, [dying, available], range)).toBe(available);
  });

  it('still targets blocked enemies by default (towers fire on meleed foes)', () => {
    const blocked = { id: 10, x: 30, y: 0, dying: false, blocked: true, blockedBy: 2 };
    const free    = { id: 11, x: 60, y: 0, dying: false, blocked: false };
    expect(nearestEnemyInRange(pos, [blocked, free], range)).toBe(blocked);
  });

  it('skips blocked enemies when skipBlocked is set', () => {
    const blocked = { id: 10, x: 30, y: 0, dying: false, blocked: true, blockedBy: 2 };
    const free    = { id: 11, x: 60, y: 0, dying: false, blocked: false };
    expect(nearestEnemyInRange(pos, [blocked, free], range, { skipBlocked: true })).toBe(free);
  });
});

describe('pickDefenderTarget', () => {
  const pos = { x: 0, y: 0 };
  const range = 100;

  it('picks the nearest in-range enemy', () => {
    const near = { id: 10, x: 40, y: 0, dying: false, blocked: false };
    const far  = { id: 11, x: 90, y: 0, dying: false, blocked: false };
    expect(pickDefenderTarget(pos, [far, near], range)).toBe(near);
  });

  it('skips enemies already blocked by another defender', () => {
    const blocked   = { id: 10, x: 30, y: 0, dying: false, blocked: true, blockedBy: 2 };
    const available = { id: 11, x: 60, y: 0, dying: false, blocked: false };
    expect(pickDefenderTarget(pos, [blocked, available], range)).toBe(available);
  });

  it('two defenders reserving in turn pick different enemies (no gang-up)', () => {
    // Simulate the scene's reserve-on-select: after a pick, the caller marks the
    // enemy blocked, so the next defender must choose a different one.
    const a = { id: 10, x: 30, y: 0, dying: false, blocked: false };
    const b = { id: 11, x: 60, y: 0, dying: false, blocked: false };
    const enemies = [a, b];

    const first = pickDefenderTarget(pos, enemies, range);
    expect(first).toBe(a);                 // nearest
    first.blocked = true; first.blockedBy = 1;

    const second = pickDefenderTarget(pos, enemies, range);
    expect(second).toBe(b);                // must skip the reserved one
  });

  it('returns null when the only in-range enemy is already reserved', () => {
    const only = { id: 10, x: 30, y: 0, dying: false, blocked: true, blockedBy: 1 };
    expect(pickDefenderTarget(pos, [only], range)).toBe(null);
  });
});

describe('stepToward', () => {
  it('moves toward the target by speed*dt and reports the x-delta sign', () => {
    const r = stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, 1);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(0);
    expect(r.arrived).toBe(false);
    expect(r.dx).toBeGreaterThan(0);
  });

  it('reports a negative dx when moving left', () => {
    const r = stepToward({ x: 0, y: 0 }, { x: -100, y: 0 }, 50, 1);
    expect(r.dx).toBeLessThan(0);
  });

  it('snaps to the target and reports arrived when within one step', () => {
    const r = stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 1000, 1); // would overshoot
    expect(r.x).toBeCloseTo(3);
    expect(r.y).toBeCloseTo(4);
    expect(r.arrived).toBe(true);
  });
});

describe('closestPointOnPath', () => {
  // An L-shaped path: right along x, then down along y.
  const path = [
    { x: 0,   y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('projects onto the middle of the nearest segment', () => {
    const r = closestPointOnPath({ x: 50, y: -20 }, path);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(0);
    expect(r.segIdx).toBe(0);
    expect(r.t).toBeCloseTo(0.5);
  });

  it('clamps to a waypoint when the foot would fall past a segment end', () => {
    // Point is beyond the first waypoint going backwards.
    const r = closestPointOnPath({ x: -50, y: -50 }, path);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.segIdx).toBe(0);
    expect(r.t).toBeCloseTo(0);
  });

  it('picks the second segment when the point is nearest to it', () => {
    const r = closestPointOnPath({ x: 130, y: 50 }, path);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(50);
    expect(r.segIdx).toBe(1);
    expect(r.t).toBeCloseTo(0.5);
  });
});

describe('pointAlongPath', () => {
  const path = [
    { x: 0,   y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('walks forward along the current segment', () => {
    const r = pointAlongPath(path, 0, 0.5, 30); // start at (50,0), go +30 forward
    expect(r.x).toBeCloseTo(80);
    expect(r.y).toBeCloseTo(0);
  });

  it('walks backward along the current segment', () => {
    const r = pointAlongPath(path, 0, 0.5, -30); // start at (50,0), go -30 backward
    expect(r.x).toBeCloseTo(20);
    expect(r.y).toBeCloseTo(0);
  });

  it('spans across a waypoint into the next segment', () => {
    // Start at (80,0); forward 40 -> 20 to reach the corner, then 20 down segment 1.
    const r = pointAlongPath(path, 0, 0.8, 40);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(20);
  });

  it('clamps at the end of the path', () => {
    const r = pointAlongPath(path, 1, 0.5, 9999); // start at (100,50), way past the end
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(100);
  });

  it('clamps at the start of the path', () => {
    const r = pointAlongPath(path, 0, 0.5, -9999);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });
});

describe('pathProgress', () => {
  // An L-shaped path: right along x, then down along y.
  const path = [
    { x: 0,   y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('increases monotonically in the enemy travel direction (wp0 → end)', () => {
    const near  = pathProgress(path, { x: 20, y: 0 });   // early on segment 0
    const mid   = pathProgress(path, { x: 90, y: 0 });   // late on segment 0
    const later = pathProgress(path, { x: 100, y: 60 });  // into segment 1
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(later);
  });

  it('returns segIdx + t (0 at start, segCount at end)', () => {
    expect(pathProgress(path, { x: 0, y: 0 })).toBeCloseTo(0);
    expect(pathProgress(path, { x: 50, y: 0 })).toBeCloseTo(0.5);
    expect(pathProgress(path, { x: 100, y: 100 })).toBeCloseTo(2);
  });
});

describe('tickCooldown', () => {
  it('subtracts delta', () => {
    expect(tickCooldown(1000, 300)).toBe(700);
  });

  it('never goes below zero', () => {
    expect(tickCooldown(100, 300)).toBe(0);
  });
});

describe('resolveMelee', () => {
  it('subtracts damage from hp', () => {
    expect(resolveMelee(20, 100)).toBe(80);
  });

  it('can drop hp to zero or below', () => {
    expect(resolveMelee(120, 100)).toBe(-20);
  });
});

describe('arrowHits', () => {
  // A dodgeable arrow: it only connects if the target is still alive and within
  // the isometric hit ellipse (2:1) of where the arrow landed. Moved/dead whiffs.
  const landing = { x: 100, y: 100 };

  it('hits a living target within the hit ellipse', () => {
    expect(arrowHits(landing, { x: 110, y: 100, dying: false }, 18)).toBe(true);
  });

  it('whiffs when the target has moved out of the hit ellipse', () => {
    expect(arrowHits(landing, { x: 140, y: 100, dying: false }, 18)).toBe(false);
  });

  it('uses the 2:1 ellipse — vertical reach is half the radius', () => {
    // dy = 12 is outside the vertical semi-axis (18*0.5 = 9) → whiff,
    // even though it is well within 18 by straight-line distance.
    expect(arrowHits(landing, { x: 100, y: 112, dying: false }, 18)).toBe(false);
  });

  it('whiffs a dying target even if still in range', () => {
    expect(arrowHits(landing, { x: 100, y: 100, dying: true }, 18)).toBe(false);
  });

  it('whiffs when there is no target', () => {
    expect(arrowHits(landing, null, 18)).toBe(false);
  });
});

describe('nearestDefenderInRange', () => {
  // An archer scans for the closest living Defender within its isometric range
  // ellipse (2:1, same as towers/defenders). Claims don't matter — it fires at any.
  const pos = { x: 0, y: 0 };

  it('returns null when there are no defenders', () => {
    expect(nearestDefenderInRange(pos, [], 150)).toBe(null);
  });

  it('returns null when all defenders are out of range', () => {
    expect(nearestDefenderInRange(pos, [{ x: 200, y: 0, dying: false }], 150)).toBe(null);
  });

  it('picks the nearest in-range defender', () => {
    const near = { x: 40, y: 0, dying: false };
    const far  = { x: 120, y: 0, dying: false };
    expect(nearestDefenderInRange(pos, [far, near], 150)).toBe(near);
  });

  it('skips dying defenders', () => {
    const dying     = { x: 30, y: 0, dying: true };
    const available = { x: 90, y: 0, dying: false };
    expect(nearestDefenderInRange(pos, [dying, available], 150)).toBe(available);
  });

  it('uses the 2:1 ellipse — vertical reach is half the radius', () => {
    // y=120 is inside a 150px circle but OUTSIDE the ellipse (vertical
    // semi-axis 75 = range*0.5), so it must NOT count as in range.
    expect(nearestDefenderInRange(pos, [{ x: 0, y: 120, dying: false }], 150)).toBe(null);
    // y=70 is within the vertical semi-axis → in range.
    expect(nearestDefenderInRange(pos, [{ x: 0, y: 70, dying: false }], 150)).not.toBe(null);
  });
});

describe('enemiesInRadius', () => {
  // A Priest's heal pulse collects every living enemy whose center falls inside its
  // isometric heal ellipse (2:1, same convention as ranges). Used to pick who to mend.
  const origin = { x: 0, y: 0 };

  it('returns an empty array when nobody is in range', () => {
    expect(enemiesInRadius(origin, [{ x: 300, y: 0, dying: false }], 140)).toEqual([]);
  });

  it('collects all living enemies inside the ellipse', () => {
    const a = { x: 40, y: 0, dying: false };
    const b = { x: 0, y: 60, dying: false };
    const out = { x: 300, y: 0, dying: false };
    const result = enemiesInRadius(origin, [a, b, out], 140);
    expect(result).toContain(a);
    expect(result).toContain(b);
    expect(result).not.toContain(out);
  });

  it('skips dying enemies', () => {
    const dying = { x: 30, y: 0, dying: true };
    const alive = { x: 30, y: 0, dying: false };
    const result = enemiesInRadius(origin, [dying, alive], 140);
    expect(result).toContain(alive);
    expect(result).not.toContain(dying);
  });

  it('includes the origin enemy itself when present in the list (Priest heals self)', () => {
    const self = { x: 0, y: 0, dying: false };
    expect(enemiesInRadius(self, [self], 140)).toContain(self);
  });

  it('uses the 2:1 ellipse — vertical reach is half the radius', () => {
    // y=120 sits inside a 140px circle but outside the ellipse (vert semi-axis 70).
    expect(enemiesInRadius(origin, [{ x: 0, y: 120, dying: false }], 140)).toEqual([]);
    expect(enemiesInRadius(origin, [{ x: 0, y: 60, dying: false }], 140)).toHaveLength(1);
  });
});

describe('applyHeal', () => {
  it('adds the heal amount to current hp', () => {
    expect(applyHeal(50, 25, 100)).toBe(75);
  });

  it('never overheals past maxHp', () => {
    expect(applyHeal(90, 25, 100)).toBe(100);
  });

  it('is a no-op effect when already at full', () => {
    expect(applyHeal(100, 25, 100)).toBe(100);
  });
});

describe('clampToEllipse', () => {
  // Clamp a point to a tower's isometric range ellipse (2:1, semi-axes range / range*0.5)
  // centered at (cx, cy). Points inside are returned unchanged; points outside are
  // pulled onto the ellipse boundary. Used to keep a Barracks rally anchor in range.
  const cx = 100, cy = 100, range = 80;

  it('returns a point inside the ellipse unchanged', () => {
    const r = clampToEllipse(cx, cy, range, 120, 110);
    expect(r.x).toBeCloseTo(120);
    expect(r.y).toBeCloseTo(110);
  });

  it('returns the center unchanged', () => {
    const r = clampToEllipse(cx, cy, range, cx, cy);
    expect(r.x).toBeCloseTo(cx);
    expect(r.y).toBeCloseTo(cy);
  });

  it('pulls a point outside back onto the boundary', () => {
    // Far to the right — clamps to the horizontal semi-axis (cx + range).
    const r = clampToEllipse(cx, cy, range, cx + 500, cy);
    expect(r.x).toBeCloseTo(cx + range);
    expect(r.y).toBeCloseTo(cy);
  });

  it('respects the 2:1 ratio on the vertical axis', () => {
    // Far below — clamps to the vertical semi-axis (cy + range*0.5).
    const r = clampToEllipse(cx, cy, range, cx, cy + 500);
    expect(r.x).toBeCloseTo(cx);
    expect(r.y).toBeCloseTo(cy + range * 0.5);
  });

  it('a clamped point lies on (within range of) the ellipse perimeter', () => {
    const r = clampToEllipse(cx, cy, range, cx + 300, cy - 300);
    expect(inEllipse(r.x - cx, r.y - cy, range)).toBe(true);
    // and it should be essentially on the boundary, not deep inside
    const onEdge = Math.sqrt(((r.x - cx) / range) ** 2 + ((r.y - cy) / (range * 0.5)) ** 2);
    expect(onEdge).toBeCloseTo(1, 5);
  });
});

describe('nearestPath', () => {
  // Picks which of several paths a point is closest to (by closest point on each
  // polyline). Used to orient a Barracks rally to the right route on multi-path levels.
  const pathA = [{ x: 0, y: 0 }, { x: 100, y: 0 }];      // horizontal along y=0
  const pathB = [{ x: 0, y: 200 }, { x: 100, y: 200 }];  // horizontal along y=200

  it('returns null when there are no paths', () => {
    expect(nearestPath({ x: 0, y: 0 }, [])).toBe(null);
  });

  it('picks the closer path and reports its index', () => {
    const r = nearestPath({ x: 50, y: 10 }, [pathA, pathB]);
    expect(r.pathIdx).toBe(0);
  });

  it('picks the second path when the point is nearer it', () => {
    const r = nearestPath({ x: 50, y: 190 }, [pathA, pathB]);
    expect(r.pathIdx).toBe(1);
  });

  it('returns the closest point on the chosen path', () => {
    const r = nearestPath({ x: 50, y: 10 }, [pathA, pathB]);
    expect(r.point.x).toBeCloseTo(50);
    expect(r.point.y).toBeCloseTo(0);
    expect(r.point.segIdx).toBe(0);
  });

  it('with a single path always returns index 0', () => {
    const r = nearestPath({ x: 50, y: 999 }, [pathA]);
    expect(r.pathIdx).toBe(0);
  });
});

describe('arcPosition', () => {
  // Parabolic lob: linear interpolation start→end plus an upward (negative-y) arc
  // peaking at t=0.5. Shared by tower arrows, enemy arrows, and bombs.
  const start = { x: 0, y: 0 };
  const end   = { x: 100, y: 0 };

  it('is at the start at t=0', () => {
    const p = arcPosition(start, end, 40, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('is at the end at t=1', () => {
    const p = arcPosition(start, end, 40, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('interpolates x linearly', () => {
    expect(arcPosition(start, end, 40, 0.25).x).toBeCloseTo(25);
    expect(arcPosition(start, end, 40, 0.75).x).toBeCloseTo(75);
  });

  it('peaks (max height) at t=0.5 with y = -arcHeight', () => {
    const p = arcPosition(start, end, 40, 0.5);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(-40);   // 4*0.5*(1-0.5)=1 → -arcHeight
  });

  it('adds the arc on top of the y interpolation for sloped shots', () => {
    const sloped = arcPosition({ x: 0, y: 0 }, { x: 0, y: 100 }, 20, 0.5);
    // linear y = 50, arc = -20 → 30
    expect(sloped.y).toBeCloseTo(30);
  });
});

describe('defenderShouldDropTarget', () => {
  // A defender drops its target when it has none, the target died, or the target
  // left the tower's range ellipse (centered on the tower, 2:1).
  const tower = { cx: 0, cy: 0, range: 100 };

  it('drops when there is no target', () => {
    expect(defenderShouldDropTarget(null, tower)).toBe(true);
  });

  it('drops a dying target', () => {
    expect(defenderShouldDropTarget({ x: 10, y: 0, dying: true }, tower)).toBe(true);
  });

  it('keeps a live target inside range', () => {
    expect(defenderShouldDropTarget({ x: 50, y: 0, dying: false }, tower)).toBe(false);
  });

  it('drops a target that wandered out of the range ellipse', () => {
    expect(defenderShouldDropTarget({ x: 150, y: 0, dying: false }, tower)).toBe(true);
  });
});

describe('withinMelee', () => {
  it('true when within the melee range', () => {
    expect(withinMelee({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);   // dist 5
  });

  it('false when beyond the melee range', () => {
    expect(withinMelee({ x: 0, y: 0 }, { x: 3, y: 4 }, 4)).toBe(false);  // dist 5 > 4
  });
});
