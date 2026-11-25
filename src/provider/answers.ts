/**
 * What Affinity's MCP tools answer, and nothing else. Only these functions know Affinity's field names, which are those
 * of Affinity's API v2, the API its MCP server calls:
 *
 * - `get_meetings`: a page `{ data: [Meeting], pagination: { nextUrl } }`, each meeting
 *   `{ id, title, startTime, createdAt, creator, organizer, attendeesPreview: { data: [Attendee], totalCount } }`, an
 *   attendee `{ emailAddress, person: { id, firstName, lastName, primaryEmailAddress } | null }`. The next page's
 *   cursor is the `cursor` query parameter of `nextUrl`, or a `nextCursor` beside it;
 * - `get_current_user`: `{ tenant: { id, name }, user: { id, firstName, lastName, emailAddress }, grant: { scopes } }`;
 * - `search_all_companies`: a page `{ data: [Company], pagination }`, a company `{ id, name, domain }`.
 *
 * Each reader takes the answer's structured output or its JSON text, at the top level or one level down, and returns
 * nothing rather than guess, so a shape this plugin does not read is unknown, never zero. Email addresses are read only
 * to tell whether the signed-in person took part in a meeting; none leaves this module. Affinity's meeting has no link,
 * so none is read. Affinity previews at most 100 attendees, so a person past the preview of a larger meeting, or invited
 * by an alias, is not matched to it.
 */
import { secretKinds } from "@we-the-rebel-alliance/plugin-contract/events"

/** The `list` input `events_list` takes for the companies snapshot. */
export const COMPANIES_LIST = "companies"
/** The list registry holds 50 items. The read asks Affinity for that many and returns no more. */
export const LIST_CAP = 50

/** An answer of one vendor tool: its structured output, its text, or both. */
export interface Answer {
  readonly output?: unknown
  readonly content?: unknown
}

/** A person Affinity names on a meeting: their Affinity person id, and their name when Affinity gives one. */
export interface MeetingPerson {
  readonly role: "organizer" | "creator" | "attendee"
  readonly id: string
  readonly name?: string
}

/** One meeting, as the source lists it. */
export interface MeetingFacts {
  /** Affinity's meeting id, digits. */
  readonly id: string
  readonly title?: string
  /** Epoch milliseconds: the meeting's start. */
  readonly time?: number
  /** Epoch milliseconds: when the meeting was added to Affinity, which can be after it started (a meeting logged late). */
  readonly created?: number
  /** The organizer, the creator and the attendees Affinity matched to a person record, in that order. */
  readonly people: readonly MeetingPerson[]
  /** Every email address on the meeting, lowercase: only to tell the signed-in person's meetings apart. */
  readonly emails: ReadonlySet<string>
}

/** A get_meetings page: its meetings, and the cursor of the next page when Affinity has one. */
export interface MeetingsPage {
  readonly meetings: readonly MeetingFacts[]
  readonly next?: string
}

/** Who is signed in to Affinity, from get_current_user. */
export interface CurrentUser {
  readonly tenant: string
  readonly tenantName?: string
  readonly userId: string
  readonly email: string
  readonly name?: string
  readonly scopes?: readonly string[]
}

/** One company, as the list shows it: Affinity's id, the name, and the primary domain when Affinity gives one. */
export interface CompanyFacts {
  readonly id: string
  readonly name: string
  readonly domain?: string
}

/** One row of the contract's `list` output. */
export interface CompanyItem {
  readonly id: string
  readonly text: string
  readonly note?: string
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The text of a tool result, or its output when that is already text. */
export function resultText(result: Answer): string {
  if (typeof result.output === "string") return result.output
  if (typeof result.content === "string") return result.content
  if (Array.isArray(result.content)) {
    return result.content.flatMap((part) => (record(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : [])).join("\n")
  }
  return ""
}

/** A text that holds a JSON value, parsed; undefined when it is anything else, Markdown included. */
function jsonText(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return undefined
  }
}

/**
 * The answer's JSON objects: its structured output, then its text parsed, each with the objects one level down. A
 * server may wrap its text as `{ "result": "<text>" }`: that text is read when it is JSON, never guessed at when it is not.
 */
function objects(result: Answer): Record<string, unknown>[] {
  const found: unknown[] = [result.output]
  found.push(jsonText(resultText(result)))
  for (const value of [...found]) {
    const wrapped = record(value) && typeof value.result === "string" ? jsonText(value.result) : undefined
    if (wrapped !== undefined) found.push(wrapped)
  }
  return found.filter(record).flatMap((value) => [value, ...Object.values(value).filter(record)])
}

/** The answer's top-level arrays, for a tool that answers a bare list. */
function lists(result: Answer): unknown[][] {
  const found: unknown[] = [result.output, jsonText(resultText(result))]
  return found.filter(Array.isArray)
}

const EMAIL = /^[^\s@/]+@[^\s@/]+$/
const DIGITS = /^[1-9][0-9]{0,18}$/
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/

const nonEmpty = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined)
const idOf = (value: unknown) => {
  const id = typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : nonEmpty(value)
  return id !== undefined && DIGITS.test(id) ? id : undefined
}
const emailOf = (value: unknown) => {
  const email = nonEmpty(value)?.toLowerCase()
  return email !== undefined && EMAIL.test(email) ? email : undefined
}
const timeOf = (value: unknown) => {
  const text = nonEmpty(value)
  if (text === undefined || !ISO_WITH_ZONE.test(text)) return undefined
  const time = Date.parse(text)
  return Number.isFinite(time) ? time : undefined
}
const nameOf = (first: unknown, last: unknown) => [nonEmpty(first), nonEmpty(last)].filter(Boolean).join(" ") || undefined

/** One attendee: its person, when Affinity matched one, and its email addresses. */
function attendee(value: unknown, role: MeetingPerson["role"], emails: Set<string>): MeetingPerson | undefined {
  if (!record(value)) return undefined
  const person = record(value.person) ? value.person : undefined
  for (const email of [value.emailAddress, person?.primaryEmailAddress, ...(Array.isArray(person?.emailAddresses) ? person.emailAddresses : [])]) {
    const address = emailOf(email)
    if (address) emails.add(address)
  }
  const id = idOf(person?.id)
  if (id === undefined) return undefined
  const name = nameOf(person?.firstName, person?.lastName)
  return { role, id, ...(name ? { name } : {}) }
}

function meetingFacts(value: unknown): MeetingFacts | undefined {
  if (!record(value)) return undefined
  const id = idOf(value.id)
  if (id === undefined) return undefined
  const emails = new Set<string>()
  const preview = record(value.attendeesPreview) ? value.attendeesPreview.data : value.attendees
  const people = [
    attendee(value.organizer, "organizer", emails),
    attendee(value.creator, "creator", emails),
    ...(Array.isArray(preview) ? preview.map((entry) => attendee(entry, "attendee", emails)) : [])
  ].filter((person): person is MeetingPerson => person !== undefined)
  const title = nonEmpty(value.title)
  const time = timeOf(value.startTime)
  const created = timeOf(value.createdAt)
  return { id, ...(title ? { title } : {}), ...(time === undefined ? {} : { time }), ...(created === undefined ? {} : { created }), people, emails }
}

/** The next page's cursor: `nextCursor`, or the `cursor` query parameter of `nextUrl`, in `pagination` or beside it. */
function nextCursor(page: Record<string, unknown>): string | undefined {
  const pagination = record(page.pagination) ? page.pagination : {}
  const direct = nonEmpty(pagination.nextCursor) ?? nonEmpty(page.nextCursor) ?? nonEmpty(page.next_cursor)
  if (direct) return direct
  const nextUrl = nonEmpty(pagination.nextUrl) ?? nonEmpty(page.nextUrl)
  if (!nextUrl) return undefined
  try {
    return nonEmpty(new URL(nextUrl).searchParams.get("cursor"))
  } catch {
    return undefined
  }
}

/** A get_meetings page; undefined when the answer holds no list of meetings at all, so it cannot be read. */
export function readMeetingsPage(result: Answer): MeetingsPage | undefined {
  for (const page of objects(result)) {
    const list = page.data ?? page.meetings
    if (!Array.isArray(list)) continue
    const next = nextCursor(page)
    return { meetings: list.flatMap((value) => meetingFacts(value) ?? []), ...(next ? { next } : {}) }
  }
  return undefined
}

/** Who is signed in, from get_current_user: the tenant, the user, their email for matching, and the grant's scopes. */
export function readCurrentUser(result: Answer): CurrentUser | undefined {
  for (const answer of objects(result)) {
    const tenant = record(answer.tenant) ? answer.tenant : undefined
    const user = record(answer.user) ? answer.user : undefined
    const tenantId = idOf(tenant?.id)
    const userId = idOf(user?.id)
    const email = emailOf(user?.emailAddress)
    if (tenantId === undefined || userId === undefined || email === undefined) continue
    const tenantName = nonEmpty(tenant?.name)
    const name = nameOf(user?.firstName, user?.lastName)
    const grant = record(answer.grant) ? answer.grant : undefined
    const scopes = Array.isArray(grant?.scopes) ? [...new Set(grant.scopes.flatMap((scope) => nonEmpty(scope) ?? []))] : undefined
    return {
      tenant: tenantId,
      ...(tenantName ? { tenantName } : {}),
      userId,
      email,
      ...(name ? { name } : {}),
      ...(scopes ? { scopes } : {})
    }
  }
  return undefined
}

/** A primary domain: no space, no address, and short enough for a note. Anything else is left out. */
const domainOf = (value: unknown) => {
  const domain = nonEmpty(value)
  return domain !== undefined && domain.length <= 200 && !/[\s@]/.test(domain) ? domain : undefined
}

function companyOf(value: unknown): CompanyFacts | undefined {
  if (!record(value)) return undefined
  const id = idOf(value.id)
  const name = nonEmpty(value.name)
  if (id === undefined || name === undefined) return undefined
  const domain = domainOf(value.domain)
  return { id, name, ...(domain === undefined ? {} : { domain }) }
}

/**
 * A `search_all_companies` page; undefined when the answer holds no list of companies at all, so it cannot be read.
 * An entry without an id or a name is skipped. An empty list is a page.
 */
export function readCompanies(result: Answer): CompanyFacts[] | undefined {
  for (const page of objects(result)) {
    const list = page.data ?? page.companies ?? page.items
    if (!Array.isArray(list)) continue
    return list.flatMap((value) => companyOf(value) ?? [])
  }
  for (const list of lists(result)) return list.flatMap((value) => companyOf(value) ?? [])
  return undefined
}

/** The most JSON bytes one list answer may take: the declared `maxBytes`, with room for the envelope. */
const LIST_BUDGET = 60_000
/** Control characters would escape to six bytes each in JSON and only make a title unreadable. */
const CONTROLS = /\p{Cc}/gu

/** Collapse whitespace and drop control characters, so a cut is a cut of text a person can read. */
const clean = (value: string) => value.replace(CONTROLS, " ").replace(/\s+/g, " ").trim()

/**
 * The contract's `list` items: id, name, and the domain as a note. A name or domain that holds a secret is left out,
 * screened whole and only then cut to the item's length, so a secret that straddles the cut cannot pass as a prefix.
 * Affinity's own order is kept, a repeated id is listed once, and items stop before the answer passes its byte budget.
 */
export function companyItems(companies: readonly CompanyFacts[]): CompanyItem[] {
  const items: CompanyItem[] = []
  const seen = new Set<string>()
  let bytes = 0
  for (const company of companies) {
    if (items.length >= LIST_CAP) break
    if (seen.has(company.id)) continue
    const name = clean(company.name)
    const domain = company.domain === undefined ? undefined : clean(company.domain)
    if (name === "" || secretKinds(name).length > 0 || (domain !== undefined && secretKinds(domain).length > 0)) continue
    const item: CompanyItem = { id: company.id, text: name.slice(0, 200), ...(domain === undefined || domain === "" ? {} : { note: domain.slice(0, 200) }) }
    const size = JSON.stringify(item).length + 1
    if (bytes + size > LIST_BUDGET) break
    bytes += size
    seen.add(company.id)
    items.push(item)
  }
  return items
}
