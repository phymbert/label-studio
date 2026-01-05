from django.utils.functional import cached_property


class OrganizationMixin:
    @cached_property
    def active_members(self):
        return self.members


class OrganizationMemberMixin:
    def has_permission(self, user):
        from organizations.models import OrganizationRole

        if getattr(user, 'is_superuser', False):
            return True

        if user.active_organization_id != self.organization_id:
            return False

        if self.deleted_at is not None:
            return False

        return self.role in OrganizationRole.active_roles()
