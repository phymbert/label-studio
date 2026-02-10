import { format } from "date-fns";
import { NavLink } from "react-router-dom";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button } from "@humansignal/ui";
import { cn } from "../../../utils/bem";
import "./SelectedUser.scss";
import { useEffect, useState } from "react";

const UserProjectsLinks = ({ projects }) => {
  return (
    <div className={cn("user-info").elem("links-list").toClassName()}>
      {projects.map((project) => (
        <NavLink
          className={cn("user-info").elem("project-link").toClassName()}
          key={`project-${project.id}`}
          to={`/projects/${project.id}`}
          data-external
        >
          {project.title}
        </NavLink>
      ))}
    </div>
  );
};

export const SelectedUser = ({ user, onClose, onRoleChange, canManageRoles, roleOptions }) => {
  const fullName = [user.first_name, user.last_name]
    .filter((n) => !!n)
    .join(" ")
    .trim();
  const [role, setRole] = useState(user.role ?? "RO");
  const roleLabel = (() => {
    switch (role) {
      case "OW":
        return "Owner";
      case "AD":
        return "Administrator";
      case "AN":
        return "Annotator";
      case "RE":
        return "Reviewer";
      case "RO":
        return "Read only";
      case "NO":
        return "Not activated";
      case "DI":
        return "Deactivated";
      default:
        return "Member";
    }
  })();

  useEffect(() => {
    setRole(user.role ?? "RO");
  }, [user.role]);

  return (
    <div className={cn("user-info").toClassName()}>
      <Button
        look="string"
        onClick={onClose}
        className="absolute top-[20px] right-[24px]"
        aria-label="Close user details"
      >
        <IconCross />
      </Button>

      <div className={cn("user-info").elem("header").toClassName()}>
        <Userpic user={user} style={{ width: 64, height: 64, fontSize: 28 }} />
        <div className={cn("user-info").elem("info-wrapper").toClassName()}>
          {fullName && <div className={cn("user-info").elem("full-name").toClassName()}>{fullName}</div>}
          <p className={cn("user-info").elem("email").toClassName()}>{user.email}</p>
          <div className={cn("user-info").elem("role").toClassName()} aria-label="User role">
            {roleLabel}
          </div>
          {canManageRoles && (
            <div className={cn("user-info").elem("role-editor").toClassName()}>
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Change user role">
                {roleOptions?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                size="small"
                onClick={() => onRoleChange?.(role)}
                aria-label="Save user role"
                className="ml-2"
              >
                Save role
              </Button>
            </div>
          )}
        </div>
      </div>

      {user.phone && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <a href={`tel:${user.phone}`}>{user.phone}</a>
        </div>
      )}

      {!!user.created_projects.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>Created Projects</div>

          <UserProjectsLinks projects={user.created_projects} />
        </div>
      )}

      {!!user.contributed_to_projects.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>Contributed to</div>

          <UserProjectsLinks projects={user.contributed_to_projects} />
        </div>
      )}

      <p className={cn("user-info").elem("last-active").toClassName()}>
        Last activity on: {format(new Date(user.last_activity), "dd MMM yyyy, KK:mm a")}
      </p>
    </div>
  );
};
