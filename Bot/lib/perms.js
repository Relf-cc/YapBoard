/**
 * Is this person the server's owner or an admin (a role with Manage Server, or an admin flag in `perms`)?
 * Same rule as the site's checkManager (Site/src/lib/yapin.ts). Only an explicit `true` counts, and anything that
 * can't be checked means no.
 */
export async function isOwnerOrAdmin(bot, serverId, userId) {
  try {
    const server = await bot.server(serverId);
    if (server?.owner_id != null && String(server.owner_id) === String(userId)) return true;
    const [member, roles] = await Promise.all([bot.member(serverId, userId), bot.roles(serverId)]);
    const mine = new Set((member?.roles ?? []).map(String));
    return (roles ?? []).some((role) => {
      if (!mine.has(String(role.id))) return false;
      const perms = role.perms && typeof role.perms === 'object' ? role.perms : {};
      return role.manage_server === true || perms.administrator === true || perms.admin === true;
    });
  } catch {
    return false;
  }
}
