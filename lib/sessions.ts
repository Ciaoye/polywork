// Keep question IDs stable when reusing a question, so historical answers match.
// Session selection and order are shared with the API in session-questions.json.
export const SESSION_1012 = "2026-10-12";
export function currentSession() {
  if (typeof window === "undefined") return "open";
  return /\/1012\/?$/.test(window.location.pathname) ? SESSION_1012 : "open";
}
export const publishedSnapshotUrl = "https://raw.githubusercontent.com/Ciaoye/polywork/live-data/snapshot.json";

export const publishedSignalUrl = "https://raw.githubusercontent.com/Ciaoye/polywork/live-data/signal.json";
