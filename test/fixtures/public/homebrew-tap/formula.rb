class ReleaseExampleHomebrew < Formula
  desc "release-example-homebrew 0.1.0 release artifact"
  homepage "https://github.com/owner/release-example-homebrew"
  url "https://github.com/owner/release-example-homebrew/releases/download/v0.1.0/release-example-homebrew-0.1.0.tgz"
  sha256 "6a6d5a6e19c74024a6cbe11ed33dc1dec5ff47acc863599137a97cd3fee1871e"
  version "0.1.0"

  def install
    bin.install "bin/release-example-homebrew" => "release-example-homebrew"
    chmod 0755, bin/"release-example-homebrew"
  end

  test do
    assert File.exist?(bin/"release-example-homebrew")
    assert File.executable?(bin/"release-example-homebrew")
  end
end
