// src/lib/auditServer.js
export async function writeAudit(sb, payload) {
  try {
    const row = {
      org_id: payload.org_id || payload.organization_id || null,
      organization_id: payload.organization_id || payload.org_id || null,
      actor_email: payload.actor_email || null,
      actor_user_id: payload.actor_user_id || null,
      action: payload.action,
      entity: payload.entity || null,
      entity_id: payload.entity_id || null,
      summary: payload.summary || null,
      before: payload.before || null,
      after: payload.after || null,
      meta: payload.meta || null,
      ip: payload.ip || null,
      user_agent: payload.user_agent || null,
    };

    if (!row.organization_id || !row.action) return;

    await sb.from("audit_log").insert(row);
  } catch {
    // no romper flujo principal
  }
}