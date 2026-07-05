class TsRelease < Formula
  desc "Portable artifact and package-manager distribution planning for TypeScript projects."
  homepage "https://github.com/mannyc2/ts-release"
  version "0.1.0"

  on_macos do
    on_arm do
      url "https://github.com/mannyc2/ts-release/releases/download/v0.1.0/ts-release-0.1.0-darwin-arm64"
      sha256 "6b42b26ec9d86fa487f6299cfef05cb7df74396b1cf94e779fc6601d5700164f"
    end

    on_intel do
      url "https://github.com/mannyc2/ts-release/releases/download/v0.1.0/ts-release-0.1.0-darwin-x64"
      sha256 "00b210a8aca5e13f4782738817b9f25cabfffc79345edb00db17deb86040eb0f"
    end

  end

  def install
    bin.install Dir["*"].find { |path| File.file?(path) } => "ts-release"
    chmod 0755, bin/"ts-release"
  end

  test do
    assert File.exist?(bin/"ts-release")
    assert File.executable?(bin/"ts-release")
  end
end
