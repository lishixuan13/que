import { join } from 'node:path'
import { getPackages, Package } from '@manypkg/get-packages'
import { findRoot } from '@manypkg/find-root'
import { execa } from 'execa'
import containsPath from 'contains-path'

export function getCurrentDependencies(dir: string) {
  return findRoot(dir)
    .then((res) => res.tool.getPackages(res.rootDir))
    .then((res) => {
      const pkgMap = new Map<string, Package>()
      let currentPackage: Package = null
      res.packages.forEach((pkg) => {
        if (containsPath(pkg.dir, dir)) {
          currentPackage = pkg
        }
        pkgMap.set(pkg.packageJson.name, pkg)
      })
      const depMonoPackages = getMonoPkgDependencies(currentPackage, pkgMap)
      return {
        rootPackage: res.rootPackage,
        rootDir: res.rootDir,
        currentPackages: currentPackage,
        depPackages: Array.from(depMonoPackages),
        tool: res.tool,
      }
    })
}

export function getMonoPkgDependencies(
  pkg: Package,
  map: Map<string, Package>,
  s = new Set<Package>()
) {
  ;[
    ...Object.keys(pkg.packageJson.dependencies),
    ...Object.keys(pkg.packageJson.devDependencies),
  ].forEach((k) => {
    const depPkg = map.get(k)
    if (!depPkg) return
    if (s.has(depPkg)) return
    s.add(depPkg)
    getMonoPkgDependencies(depPkg, map, s)
  })
  return s
}

export async function getLastCommit(cwd: string) {
  const { stdout } = await execa('git', ['rev-list', '-n', '1', 'HEAD'], {
    cwd,
  })
  return stdout
}

export async function getCommitDiffFile(cwd: string, c1: string, c2?: string) {
  const diffCommit = [c1]
  if (c2) {
    diffCommit.push(c2)
  }
  const { stdout } = await execa(
    'git',
    ['diff', ...diffCommit, '--name-only'],
    {
      cwd,
    }
  )
  if (!stdout) return []
  const result = stdout.split('\n').map((p) => join(cwd, p))
  return result
}

export async function getCommitDiffPackages(
  root: string,
  c1: string,
  c2?: string
) {
  const [pkgResult, diffFiles] = await Promise.all([
    getPackages(root),
    getCommitDiffFile(root, c1, c2),
  ])
  const diffPages = pkgResult.packages.filter((pkg) =>
    diffFiles.some((file) => containsPath(file, pkg.dir))
  )
  return diffPages
}

getCurrentDependencies(
  '/Users/edy/Desktop/project/alipay_applet/packages/hooks'
).then((res) => {
  console.log(res)
})
