import * as core from "@actions/core"
import * as github from "@actions/github"

function isDefined<T>(value: T | undefined | null): value is T {
  return <T>value !== undefined && <T>value !== null
}

(async () => {
  const SEMVER = /v([0-9]+).([0-9]+).([0-9]+)/
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ""

  const octokit = github.getOctokit(GITHUB_TOKEN)

  async function fetchTags(owner: string, name: string): Promise<string[]> {
    let cursor: string | undefined = undefined
    let hasNextPage = true
    let results: string[] = []
    while (hasNextPage) {
      const resp: any = await octokit.graphql(`
  query($owner: String!, $name: String!, $cursor: String) { 
    repository(owner:$owner, name:$name){
      refs(refPrefix:"refs/tags/", first:10, after:$cursor) {
        pageInfo{
          hasNextPage
          endCursor
        }
        nodes{
          name
        }
      }
    }
  }`, { owner, name, cursor })
      hasNextPage = resp.repository.refs.pageInfo.hasNextPage
      cursor = resp.repository.refs.pageInfo.endCursor
      results.push(...resp.repository.refs.nodes.map(v => v.name))
    }
    return results
  }
  // get all tags
  const tags = await fetchTags(github.context.repo.owner, github.context.repo.repo)
  const latest = tags
    .map(tag => {
      const result = tag?.match(SEMVER)
      if (result === null) {
        return null
      }
      const major = parseInt(result?.[1])
      const minor = parseInt(result?.[2])
      const patch = parseInt(result?.[3])
      return {
        major,
        minor,
        patch,
      }
    })
    .filter(isDefined)
    .sort((a, b) => {
      const dMajor = (a.major - b.major)
      const dMinor = (a.minor - b.minor)
      const dPatch = (a.patch - b.patch)
      if (dMajor !== 0) {
        return dMajor
      }
      if (dMinor !== 0) {
        return dMinor
      }
      return dPatch
    })
    .pop()
    ?? { major: 0, minor: 0, patch: 0 }

  core.info(`Latest version is v${latest.major}.${latest.minor}.${latest.patch}`)
  //
  core.setOutput("current", `v${latest.major}.${latest.minor}.${latest.patch}`)
  core.setOutput("current-nopatch", `v${latest.major}.${latest.minor}`)
  core.setOutput("current-nominor", `v${latest.major}`)
  // 
  core.setOutput("nextpatch", `v${latest.major}.${latest.minor}.${latest.patch + 1}`)
  core.setOutput("nextpatch-nopatch", `v${latest.major}.${latest.minor}`)
  core.setOutput("nextpatch-nominor", `v${latest.major}`)
  // 
  core.setOutput("nextminor", `v${latest.major}.${latest.minor + 1}.0`)
  core.setOutput("nextminor-nopatch", `v${latest.major}.${latest.minor + 1}`)
  core.setOutput("nextminor-nominor", `v${latest.major}`)
  // 
  core.setOutput("nextmajor", `v${latest.major + 1}.0.0`)
  core.setOutput("nextmajor-nopatch", `v${latest.major + 1}.0`)
  core.setOutput("nextmajor-nominor", `v${latest.major + 1}`)
})()