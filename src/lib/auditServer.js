// src/lib/auditServer.js

function trimText(value, max = 1200) {
  if (value == null) return null;
  return String(value).trim().slice(0, max) || null;
}

function safeJson(value) {
  if (value == null) return null;

  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  return null;
}

export async function writeAudit(sb, payload = {}) {
  try {
    if (!sb?.from) return;

    const organization_id = String(
      payload.organization_id || payload.org_id || ""
    ).trim();
    const action = trimText(payload.action, 120);
    if (!organization_id || !action) return;

    const row = {
      organization_id,
      org_id: organization_id,
      actor_email: trimText(payload.actor_email, 320),
      actor_user_id: payload.actor_user_id || null,
      action,
      entity: trimText(payload.entity, 120),
      entity_id: trimText(payload.entity_id, 200),
      summary: trimText(payload.summary, 1200),
      before: safeJson(payload.before),
      after: safeJson(payload.after),
      meta: safeJson(payload.meta),
      ip: trimText(payload.ip, 120),
      user_agent: trimText(payload.user_agent, 500),
    };

    const { error } = await sb.from("audit_log").insert(row);
    if (error) {
      console.error("audit insert failed:", error.message || error);
    }
  } catch (error) {
    console.error("writeAudit failed:", error?.message || error);
  }
}