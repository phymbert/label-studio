import { Button } from "@humansignal/ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { useUpdatePageTitle } from "@humansignal/core";
import { HeidiTips } from "../../../components/HeidiTips/HeidiTips";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { cn } from "../../../utils/bem";
import { FF_AUTH_TOKENS, FF_LSDV_E_297, isFF } from "../../../utils/feature-flags";
import "./PeopleInvitation.scss";
import { PeopleList } from "./PeopleList";
import "./PeoplePage.scss";
import { TokenSettingsModal } from "@humansignal/app-common/blocks/TokenSettingsModal";
import { IconPlus } from "@humansignal/icons";
import { useToast } from "@humansignal/ui";
import { InviteLink } from "./InviteLink";
import { SelectedUser } from "./SelectedUser";
import { Input } from "../../../components/Form";
import { useAPI } from "../../../providers/ApiProvider";

const ROLE_OPTIONS = [
  { value: "OW", label: "Owner" },
  { value: "AD", label: "Administrator" },
  { value: "AN", label: "Annotator" },
  { value: "RE", label: "Reviewer" },
  { value: "RO", label: "Read only" },
  { value: "NO", label: "Not activated" },
  { value: "DI", label: "Deactivated" },
];

export const PeoplePage = () => {
  const api = useAPI();
  const apiSettingsModal = useRef();
  const toast = useToast();
  const [selectedUser, setSelectedUser] = useState(null);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [newUserId, setNewUserId] = useState("");
  const [newUserRole, setNewUserRole] = useState("RO");
  const organizationId = window.APP_SETTINGS?.user?.active_organization ?? 1;
  const isSuperUser = window.APP_SETTINGS?.user?.is_superuser;
  const userRole = window.APP_SETTINGS?.user?.role;
  const isOrgAdmin = isSuperUser || ["OW", "AD"].includes(userRole);

  useUpdatePageTitle("People");

  const selectUser = useCallback(
    (user) => {
      setSelectedUser(user);

      localStorage.setItem("selectedUser", user?.id);
    },
    [setSelectedUser],
  );

  const apiTokensSettingsModalProps = useMemo(
    () => ({
      title: "API Token Settings",
      style: { width: 480 },
      body: () => (
        <TokenSettingsModal
          onSaved={() => {
            toast.show({ message: "API Token settings saved" });
            apiSettingsModal.current?.close();
          }}
        />
      ),
    }),
    [],
  );

  const showApiTokenSettingsModal = useCallback(() => {
    apiSettingsModal.current = modal(apiTokensSettingsModalProps);
    __lsa("organization.token_settings");
  }, [apiTokensSettingsModalProps]);

  const defaultSelected = useMemo(() => {
    return localStorage.getItem("selectedUser");
  }, []);

  const handleAddMember = async () => {
    if (!isOrgAdmin) return;
    if (!newUserId) {
      toast.show({ message: "User ID is required", type: "error" });
      return;
    }
    try {
      await api.callApi("createMembership", {
        params: { pk: organizationId },
        body: { user: Number(newUserId), role: newUserRole },
      });
      toast.show({ message: "Member added", type: "success" });
      setNewUserId("");
      setReloadToken(Date.now());
    } catch (e) {
      toast.show({ message: "Failed to add member", type: "error" });
    }
  };

  const handleRoleChange = async (userId, role) => {
    if (!isOrgAdmin) return;
    try {
      await api.callApi("updateMembership", {
        params: { pk: organizationId, userPk: userId },
        body: { role },
      });
      toast.show({ message: "Role updated", type: "success" });
      setReloadToken(Date.now());
    } catch (e) {
      toast.show({ message: "Failed to update role", type: "error" });
    }
  };

  return (
    <div className={cn("people").toClassName()}>
      <div className={cn("people").elem("controls").toClassName()}>
        <Space spread>
          <Space />

          <Space>
            {isFF(FF_AUTH_TOKENS) && (
              <Button look="outlined" onClick={showApiTokenSettingsModal} aria-label="Show API token settings">
                API Tokens Settings
              </Button>
            )}
            <Button
              leading={<IconPlus className="!h-4" />}
              onClick={() => setInvitationOpen(true)}
              aria-label="Invite new member"
            >
              Add Members
            </Button>
          </Space>
        </Space>
        {isOrgAdmin && (
          <div className={cn("people").elem("add-form").toClassName()}>
            <Space align="center" gap="small">
              <Input
                value={newUserId}
                placeholder="User ID"
                onChange={(e) => setNewUserId(e.target.value)}
                style={{ width: 160 }}
                aria-label="New member user ID"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                aria-label="New member role"
                className="ls-select"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                leading={<IconPlus className="!h-4" />}
                onClick={handleAddMember}
                aria-label="Add member by ID"
              >
                Add Member by ID
              </Button>
            </Space>
          </div>
        )}
      </div>
      <div className={cn("people").elem("content").toClassName()}>
        <PeopleList
          selectedUser={selectedUser}
          defaultSelected={defaultSelected}
          onSelect={(user) => selectUser(user)}
          reloadToken={reloadToken}
        />

        {selectedUser ? (
          <SelectedUser
            user={selectedUser}
            onClose={() => selectUser(null)}
            onRoleChange={(role) => handleRoleChange(selectedUser.id, role)}
            canManageRoles={isOrgAdmin}
            roleOptions={ROLE_OPTIONS}
          />
        ) : (
          isFF(FF_LSDV_E_297) && <HeidiTips collection="organizationPage" />
        )}
      </div>
      <InviteLink
        opened={invitationOpen}
        onClosed={() => {
          console.log("hidden");
          setInvitationOpen(false);
        }}
      />
    </div>
  );
};

PeoplePage.title = "People";
PeoplePage.path = "/";
