class PortableExample < Formula
  desc "Portable CLI distribution for @scope/portable-example"
  homepage "https://github.com/owner/portable-example"
  version "0.1.0"

  on_macos do
    on_arm do
      url "https://github.com/owner/portable-example/releases/download/v0.1.0/portable-example-0.1.0-darwin-arm64"
      sha256 "420c09ffefd15b0ab90134aa1149b76b46933145c19f1335bde9d8960e84ff9e"
    end

    on_intel do
      url "https://github.com/owner/portable-example/releases/download/v0.1.0/portable-example-0.1.0-darwin-x64"
      sha256 "6244805d219cc43ebe6693ee3b5aff6a56bfe6671846120a7adf8a57f360d52f"
    end

  end

  def install
    bin.install Dir["*"].find { |path| File.file?(path) } => "portable-example"
    chmod 0755, bin/"portable-example"
  end

  test do
    assert File.exist?(bin/"portable-example")
    assert File.executable?(bin/"portable-example")
  end
end
