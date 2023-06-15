import * as core from "@actions/core"
import * as github from "@actions/github"

function isDefined<T>(value: T | undefined | null): value is T {
  return <T>value !== undefined && <T>value !== null
}

(async () => {
  const SEMVER = /v([0-9]+).([0-9]+).([0-9]+)/
  const GITHUB_TOKEN = core.getInput("github-token", { required: true, trimWhitespace: true }) ?? ""
  const valueType = (core.getInput("value-type", { trimWhitespace: true }) ?? "current") as "current" | "nextpatch" | "nextminor" | "nextmajor"
  const release = (core.getInput("release", { trimWhitespace: true }) ?? "current") as "no" | "prerelease" | "release"
  const releaseName = core.getInput("release-name")
  const releaseBody = core.getInput("release-body")

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
  const values = {
    current: {
      main: `v${latest.major}.${latest.minor}.${latest.patch}`,
      nopatch: `v${latest.major}.${latest.minor}`,
      nominor: `v${latest.major}`,
    },
    nextpatch: {
      main: `v${latest.major}.${latest.minor}.${latest.patch + 1}`,
      nopatch: `v${latest.major}.${latest.minor}`,
      nominor: `v${latest.major}`,
    },
    nextminor: {
      main: `v${latest.major}.${latest.minor + 1}.0`,
      nopatch: `v${latest.major}.${latest.minor + 1}`,
      nominor: `v${latest.major}`,
    },
    nextmajor: {
      main: `v${latest.major + 1}.0.0`,
      nopatch: `v${latest.major + 1}.0`,
      nominor: `v${latest.major + 1}`,
    },
  }
  if (["release", "prerelease"].includes(release)) {
    core.info(`create tag : ${values[valueType].main}`)
    await octokit.rest.git.createTag({
      type: "commit",
      tag: values[valueType].main,
      message: "github action egoavara/semver release this tag",
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      object: github.context.sha,
    })
    core.info(`create no patch tag : ${values[valueType].nopatch}`)
    await octokit.rest.git.createTag({
      type: "commit",
      tag: values[valueType].nopatch,
      message: "github action egoavara/semver release this tag",
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      object: github.context.sha,
    })
    core.info(`create no minor tag : ${values[valueType].nominor}`)
    await octokit.rest.git.createTag({
      type: "commit",
      tag: values[valueType].nominor,
      message: "github action egoavara/semver release this tag",
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      object: github.context.sha,
    })
    core.info(`create release, and tag : ${values[valueType].main}`)
    await octokit.rest.repos.createRelease({
      tag_name: values[valueType].main,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      target_commitish: github.context.sha,
      name: releaseName.replace("<<version>>", values[valueType].main),
      body: releaseBody,
      prerelease: release === "prerelease",
    })
  }


  core.setOutput("value", values[valueType].main)
  core.setOutput("value-nopatch", values[valueType].nopatch)
  core.setOutput("value-nominor", values[valueType].nominor)
  core.setOutput("current", values.current.main)
  core.setOutput("current-nopatch", values.current.nopatch)
  core.setOutput("current-nominor", values.current.nominor)
  core.setOutput("nextpatch", values.nextpatch.main)
  core.setOutput("nextpatch-nopatch", values.nextpatch.nopatch)
  core.setOutput("nextpatch-nominor", values.nextpatch.nominor)
  core.setOutput("nextminor", values.nextminor.main)
  core.setOutput("nextminor-nopatch", values.nextminor.nopatch)
  core.setOutput("nextminor-nominor", values.nextminor.nominor)
  core.setOutput("nextmajor", values.nextmajor.main)
  core.setOutput("nextmajor-nopatch", values.nextmajor.nopatch)
  core.setOutput("nextmajor-nominor", values.nextmajor.nominor)
})()