# W05 independent review

The user-requested reviewer `review_beta_declaration` examined the material kernel
seam and GitHub provider. Implementation was not delegated. This bounded review
is separate from final release-candidate review and native hosted certification.

The kernel review found a stale-parent race during credential preparation and a
mutable descriptor callback during asynchronous plan hashing. The common executor
now verifies the candidate start against its refreshed preceding history before
CAS; plan loading captures descriptor identity, codec and callback before yielding.
Both original reproductions independently reject. Retained external-provider
regressions pass8tests/36assertions, and a later full regression passed202/1797
before the GitHub provider was added.

Provider review found and independently closed:

- Durable content-length conflicted with the real HTTP host's framing ownership.
  Request byte length/digest remain exact; the native transport generates framing.
  The original real HTTP.prepare reproduction now succeeds with one credential call.
- Draft creation could accept a201 response with draft:false. Its receipt now
  requires draft:true; publish requires draft:false. The original reproduction
  now returns Unknown/different-native. Later published-stage observations remain
  separately admissible.
- Ignoring unquoted or malformed next links could hide an extra asset and permit
  publication. Every Link member is now parsed or rejected. The related last-link
  case required preserving an advertised page frontier across short intermediate
  pages, with consistent last-page evidence. All original next/last reproductions
  now read page2, preserve the draft and report Conflict without PATCH. Five
  independent malformed/frontier controls return Inconclusive.

Draft preparation independently requires complete native absence, including when
optional observation is disabled or inconclusive. This matters because GitHub
allows multiple drafts at one tag and initial journal authority is not a native
absence proof. Independent review found no additional issue in this guard.

The reviewer independently passed28tests/214assertions and reported all findings
from the bounded provider review closed. Returned-parent mutation/upload binding,
selected asset checks, NoReplay response-loss behavior, fixed diagnostics and
public redirect credential separation were inspected. The credential helper's
repository read-route families do not downscope a token. Neither REST enumeration
nor tag preflight is an atomic remote snapshot.

Hosted existing-release GET/checksum-download witnesses pass on Node22.22.2 and
Bun1.3.14. New local process-recovery and fresh packed-consumer evidence are separate
implementer checks. This review does not certify hosted GitHub mutations, the69
launch outcomes, native platform behavior or a published release candidate.

The independent accounting review reproduced9453replacement+4902legacy=14355,
all65replacement files and the exact source digest. Every one of685measured
file bindings/counts matched the reviewed snapshot. The preserved25de8c0donor
matches954lines and56ASTdeclaration hashes and is absent from the current tree.
Forecast components and11807/12904/14392totals match; no omitted or double-counted
replacement was found. Two stale future-package/actual-owner descriptions were
corrected. This review does not waive the1703line cumulative tripwire excess or
1419line expected full-product deficit.
