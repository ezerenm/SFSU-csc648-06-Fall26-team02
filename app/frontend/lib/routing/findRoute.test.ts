import { describe, expect, it } from 'vitest';
import { findRoute } from './findRoute';
import type { RoutableSegment } from './types';

// Sample graph from the professor Q&A / viewer sample data.
//   S1 N1 Entrance – N2 Corner      8 m
//   S2 N2 Corner   – N3 Room 103    6 m  (robot restricted)
//   S3 N2 Corner   – N4 Side hall   5 m
//   S4 N4 Side hall – N3 Room 103   7 m
//   S5 N4 Side hall – N5 Lobby      4 m
//   S6 N5 Lobby    – N3 Room 103    5 m
const NODES = ['N1', 'N2', 'N3', 'N4', 'N5'];

function seg(
  id: string,
  a: string,
  b: string,
  d: number,
  extra: Partial<RoutableSegment> = {},
): RoutableSegment {
  return {
    segment_id: id,
    start_node_id: a,
    end_node_id: b,
    direction: 'bidirectional',
    distance_m: d,
    availability: 'open',
    robot_access: 'allowed',
    ...extra,
  };
}

function baseGraph(): RoutableSegment[] {
  return [
    seg('S1', 'N1', 'N2', 8),
    seg('S2', 'N2', 'N3', 6, { robot_access: 'restricted' }),
    seg('S3', 'N2', 'N4', 5),
    seg('S4', 'N4', 'N3', 7),
    seg('S5', 'N4', 'N5', 4),
    seg('S6', 'N5', 'N3', 5),
  ];
}

function close(segments: RoutableSegment[], id: string): RoutableSegment[] {
  return segments.map((s) => (s.segment_id === id ? { ...s, availability: 'closed' as const } : s));
}

describe('findRoute – professor example (hand-calculated)', () => {
  it('human N1 → N3 takes the direct corridor: 14 m', () => {
    const r = findRoute(NODES, baseGraph(), 'N1', 'N3', 'human');
    expect(r.status).toBe('valid');
    expect(r.node_ids).toEqual(['N1', 'N2', 'N3']);
    expect(r.steps.map((s) => s.segment_id)).toEqual(['S1', 'S2']);
    expect(r.total_distance_m).toBe(14);
  });

  it('robot N1 → N3 avoids the restricted segment: 20 m', () => {
    const r = findRoute(NODES, baseGraph(), 'N1', 'N3', 'robot');
    expect(r.status).toBe('valid');
    expect(r.node_ids).toEqual(['N1', 'N2', 'N4', 'N3']);
    expect(r.total_distance_m).toBe(20);
  });
});

describe('findRoute – closures and rerouting (R8/R9)', () => {
  it('human reroutes when the direct corridor closes', () => {
    const r = findRoute(NODES, close(baseGraph(), 'S2'), 'N1', 'N3', 'human');
    expect(r.node_ids).toEqual(['N1', 'N2', 'N4', 'N3']);
    expect(r.total_distance_m).toBe(20);
  });

  it('robot takes the lobby detour when S4 closes', () => {
    const r = findRoute(NODES, close(baseGraph(), 'S4'), 'N1', 'N3', 'robot');
    expect(r.node_ids).toEqual(['N1', 'N2', 'N4', 'N5', 'N3']);
    expect(r.total_distance_m).toBe(22);
  });

  it('robot is unreachable when N2–N4 closes, human is unaffected', () => {
    const graph = close(baseGraph(), 'S3');
    const robot = findRoute(NODES, graph, 'N1', 'N3', 'robot');
    expect(robot.status).toBe('unreachable');
    expect(robot.steps).toEqual([]);
    expect(robot.total_distance_m).toBeNull();
    expect(robot.reason).toMatch(/robot-allowed/);

    const human = findRoute(NODES, graph, 'N1', 'N3', 'human');
    expect(human.total_distance_m).toBe(14);
  });

  it('does not mutate the input segments', () => {
    const graph = baseGraph();
    const snapshot = JSON.stringify(graph);
    findRoute(NODES, graph, 'N1', 'N3', 'robot');
    expect(JSON.stringify(graph)).toBe(snapshot);
  });
});

describe('findRoute – edge cases', () => {
  it('start = destination is a valid 0 m route', () => {
    const r = findRoute(NODES, baseGraph(), 'N3', 'N3', 'human');
    expect(r).toMatchObject({ status: 'valid', steps: [], node_ids: ['N3'], total_distance_m: 0 });
  });

  it('respects one-way (start_to_end) segments', () => {
    const graph = [seg('A', 'N1', 'N2', 3, { direction: 'start_to_end' })];
    expect(findRoute(['N1', 'N2'], graph, 'N1', 'N2', 'human').total_distance_m).toBe(3);
    expect(findRoute(['N1', 'N2'], graph, 'N2', 'N1', 'human').status).toBe('unreachable');
  });

  it('walks a bidirectional segment backwards and reports direction', () => {
    const r = findRoute(NODES, baseGraph(), 'N3', 'N1', 'human');
    expect(r.node_ids).toEqual(['N3', 'N2', 'N1']);
    expect(r.steps[0]).toEqual({ segment_id: 'S2', from_node_id: 'N3', to_node_id: 'N2' });
  });

  it('isolated node is unreachable', () => {
    const r = findRoute([...NODES, 'N9'], baseGraph(), 'N1', 'N9', 'human');
    expect(r.status).toBe('unreachable');
  });

  it('rejects unknown nodes and bad distances', () => {
    expect(findRoute(NODES, baseGraph(), 'NX', 'N3', 'human').status).toBe('invalid_input');
    expect(findRoute(NODES, baseGraph(), 'N1', 'NX', 'human').status).toBe('invalid_input');
    const neg = [...baseGraph(), seg('BAD', 'N1', 'N5', -1)];
    expect(findRoute(NODES, neg, 'N1', 'N3', 'human').status).toBe('invalid_input');
    const dangling = [...baseGraph(), seg('DANG', 'N1', 'N99', 2)];
    expect(findRoute(NODES, dangling, 'N1', 'N3', 'human').status).toBe('invalid_input');
  });

  it('is deterministic on equal-length ties', () => {
    // Two 10 m options; first-listed segment should win every time.
    const graph = [seg('A1', 'N1', 'N2', 5), seg('A2', 'N2', 'N3', 5), seg('B1', 'N1', 'N4', 5), seg('B2', 'N4', 'N3', 5)];
    const nodes = ['N1', 'N2', 'N3', 'N4'];
    const first = findRoute(nodes, graph, 'N1', 'N3', 'human');
    for (let i = 0; i < 20; i++) {
      expect(findRoute(nodes, graph, 'N1', 'N3', 'human').node_ids).toEqual(first.node_ids);
    }
    expect(first.total_distance_m).toBe(10);
  });
});

// Cross-check against an independent brute-force answer (Floyd–Warshall)
// on random graphs, so we trust the result beyond the hand-picked cases.
describe('findRoute – matches brute force on random graphs', () => {
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  function floydDistance(nodes: string[], segs: RoutableSegment[], profile: 'human' | 'robot', a: string, b: string) {
    const idx = new Map(nodes.map((n, i) => [n, i]));
    const n = nodes.length;
    const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
    for (const s of segs) {
      if (s.availability !== 'open') continue;
      if (profile === 'robot' && s.robot_access !== 'allowed') continue;
      const u = idx.get(s.start_node_id)!;
      const v = idx.get(s.end_node_id)!;
      d[u][v] = Math.min(d[u][v], s.distance_m);
      if (s.direction === 'bidirectional') d[v][u] = Math.min(d[v][u], s.distance_m);
    }
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
    return d[idx.get(a)!][idx.get(b)!];
  }

  it('200 random graphs × every start/end pair × both profiles', () => {
    const rand = rng(648);
    for (let g = 0; g < 200; g++) {
      const nodeCount = 2 + Math.floor(rand() * 9);
      const nodes = Array.from({ length: nodeCount }, (_, i) => `N${i}`);
      const segs: RoutableSegment[] = [];
      const segCount = Math.floor(rand() * nodeCount * 2);
      for (let s = 0; s < segCount; s++) {
        segs.push(
          seg(`S${s}`, nodes[Math.floor(rand() * nodeCount)], nodes[Math.floor(rand() * nodeCount)], Math.round(rand() * 20), {
            direction: rand() < 0.2 ? 'start_to_end' : 'bidirectional',
            availability: rand() < 0.15 ? 'closed' : 'open',
            robot_access: rand() < 0.25 ? 'restricted' : 'allowed',
          }),
        );
      }
      for (const profile of ['human', 'robot'] as const) {
        for (const a of nodes) {
          for (const b of nodes) {
            const expected = floydDistance(nodes, segs, profile, a, b);
            const r = findRoute(nodes, segs, a, b, profile);
            if (expected === Infinity) {
              expect(r.status).toBe('unreachable');
            } else {
              expect(r.status).toBe('valid');
              expect(r.total_distance_m).toBe(expected);
              // The returned steps must actually add up and chain correctly.
              const sum = r.steps.reduce((acc, st) => acc + segs.find((x) => x.segment_id === st.segment_id)!.distance_m, 0);
              expect(sum).toBe(expected);
              expect(r.node_ids[0]).toBe(a);
              expect(r.node_ids.at(-1)).toBe(b);
            }
          }
        }
      }
    }
  });
});
