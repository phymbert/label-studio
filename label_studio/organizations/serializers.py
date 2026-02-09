"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""

from drf_dynamic_fields import DynamicFieldsMixin
from organizations.models import Organization, OrganizationMember
from rest_framework import serializers
from users.serializers import UserSerializer


class OrganizationIdSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'title', 'contact_info', 'created_at']


class OrganizationSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'


# =========================================
# OrganizationMemberListAPI
# =========================================


class OrganizationMemberListParamsSerializer(serializers.Serializer):
    active = serializers.BooleanField(required=False, default=False)
    contributed_to_projects = serializers.BooleanField(required=False, default=False)


class UserOrganizationMemberListSerializer(UserSerializer):
    created_projects = serializers.SerializerMethodField(read_only=True)
    contributed_to_projects = serializers.SerializerMethodField(read_only=True)

    def get_created_projects(self, user):
        if not self.context.get('contributed_to_projects', False):
            return None
        created_projects_map = self.context.get('created_projects_map', {})
        return created_projects_map.get(user.id, [])

    def get_contributed_to_projects(self, user):
        if not self.context.get('contributed_to_projects', False):
            return None
        contributed_to_projects_map = self.context.get('contributed_to_projects_map', {})
        return contributed_to_projects_map.get(user.id, [])

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ('created_projects', 'contributed_to_projects')


class OrganizationMemberListSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    user = UserOrganizationMemberListSerializer()

    class Meta:
        model = OrganizationMember
        fields = ['id', 'organization', 'user', 'role']


# =========================================


class OrganizationMemberSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    annotations_count = serializers.SerializerMethodField(read_only=True)
    contributed_projects_count = serializers.SerializerMethodField(read_only=True)
    role = serializers.CharField(read_only=True)

    def get_annotations_count(self, member):
        org = self.context.get('organization')
        return member.user.annotations.filter(project__organization=org).count()

    def get_contributed_projects_count(self, member):
        org = self.context.get('organization')
        return member.user.annotations.filter(project__organization=org).values('project').distinct().count()

    class Meta:
        model = OrganizationMember
        fields = ['user', 'organization', 'role', 'contributed_projects_count', 'annotations_count', 'created_at']


class OrganizationMemberWriteSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=OrganizationMember._meta.get_field('role').choices)

    class Meta:
        model = OrganizationMember
        fields = ['user', 'role']

    def validate(self, attrs):
        organization = self.context['organization']
        user = attrs.get('user', getattr(self.instance, 'user', None))
        if user is None:
            return attrs

        existing = OrganizationMember.objects.filter(
            organization=organization, user=user, deleted_at__isnull=True
        ).exclude(pk=getattr(self.instance, 'pk', None))
        if existing.exists():
            raise serializers.ValidationError('User is already a member of this organization.')
        return attrs

    def create(self, validated_data):
        organization = self.context['organization']
        return OrganizationMember.objects.create(organization=organization, **validated_data)


class OrganizationInviteSerializer(serializers.Serializer):
    token = serializers.CharField(required=False)
    invite_url = serializers.CharField(required=False)
