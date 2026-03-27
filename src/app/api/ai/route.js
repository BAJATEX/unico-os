function normalizeGeminiError(e) {
  const msg = String(e?.message || e || "");
  if (/model.*not found|404/i.test(msg)) {
    return "La inteligencia está usando un modelo no disponible. Revisa GEMINI_MODEL en Vercel.";
  }
  if (/api key|unauth|permission|denied|401|403/i.test(msg)) {
    return "La inteligencia no tiene permiso para responder en este momento.";
  }
  return "La inteligencia del panel no pudo completar la solicitud.";
}