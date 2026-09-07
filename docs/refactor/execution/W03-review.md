# W03 independent review

The user-requested independent reviewer examined the per-file provider and common
artifact/JSON extraction. No implementation work was delegated to that reviewer.

Corrected findings: Simple HTML/JSON misleading labels could conceal pip-visible
conflicting links; trusted authorization lacked normalized nonempty unique project
sets; native metadata values/field versions were under-validated. Both Simple and
project-set corrections were independently rerun and confirmed. Shared npm/core
regression passed 11 tests/80 assertions during the bounded review.

Native metadata corrections now have 82 Python/Twine admission controls, with 34
accepted cases. The reviewer independently regenerated all controls, compared
native fields with only field-order normalization, and verified all four upstream
source hashes. The fixture tests compare full native multipart fields and exact
file bytes for four actual Python-built distributions. Boundary parsing exposed
a 77-character boundary; its replacement always stays 68 characters, checks
collisions and is reconstructed during request admission.

Additional corrections cover malformed Python string escapes, duplicate MIME
parameters, Python identifier restrictions, case-insensitive LicenseRef syntax,
and native catalog membership. Pinned npm SPDX catalogs disagreed with Python's
authority, so the production data is generated explicitly from packaging 26.3's
SPDX 3.27.0 owner. The reviewer verified all 699 license and 79 exception members
and its source hash. Its generated data bytes and lines are counted separately;
the provider's parser logic remains normally formatted, counted TypeScript.

Final bounded rerun passed 3 tests/196 assertions. The unchanged extracted
Warehouse helper and response branches correctly distinguish exact duplicates
(HTTP 200 and a doomed transaction), different/deleted filenames (HTTP 400), and
absence (continued native validation). Database/HTTP stand-ins and source excerpts
are expressly limited; neither this witness nor an HTTP error permits replay.
The reviewer reported no remaining actionable defect in these corrections.

Real local pypiserver/devpi two/four-file uploads, SIGKILL/fresh-process SQLite
restart, temporary Simple absence and clean pip consumers were executed by the
implementer in separate acceptance. They are not the independent full release
candidate review or hosted Warehouse/OIDC acceptance required by Plans 009/010.
