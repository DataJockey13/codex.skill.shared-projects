#!/usr/bin/env python3
"""One-time textual migration; filesystem anchors come only from workspace.paths.json."""
from pathlib import Path
import json
import os
import re

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'workspace.paths.json').read_text())
OLD_BASE = CONFIG['bases']['darwin'].rstrip('/')
EXCLUDED = {'.git', 'node_modules', 'dist', '.runtime', '__pycache__'}


def migrate():
    changed = []
    for base, directories, filenames in os.walk(ROOT):
        directories[:] = [name for name in directories if name not in EXCLUDED]
        for name in filenames:
            file = Path(base) / name
            if file == ROOT / 'workspace.paths.json' or file.is_symlink():
                continue
            try:
                original = file.read_bytes().decode('utf-8')
            except (UnicodeError, OSError):
                continue
            if OLD_BASE not in original:
                continue
            text = original
            if file.suffix == '.md':
                # Markdown link destinations and provenance resources remain real
                # file-relative links; logical directory references use SHARED_ROOT.
                def link(match):
                    target = match.group(1)
                    relative = os.path.relpath(target, file.parent).replace(os.sep, '/')
                    return '](' + relative + ')'
                text = re.sub(r'\]\((' + re.escape(OLD_BASE) + r'/[^)]+)\)', link, text)
                def resource(match):
                    relative = os.path.relpath(match.group(2), file.parent).replace(os.sep, '/')
                    return match.group(1) + relative
                text = re.sub(r'(?m)^(\s*resource:\s*)(' + re.escape(OLD_BASE) + r'/[^\n]+)$', resource, text)
            text = text.replace(OLD_BASE + '/', '').replace(OLD_BASE, 'SHARED_ROOT')
            if file.suffix == '.json':
                document = json.loads(text)
                if isinstance(document, dict):
                    document['path_basis'] = 'SHARED_ROOT'
                    text = json.dumps(document, ensure_ascii=False, indent=2) + '\n'
            if text != original:
                file.write_bytes(text.encode('utf-8'))
                changed.append(str(file.relative_to(ROOT)))
    return changed


if __name__ == '__main__':
    result = migrate()
    print(json.dumps({'changed_files': result, 'count': len(result)}, ensure_ascii=False, indent=2))
