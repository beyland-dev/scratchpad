# Run dmgbuild, but force the final detach: on Macs with endpoint security, a scanner keeps the
# freshly written volume "busy" for minutes. Everything is synced before detach, so forcing is safe.
import sys, dmgbuild.core as core
orig = core.hdiutil
def hdiutil(cmd, *args, **kwargs):
    if cmd == "detach" and "-force" not in args:
        args = ("-force", *args)
    return orig(cmd, *args, **kwargs)
core.hdiutil = hdiutil
from dmgbuild.__main__ import main
sys.exit(main())
