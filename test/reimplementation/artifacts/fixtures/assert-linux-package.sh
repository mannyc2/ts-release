#!/bin/sh
set -eu
format="$1"
name=ts-release-acceptance
test ! -e "/usr/bin/$name"
case "$format" in
  deb)
    package=/delivery/fixture.deb
    test "$(dpkg-deb --field "$package" Package)" = "$name"
    test "$(dpkg-deb --field "$package" Version)" = "1.0.0-1"
    test "$(dpkg-deb --field "$package" Architecture)" = "amd64"
    test "$(dpkg-deb --field "$package" Maintainer)" = "ts-release acceptance <acceptance@example.test>"
    dpkg-deb --contents "$package" | grep -E '^-rwxr-xr-x.*2009-11-10 23:00.*\./usr/bin/ts-release-acceptance$'
    dpkg --install "$package"
    ;;
  rpm)
    package=/delivery/fixture.rpm
    test "$(rpm -qp --qf '%{NAME}|%{VERSION}|%{RELEASE}|%{ARCH}|%{LICENSE}' "$package")" = "$name|1.0.0|1|x86_64|MIT"
    test "$(rpm -qp --qf '%{BUILDTIME}' "$package")" = 1257894000
    rpm -qplv "$package" | grep -E '^-rwxr-xr-x.* /usr/bin/ts-release-acceptance$'
    rpm -ivh "$package"
    ;;
  apk)
    package=/delivery/fixture.apk
    tar -xOzf "$package" .PKGINFO > /tmp/package-info
    grep -Fqx "pkgname = $name" /tmp/package-info
    grep -Fqx 'pkgver = 1.0.0-r1' /tmp/package-info
    grep -Fqx 'arch = x86_64' /tmp/package-info
    grep -Fqx 'license = MIT' /tmp/package-info
    grep -Fqx 'depend = libstdc++' /tmp/package-info
    tar -tvzf "$package" | grep -E '^-rwxr-xr-x.*2009-11-10 23:00:00 usr/bin/ts-release-acceptance$'
    apk add --no-network /dependencies/*.apk
    apk add --no-network --allow-untrusted "$package"
    ;;
  archlinux)
    package=/delivery/fixture.pkg.tar.zst
    bsdtar -xOf "$package" .PKGINFO > /tmp/package-info
    grep -Fqx "pkgname = $name" /tmp/package-info
    grep -Fqx 'pkgver = 1.0.0-1' /tmp/package-info
    grep -Fqx 'arch = x86_64' /tmp/package-info
    grep -Fqx 'license = MIT' /tmp/package-info
    grep -Fqx 'builddate = 1257894000' /tmp/package-info
    bsdtar -tvf "$package" | grep -E '^-rwxr-xr-x.* usr/bin/ts-release-acceptance$'
    pacman -Qlp "$package" | grep -Fqx "$name /usr/bin/$name"
    pacman -U --noconfirm "$package"
    ;;
  *) exit 64 ;;
esac
test "$("/usr/bin/$name" --version)" = 'ts-release producer fixture 1.0.0'
case "$format" in
  deb) dpkg --remove "$name" ;;
  rpm) rpm -e "$name" ;;
  apk) apk del --no-network "$name" ;;
  archlinux) pacman -R --noconfirm "$name" ;;
esac
test ! -e "/usr/bin/$name"
printf 'ts-release/%s:passed\n' "$format"
