# Independent W06 review

Reviewer: Hypatia (`/root/review_beta_declaration`), GPT-6Astra inherited task
context, bounded independent review. Product implementation stayed with the root.
No remaining actionable product finding after native reproductions and closure.

1. Official Scoop install_app treats nightly case-insensitively and disables native
   download hash verification. Manifest now rejects this sentinel. Native positive
   and negative controls demonstrate check_hash true versus false before download.
2. Scoop interpolated an admitted executable into a generated PowerShell shim and
   interpreted wildcard paths through native Test-Path/Convert-Path. Scoop-specific
   portable path admission now excludes script metacharacters and wildcard syntax.
   Retained native controls execute original shim construction with isolated output
   adapters and prove the original substitution/wrong-file selection.
3. Ruby reserved identifiers BEGIN/END passed the proposed class regex. Both reject;
   original native Ruby parsing controls independently confirm why.
4. Git fixtures initially published classTool under tool0.rb/tool1.rb. The atomic
   Git guarantee was intact but the consumer fixture was invalid. Each path now
   renders its corresponding class, and native Homebrew loads the exact committed
   bytes under that filename before accepting the fixture.
5. The retained installer-policy control initially tried to parse native diagnostic
   output as JSON. It now parses the final compact result record; independent rerun
   passes1test/9assertions. Diagnostic output does not enter product history.

Independent additional version review uses actual Homebrew Formula/Resource APIs:
16cells across matching version, conflicting release, date and versionless filenames
all preserve intended1.2.3. Only matching inference retains detected_from_url=true;
the others use native explicit override. The implementation delegates version parsing
to Homebrew. Native style and strict audit pass. The maintainer suite retains the
version controls and the original safety regressions.

Original independent reproductions remain in/tmp/ts-release-w06-*-review.*; lasting
regressions are test/reimplementation/catalog/{render,native,git}.test.ts and their
Ruby/PowerShell scripts. The tool pin record binds actual official source versions.
Native source calls use isolated filesystem/output adapters where Linux cannot run
Windows installation; this limitation is explicit. No hosted catalog publication or
native Windows/macOS install/run is certified by this review.

Independent accounting confirms13667product=9647replacement+4020legacy, all70actual
source files bound once, all89module IDs unique, and both exact retired donors with
all62AST declaration hashes. Stale forecast-policy prose and an ambiguous source/file
label were corrected before sealing. Final topology/preservation review confirms all701ledger bindings and the original
226propositions/69outcomes/native witnesses/ancestry requirements. Live T3c owns all
five catalog modules within one package. The production scope now names catalog;
forecast JSON explicitly records the selected combined metadata/data views without
double-counting Action YAML or rejected topology costs. All review corrections closed. Full release-candidate
review remains required after all waves and native host/consumer qualification.
