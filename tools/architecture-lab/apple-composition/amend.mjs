import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { resolve, join } from "node:path"
import { fileURLToPath } from "node:url"

const root=resolve(fileURLToPath(new URL("../../..",import.meta.url)))
export function amendApple(directory) {
  const file=join(directory,"src/apple/apple-preparation.ts")
  const original=readFileSync(file,"utf8")
  let source=original.replace('Content, OwnedTree, adoptTree','Content, OwnedFile, OwnedTree, adoptTree')
  source=source.replace('owner: ContentOwner, sourceDir: string, outputDir: string\n)', 'owner: ContentOwner, sourceDir: string, outputDir: string,\n  deliver?: (artifact: Model.StapledApplicationBundle) => Effect.Effect<readonly OwnedFile[],LabError>\n)')
  source=source.replace('const bundle = yield* finalize([adopted])','const delivery = deliver ? yield* deliver(finalArtifact) : []\n  const bundle = yield* finalize([adopted,...delivery])')
  if(source===original)throw Error("Apple delivery amendment anchor changed")
  writeFileSync(file,source)
  const fixture=join(directory,"src/apple/apple-experiment.ts")
  let test=readFileSync(fixture,"utf8")
  test=test.replace('const run =','export const run =').replace('const protocolLayers = (root:string, mode:string) =>','export const protocolLayers = (root:string, mode:string, bundleName="Fixture.app") =>')
  const start=test.indexOf('export const protocolLayers'),end=test.indexOf('\nclass PublishIntent')
  test=test.slice(0,start)+test.slice(start,end).replaceAll('"Fixture.app"','bundleName').replace('bundleName=bundleName','bundleName="Fixture.app"').replaceAll('"/Fixture.app"','`/${bundleName}`')+test.slice(end)
  test=test.replace('const setup=async(root:string)=>','export const setup=async(root:string,logicalName="Fixture.app",objectDirectory=join(root,"objects"),architecture:"arm64"|"x64"="arm64")=>')
  const setupStart=test.indexOf('export const setup='),setupEnd=test.indexOf('\nconst worker=')
  let setup=test.slice(setupStart,setupEnd).replace('fileContentOwner(join(root,"objects")),"Fixture.app"','fileContentOwner(objectDirectory),logicalName').replace('Artifact.portableRelativePath("Fixture.app")','Artifact.portableRelativePath(logicalName)').replace('source,architecture:"arm64"','source,architecture')
  test=test.slice(0,setupStart)+setup+test.slice(setupEnd)
  writeFileSync(fixture,test)
  return {base: createHash("sha256").update(original).digest("hex"),amended:createHash("sha256").update(source).digest("hex"),sourceLines:source.split("\n").length-1,amendmentScript:join(root,"tools/architecture-lab/apple-composition/amend.mjs")}
}
