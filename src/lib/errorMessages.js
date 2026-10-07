/**
 * Maps an ApiError onto something a person can act on.
 *
 * The client already strips SQL, stacks and adapter internals; this maps the
 * remaining codes so a user never sees a raw code or an internal sentence.
 */
const MESSAGES = {
  LIST_NAME_EXISTS: "A list with this name already exists.",
  LIST_NOT_FOUND: "That list no longer exists.",
  TASK_NOT_FOUND: "That task no longer exists.",
  CHECKLIST_ITEM_NOT_FOUND: "That checklist item no longer exists.",
  INBOX_IMMUTABLE: "Inbox cannot be modified.",

  NETWORK_ERROR: "Unable to reach the server. Please try again.",
  TIMEOUT: "Unable to reach the server. Please try again.",
  ABORTED: "Unable to reach the server. Please try again.",

  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  UNIQUE_VIOLATION: "That value is already in use.",
  FOREIGN_KEY_VIOLATION: "That item is still in use elsewhere.",
  DB_UNAVAILABLE: "The server is temporarily unavailable. Please try again.",
};

const NETWORK_FALLBACK = "Unable to reach the server. Please try again.";
const UNKNOWN_FALLBACK = "Something went wrong. Please try again.";

export function userMessageFor(error) {
  const code = error && typeof error === "object" ? error.code : undefined;

  if (typeof code === "string" && MESSAGES[code]) {
    return MESSAGES[code];
  }

  // Transport failures surface with status 0, sometimes without a code.
  if (error && typeof error === "object" && error.status === 0) {
    return NETWORK_FALLBACK;
  }

  return UNKNOWN_FALLBACK;
}
