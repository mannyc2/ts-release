# Deterministic retained-archive census. No package code execution or network.
import json,tarfile,pathlib,hashlib,re,collections,tempfile,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
handoff=root/'docs/refactor/architecture-program/handoff'
archive=handoff/'public-history/ts-release-0.3.0.tgz'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(archive.read_bytes())=='64df9e8ed395a6e055a94a72fa7a360d9b69af985238f43ce369dbbaf72dd5e3'
with tarfile.open(archive,'r:gz') as t:
 members=t.getmembers();entries={}
 assert len({m.name for m in members})==len(members)
 for m in members:
  assert m.isfile() and not pathlib.PurePosixPath(m.name).is_absolute() and '..' not in pathlib.PurePosixPath(m.name).parts
  entries[m.name]=t.extractfile(m).read()
# Extract only safe regular source/declaration/runtime files into an isolated
# temporary directory for TypeScript syntax/alias inspection, never execution.
temporary=tempfile.TemporaryDirectory(prefix='ts-release-public-history-')
inspection=pathlib.Path(temporary.name)
for name,data in entries.items():
 if name.endswith(('.ts','.js')) or name=='package/package.json':
  target=inspection/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
symbol_path=inspection/'symbols.json'
subprocess.run(['bun',str(root/'tools/architecture-lab/public-history-symbols.cjs'),str(inspection/'package'),str(symbol_path)],check=True,stdout=subprocess.PIPE,text=True)
manifest=json.loads(entries['package/package.json'])
migration=json.loads(subprocess.check_output(['bun',str(root/'tools/architecture-lab/records.ts'),str(handoff/'migration.json')],text=True))
unitmap={}
for row in migration['files']:
 unitmap.setdefault(row['path'],[]).append(row)
oldsymbols={(s['module'],s['name']):s for s in migration['publicSymbols'] if s['snapshot']=='pr21'}
host_donors={'authority.ts','aws.ts','aws/deadline.ts','aws/oidc.ts','aws/policy.ts','aws/s3-boundary.ts'}
def owner_for(p):
 rows=unitmap.get(p,[])
 if rows:
  r=next((x for x in rows if x['snapshot']=='current'),rows[0]);return r['owner'],r['wave'],r['disposition'],r.get('successors',[])
 if p.startswith('src/operation-journal'):
  rel=p.removeprefix('src/operation-journal/')
  if rel in host_donors:return 'host','W04','historical-aws-donor-translate-only-if-optional-host-selected',['host.aws-s3']
  return 'journal','W01','retire-old-operation-journal-owner-and-wire-format',['kernel.machine','host.store']
 if p.startswith('apps/ts-release-agents/'):
  return 'openai','W09','replace-selected-agents-outcomes-with-final-owned-provider', ['provider.openai']
 if p.startswith('examples/'):
  return 'cli','W10','replace-example-with-ordinary-application-loading',['app.cli']
 raise ValueError('No disposition '+p)
units=[]
for name,data in sorted(entries.items()):
 if not name.endswith('.ts') or name.endswith('.d.ts'):continue
 p=name.removeprefix('package/');owner,wave,disposition,successors=owner_for(p)
 current=root/p;ch=sha(current.read_bytes()) if current.is_file() else None
 rows=unitmap.get(p,[])
 units.append({'path':name,'bytes':len(data),'sha256':sha(data),'physicalLines':len(data.splitlines()),'lane':'test' if '/test/' in p or p.endswith('.test.ts') else 'example' if p.startswith('examples/') else 'product','currentPath':p,'currentPresence':'absent' if ch is None else 'identical' if ch==sha(data) else 'different','currentSha256':ch,'coveredHistoricalSnapshots':[{'snapshot':r['snapshot'],'sha256':r['sha256'],'sameBytes':r['sha256']==sha(data)} for r in rows],'newToMaintainedMigrationInventory':not rows,'owner':owner,'wave':wave,'disposition':disposition,'successors':successors,'accounting':'historical-published-donor-no-baseline-addition-no-deletion-credit'})
unit_lookup={u['path']:u for u in units}
symbols=json.load(open(symbol_path))
for surface in symbols['surfaces']:
 subpath=surface['subpath'];surface['disposition']='retire-old-export-path-no-compatibility-alias'
 surface['targetExists']=all(p in entries for p in [surface['types'],surface['runtime']])
 for s in surface['symbols']:
  prior=oldsymbols.get((subpath,s['name']))
  source_paths=sorted(set(o['path'].replace('package/dist/','package/src/').replace('.d.ts','.ts') for o in s['origins']))
  s['sourceOrigins']=[{'path':p,'present':p in entries,'owner':unit_lookup[p]['owner'] if p in unit_lookup else None} for p in source_paths]
  if prior:
   s.update({k:prior[k] for k in ['disposition','successorOwner','successorModules','wave'] if k in prior})
   s['existingDispositionSource']='handoff/migration.json:pr21 publicSymbols'
  elif subpath.startswith('./operation-journal'):
   s['disposition']='retire-old-export-no-alias';s['successorOwner']='host' if subpath.endswith('/aws') else 'journal';s['successorModules']=['host.aws-s3'] if subpath.endswith('/aws') else ['kernel.machine','host.store'];s['wave']='W04' if subpath.endswith('/aws') else 'W01';s['existingDispositionSource']=None
  else:raise ValueError('No symbol disposition '+subpath+':'+s['name'])
  s['hardCutRule']='Published presence does not establish a consumer or persisted payload; preserve explicit user-authorized hard cut. No old reader or export compatibility shim.'
formats=[]
for name,data in sorted(entries.items()):
 if not name.endswith('.ts') or name.endswith('.d.ts'):continue
 text=data.decode()
 for match in re.finditer(r'[\"\x27]([^\"\x27\n]{0,160}(?:/v[0-9]+|[-/]v[0-9]+))\s*[\"\x27]',text):
  value=match.group(1)
  if '/' not in value:continue
  formats.append({'value':value,'path':name,'line':text.count('\n',0,match.start())+1,'disposition':'retire-old-format-no-dual-reader','rule':'Source literal census only; not evidence any encoded payload exists. Explicit one-shot reviewed import only if separately requested.'})
journal_units=[u for u in units if u['path']=='package/src/operation-journal.ts' or u['path'].startswith('package/src/operation-journal/')]
host_units=[u for u in journal_units if u['owner']=='host']
public_total=sum(s['symbolCount'] for s in symbols['surfaces']);runtime_total=sum(s['runtimeSymbolCount'] for s in symbols['surfaces'])
d={
 'format':'published-historical-package-inventory/1','asOf':'2026-09-05','purpose':'Complete shipped archive/source and supported export-name census with bounded source audit of the published S3 implementation. Separate historical donor lane, not a new baseline or ancestry proof.',
 'archive':{'path':str(archive.relative_to(root)),'sha256':sha(archive.read_bytes()),'compressedBytes':len(archive.read_bytes()),'unpackedBytes':sum(len(b) for b in entries.values()),'memberCount':len(entries),'allRegularFiles':True,'uniquePaths':True,'noAbsoluteOrParentPaths':True},
 'package':{k:manifest[k] for k in ['name','version','repository','engines','dependencies','peerDependencies','exports','bin']},
 'qualification':{'sourceInspection':True,'supportedExportNamesAndOriginsInventoried':True,'sourceBuiltOrExecuted':False,'publishedBeta83DependenciesInstalled':False,'awsCallsPerformed':False,'workflowActivated':False,'credentialsConsumed':False,'provisioningObserved':False,'liveAwsQualification':False,'ancestryInferred':False,'externalConsumersKnownFromPackagePresence':False,'baselineDenominatorChanged':False,'baseline':22971,'unchangedSourceCeiling':11485,'limits':'Compiler export/alias and JS AST inspection establish names and source bindings only, not build/runtime/declaration compatibility. Declared members are syntactic own members, not inherited Effect members. Full native journal protocol was inspected; no historical test run is claimed.'},
 'symbolInventory':symbols,
 'counts':{'exports':len(symbols['surfaces']),'declarationNamesAcrossSurfaces':public_total,'runtimeNamesAcrossSurfaces':runtime_total,'uniqueDeclarationNames':len(set(s['name'] for v in symbols['surfaces'] for s in v['symbols'])),'uniqueRuntimeNames':len(set(s['name'] for v in symbols['surfaces'] for s in v['symbols'] if s['runtime'])),'sourceUnits':len(units),'sourcePhysicalLines':sum(u['physicalLines'] for u in units),'sourceLanes':dict(collections.Counter(u['lane'] for u in units)),'sourceUnitsAbsentCurrent':sum(u['currentPresence']=='absent' for u in units),'sourceUnitsNewToMigration':sum(u['newToMaintainedMigrationInventory'] for u in units),'journalUnits':len(journal_units),'journalPhysicalLines':sum(u['physicalLines'] for u in journal_units),'awsHostAuthGovernancePhysicalLines':sum(u['physicalLines'] for u in host_units),'oldJournalSemanticPhysicalLines':sum(u['physicalLines'] for u in journal_units if u not in host_units)},
 'sourceUnits':units,'formatLiteralOccurrences':formats,
 'journalContract':{'scope':['releasePoint','operationKey'],'namespace':'operation-journal/v1/<40hex releasePoint>/<64hex operationKey>/','eventKey':'events/<8-digit sequence>/<UUID>.bin','headKey':'head.bin','eventFormat':'ts-release-operation-journal-event/v1','headFormat':'ts-release-operation-journal-head/v1','tags':['IntentRecorded','ReceiptRecorded','ObservationRecorded','TerminalRecorded','OutcomeUnknown'],'appendArguments':['releasePoint','operationKey','tag','codecId','payload'],'noCallerExpectedRevision':True,'noCallerEventId':True,'acknowledgementIsNotFreshDispatchPermit':True,'transactionIdGeneratedInternally':True,'orphanReconciliationMayWriteHead':True,'boundedHeadRetryAndRebase':True,'limits':{'operationIdentityBytes':65536,'opaquePayloadBytes':1048576,'storedObjectBytes':1500000,'namespaceListedVersions':512,'networkDeadlineMilliseconds':10000,'awsSdkMaxAttempts':1,'retentionYears':10},'boundDifference':'Historical1MiB applies to opaque payload, followed by base64/metadata in a1.5MB object. Proposed replacement1MiB applies to full canonical JournalEvent; neither is evidence all native provider payloads fit.'},
 'designDisposition':{'store':'Use selected JournalStore global journalId/expectedRevision/eventId/CAS-result protocol. Do not wrap CanonicalOperationJournal, rebase DispatchStarted, or delegate release semantics to a second journal owner.','reuse':'Translate useful AWS OIDC/session, authority, expected-owner, conditional-write, exact version/checksum/retention, stream-bound and policy obligations in one optional host adapter if selected. Separate AWS SDK transport one-attempt behavior from old journal internal retry/rebase semantics.','upstream':'Does not reverse current immutable upstream npm-only scope amendment. AWS/Apple upstream gates remain explicitly deferred/not passed; all69 ts-release outcomes remain selected.','forecast':'Charge any maintained translated host/auth/governance implementation and tests in replacement numerator.1755 historical host/auth/governance lines are a donor responsibility anchor, not a mandatory copied addition or deletion credit;145-line S3 model is not complete AWS implementation.','formats':'Hard cut of old per-operation v1 envelopes and public symbols; no automatic importer/dual reader. Published bytes are preserved as evidence, not production runtime input.'},
 'entries':[{'path':m.name,'bytes':m.size,'mode':format(m.mode,'04o'),'sha256':sha(entries[m.name])} for m in sorted(members,key=lambda x:x.name)]
}
assert d['counts']['journalPhysicalLines']==3476
assert d['counts']['awsHostAuthGovernancePhysicalLines']==1755
assert d['counts']['oldJournalSemanticPhysicalLines']==1721
assert len([u for u in units if u['newToMaintainedMigrationInventory'] and (u['path']=='package/src/operation-journal.ts' or u['path'].startswith('package/src/operation-journal/'))])==11
assert all(s['targetExists'] for s in d['symbolInventory']['surfaces'])
output=json.dumps(d,indent=2)+'\n'
target=handoff/'public-history-inventory.json'
if '--check' in sys.argv:
 assert target.read_text()==output,'Published history inventory changed; review the census before regenerating'
else:target.write_text(output)
temporary.cleanup()
print(json.dumps({'mode':'check' if '--check' in sys.argv else 'write','members':len(entries),'sourceUnits':len(units),'exportNames':public_total,'runtimeNames':runtime_total,'journalLines':d['counts']['journalPhysicalLines']}))
