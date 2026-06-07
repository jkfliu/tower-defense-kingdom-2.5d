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
