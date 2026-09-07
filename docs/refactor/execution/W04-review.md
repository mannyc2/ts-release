# W04 independent review

The user-requested independent reviewer `review_beta_declaration` examined the
native HTTP/credential/OIDC implementation and then the native Git delta. No
implementation work was delegated. This bounded review is not the required final
release-candidate review or hosted/platform certification.

HTTP review reproduced lost duplicate singleton headers in Node's response
projection and merged raw headers under Bun. The implementation now admits raw
pairs through the pinned native dispatcher. Total native input is counted before
parsing, including discarded whitespace, chunk extensions and trailers. Owning
the socket from creation fixes cleanup of unfinished TLS handshakes. The reviewer
reran 16 tests/159 assertions with Node22.22.2 and Bun1.3.14 controls and reported
no remaining actionable material finding in that delta.

Git review found that arbitrary credential resolver failures could escape with
secret-bearing text. Both catalog host and journal now use one captured,
sanitized boundary for typed failure, synchronous throw and defect; interruption
remains interruption. The reviewer independently reran the original marker
reproduction and confirmed the leak was closed.

Git review also found that index reconstruction and leaf-only comparison could
drop unrelated empty trees. Native tree construction now grafts managed entries
through their ancestor trees and compares complete native tree entries, preserving
empty trees, submodules and symlinks outside the exact managed edits. The original
malicious graph still imports and passes native fsck, then correctly fails managed
commit admission. The reviewer independently passed 3 tests/50 assertions for
SHA-1/SHA-256 preservation and rejection, including empty trees inside and outside
edited ancestors, and reported no remaining defect in this correction.

The independent Git review found no additional actionable issue in the examined
CAS, captured argv, multiple authorities, native push evidence or restart paths.
Native process lifetime, Node/Bun public entries, actual Python servers through
HTTP plus Git journal, and fresh packed consumers were separately exercised by
the implementer. Fetch timeout/output/history bounds do not impose a fetched-pack
wire or temporary-disk byte limit. Windows/macOS process behavior, hosted grants
and direct Bun Sigstore remain open and are not inferred from Linux fixtures.

The bounded independent accounting review reproduced the budget digest and
7,891 replacement + 5,856 legacy = 13,747 physical lines. All 55 replacement
files have exact line/hash bindings once; all 82 projected module IDs have one
forecast owner. The original retired credential file and every one of its 81
declaration name/kind/line/text hashes match the preserved commit. No hidden or
double-counted replacement was found. Two stale prose fields were corrected:
the source-ceiling policy now says 12,862/1,377, and prototype printer diagnostics
are explicitly historical. This planning variance leaves the full ceiling red.
