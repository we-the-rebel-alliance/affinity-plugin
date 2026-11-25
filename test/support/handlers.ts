/**
 * The handler table as the tests name it: the three methods this plugin declares have handlers, so a test may read
 * them directly instead of indexing a map that is typed as possibly missing them.
 */
import type { HandlerTable, MethodHandler } from "@we-the-rebel-alliance/plugin-contract/register"

/** The three handlers, by name. */
export type TestHandlers = Readonly<Record<"status" | "events_list" | "probe", MethodHandler>>

/** The table, named. */
export function named(table: HandlerTable): TestHandlers {
  return table as TestHandlers
}
