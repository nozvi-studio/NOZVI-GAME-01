/**
 * The level map plays its arrival animations (galaxy fade-ins, chapter title cards) only the first
 * time it opens in a session. After that the map shows at rest, which saves a lot of tween work on
 * weak phones. The textures stay loaded, so later visits load nothing either.
 */
let seen = false;

export function mapIntroSeen(): boolean {
  return seen;
}

export function markMapIntroSeen(): void {
  seen = true;
}

/** Tests only. */
export function resetMapIntroSeen(): void {
  seen = false;
}
