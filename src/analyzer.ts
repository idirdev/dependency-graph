import * as path from 'path';
import { Package, Dependency, GraphEdge, AnalysisResult, CLIOptions, CircularDep, UnusedDep, DuplicateDep } from './types';
import { readPackageJson, findNodeModulesPackage, scanImports } from './utils/fs';

export function analyze(dir: string, options: CLIOptions): AnalysisResult {
  const rootPkg = readPackageJson(dir);
  if (!rootPkg) {
    throw new Error(`No package.json found in ${dir}`);
  }

  const nodes = new Map<string, Dependency>();
  const edges: GraphEdge[] = [];
  const versionMap = new Map<string, Set<string>>(); // name -> versions
  let maxDepth = 0;

  // Collect direct dependencies
  const directDeps: Record<string, { version: string; scope: 'production' | 'dev' | 'peer' }> = {};

  for (const [name, version] of Object.entries(rootPkg.dependencies ?? {})) {
    directDeps[name] = { version, scope: 'production' };
  }

  if (options.dev) {
    for (const [name, version] of Object.entries(rootPkg.devDependencies ?? {})) {
      directDeps[name] = { version, scope: 'dev' };
    }
  }

  // Resolve dependency tree
  const visited = new Set<string>();

  function resolve(name: string, version: string, scope: 'production' | 'dev' | 'peer', depth: number, parent: string | null): void {
    if (depth > options.depth) return;

    const key = `${name}@${version}`;
    if (visited.has(key)) return;
    visited.add(key);

    maxDepth = Math.max(maxDepth, depth);

    // Track versions for duplicate detection
    const versions = versionMap.get(name) ?? new Set();
    versions.add(version);
    versionMap.set(name, versions);

    // Try to resolve actual installed version from node_modules
    const resolvedPkg = findNodeModulesPackage(dir, name);
    const resolvedVersion = resolvedPkg?.version ?? version;

    const node: Dependency = {
      name,
      version,
      resolvedVersion,
      scope,
      depth,
      parent,
      children: [],
    };

    nodes.set(key, node);

    if (parent) {
      edges.push({ from: parent, to: name, version, scope });
      const parentNode = nodes.get(parent);
      if (parentNode) parentNode.children.push(name);
    }

    // Resolve transitive dependencies
    if (resolvedPkg) {
      for (const [depName, depVersion] of Object.entries(resolvedPkg.dependencies ?? {})) {
        resolve(depName, depVersion, 'production', depth + 1, key);
      }
    }
  }

  // Start resolution from direct deps
  for (const [name, info] of Object.entries(directDeps)) {
    resolve(name, info.version, info.scope, 1, `${rootPkg.name}@${rootPkg.version}`);
  }

  // Calculate stats
  const directCount = Object.keys(directDeps).length;
  const totalCount = nodes.size;
  const transitiveCount = totalCount - directCount;

  // Estimate size (rough heuristic: 50KB per package on average)
  const estimatedSizeKb = totalCount * 50;

  // Detect circular dependencies
  const circularDeps = options.circular ? detectCircular(edges) : [];

  // Detect unused dependencies
  const unusedDeps = options.unused ? detectUnused(dir, rootPkg, options.dev) : [];

  // Detect duplicate dependencies
  const duplicateDeps = options.duplicates ? detectDuplicates(versionMap) : [];

  return {
    root: rootPkg,
    totalDependencies: totalCount,
    directDependencies: directCount,
    transitiveDependencies: transitiveCount,
    maxDepth,
    circularDependencies: circularDeps,
    unusedDependencies: unusedDeps,
    duplicateDependencies: duplicateDeps,
    edges,
    nodes,
    estimatedSizeKb,
  };
}

function detectCircular(edges: GraphEdge[]): CircularDep[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from) ?? [];
    neighbors.push(edge.to);
    adjacency.set(edge.from, neighbors);
  }

  const cycles: CircularDep[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        cycles.push({ cycle, depth: cycle.length });
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      dfs(neighbor);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    dfs(node);
  }

  return cycles;
}

function detectUnused(dir: string, pkg: Package, includeDev: boolean): UnusedDep[] {
  const imports = scanImports(dir);
  const unused: UnusedDep[] = [];

  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (!imports.has(name) && !imports.has(`@${name}`)) {
      unused.push({ name, version, scope: 'production' });
    }
  }

  if (includeDev) {
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      if (!imports.has(name)) {
        unused.push({ name, version, scope: 'dev' });
      }
    }
  }

  return unused;
}

function detectDuplicates(versionMap: Map<string, Set<string>>): DuplicateDep[] {
  const duplicates: DuplicateDep[] = [];

  for (const [name, versions] of versionMap.entries()) {
    if (versions.size > 1) {
      duplicates.push({
        name,
        versions: Array.from(versions),
        locations: Array.from(versions).map((v) => `${name}@${v}`),
      });
    }
  }

  return duplicates;
}
