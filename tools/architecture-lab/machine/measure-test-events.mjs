import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here=dirname(fileURLToPath(import.meta.url))
const temporary=await mkdtemp("/tmp/machine-event-sizes-")
const file=join(temporary,"sizes.jsonl")
const child=Bun.spawn([process.execPath,"test",join(here,"test")],{env:{...process.env,LAB_EVENT_SIZE_FILE:file},stdout:"pipe",stderr:"pipe"})
const [exitCode,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()])
if(exitCode!==0)throw Error(stdout+stderr)
const observations=(await readFile(file,"utf8")).trim().split("\n").map(line=>JSON.parse(line))
const successful=observations.filter(row=>row.result==="Appended")
const rejected=observations.filter(row=>row.result==="Rejected")
const output={format:"machine-event-size-observations/1",unit:"canonical full JournalEvent UTF-8 bytes",method:"Instrumented all successful MemoryJournal appends and SQLite machine/process/failure fixtures. Counts include fixture corruption/adversarial histories; repeated CAS measurements are not unique journal facts. Production provider maximum is not inferred from this fixture population.",testSummary:stderr.split("\n").filter(line=>/ pass$| fail$|expect\(\)|Ran /.test(line)),maximumAppendedBytes:Math.max(...successful.map(row=>row.encodedBytes)),maximumRejectedBytes:Math.max(...rejected.map(row=>row.encodedBytes)),byEvent:[...new Set(observations.map(row=>row.event))].sort().map(event=>({event,maximumAppendedBytes:Math.max(0,...successful.filter(row=>row.event===event).map(row=>row.encodedBytes)),maximumRejectedBytes:Math.max(0,...rejected.filter(row=>row.event===event).map(row=>row.encodedBytes))})),observedAppendAttempts:observations.length}
await writeFile(join(here,"event-sizes.json"),JSON.stringify(output,null,2)+"\n")
console.log(JSON.stringify(output,null,2))
