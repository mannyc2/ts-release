class ReleaseExampleMultiTarget < Formula
  desc "release-example-multi-target 0.1.0 release artifact"
  homepage "https://github.com/owner/release-example-multi-target"
  url "https://github.com/owner/release-example-multi-target/releases/download/v0.1.0/release-example-multi-target-0.1.0.tgz"
  sha256 "60bf2ce69a7cd8d437fa36701f8913bfe92a9f37aedea8e191f34fc6d11f9c4b"
  version "0.1.0"

  def install
    bin.install "bin/release-example-multi-target" => "release-example-multi-target"
    chmod 0755, bin/"release-example-multi-target"
  end

  test do
    assert File.exist?(bin/"release-example-multi-target")
    assert File.executable?(bin/"release-example-multi-target")
  end
end
