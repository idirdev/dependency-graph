import { GraphEdge, DependencyNode, CircularDep, Dependency } from './types';

export class Graph {
  private adjacencyList = new Map<string, Set<string>>();
  private edgeData = new Map<string, GraphEdge>();
  private nodeData = new Map<string, Dependency>();

  addNode(node: Dependency): void {
    this.nodeData.set(node.name, node);
    if (!this.adjacencyList.has(node.name)) {
      this.adjacencyList.set(node.name, new Set());
    }
  }

  addEdge(edge: GraphEdge): void {
    const neighbors = this.adjacencyList.get(edge.from) ?? new Set();
    neighbors.add(edge.to);
    this.adjacencyList.set(edge.from, neighbors);
    this.edgeData.set(`${edge.from}->${edge.to}`, edge);
  }

  getNeighbors(node: string): string[] {
    return Array.from(this.adjacencyList.get(node) ?? []);
  }

  getNode(name: string): Dependency | undefined {
    return this.nodeData.get(name);
  }

  getEdge(from: string, to: string): GraphEdge | undefined {
    return this.edgeData.get(`${from}->${to}`);
  }

  getAllNodes(): string[] {
    return Array.from(this.adjacencyList.keys());
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edgeData.values());
  }

  findCircularDependencies(): CircularDep[] {
    const cycles: CircularDep[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of this.getNeighbors(node)) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycles.push({ cycle: [...cycle], depth: cycle.length });
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of this.getAllNodes()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  buildTree(root: string, maxDepth: number = Infinity): DependencyNode | null {
    const visited = new Set<string>();

    const build = (name: string, depth: number): DependencyNode | null => {
      const node = this.nodeData.get(name);
      if (!node) return null;

      const isCircular = visited.has(name);
      visited.add(name);

      const treeNode: DependencyNode = {
        name: node.name,
        version: node.version,
        depth,
        scope: node.scope,
        dependencies: [],
        isCircular,
      };

      if (!isCircular && depth < maxDepth) {
        for (const neighbor of this.getNeighbors(name)) {
          const child = build(neighbor, depth + 1);
          if (child) treeNode.dependencies.push(child);
        }
      }

      return treeNode;
    };

    return build(root, 0);
  }

  getDepthMap(): Map<string, number> {
    const depths = new Map<string, number>();
    const visited = new Set<string>();

    const bfs = (startNodes: string[]): void => {
      const queue: Array<{ node: string; depth: number }> = startNodes.map((n) => ({ node: n, depth: 0 }));

      while (queue.length > 0) {
        const { node, depth } = queue.shift()!;
        if (visited.has(node)) continue;
        visited.add(node);
        depths.set(node, depth);

        for (const neighbor of this.getNeighbors(node)) {
          if (!visited.has(neighbor)) {
            queue.push({ node: neighbor, depth: depth + 1 });
          }
        }
      }
    };

    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set<string>();
    for (const edge of this.edgeData.values()) {
      hasIncoming.add(edge.to);
    }
    const roots = this.getAllNodes().filter((n) => !hasIncoming.has(n));
    bfs(roots.length > 0 ? roots : [this.getAllNodes()[0]]);

    return depths;
  }

  getStats(): { nodes: number; edges: number; density: number } {
    const nodeCount = this.adjacencyList.size;
    const edgeCount = this.edgeData.size;
    const maxEdges = nodeCount * (nodeCount - 1);
    return {
      nodes: nodeCount,
      edges: edgeCount,
      density: maxEdges > 0 ? edgeCount / maxEdges : 0,
    };
  }

  topologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    for (const node of this.getAllNodes()) {
      inDegree.set(node, 0);
    }
    for (const edge of this.edgeData.values()) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(node);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      sorted.push(node);

      for (const neighbor of this.getNeighbors(node)) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    // If sorted doesn't include all nodes, there's a cycle
    return sorted.length === this.adjacencyList.size ? sorted : null;
  }
}
