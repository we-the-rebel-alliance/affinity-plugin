/**
 * A fake Affinity MCP transport, faithful to the vendor's tool envelopes.
 *
 * The real handlers run over it: the provider lists tools from `ctx.tool.list()` and executes them, exactly as it does
 * over OpenCode's own executors. Each answer is Affinity's API v2 shape as its MCP server returns it: a page
 * `{ data, pagination }` with an opaque `cursor` in `pagination.nextUrl`, a whoami `{ tenant, user, grant }`, and a
 * companies page. Each call gets a request id, as the vendor's answer does, and a failure is an MCP `Tool.Error` whose
 * message carries that id. Every organisation, person, address, meeting and company is invented, and the two secrets
 * are assembled at runtime so no credential-shaped text is committed.
 */
import { Error as ToolError } from "@opencode/plugin/promise/tool"
import { toolAction } from "@we-the-rebel-alliance/plugin-contract/access"
import { serverName } from "../../src/accounts.ts"
import type { ProviderContext } from "../../src/provider/index.ts"

/** The clock every deterministic recording uses. */
export const NOW = Date.parse("2026-11-13T12:00:00.000Z")

/** A fake API key, assembled at runtime: the file itself holds no credential. */
const FAKE_KEY = `sk-${"conform"}${"ance4"}${"Kq7Tz"}${"2Lm9Rp"}${"4Vw8Bn"}${"3Cd6Fg"}`
/** A meeting title that holds the fake key, refused for a secret rather than listed. */
export const SECRET_TITLE = `Handover notes ${FAKE_KEY}`
/** A company whose name holds the fake key, left out of the list. */
export const SECRET_COMPANY = `Northwind ${FAKE_KEY}`

/** One alias's whoami answer: the shapes `get_current_user` returns. */
export function whoami(tenant: number, tenantName: string, user: number, first: string, last: string, email: string, scopes: readonly string[]) {
  return {
    tenant: { id: tenant, name: tenantName, subdomain: tenantName.toLowerCase().replaceAll(" ", "-") },
    user: { id: user, firstName: first, lastName: last, emailAddress: email },
    grant: { type: "access-token", scopes, createdAt: "2026-11-01T09:00:00Z" }
  }
}

/** The `work` alias: an example firm and the person signed in to it. */
export const WORK_USER = whoami(4821, "Example Ventures", 77, "Pilot", "Owner", "pilot.owner@example.com", ["mcp", "mcp.read", "offline_access"])
/** The `personal` alias: a second, read-only sign-in. */
export const PERSONAL_USER = whoami(9001, "Owner Family Office", 88, "Pilot", "Owner", "pilot@example.com", ["mcp.read"])

/** A person Affinity matched: an id and an address, and no name, so the recording carries no personal data. */
const person = (id: number, email: string) => ({ person: { id, primaryEmailAddress: email } })

/** The `work` meetings, in Affinity's answer shape. A colleague's meeting and a secret-bearing title are not listed. */
export const WORK_MEETINGS = [
  {
    id: 1000,
    title: "Quarterly LP update",
    startTime: "2026-11-03T10:00:00Z",
    endTime: "2026-11-03T11:00:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    createdAt: "2026-10-20T08:00:00Z",
    attendeesPreview: { data: [{ emailAddress: "kofi@example.test", ...person(501, "kofi@example.test") }], totalCount: 2 }
  },
  {
    id: 1001,
    title: "Intro: Northwind Robotics",
    startTime: "2026-11-12T09:00:00Z",
    endTime: "2026-11-12T09:30:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    createdAt: "2026-11-10T07:00:00Z",
    attendeesPreview: { data: [{ emailAddress: "ana@example.test", ...person(502, "ana@example.test") }], totalCount: 1 }
  },
  {
    id: 1002,
    title: "Board prep",
    startTime: "2026-11-12T16:00:00Z",
    endTime: "2026-11-12T17:00:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    createdAt: "2026-11-05T09:00:00Z",
    attendeesPreview: { data: [], totalCount: 0 }
  },
  {
    id: 1003,
    title: "A colleague's call",
    startTime: "2026-11-10T11:00:00Z",
    endTime: "2026-11-10T11:30:00Z",
    creator: null,
    organizer: { emailAddress: "dana@example.test", ...person(9002, "dana@example.test") },
    createdAt: "2026-11-02T09:00:00Z",
    attendeesPreview: { data: [{ emailAddress: "rowan@example.test", ...person(503, "rowan@example.test") }], totalCount: 2 }
  },
  {
    id: 1004,
    title: SECRET_TITLE,
    startTime: "2026-11-04T09:00:00Z",
    endTime: "2026-11-04T09:30:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    createdAt: "2026-10-25T09:00:00Z",
    attendeesPreview: { data: [], totalCount: 0 }
  },
  {
    id: 1005,
    title: "Stand-up",
    startTime: "2026-11-13T11:30:00Z",
    endTime: "2026-11-13T12:30:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    createdAt: "2026-11-12T09:00:00Z",
    attendeesPreview: { data: [], totalCount: 0 }
  },
  {
    id: 1006,
    title: "Next week's offsite",
    startTime: "2026-11-20T09:00:00Z",
    endTime: "2026-11-20T10:00:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    createdAt: "2026-11-11T09:00:00Z",
    attendeesPreview: { data: [], totalCount: 0 }
  },
  {
    id: 1007,
    title: "Call with Harbour LP",
    startTime: "2026-11-12T13:00:00Z",
    endTime: "2026-11-12T13:30:00Z",
    creator: null,
    organizer: { emailAddress: "pilot.owner@example.com", ...person(9001, "pilot.owner@example.com") },
    // Added to Affinity after `now` in the first listing: only a later listing sees it.
    createdAt: "2026-11-13T12:30:00Z",
    attendeesPreview: { data: [], totalCount: 0 }
  }
]

/** The `personal` alias's one meeting. */
export const PERSONAL_MEETINGS = [
  {
    id: 2000,
    title: "Weekend planning",
    startTime: "2026-11-11T18:00:00Z",
    endTime: "2026-11-11T18:30:00Z",
    creator: null,
    organizer: { emailAddress: "pilot@example.com", ...person(9003, "pilot@example.com") },
    createdAt: "2026-11-09T18:00:00Z",
    attendeesPreview: { data: [{ emailAddress: "rowan@example.test", ...person(503, "rowan@example.test") }], totalCount: 1 }
  }
]

/** The companies page `search_all_companies` answers: one secret-bearing name and one nameless entry are left out. */
export const COMPANIES = {
  data: [
    { id: 2001, name: "Northwind Robotics", domain: "northwind.example.test" },
    { id: 2002, name: "Harbour Capital", domain: "harbour.example.test" },
    { id: 2003, name: SECRET_COMPANY, domain: "secret.example.test" },
    { id: 2004, domain: "nameless.example.test" }
  ],
  pagination: { prevUrl: null, nextUrl: null }
}

/** How the fake answers: its page size, a failure for one tool, unreadable text, the clock, and the calls it saw. */
export interface FakeOptions {
  /** Meetings per page, below what the caller asks. */
  readonly pageSize?: number | undefined
  /** Affinity's own failure text for one tool, thrown as a `Tool.Error` without a cause. */
  readonly fail?: { readonly tool: string; readonly message: string } | undefined
  /** `get_meetings` answers this text instead of a page. */
  readonly unreadable?: string | undefined
  /** `search_all_companies` answers this text instead of a page. */
  readonly unreadableCompanies?: string | undefined
  /** `get_current_user` answers this text instead of the whoami. */
  readonly unreadableUser?: string | undefined
  /** The clock: a meeting added after it does not exist yet. */
  readonly now?: number | undefined
  /** Every call, in order: the alias, the vendor tool, its input, and the request id the answer carried. */
  readonly calls?: { readonly alias: string; readonly tool: string; readonly input: Record<string, unknown>; readonly requestId: string }[] | undefined
  /** The server state each alias reports; `connected` by default. */
  readonly state?: "connected" | "pending" | "needs_auth" | "failed" | "disabled" | "missing" | undefined
  /** The meetings each alias answers, in Affinity's shape; the built-in invented sets by default. */
  readonly meetings?: Readonly<Record<string, readonly Record<string, unknown>[]>> | undefined
}

/** One recorded call: the alias, the vendor tool, its input and the request id. */
export interface FakeCall {
  readonly alias: string
  readonly tool: string
  readonly input: Record<string, unknown>
  readonly requestId: string
}

/** What one provider call answered: the tool's result, as OpenCode's executor returns it. */
export interface FakeAnswer {
  readonly output: unknown
  readonly content?: readonly { readonly type: "text"; readonly text: string }[]
}

const MEETING_KEYS = /^(startTime|createdAt)(>=|<=|>|<)(\S+Z)$/

/** The meeting a filter's text keeps: Affinity's filter language, `a & b`, with disjuncts joined by ` | `. */
export function matcher(filter: unknown): (meeting: Record<string, unknown>) => boolean {
  const text = String(filter)
  const disjuncts = (text.includes(" | ") ? text.split(" | ").map((part) => /^\((.*)\)$/.exec(part)?.[1]) : [text]).map((part) =>
    part?.split(" & ").map((condition) => MEETING_KEYS.exec(condition))
  )
  if (disjuncts.some((conditions) => conditions === undefined || conditions.some((condition) => condition === null))) {
    throw new ToolError({ message: `Invalid filter_expr: ${text}` })
  }
  const holds = (value: number, op: string, bound: number) => (op === ">=" ? value >= bound : op === "<=" ? value <= bound : op === ">" ? value > bound : value < bound)
  return (meeting) => disjuncts.some((conditions) => conditions!.every((match) => holds(Date.parse(String(meeting[match![1]!])), match![2]!, Date.parse(match![3]!))))
}

/** A get_meetings answer: matching meetings, newest first as Affinity may answer, paged by an opaque cursor. */
function meetingsAnswer(meetings: readonly Record<string, unknown>[], input: Record<string, unknown>, options: FakeOptions): string {
  const passes = matcher(input["filter_expr"])
  const clock = options.now ?? NOW
  const matching = meetings.filter((meeting) => Date.parse(String(meeting["createdAt"])) <= clock && passes(meeting))
  matching.sort((left, right) => Date.parse(String(right["startTime"])) - Date.parse(String(left["startTime"])))
  const size = Math.min(Number(input["limit"] ?? 100), options.pageSize ?? 100)
  const offset =
    input["cursor"] === undefined
      ? 0
      : Number(
          Buffer.from(String(input["cursor"]), "base64url")
            .toString("utf8")
            .replace(/^after:/, "")
        )
  const data = matching.slice(offset, offset + size)
  const next = offset + size < matching.length ? Buffer.from(`after:${offset + size}`).toString("base64url") : undefined
  return JSON.stringify({ data, pagination: { prevUrl: null, nextUrl: next === undefined ? null : `https://api.affinity.co/v2/meetings?cursor=${next}&limit=${size}` } })
}

/** The two servers and the three tools the provider looks up. */
export function fakeContext(options: FakeOptions = {}): { readonly ctx: ProviderContext; readonly calls: FakeCall[] } {
  const calls: FakeCall[] = []
  const aliases = ["work", "personal"] as const
  const meetings: Record<string, readonly Record<string, unknown>[]> = options.meetings ?? { work: WORK_MEETINGS, personal: PERSONAL_MEETINGS }
  const users: Record<string, unknown> = { work: WORK_USER, personal: PERSONAL_USER }
  let requests = 0
  const answerOf = (alias: string, tool: string, input: Record<string, unknown>): string => {
    if (tool === "get_current_user") return options.unreadableUser ?? JSON.stringify(users[alias])
    if (tool === "get_meetings") return options.unreadable ?? meetingsAnswer(meetings[alias] ?? [], input, options)
    if (tool === "search_all_companies") return options.unreadableCompanies ?? JSON.stringify(COMPANIES)
    throw new ToolError({ message: `Affinity has no tool ${tool}` })
  }
  const tools = aliases.flatMap((alias) =>
    ["get_current_user", "get_meetings", "search_all_companies"].map((tool) => ({
      id: toolAction(serverName(alias), tool),
      async execute(input: unknown, _context: unknown): Promise<FakeAnswer> {
        requests++
        const requestId = `req_${String(requests).padStart(4, "0")}_${tool}`
        const held = (input ?? {}) as Record<string, unknown>
        calls.push({ alias, tool, input: held, requestId })
        if (options.fail?.tool === tool) throw new ToolError({ message: `${options.fail.message} (request ${requestId})` })
        const text = answerOf(alias, tool, held)
        const parsed = ((): unknown => {
          try {
            return JSON.parse(text) as unknown
          } catch {
            return text
          }
        })()
        return { output: parsed, content: [{ type: "text", text } as const] }
      }
    }))
  )
  const state = options.state ?? "connected"
  const ctx = {
    tool: { list: async () => tools },
    mcp: {
      list: async () => ({
        data:
          state === "missing"
            ? []
            : aliases.map((alias) => ({
                name: serverName(alias),
                status:
                  state === "failed" ? { status: state, error: "the server could not connect" } : state === "needs_auth" ? { status: state, error: "sign in" } : { status: state }
              }))
      })
    }
  }
  return { ctx: ctx as unknown as ProviderContext, calls }
}
