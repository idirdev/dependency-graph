export interface Package {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  description?: string;
  license?: string;
}

export interface Dependency {
  name: string;
  version: string;
  resolvedVersion?: string;
  scope: 'production' | 'dev' | 'peer';
  depth: number;
  parent: string | null;
  children: string[];
}

export interface DependencyNode {
  name: string;
  version: string;
  depth: number;
  scope: 'production' | 'dev' | 'peer';
  dependencies: DependencyNode[];
  isCircular?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  version: string;
  scope: 'production' | 'dev' | 'peer';
}

export interface CircularDep {
  cycle: string[];
  depth: number;
}

export interface DuplicateDep {
  name: string;
  versions: string[];
  locations: string[];
}

export interface UnusedDep {
  name: string;
  version: string;
  scope: 'production' | 'dev';
}

export interface AnalysisResult {
  root: Package;
  totalDependencies: number;
  directDependencies: number;
  transitiveDependencies: number;
  maxDepth: number;
  circularDependencies: CircularDep[];
  unusedDependencies: UnusedDep[];
  duplicateDependencies: DuplicateDep[];
  edges: GraphEdge[];
  nodes: Map<string, Dependency>;
  estimatedSizeKb: number;
}

export interface CLIOptions {
  depth: number;
  dev: boolean;
  format: 'tree' | 'json' | 'dot' | 'mermaid';
  circular: boolean;
  unused: boolean;
  duplicates: boolean;
}
