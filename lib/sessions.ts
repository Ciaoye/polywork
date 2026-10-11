// Keep question IDs stable when reusing a question, so historical answers match.
// Session selection and order are shared with the API in session-questions.json.
import enrollment from "../cloudbase-functions/polywork-event-api/home-enrollment.json";
import sessionQuestionIds from "../cloudbase-functions/polywork-event-api/session-questions.json";

export const SESSION_1012 = "2026-10-12";
export function submissionSession(questionId: string, pageSession = currentSession(), now = Date.now()) {
  return pageSession === "open" && now >= Date.parse(enrollment.startsAt) && now < Date.parse(enrollment.endsAt)
    && sessionQuestionIds[SESSION_1012].includes(questionId) ? enrollment.sessionId : pageSession;
}
export function currentSession() {
  if (typeof window === "undefined") return "open";
  return /\/1012\/?$/.test(window.location.pathname) ? SESSION_1012 : "open";
}
export const publishedSnapshotUrl = "https://raw.githubusercontent.com/Ciaoye/polywork/live-data/snapshot.json";

export const publishedSignalUrl = "https://raw.githubusercontent.com/Ciaoye/polywork/live-data/signal.json";
