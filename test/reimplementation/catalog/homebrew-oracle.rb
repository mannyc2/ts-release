require "formula"
require "formulary"
require "simulate_system"
require "json"

path = Pathname.new(ARGV.fetch(0))
text = path.read
results = []
[:macos, :linux].product([:intel, :arm]).each do |os, arch|
  Homebrew::SimulateSystem.with(os:, arch:) do
    Formulary.clear_cache
    formula = Formulary.from_contents(path.basename(".rb").to_s, path, text, tap: Tap.fetch("fixture/catalog"))
    results << { os:, arch:, url: formula.stable.url, sha256: formula.stable.checksum.to_s,
                 version: formula.version.to_s, detected: formula.version.detected_from_url?, description: formula.desc, homepage: formula.homepage,
                 license: formula.license, test_defined: formula.test_defined? }
  end
end
puts JSON.generate({ ruby: RUBY_DESCRIPTION, cells: results })
