/**
 * Builds the query object for GET /tasks. Pure: it never filters or sorts
 * task objects itself — the server owns those semantics.
 */
export function buildTaskQuery({ listId, completed, q, sort } = {}) {
  const query = {};
  const trimmedQ = typeof q === "string" ? q.trim() : "";

  if (trimmedQ) {
    // Search is global across lists, so list scoping is deliberately dropped
    // while a query is active — the same rule the client applied locally.
    query.q = trimmedQ;
  } else if (listId) {
    query.listId = listId;
  }

  // `false` is meaningful, so this must not be a truthiness check.
  if (completed !== undefined && completed !== null) {
    query.completed = completed;
  }

  if (sort) {
    query.sort = sort;
  }

  return query;
}
