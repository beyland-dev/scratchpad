# Runs dmgbuild with two fixes for current macOS:
#
# 1. The background bookmark (.DS_Store "pBBk") is created by macOS itself (Foundation's
#    NSURL bookmark data) instead of mac_alias's hand-built one, which Finder on macOS 26
#    can't resolve, so it shows a plain white window.
# 2. The final detach is forced: on Macs with endpoint security, a scanner keeps the freshly
#    written volume "busy" for minutes. Everything is synced before detach, so forcing is safe.
import subprocess
import sys

import dmgbuild.core as core

# NSURLBookmarkCreationWithSecurityScope: the same fields Finder writes for a background picture.
BOOKMARK_OPTIONS = 1 << 11

JXA = """
ObjC.import("Foundation");
function run(argv) {
  const url = $.NSURL.fileURLWithPath(argv[0]);
  const error = $();
  const data = url.bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(
    %d, $(), $(), error);
  if (!data.js) throw new Error("Couldn't create a bookmark for " + argv[0]);
  return data.base64EncodedStringWithOptions(0).js;
}
""" % BOOKMARK_OPTIONS


class NativeBookmark:
    def __init__(self, data):
        self.data = data

    def to_bytes(self):
        return self.data


class Bookmark(core.Bookmark):
    @classmethod
    def for_file(cls, path):
        import base64

        out = subprocess.run(
            ["osascript", "-l", "JavaScript", "-e", JXA, path],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        return NativeBookmark(base64.b64decode(out))


core.Bookmark = Bookmark

original_hdiutil = core.hdiutil


def hdiutil(cmd, *args, **kwargs):
    if cmd == "detach" and "-force" not in args:
        args = ("-force", *args)
    return original_hdiutil(cmd, *args, **kwargs)


core.hdiutil = hdiutil

from dmgbuild.__main__ import main  # noqa: E402

sys.exit(main())
