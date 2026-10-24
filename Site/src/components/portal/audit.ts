const LABELS: Record<string, string> = {
  'report.dismiss': 'dismissed report',
  'report.action': 'actioned report',
  'report.reopen': 'reopened report',
  'server.hide': 'hid server',
  'server.remove': 'removed server',
  'server.restore': 'restored server',
  'server.verify': 'verified server',
  'server.officiate': 'made official:',
  'server.unbadge': 'removed checkmark from',
  'user.ban': 'banned user',
  'user.unban': 'unbanned user',
  'role.user': 'removed staff from',
  'role.staff': 'made staff:',
  'role.admin': 'made admin:',
};

export const auditLabel = (action: string) => LABELS[action] ?? action;
