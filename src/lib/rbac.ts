export type Role = 'admin' | 'editor' | 'viewer';
export type Capability =
  | 'read_dashboard'
  | 'write_ops'
  | 'approve_automations'
  | 'chat_send'
  | 'manage_users'
  | 'view_audit'
  | 'manage_system';

export const CAPABILITY_DEFINITIONS: { key: Capability; label: string }[] = [
  { key: 'read_dashboard', label: 'Read dashboards' },
  { key: 'write_ops', label: 'CRM, content, sequences write' },
  { key: 'approve_automations', label: 'Automations approval' },
  { key: 'chat_send', label: 'Chat send' },
  { key: 'manage_users', label: 'Manage users & login requests' },
  { key: 'view_audit', label: 'Audit log access' },
  { key: 'manage_system', label: 'Sync, cron, memory policy' },
];

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: CAPABILITY_DEFINITIONS.map(c => c.key),
  editor: ['read_dashboard', 'write_ops', 'approve_automations', 'chat_send'],
  viewer: ['read_dashboard'],
};

export function roleHasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function getRoleMatrix() {
  return {
    roles: ['admin', 'editor', 'viewer'] as Role[],
    capabilities: CAPABILITY_DEFINITIONS,
    roleCapabilities: ROLE_CAPABILITIES,
  };
}

