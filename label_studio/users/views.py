"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging
from urllib.parse import quote

from core.feature_flags import flag_set
from core.middleware import enforce_csrf_checks
from core.utils.common import load_func
from django.conf import settings
from django.contrib import auth
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect, render, reverse
from django.utils.http import url_has_allowed_host_and_scheme
import requests
from organizations.forms import OrganizationSignupForm
from organizations.models import Organization
from rest_framework.authtoken.models import Token
from users import forms
from users.functions import login, proceed_registration
from users.oidc import (
    OIDCAuthenticationError,
    OIDCClient,
    OIDCConfigurationError,
    get_default_next_page,
    resolve_next_page,
)

logger = logging.getLogger()


@login_required
def logout(request):
    auth.logout(request)

    if settings.LOGOUT_REDIRECT_URL:
        return redirect(settings.LOGOUT_REDIRECT_URL)

    if settings.HOSTNAME:
        redirect_url = settings.HOSTNAME
        if not redirect_url.endswith('/'):
            redirect_url += '/'
        return redirect(redirect_url)
    return redirect('/')


@enforce_csrf_checks
def user_signup(request):
    """Sign up page"""
    user = request.user
    next_page = request.GET.get('next')
    token = request.GET.get('token')

    # checks if the URL is a safe redirection.
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        if flag_set('fflag_all_feat_dia_1777_ls_homepage_short', user):
            next_page = reverse('main')
        else:
            next_page = reverse('projects:project-index')

    user_form = forms.UserSignupForm()
    organization_form = OrganizationSignupForm()

    if user.is_authenticated:
        return redirect(next_page)

    # make a new user
    if request.method == 'POST':
        organization = Organization.objects.first()
        if settings.DISABLE_SIGNUP_WITHOUT_LINK is True:
            if not (token and organization and token == organization.token):
                raise PermissionDenied()
        else:
            if token and organization and token != organization.token:
                raise PermissionDenied()

        user_form = forms.UserSignupForm(request.POST)
        organization_form = OrganizationSignupForm(request.POST)

        if user_form.is_valid():
            redirect_response = proceed_registration(request, user_form, organization_form, next_page)
            if redirect_response:
                return redirect_response

    if flag_set('fflag_feat_front_lsdv_e_297_increase_oss_to_enterprise_adoption_short'):
        return render(
            request,
            'users/new-ui/user_signup.html',
            {
                'user_form': user_form,
                'organization_form': organization_form,
                'next': quote(next_page),
                'token': token,
                'found_us_options': forms.FOUND_US_OPTIONS,
                'elaborate': forms.FOUND_US_ELABORATE,
            },
        )

    return render(
        request,
        'users/user_signup.html',
        {
            'user_form': user_form,
            'organization_form': organization_form,
            'next': quote(next_page),
            'token': token,
        },
    )


@enforce_csrf_checks
def user_login(request):
    """Login page"""
    if settings.OIDC_ENABLED:
        return redirect('user-sso-login')

    user = request.user
    next_page = request.GET.get('next')

    # checks if the URL is a safe redirection.
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        if flag_set('fflag_all_feat_dia_1777_ls_homepage_short', user):
            next_page = reverse('main')
        else:
            next_page = reverse('projects:project-index')

    login_form = load_func(settings.USER_LOGIN_FORM)
    form = login_form()

    if user.is_authenticated:
        return redirect(next_page)

    if request.method == 'POST':
        form = login_form(request.POST)
        if form.is_valid():
            user = form.cleaned_data['user']
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            if form.cleaned_data['persist_session'] is not True:
                # Set the session to expire when the browser is closed
                request.session['keep_me_logged_in'] = False
                request.session.set_expiry(0)

            # user is organization member
            org_pk = Organization.find_by_user(user).pk
            user.active_organization_id = org_pk
            user.save(update_fields=['active_organization'])
            return redirect(next_page)

    if flag_set('fflag_feat_front_lsdv_e_297_increase_oss_to_enterprise_adoption_short'):
        return render(request, 'users/new-ui/user_login.html', {'form': form, 'next': quote(next_page)})

    return render(request, 'users/user_login.html', {'form': form, 'next': quote(next_page)})


@enforce_csrf_checks
def user_sso_login(request):
    if not settings.OIDC_ENABLED:
        return redirect('user-login')

    next_page = request.GET.get('next') or get_default_next_page(request.user)
    persist_session = request.GET.get('persist_session', '1') not in ('0', 'false', 'False')
    # Safe redirect only to same host
    if not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts={request.get_host()}):
        next_page = get_default_next_page(request.user)

    oidc = OIDCClient()
    try:
        auth_url = oidc.build_auth_url(request, next_page)
        request.session['keep_me_logged_in'] = persist_session
        if not persist_session:
            request.session.set_expiry(0)
    except Exception as exc:
        logger.exception('Failed to start OIDC login flow.')
        return render(
            request,
            'users/user_login.html',
            {'form': forms.LoginForm(), 'next': quote(next_page), 'oidc_error': str(exc)},
        )

    return redirect(auth_url)


def _ensure_user_membership(user):
    if Organization.objects.exists():
        org = Organization.objects.first()
        org.add_user(user)
    else:
        org = Organization.create_organization(created_by=user, title=settings.OIDC_ORGANIZATION_TITLE)
    user.active_organization = org
    user.save(update_fields=['active_organization'])
    return org


@enforce_csrf_checks
def user_sso_callback(request):
    if not settings.OIDC_ENABLED:
        return redirect('user-login')

    state = request.GET.get('state')
    code = request.GET.get('code')
    stored_state = request.session.get('oidc_state')
    if not state or not stored_state or state != stored_state:
        logger.warning(
            'OIDC state mismatch or missing state on callback',
            extra={
                'provided_state': state,
                'stored_state_present': stored_state is not None,
                'path': request.path,
            },
        )
        request.session.pop('oidc_state', None)
        request.session.pop('oidc_next', None)
        oidc = OIDCClient()
        try:
            retry_next = get_default_next_page(request.user)
            auth_url = oidc.build_auth_url(request, retry_next)
            return redirect(auth_url)
        except Exception as exc:
            logger.exception('Failed to restart OIDC login after state mismatch.')
            return render(
                request,
                'users/user_login.html',
                {
                    'form': forms.LoginForm(),
                    'next': quote(get_default_next_page(request.user)),
                    'oidc_error': 'Invalid login state. Please try again.',
                },
            )

    oidc = OIDCClient()
    try:
        token_response = oidc.exchange_code(code, request)
        access_token = token_response.get('access_token')
        if not access_token:
            raise OIDCAuthenticationError('Missing access token in token response.')
        userinfo = oidc.fetch_userinfo(access_token)
        userinfo = oidc.validate_userinfo(userinfo)
    except (OIDCAuthenticationError, OIDCConfigurationError, requests.RequestException) as exc:
        logger.warning('OIDC authentication failed: %s', exc)
        return render(
            request,
            'users/user_login.html',
            {
                'form': forms.LoginForm(),
                'next': quote(get_default_next_page(request.user)),
                'oidc_error': str(exc),
            },
        )

    email = userinfo[settings.OIDC_CLAIM_EMAIL].lower()
    first_name = userinfo.get(settings.OIDC_CLAIM_GIVEN_NAME, '')
    last_name = userinfo.get(settings.OIDC_CLAIM_FAMILY_NAME, '')

    user_model = get_user_model()
    user, created = user_model.objects.get_or_create(
        email=email, defaults={'username': email.split('@')[0], 'first_name': first_name, 'last_name': last_name}
    )
    if created:
        user.set_unusable_password()
        user.save()
    else:
        update_fields = []
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            update_fields.append('first_name')
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            update_fields.append('last_name')
        if update_fields:
            user.save(update_fields=update_fields)

    _ensure_user_membership(user)

    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    if request.session.get('keep_me_logged_in') is False:
        request.session.set_expiry(0)
    else:
        request.session['keep_me_logged_in'] = True

    next_page = resolve_next_page(request, get_default_next_page(user))
    # Cleanup state
    request.session.pop('oidc_state', None)
    request.session.pop('oidc_next', None)

    return redirect(next_page)


@login_required
def user_account(request, sub_path=None):
    """
    Handle user account view and profile updates.

    This view displays the user's profile information and allows them to update
    it. It requires the user to be authenticated and have an active organization
    or an organization_pk in the session.

    Args:
        request (HttpRequest): The request object.
        sub_path (str, optional): A sub-path parameter for potential URL routing.
            Defaults to None.

    Returns:
        HttpResponse: Renders the user account template with user profile form,
            or redirects to 'main' if no active organization is found,
            or redirects back to user-account after successful profile update.

    Notes:
        - Authentication is required (enforced by @login_required decorator)
        - Retrieves the user's API token for display in the template
        - Form validation happens on POST requests
    """
    user = request.user

    if user.active_organization is None and 'organization_pk' not in request.session:
        return redirect(reverse('main'))

    form = forms.UserProfileForm(instance=user)
    token = Token.objects.get(user=user)

    if request.method == 'POST':
        form = forms.UserProfileForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return redirect(reverse('user-account'))

    return render(
        request,
        'users/user_account.html',
        {'settings': settings, 'user': user, 'user_profile_form': form, 'token': token},
    )
