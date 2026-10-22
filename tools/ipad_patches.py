"""Changes the GitHub Pages copy makes to the Claude artifact's page for the student's iPad.

- Child Mode profiles open and start a session without the PIN.
- Adult Mode profiles need the PIN to open from the profile picker.
- Everything that already asked for the PIN still does (ending a session, switching profiles
  mid-session, leaving a deck early, edit mode, managing profiles, changing mode).

Each change is an exact text replacement that must match exactly once. If a new artifact version
moves the code, apply() stops with an error naming the change, so nothing half-patched is published.
"""
import sys

PATCHES = [
    ("open adult profiles behind the PIN",
     "        Sound.unlock();\n        enterProfile(p);\n",
     "        Sound.unlock();\n"
     "        /* iPad copy: grown-up profiles need the PIN to open; child profiles open freely. */\n"
     "        if(p.mode === 'adult'){\n"
     "          S.pendingEnterProfile = p;\n"
     "          S.pinInput=''; S.pinError=''; S.pinShake=false;\n"
     "          S.pinPromptFor = 'enterAdult';\n"
     "          render();\n"
     "          return;\n"
     "        }\n"
     "        enterProfile(p);\n"),
    ("PIN pad title for opening an adult profile",
     "  function pinPadTitles(kind){\n",
     "  function pinPadTitles(kind){\n"
     "    if(kind === 'enterAdult') return ['🔐 Grown-up Profile', 'Enter the PIN to open this profile.'];\n"),
    ("open the adult profile once the PIN clears",
     "    if(kind === 'start'){\n      beginSession();\n",
     "    if(kind === 'enterAdult'){\n"
     "      S.pinPromptFor = null;\n"
     "      var ep = S.pendingEnterProfile;\n"
     "      S.pendingEnterProfile = null;\n"
     "      if(ep) enterProfile(ep); else render();\n"
     "    } else if(kind === 'start'){\n      beginSession();\n"),
    ("cancelling goes back to the picker",
     "    if(kind === 'modeSwitch') S.pendingModeSwitch = null;\n",
     "    if(kind === 'modeSwitch') S.pendingModeSwitch = null;\n"
     "    if(kind === 'enterAdult') S.pendingEnterProfile = null;\n"),
    ("Start Session without the PIN",
     "      S.pinInput=''; S.pinError=''; S.pinShake=false;\n      S.pinPromptFor = 'start';\n      render();\n",
     "      /* iPad copy: starting a session doesn't need the PIN; ending one still does. */\n"
     "      beginSession();\n"),
    ("resting screen wording",
     "'<p>Ask a grown-up to enter the PIN to start today\\'s study session.</p>'",
     "'<p>Tap Start Session when you\\'re ready to dive in.</p>'"),
]


def apply(html):
    for name, old, new in PATCHES:
        n = html.count(old)
        if n != 1:
            sys.exit(f"iPad patch '{name}' expected its anchor once but found it {n} times; "
                     "the artifact's code changed, so update tools/ipad_patches.py.")
        html = html.replace(old, new)
    return html


if __name__ == "__main__":
    # Patch already-built pages in place: python3 tools/ipad_patches.py index.html coral-cove/index.html
    for f in sys.argv[1:]:
        with open(f, encoding="utf-8") as fh:
            text = fh.read()
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(apply(text))
        print("patched", f)
