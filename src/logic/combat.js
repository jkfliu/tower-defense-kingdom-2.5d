// Pure, framework-free combat/movement helpers for towers and roaming Defenders.
// No Phaser imports — everything here is unit-testable in isolation.

// Isometric range test, factored out of the turret targeting loop:
// an ellipse twice as wide (x) as it is tall (y), with horizontal semi-axis `range`.
export function inEllipse(dx, dy, range) {
  return Math.sqrt((dx / range) ** 2 + (dy / (range * 0.5)) ** 2) <= 1;
}

// Nearest living enemy inside the isometric perimeter, ranked by raw distance.
// `skipBlocked` excludes enemies already claimed by a Defender — used by Defender
// targeting (no gang-ups); towers leave it false so they still fire on blocked enemies.
export function nearestEnemyInRange(pos, enemies, range, { skipBlocked = false } = {}) {
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e.dying) continue;
    if (skipBlocked && e.blocked) continue;
    const dx = e.x - pos.x;
    const dy = e.y - pos.y;
    if (!inEllipse(dx, dy, range)) continue;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { best = e; bestDist = d; }
  }
  return best;
}

// A Defender picks the nearest unclaimed enemy in its Barracks perimeter.
export function pickDefenderTarget(pos, enemies, range) {
  return nearestEnemyInRange(pos, enemies, range, { skipBlocked: true });
}

// Move `pos` toward `target` by speed*dt. Snaps and reports `arrived` when the
// remaining distance is within a single step. `dx` carries the x-direction sign
// for sprite flipping.
export function stepToward(pos, target, speed, dt) {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = speed * dt;
  if (dist <= step || dist === 0) {
    return { x: target.x, y: target.y, arrived: true, dx };
  }
  return { x: pos.x + (dx / dist) * step, y: pos.y + (dy / dist) * step, arrived: false, dx };
}

// Closest point on the waypoint polyline to `pos`. Projects onto every segment with
// the parameter clamped to [0,1] (foot stays between two waypoints), returning the
// nearest foot plus which segment (`segIdx`) and how far along it (`t`).
export function closestPointOnPath(pos, waypoints) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const len2 = sx * sx + sy * sy;
    let t = len2 === 0 ? 0 : ((pos.x - a.x) * sx + (pos.y - a.y) * sy) / len2;
    t = Math.max(0, Math.min(1, t));
    const fx = a.x + t * sx;
    const fy = a.y + t * sy;
    const dx = pos.x - fx;
    const dy = pos.y - fy;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = { x: fx, y: fy, segIdx: i, t }; }
  }
  return best;
}

// Walk a signed arc-length along the polyline from a (segIdx, t) anchor. Positive
// distance heads toward later waypoints, negative toward earlier ones; clamps at the
// path ends.
export function pointAlongPath(waypoints, segIdx, t, signedDist) {
  const a = waypoints[segIdx];
  const b = waypoints[segIdx + 1];
  let x = a.x + t * (b.x - a.x);
  let y = a.y + t * (b.y - a.y);
  let remaining = signedDist;

  if (remaining >= 0) {
    // Forward: finish the current segment, then continue into later segments.
    let i = segIdx;
    while (remaining > 0 && i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      const dx = next.x - x;
      const dy = next.y - y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen <= remaining) {
        x = next.x; y = next.y;
        remaining -= segLen;
        i++;
      } else {
        x += (dx / segLen) * remaining;
        y += (dy / segLen) * remaining;
        remaining = 0;
      }
    }
  } else {
    // Backward: walk toward the start of the current segment, then earlier segments.
    remaining = -remaining;
    let i = segIdx;
    while (remaining > 0 && i >= 0) {
      const prev = waypoints[i];
      const dx = prev.x - x;
      const dy = prev.y - y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen <= remaining) {
        x = prev.x; y = prev.y;
        remaining -= segLen;
        i--;
      } else {
        x += (dx / segLen) * remaining;
        y += (dy / segLen) * remaining;
        remaining = 0;
      }
    }
  }
  return { x, y };
}

// Decrement a cooldown by delta, clamped at zero.
export function tickCooldown(current, delta) {
  return Math.max(0, current - delta);
}

// Apply melee damage to a target's hp (may go to zero or below).
export function resolveMelee(attackerDamage, targetHp) {
  return targetHp - attackerDamage;
}
