import json
from pathlib import Path

from django.conf import settings

# Load manifest.json once at module scope
_MANIFEST = {}

def _load_manifest():
    manifest_locations = [
        Path(settings.REACT_APP_ROOT) / 'manifest.json',
        Path(settings.STATIC_ROOT) / 'js/manifest.json',
    ]

    for manifest_path in manifest_locations:
        if manifest_path.exists():
            with open(manifest_path, 'r') as f:
                return json.load(f)
    return {}


try:
    # If HMR is enabled, we don't need to read the manifest as it's not used
    # All assets are served from the dev server in that case
    if not settings.FRONTEND_HMR:
        _MANIFEST = _load_manifest()
except Exception:
    # If there's any error reading the manifest, we'll use the default mapping
    _MANIFEST = {}


def get_manifest_asset(path: str) -> str:
    """Maps a path to its hashed filename using manifest.json, or falls back to /react-app/ prefix

    Usage in template:
    {% manifest_asset 'main.js' %}
    """
    asset = None
    if path in _MANIFEST:
        entry = _MANIFEST[path]
        asset = entry.get('file') if isinstance(entry, dict) else entry
    else:
        for entry in _MANIFEST.values():
            if isinstance(entry, dict):
                if entry.get('file', '').endswith(path):
                    asset = entry['file']
                    break
                for css_asset in entry.get('css', []):
                    if css_asset.endswith(path):
                        asset = css_asset
                        break

    if asset:
        if asset.startswith(('http://', 'https://')):
            return asset
        prefix = settings.FRONTEND_HOSTNAME.rstrip('/')
        if asset.startswith('/react-app/'):
            return f'{prefix}{asset}'
        return f'{prefix}/react-app/{asset.lstrip('/')}'  # type: ignore[arg-type]

    return f'{settings.FRONTEND_HOSTNAME}/react-app/{path}'
