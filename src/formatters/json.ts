import { AnalysisResult } from '../types';

export function formatJson(result: AnalysisResult): string {
  const output = {
    name: result.root.name,
    version: result.root.version,
    stats: {
      totalDependencies: result.totalDependencies,
      directDependencies: result.directDependencies,
      transitiveDependencies: result.transitiveDependencies,
      maxDepth: result.maxDepth,
      estimatedSizeKb: result.estimatedSizeKb,
    },
    dependencies: Array.from(result.nodes.entries()).map(([key, node]) => ({
      key,
      name: node.name,
      version: node.version,
      resolvedVersion: node.resolvedVersion,
      scope: node.scope,
      depth: node.depth,
      parent: node.parent,
      childCount: node.children.length,
    })),
    edges: result.edges.map((e) => ({
      from: e.from,
      to: e.to,
      version: e.version,
      scope: e.scope,
    })),
    issues: {
      circularDependencies: result.circularDependencies.map((c) => ({
        cycle: c.cycle,
        length: c.depth,
      })),
      unusedDependencies: result.unusedDependencies.map((u) => ({
        name: u.name,
        version: u.version,
        scope: u.scope,
      })),
      duplicateDependencies: result.duplicateDependencies.map((d) => ({
        name: d.name,
        versions: d.versions,
      })),
    },
  };

  return JSON.stringify(output, null, 2);
}
