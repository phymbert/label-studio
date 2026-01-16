from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasObjectPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.has_permission(request.user)


class MemberHasOwnerPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'is_superuser', False):
            return True

        if request.method not in SAFE_METHODS and not request.user.is_organization_admin(
            getattr(obj, 'organization_id', None)
        ):
            return False

        return obj.has_permission(request.user)
