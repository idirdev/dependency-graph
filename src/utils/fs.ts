import * as fs from 'fs';
import * as path from 'path';
import { Package } from '../types';

export function readPackageJson(dir: string): Package | null {
  const pkgPath = path.join(dir, 'package.json');
  try {
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return {
      name: pkg.name ?? 'unknown',
      version: pkg.version ?? '0.0.0',
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      peerDependencies: pkg.peerDependencies,
      description: pkg.description,
      license: pkg.license,
    };
  } catch {
    return null;
  }
}

export function findNodeModulesPackage(projectDir: string, packageName: string): Package | null {
  const nmPath = path.join(projectDir, 'node_modules', packageName);
  return readPackageJson(nmPath);
}

export function scanImports(dir: string): Set<string> {
  const imports = new Set<string>();
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        walk(fullPath);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          extractImports(content, imports);
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  walk(dir);
  return imports;
}

function extractImports(content: string, imports: Set<string>): void {
  // Match require('package') and import ... from 'package'
  const requireRegex = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  const importRegex = /(?:import|from)\s+['"]([^'"./][^'"]*)['"]/g;

  let match: RegExpExecArray | null;

  while ((match = requireRegex.exec(content)) !== null) {
    imports.add(normalizePackageName(match[1]));
  }

  while ((match = importRegex.exec(content)) !== null) {
    imports.add(normalizePackageName(match[1]));
  }
}

function normalizePackageName(importPath: string): string {
  // Handle scoped packages: @scope/package/sub -> @scope/package
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
  }
  // Handle subpath imports: package/sub -> package
  return importPath.split('/')[0];
}
