from typing import Optional

from django.conf import settings
from rest_framework.exceptions import PermissionDenied


def is_delete_guardrails_enabled() -> bool:
    return getattr(settings, 'GUARDRAILS', False)


def require_delete_allowed(action: Optional[str] = None) -> None:
    if not is_delete_guardrails_enabled():
        return

    if action:
        detail = f'Delete action "{action}" is disabled by GUARDRAILS environment variable.'
    else:
        detail = 'Delete actions are disabled by GUARDRAILS environment variable.'
    raise PermissionDenied(detail)
