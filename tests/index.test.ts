import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../src/graph';
import type { Dependency, GraphEdge } from '../src/types';

function createDep(name: string, version: string = '1.0.0', scope: 'production' | 'dev' | 'peer' = 'production'): Dependency {
  return {
    name,
    version,
    scope,
    depth: 0,
    parent: null,
    children: [],
  };
}

describe('Graph - nodes', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it('adds and retrieves a node', () => {
    const dep = createDep('express', '4.18.0');
    graph.addNode(dep);
    const retrieved = graph.getNode('express');
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('express');
    expect(retrieved!.version).toBe('4.18.0');
  });

  it('getAllNodes returns all added node names', () => {
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addNode(createDep('c'));
    expect(graph.getAllNodes().sort()).toEqual(['a', 'b', 'c']);
  });

  it('getNode returns undefined for unknown node', () => {
    expect(graph.getNode('nonexistent')).toBeUndefined();
  });
});

describe('Graph - edges', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
    graph.addNode(createDep('app'));
    graph.addNode(createDep('express'));
    graph.addNode(createDep('body-parser'));
  });

  it('adds and retrieves edges', () => {
    const edge: GraphEdge = { from: 'app', to: 'express', version: '^4.18.0', scope: 'production' };
    graph.addEdge(edge);

    const retrieved = graph.getEdge('app', 'express');
    expect(retrieved).toBeDefined();
    expect(retrieved!.from).toBe('app');
    expect(retrieved!.to).toBe('express');
  });

  it('getNeighbors returns direct dependencies', () => {
    graph.addEdge({ from: 'app', to: 'express', version: '^4.18.0', scope: 'production' });
    graph.addEdge({ from: 'app', to: 'body-parser', version: '^1.20.0', scope: 'production' });

    const neighbors = graph.getNeighbors('app');
    expect(neighbors.sort()).toEqual(['body-parser', 'express']);
  });

  it('getNeighbors returns empty array for node with no edges', () => {
    expect(graph.getNeighbors('express')).toEqual([]);
  });

  it('getAllEdges returns all edges', () => {
    graph.addEdge({ from: 'app', to: 'express', version: '^4.18.0', scope: 'production' });
    graph.addEdge({ from: 'express', to: 'body-parser', version: '^1.20.0', scope: 'production' });

    const edges = graph.getAllEdges();
    expect(edges).toHaveLength(2);
  });
});

describe('Graph - circular dependency detection', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it('detects no cycles in a DAG', () => {
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addNode(createDep('c'));
    graph.addEdge({ from: 'a', to: 'b', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'b', to: 'c', version: '1.0.0', scope: 'production' });

    const cycles = graph.findCircularDependencies();
    expect(cycles).toHaveLength(0);
  });

  it('detects a simple cycle', () => {
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addEdge({ from: 'a', to: 'b', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'b', to: 'a', version: '1.0.0', scope: 'production' });

    const cycles = graph.findCircularDependencies();
    expect(cycles.length).toBeGreaterThan(0);
    // The cycle should contain both 'a' and 'b'
    const cycleNodes = cycles[0].cycle;
    expect(cycleNodes).toContain('a');
    expect(cycleNodes).toContain('b');
  });

  it('detects a 3-node cycle', () => {
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addNode(createDep('c'));
    graph.addEdge({ from: 'a', to: 'b', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'b', to: 'c', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'c', to: 'a', version: '1.0.0', scope: 'production' });

    const cycles = graph.findCircularDependencies();
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('Graph - topologicalSort', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it('returns topological order for a DAG', () => {
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addNode(createDep('c'));
    graph.addEdge({ from: 'a', to: 'b', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'b', to: 'c', version: '1.0.0', scope: 'production' });

    const sorted = graph.topologicalSort();
    expect(sorted).not.toBeNull();
    expect(sorted).toHaveLength(3);
    // 'a' must come before 'b', 'b' before 'c'
    expect(sorted!.indexOf('a')).toBeLessThan(sorted!.indexOf('b'));
    expect(sorted!.indexOf('b')).toBeLessThan(sorted!.indexOf('c'));
  });

  it('returns null when there is a cycle', () => {
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addEdge({ from: 'a', to: 'b', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'b', to: 'a', version: '1.0.0', scope: 'production' });

    expect(graph.topologicalSort()).toBeNull();
  });
});

describe('Graph - buildTree', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
    graph.addNode(createDep('app'));
    graph.addNode(createDep('express'));
    graph.addNode(createDep('body-parser'));
    graph.addEdge({ from: 'app', to: 'express', version: '^4.18.0', scope: 'production' });
    graph.addEdge({ from: 'app', to: 'body-parser', version: '^1.20.0', scope: 'production' });
    graph.addEdge({ from: 'express', to: 'body-parser', version: '^1.20.0', scope: 'production' });
  });

  it('builds a tree from a root node', () => {
    const tree = graph.buildTree('app');
    expect(tree).not.toBeNull();
    expect(tree!.name).toBe('app');
    expect(tree!.depth).toBe(0);
    expect(tree!.dependencies).toHaveLength(2);
  });

  it('respects maxDepth', () => {
    const tree = graph.buildTree('app', 1);
    expect(tree).not.toBeNull();
    // At depth 1, express's children should be empty
    const expressNode = tree!.dependencies.find((d) => d.name === 'express');
    expect(expressNode).toBeDefined();
    expect(expressNode!.dependencies).toHaveLength(0);
  });

  it('returns null for unknown root', () => {
    expect(graph.buildTree('unknown')).toBeNull();
  });

  it('marks circular references', () => {
    graph.addEdge({ from: 'body-parser', to: 'app', version: '1.0.0', scope: 'production' });
    const tree = graph.buildTree('app');
    expect(tree).not.toBeNull();
    // Somewhere in the tree, isCircular should be true
    const findCircular = (node: any): boolean => {
      if (node.isCircular) return true;
      return node.dependencies.some(findCircular);
    };
    expect(findCircular(tree)).toBe(true);
  });
});

describe('Graph - getStats', () => {
  it('returns correct node and edge counts', () => {
    const graph = new Graph();
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    graph.addNode(createDep('c'));
    graph.addEdge({ from: 'a', to: 'b', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'a', to: 'c', version: '1.0.0', scope: 'production' });

    const stats = graph.getStats();
    expect(stats.nodes).toBe(3);
    expect(stats.edges).toBe(2);
    expect(stats.density).toBeGreaterThan(0);
    expect(stats.density).toBeLessThanOrEqual(1);
  });

  it('returns density 0 for a graph with no edges', () => {
    const graph = new Graph();
    graph.addNode(createDep('a'));
    graph.addNode(createDep('b'));
    const stats = graph.getStats();
    expect(stats.density).toBe(0);
  });
});

describe('Graph - getDepthMap', () => {
  it('assigns depths based on BFS from root nodes', () => {
    const graph = new Graph();
    graph.addNode(createDep('root'));
    graph.addNode(createDep('child'));
    graph.addNode(createDep('grandchild'));
    graph.addEdge({ from: 'root', to: 'child', version: '1.0.0', scope: 'production' });
    graph.addEdge({ from: 'child', to: 'grandchild', version: '1.0.0', scope: 'production' });

    const depthMap = graph.getDepthMap();
    expect(depthMap.get('root')).toBe(0);
    expect(depthMap.get('child')).toBe(1);
    expect(depthMap.get('grandchild')).toBe(2);
  });
});
