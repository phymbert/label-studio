"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""
import logging
import secrets
import time
from typing import Dict, Iterable, Optional
from urllib.parse import urlencode, urljoin

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.http import url_has_allowed_host_and_scheme
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

User = get_user_model()


class OIDCConfigurationError(Exception):
    """Raised when an OpenID Connect configuration issue occurs."""


class OIDCAuthenticationError(Exception):
    """Raised when authentication with the OIDC provider fails."""


class OIDCClient:
    """Utility class for handling OpenID Connect authentication flow."""

    def __init__(self):
        self._metadata: Optional[Dict] = None
        self._fetched_at: Optional[float] = None

    def _discovery_endpoint(self) -> str:
        base = settings.OIDC_SERVER_URL.rstrip('/') + '/'
        return urljoin(base, '.well-known/openid-configuration')

    def _metadata_stale(self) -> bool:
        if self._metadata is None or self._fetched_at is None:
            return True
        # refresh every 5 minutes
        return (time.time() - self._fetched_at) > 300

    def _get_metadata(self) -> Dict:
        if not settings.OIDC_ENABLED:
            raise OIDCConfigurationError('OIDC is not configured.')

        if self._metadata_stale():
            response = requests.get(self._discovery_endpoint(), timeout=settings.OIDC_TIMEOUT)
            response.raise_for_status()
            self._metadata = response.json()
            self._fetched_at = time.time()
            logger.info('OIDC discovery document refreshed.')
        return self._metadata

    def _get_endpoint(self, key: str) -> str:
        metadata = self._get_metadata()
        if key not in metadata:
            raise OIDCConfigurationError(f"'{key}' not found in OIDC discovery document.")
        return metadata[key]

    def build_auth_url(self, request, next_page: str) -> str:
        state = secrets.token_urlsafe(16)
        request.session['oidc_state'] = state
        request.session['oidc_next'] = next_page

        from django.urls import reverse

        redirect_uri = request.build_absolute_uri(reverse('user-sso-callback'))
        params = {
            'client_id': settings.OIDC_CLIENT_ID,
            'response_type': 'code',
            'scope': settings.OIDC_SCOPES,
            'redirect_uri': redirect_uri,
            'state': state,
        }
        auth_endpoint = self._get_endpoint('authorization_endpoint')
        return f'{auth_endpoint}?{urlencode(params)}'

    def exchange_code(self, code: str, request) -> Dict:
        token_endpoint = self._get_endpoint('token_endpoint')
        from django.urls import reverse

        redirect_uri = request.build_absolute_uri(reverse('user-sso-callback'))
        payload = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
        }
        auth = HTTPBasicAuth(settings.OIDC_CLIENT_ID, settings.OIDC_CLIENT_SECRET)
        response = requests.post(token_endpoint, data=payload, auth=auth, timeout=settings.OIDC_TIMEOUT)
        if response.status_code >= 400:
            logger.error('OIDC token exchange failed: %s', response.text)
            raise OIDCAuthenticationError('Failed to exchange authorization code for token.')
        return response.json()

    def fetch_userinfo(self, access_token: str) -> Dict:
        userinfo_endpoint = self._get_endpoint('userinfo_endpoint')
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get(userinfo_endpoint, headers=headers, timeout=settings.OIDC_TIMEOUT)
        if response.status_code >= 400:
            logger.error('OIDC userinfo request failed: %s', response.text)
            raise OIDCAuthenticationError('Failed to fetch user information from provider.')
        return response.json()

    def validate_userinfo(self, userinfo: Dict) -> Dict:
        logger.debug('OIDC userinfo received: %s', userinfo)

        email = userinfo.get(settings.OIDC_CLAIM_EMAIL)
        if not email:
            raise OIDCAuthenticationError(
                f'Email is required from the identity provider. Claims present: {", ".join(userinfo.keys())}'
            )

        domain_allowed = self._email_domain_allowed(email)
        if not domain_allowed:
            raise OIDCAuthenticationError('Email domain is not allowed to sign in.')

        if settings.OIDC_CLAIMS_GROUP:
            group_claim = userinfo.get(settings.OIDC_CLAIMS_GROUP)
            if not group_claim:
                raise OIDCAuthenticationError(
                    f'Required group claim "{settings.OIDC_CLAIMS_GROUP}" is missing. '
                    f'Claims present: {", ".join(userinfo.keys())}'
                )
            if settings.OIDC_ALLOWED_GROUPS and not self._is_group_allowed(group_claim, settings.OIDC_ALLOWED_GROUPS):
                raise OIDCAuthenticationError('User is not a member of an allowed group.')

        return userinfo

    @staticmethod
    def _normalize_to_iterable(value) -> Iterable:
        if isinstance(value, (list, tuple, set)):
            return value
        return [value]

    def _email_domain_allowed(self, email: str) -> bool:
        if not settings.OIDC_ALLOWED_EMAIL_DOMAINS:
            return True
        domain = email.split('@')[-1].lower()
        return domain in {d.lower() for d in settings.OIDC_ALLOWED_EMAIL_DOMAINS}

    def _is_group_allowed(self, claim_value, allowed: Iterable[str]) -> bool:
        values = {str(v).lower() for v in self._normalize_to_iterable(claim_value)}
        allowed_set = {a.lower() for a in allowed}
        return not values.isdisjoint(allowed_set)


def resolve_next_page(request, fallback: str) -> str:
    next_page = request.session.pop('oidc_next', None) or request.GET.get('next') or fallback
    if url_has_allowed_host_and_scheme(url=next_page, allowed_hosts={request.get_host()}):
        return next_page
    return fallback


def get_default_next_page(user) -> str:
    from django.urls import reverse
    return reverse('projects:project-index')
