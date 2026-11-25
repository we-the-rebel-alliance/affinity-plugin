/**
 * `events_list`: the meetings the signed-in person organised, created or attended, as contract events, and the
 * companies list snapshot on the same method (contract §7).
 *
 * `affinity.meetings` lists meetings: the meeting's id, start, title and the people Affinity matched to a person record
 * (their Affinity person id and name). It carries no notes, transcript, email address, phone number or relationship
 * score: `text` is always empty, `url` is null, and `labels` is empty, because Affinity's meetings carry none of them.
 * A meeting is listed once it started an hour ago. Affinity lists every meeting the person may see, colleagues'
 * included, and promises no order within a page, so a listing reads a slice of start times whole, sorts it, and keeps a
 * meeting only when the signed-in email is its organiser's, its creator's or one of the attendees Affinity previews.
 * That address stays in memory: it is what tells the person's own meetings apart, and no answer carries it.
 *
 * Two feeds share one cursor:
 *
 * - the main feed: meetings that started after the position, oldest first;
 * - the late feed: meetings that started within the read-back but were added to Affinity after an earlier listing
 *   passed them (logged late, a calendar connected later). Listings run in generations: a generation starts at a
 *   listing's clock G and owns the meetings added in [previous G − MARGIN, G − MARGIN), so each meeting belongs to
 *   exactly one generation and is listed once. The margin covers Affinity's index lag and clock skew up to MARGIN.
 *
 * Every call counts against the firm's shared monthly API quota, so a listing makes at most MAX_CALLS calls, a hard
 * budget: when it runs out, the page ends with what it listed, `more: true`, and a cursor that carries on. A slice that
 * takes more than ATTEMPT_PAGES pages is read again at half its span, so a backfill of thousands of meetings drains over
 * several listings at a bounded cost each. A normal listing is one call: the late feed's reach and the main feed's slice
 * share one filter. The page reports its calls in `cost`.
 *
 * The listing reads back READ_BACK_DAYS, by choice, to bound the quota: an older `since` starts there with `gap`
 * `window-truncated`, and a cursor older than EXPIRE_DAYS restarts there with `gap` `expired`, once. A meeting deleted
 * before a listing reaches it is never listed, and no gap says so.
 *
 * `affinity.companies` is a snapshot: the first page of the firm's companies as the registry's `list` output, from one
 * `search_all_companies` read. Its `data` is checked with the registry's own `checkOutput`, and an answer that breaks
 * the shape is refused rather than passed on.
 */

import { type CursorBinding, decodeBoundCursor, encodeBoundCursor } from "@we-the-rebel-alliance/plugin-contract/cursor"
import {
  EVENTS_LIST_INPUT_SCHEMA,
  type EventsGap,
  type EventsOwner,
  eventsListResult,
  fitPage,
  makeEvent,
  PAGE_SCHEMA,
  parseEventsListInput,
  type RefusedEvent,
  type SourceEvent,
  screenEvents,
  startTime
} from "@we-the-rebel-alliance/plugin-contract/events"
import { checkOutput } from "@we-the-rebel-alliance/plugin-contract/outputs"
import { type MethodCall, type MethodHandler, RegisterError, refusal } from "@we-the-rebel-alliance/plugin-contract/register"
import { PACKAGE } from "../manifest.ts"
import { COMPANIES_LIST, companyItems, LIST_CAP, type MeetingFacts, readCompanies, readCurrentUser, readMeetingsPage } from "../provider/answers.ts"
import type { Provider, ToolResult } from "../provider/index.ts"
import { ownerOf } from "./probe.ts"

/** The source id every event and both snapshots name. */
export const SOURCE = "affinity"
/** The most bytes of JSON one page holds: the descriptor's `maxBytes`. */
export const MAX_BYTES = 65_536
/** The cost unit the descriptor names: one Affinity call, against the firm's monthly quota. */
export const COST_UNIT = "call"

/** A meeting is listed once it started this long ago. */
export const SETTLE_MS = 3_600_000
const DAY_MS = 86_400_000
/** How far back a listing reads, by choice, to bound the quota. */
export const READ_BACK_DAYS = 90
/** A cursor older than this many days restarts at READ_BACK_DAYS; the margin keeps one restart from answering twice. */
export const EXPIRE_DAYS = 100
/** The index lag and clock skew the late feed absorbs: a generation owns what was added up to this long before it. */
export const MARGIN_MS = 10 * 60_000
/** The most calls one listing makes, whatever it finds: the cursor carries on from where it stopped. */
export const MAX_CALLS = 10
/** Pages one slice may take before it is read again at half its span. */
export const ATTEMPT_PAGES = 5
/** Meetings per get_meetings page: Affinity's most. */
const PAGE_SIZE = 100
/** The main feed's first span, and the late feed's widest: the late feed asks for its whole reach at once. */
const WEEK_MS = 7 * DAY_MS
const WIDEST_MS = 128 * DAY_MS
/** The narrowest slice: one second, Affinity's filter precision. */
const NARROWEST_MS = 1000
/**
 * A position past every meeting at its start time.
 *
 * A meeting's tie-breaker is its id as the exact digit string Affinity sent, and the order is the same string comparison
 * everywhere, so a string starting above `9` sorts after every id. The sentinel is never an id: the reader accepts only
 * digits, so no meeting can carry it.
 */
const AFTER_ALL = "~"
/** A position before every id at its start time: the empty string sorts before any digit string. */
const BEFORE_ALL = ""
/** How long a page's owner and matching address are kept, so a listing costs no identity call every time. */
export const IDENTITY_TTL_MS = 15 * 60_000

const fail = (code: "INPUT_INVALID" | "SOURCE_UNKNOWN" | "CURSOR_INVALID" | "UNAVAILABLE" | "SCHEMA_VIOLATION", message: string, next: string) =>
  new RegisterError(refusal(code, message, next))

/** What a caller reads in an answer: the page's identity. */
type Identity = { readonly account: string; readonly owner: EventsOwner; readonly email: string }

/** Who is signed in to one alias, kept for a bounded time so listings share one identity call. */
interface CachedIdentity extends Identity {
  readonly readAt: number
}

/** What the events handlers share: the provider, the clock, and the per-alias identity cache. */
export interface EventsParts {
  readonly provider: Provider
  /** The clock; tests fix it. */
  readonly now: () => number
}

/**
 * The page's input: the contract's own `events_list` schema, with the one selector this method adds.
 *
 * `list` chooses the source's events feed (the default) or its companies list snapshot. Everything else — `source`,
 * `cursor`, `since`, `limit`, `scope`, and the closed object — is the shared schema, spread here rather than copied.
 */
const INPUT = {
  ...EVENTS_LIST_INPUT_SCHEMA,
  properties: {
    ...((EVENTS_LIST_INPUT_SCHEMA["properties"] ?? {}) as Record<string, unknown>),
    list: { type: "string", enum: ["events", "companies"], description: 'Read the events feed (the default) or the companies list snapshot ("companies").' }
  }
}

/** The snapshot answer, as the registry's `list` output inside the contract's snapshot envelope. */
const SNAPSHOT_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: ["source", "account", "data", "asOf", "trust"],
  properties: {
    source: { type: "string", enum: [SOURCE] },
    account: { type: "string" },
    data: { type: "object" },
    asOf: { type: "string" },
    trust: { type: "string", enum: ["untrusted"] }
  }
} as const

/** events_list answers a page, or the snapshot. The snapshot's `data` is checked with the registry's own validator. */
const OUTPUT = { anyOf: [PAGE_SCHEMA, SNAPSHOT_OUTPUT] }

/** What a cursor is bound to: this plugin, its one source and the account. The snapshot carries no cursor. */
const bindingOf = (account: string): CursorBinding => ({ plugin: "affinity", source: SOURCE, account })

/**
 * (start, meeting id) as a string: the total order events are listed in, and each feed's position.
 *
 * The id is the exact string Affinity sent, never a number: two ids beyond `Number`'s safe range can collapse to one
 * number, and a tie-breaker that cannot tell them apart can repeat one and skip the other at a page boundary.
 */
interface Key {
  readonly t: number
  readonly i: string
}

type Dated = MeetingFacts & { readonly time: number }

const keyOf = (meeting: Dated): Key => ({ t: meeting.time, i: meeting.id })
const compare = (a: Key, b: Key) => {
  if (a.t !== b.t) return a.t - b.t
  return a.i < b.i ? -1 : a.i > b.i ? 1 : 0
}

/** Where a listing stands; the cursor holds all of it. */
interface State {
  /** The main feed's position: the last meeting listed, or the end of the last slice read. */
  pos: Key
  /** The late feed's generation: its start G (the listing's clock) and the previous generation's, W. */
  g: number
  w: number
  /** The generation's reach ends at the main position when it started, and has read up to `lp`. */
  le: Key
  lp: Key
  /** The span the next late and main slices take. */
  zl: number
  zm: number
}

const cursorInvalid = () =>
  fail(
    "CURSOR_INVALID",
    "The cursor was not issued by events_list for this account and source",
    "Pass a cursor from a previous result for the same account, or start again with since."
  )

const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
/** Whether a cursor's tie-breaker is one this listing writes: a digit id, or one of its two sentinels. */
const keyId = (value: unknown): value is string => typeof value === "string" && (value === BEFORE_ALL || value === AFTER_ALL || /^[0-9]+$/.test(value))
const pair = (value: unknown): Key | undefined => (Array.isArray(value) && value.length === 2 && whole(value[0]) && keyId(value[1]) ? { t: value[0], i: value[1] } : undefined)
const span = (value: unknown): value is number => whole(value) && value >= NARROWEST_MS && value <= WIDEST_MS

/** The state a cursor holds for `account`; anything that is not this source's bound cursor is CURSOR_INVALID. */
function stateOf(cursor: string, account: string): State {
  const decoded = decodeBoundCursor(bindingOf(account), cursor)
  if (!decoded.ok) throw cursorInvalid()
  const { state } = decoded
  const pos = pair([state["t"], state["i"]])
  const [le, lp] = [pair(state["e"]), pair(state["p"])]
  const [g, w, zl, zm] = [state["g"], state["w"], state["x"], state["y"]]
  if (state["l"] !== "meetings" || !pos || !le || !lp || !whole(g) || !whole(w) || !span(zl) || !span(zm)) throw cursorInvalid()
  return { pos, g, w, le, lp, zl, zm }
}

const encodeState = (account: string, state: State) =>
  encodeBoundCursor(bindingOf(account), {
    l: "meetings",
    t: state.pos.t,
    i: state.pos.i,
    g: state.g,
    w: state.w,
    e: [state.le.t, state.le.i],
    p: [state.lp.t, state.lp.i],
    x: state.zl,
    y: state.zm
  })

/** A fresh listing from `start`: no late reach yet, since nothing was listed before it. */
const fresh = (start: number, now: number): State => ({
  pos: { t: start, i: BEFORE_ALL },
  g: now,
  w: now,
  le: { t: start, i: BEFORE_ALL },
  lp: { t: start, i: BEFORE_ALL },
  zl: WIDEST_MS,
  zm: WEEK_MS
})

/** Seconds are as fine as Affinity's filter takes; a slice is widened to whole seconds and narrowed again here. */
const isoFloor = (time: number) => new Date(Math.floor(time / 1000) * 1000).toISOString().replace(".000Z", "Z")
const isoCeil = (time: number) => new Date(Math.ceil(time / 1000) * 1000).toISOString().replace(".000Z", "Z")

/** A listing's reads: the account, the calls made so far, and the signed-in email meetings are matched on. */
interface Listing {
  readonly account: string
  readonly email: string
  calls: number
}

/** True when the signed-in person organised, created or attended the meeting, as far as Affinity's preview shows. */
const isOwn = (listing: Listing, meeting: MeetingFacts) => meeting.emails.has(listing.email)

/** A slice of start times, (from, to], and for the late feed the earliest `createdAt` it asks for. */
interface Slice {
  readonly from: Key
  readonly to: Key
  readonly addedFrom?: number
}

const clause = (slice: Slice) =>
  `startTime>=${isoFloor(slice.from.t)} & startTime<=${isoCeil(slice.to.t)}${slice.addedFrom === undefined ? "" : ` & createdAt>=${isoFloor(slice.addedFrom)}`}`

/**
 * Every dated meeting of one or two slices (one filter, joined by `|`), from every page of `get_meetings`, or undefined
 * when they take more than `pages` pages.
 */
async function readSlices(provider: Provider, listing: Listing, slices: readonly Slice[], pages: number, call: MethodCall): Promise<Dated[] | undefined> {
  const filter = slices.length === 1 ? clause(slices[0]!) : slices.map((slice) => `(${clause(slice)})`).join(" | ")
  const found: Dated[] = []
  let cursor: string | undefined
  for (let page = 0; ; page++) {
    if (page >= pages) return undefined
    listing.calls++
    const result: ToolResult = await provider.call(listing.account, "get_meetings", { filter_expr: filter, limit: PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) }, call)
    const read = readMeetingsPage(result)
    if (read === undefined) {
      throw fail("UNAVAILABLE", "Affinity's get_meetings answered in a shape this plugin does not read", "Try again; if it keeps failing, report it with the plugin's version.")
    }
    for (const meeting of read.meetings) if (meeting.time !== undefined) found.push(meeting as Dated)
    if (read.next === undefined || read.next === cursor) return found
    cursor = read.next
  }
}

const inSlice = (meeting: Dated, slice: Slice) => compare(keyOf(meeting), slice.from) > 0 && compare(keyOf(meeting), slice.to) <= 0

const actorsOf = (meeting: MeetingFacts) =>
  meeting.people.map((person) => ({ role: person.role, id: `affinity:person/${person.id}`, ...(person.name ? { name: person.name } : {}) }))

function toEvent(account: string, meeting: Dated): SourceEvent {
  return makeEvent({
    source: SOURCE,
    account,
    external_id: meeting.id,
    kind: "meeting",
    occurred_at: meeting.time,
    thread: null,
    actors: actorsOf(meeting),
    title: meeting.title ?? "",
    text: "",
    url: null,
    labels: []
  })
}

/** The identity of one alias, from the cache while it is fresh, else one `get_current_user` call. */
async function identityOf(
  parts: EventsParts,
  account: string,
  cache: Map<string, CachedIdentity>,
  call: MethodCall
): Promise<{ readonly identity: Identity; readonly calls: number }> {
  const now = parts.now()
  const held = cache.get(account)
  if (held !== undefined && now - held.readAt < IDENTITY_TTL_MS) return { identity: held, calls: 0 }
  const answer = await parts.provider.call(account, "get_current_user", {}, call)
  const user = readCurrentUser(answer)
  if (user === undefined) {
    throw fail(
      "UNAVAILABLE",
      "Affinity's get_current_user did not name the organisation, the signed-in user and their address",
      "Try again; if it keeps failing, check the plugin's status."
    )
  }
  const identity: CachedIdentity = { account, owner: ownerOf(user), email: user.email, readAt: now }
  cache.set(account, identity)
  return { identity, calls: 1 }
}

/**
 * One page of events for the account the call resolves to. The input and the cursor are checked before any read.
 */
async function listEvents(parts: EventsParts, cache: Map<string, CachedIdentity>, input: Readonly<Record<string, unknown>>, call: MethodCall): Promise<unknown> {
  const parsed = parseEventsListInput(input)
  if (!parsed.ok) throw fail("INPUT_INVALID", `The events_list input is invalid: ${parsed.problems.join("; ")}`, "Pass only source, since, cursor and limit.")
  const request = parsed.value
  if (request.source !== undefined && request.source !== SOURCE) throw fail("SOURCE_UNKNOWN", "This plugin lists one source, affinity", 'Leave source out, or pass "affinity".')
  const account = call.account
  const now = parts.now()
  // The cursor carries the filter: its position is the last (start, id) this read listed, so a continuation resumes
  // strictly after it and never restarts at `since`. A caller's `since` on a cursor call is ignored, as the contract says.
  const given = request.cursor === undefined ? undefined : stateOf(request.cursor, account)

  // Where this listing starts: the cursor's state, or since; never before the read-back, and a page that starts at the
  // read-back instead says so with a gap, once.
  const horizon = now - READ_BACK_DAYS * DAY_MS
  let state: State
  let gap: EventsGap | undefined
  if (given !== undefined && given.pos.t < now - EXPIRE_DAYS * DAY_MS) {
    state = fresh(horizon, now)
    gap = { reason: "expired", since: new Date(horizon).toISOString() }
  } else if (given !== undefined) {
    state = { ...given }
    // A finished generation hands over: the next one reaches over the whole read-back, up to the main position, for
    // what was added since the last one started.
    if (compare(state.lp, state.le) >= 0) state = { ...state, w: state.g, g: now, le: state.pos, lp: { t: horizon, i: BEFORE_ALL } }
  } else {
    const start = startTime(request, now)
    state = fresh(Math.max(start, horizon), now)
    if (start < horizon) gap = { reason: "window-truncated", since: new Date(horizon).toISOString() }
  }

  const read = await identityOf(parts, account, cache, call)
  const identity = read.identity
  const end = now - SETTLE_MS
  // A meeting added at or after `owned` belongs to the next generation; the late feed asks from `addedFrom`.
  const owned = state.g - MARGIN_MS
  const addedFrom = state.w - MARGIN_MS
  const listing: Listing = { account, email: identity.email, calls: 0 }
  const page: SourceEvent[] = []
  const refused: RefusedEvent[] = []
  let stopped = false
  let joined = true

  const latePending = () => compare(state.lp, state.le) < 0
  const mainPending = () => state.pos.t < end
  const lateSlice = (): Slice => {
    const to = Math.min(state.lp.t + state.zl, state.le.t)
    return { from: state.lp, to: to >= state.le.t ? state.le : { t: to, i: AFTER_ALL }, addedFrom }
  }
  const mainSlice = (): Slice => ({ from: state.pos, to: { t: Math.min(state.pos.t + state.zm, end), i: AFTER_ALL } })

  /**
   * Lists a slice's candidates, sorted, as far as the page holds them; moves the feed's position past what it listed,
   * or past the whole slice. Returns false when the page is full.
   */
  const take = (candidates: Dated[], slice: Slice, move: (key: Key) => void): boolean => {
    const sorted = candidates.sort((a, b) => compare(keyOf(a), keyOf(b)))
    const screened = screenEvents(sorted.map((meeting) => toEvent(account, meeting)))
    const fits = Math.max(0, fitPage([...page, ...screened.events], request.limit, MAX_BYTES) - page.length)
    if (fits >= screened.events.length) {
      page.push(...screened.events)
      refused.push(...screened.refused)
      move(slice.to)
      return true
    }
    // The page is full: the feed stops after the last meeting listed, and a refused one before it is passed too.
    const keyById = new Map(sorted.map((meeting) => [meeting.id, keyOf(meeting)]))
    const firstLeft = keyById.get(screened.events[fits]!.external_id)!
    page.push(...screened.events.slice(0, fits))
    refused.push(...screened.refused.filter((entry) => compare(keyById.get(entry.external_id)!, firstLeft) < 0))
    const passed = sorted.filter((meeting) => compare(keyOf(meeting), firstLeft) < 0).at(-1)
    if (passed !== undefined) move(keyOf(passed))
    return false
  }

  while (!stopped && listing.calls < MAX_CALLS && page.length < request.limit && (latePending() || mainPending())) {
    call.signal.throwIfAborted()
    const left = MAX_CALLS - listing.calls
    // A main slice narrowed to one second goes first, with the whole budget.
    const late = latePending() && !(mainPending() && state.zm <= NARROWEST_MS) ? lateSlice() : undefined
    // The late reach shares its call with the main feed's slice while it is read whole at its widest: a normal listing
    // is one call. After a backfill it is read apart until its span has grown back.
    const main = (late === undefined || (late.to === state.le && joined && state.zl >= WIDEST_MS && state.zm >= WEEK_MS)) && mainPending() ? mainSlice() : undefined
    const slices = [late, main].filter((slice): slice is Slice => slice !== undefined)
    const narrowest = slices.length === 1 && slices[0]!.to.t - slices[0]!.from.t <= NARROWEST_MS
    const pages = narrowest ? left : Math.min(ATTEMPT_PAGES, left)
    const meetings = await readSlices(parts.provider, listing, slices, pages, call)
    if (meetings === undefined) {
      // Out of budget before the slice was read whole: the next listing tries it again.
      if (pages < ATTEMPT_PAGES && !narrowest) break
      if (narrowest) {
        if (pages < MAX_CALLS) break
        throw fail(
          "UNAVAILABLE",
          `Affinity lists more than ${MAX_CALLS * PAGE_SIZE} meetings that start in one second, which events_list cannot read whole`,
          "Call events_list again later with the same cursor."
        )
      }
      // Too many meetings in the slice: read the feeds apart (the main feed narrower), then a slice at half its span.
      if (slices.length === 2) {
        joined = false
        state.zm = Math.max(NARROWEST_MS, Math.floor(state.zm / 2))
      } else if (late !== undefined) state.zl = Math.max(NARROWEST_MS, Math.floor(state.zl / 2))
      else state.zm = Math.max(NARROWEST_MS, Math.floor(state.zm / 2))
      continue
    }
    const roomy = meetings.length <= PAGE_SIZE * 2
    if (late !== undefined) {
      const candidates = meetings.filter(
        (meeting) => inSlice(meeting, late) && isOwn(listing, meeting) && meeting.created !== undefined && meeting.created >= addedFrom && meeting.created < owned
      )
      stopped = !take(candidates, late, (key) => (state.lp = key))
      if (roomy && slices.length === 1) state.zl = Math.min(WIDEST_MS, state.zl * 2)
    }
    if (main !== undefined && !stopped) {
      // A meeting added in this generation's margin is left to the next generation's late feed.
      const candidates = meetings.filter(
        (meeting) => inSlice(meeting, main) && meeting.time <= end && isOwn(listing, meeting) && (meeting.created === undefined || meeting.created < owned)
      )
      stopped = !take(candidates, main, (key) => (state.pos = key))
      if (roomy) state.zm = Math.min(WIDEST_MS, state.zm * 2)
    }
  }

  const more = stopped || latePending() || mainPending()
  return eventsListResult({ source: SOURCE, account, owner: identity.owner }, page, encodeState(account, state), more, {
    refused,
    ...(gap === undefined ? {} : { gap }),
    cost: { units: [{ per: COST_UNIT, count: listing.calls + read.calls }] },
    plugin: PACKAGE,
    asOf: new Date(now).toISOString()
  })
}

/**
 * The companies list snapshot: the first page of the firm's companies, as the registry's `list` output, from one
 * `search_all_companies` read. Not editable. A company whose name or domain holds a secret is left out.
 */
async function companiesSnapshot(parts: EventsParts, input: Readonly<Record<string, unknown>>, call: MethodCall): Promise<unknown> {
  if (input["list"] !== COMPANIES_LIST)
    throw fail("SOURCE_UNKNOWN", `A list read names "${COMPANIES_LIST}", not "${String(input["list"] ?? "")}"`, `Pass "list" as "${COMPANIES_LIST}".`)
  if (input["source"] !== undefined && input["source"] !== SOURCE) throw fail("SOURCE_UNKNOWN", "This plugin reads one source, affinity", 'Leave source out, or pass "affinity".')
  for (const key of ["since", "cursor", "limit"]) {
    if (input[key] !== undefined) throw fail("INPUT_INVALID", `A list snapshot does not take ${key}`, "Pass source and list only.")
  }
  const result = await parts.provider.call(call.account, "search_all_companies", { limit: LIST_CAP }, call)
  const companies = readCompanies(result)
  if (companies === undefined)
    throw fail("UNAVAILABLE", "Affinity's search_all_companies did not answer with a list of companies", "Try again; if it keeps failing, check the plugin's status.")
  const data = { items: companyItems(companies), editable: false }
  const checked = checkOutput("list", data)
  if (!checked.ok) {
    throw fail(
      "SCHEMA_VIOLATION",
      `the companies list does not keep the contract's list shape: ${checked.problems.slice(0, 3).join("; ")}`,
      "Report it to the plugin's maintainers."
    )
  }
  return {
    source: SOURCE,
    account: call.account,
    data,
    asOf: new Date(parts.now()).toISOString(),
    cost: { units: [{ per: COST_UNIT, count: 1 }] },
    trust: "untrusted" as const
  }
}

/** The `events_list` handler. */
export function eventsHandler(parts: EventsParts): MethodHandler {
  const cache = new Map<string, CachedIdentity>()
  return {
    description:
      "List the Affinity meetings the signed-in person organised, created or attended since a cursor, oldest first, each with its start, title and the people Affinity matched to a person record; no notes, addresses or scores. Pass list companies for the firm's companies as a list snapshot. Each call shares the firm's monthly API quota.",
    input: INPUT,
    output: OUTPUT,
    async run(input, call) {
      const list = input["list"]
      if (list === COMPANIES_LIST) return companiesSnapshot(parts, input, call)
      if (list !== undefined && list !== "events") {
        throw fail("SOURCE_UNKNOWN", `A list read names "${COMPANIES_LIST}", not "${String(list)}"`, `Pass "list" as "${COMPANIES_LIST}", or leave it out for the events feed.`)
      }
      const { list: _list, ...rest } = input
      return listEvents(parts, cache, rest, call)
    }
  }
}
