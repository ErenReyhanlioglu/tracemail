# ADR-0028: Exclude Account-Security Mail by Subject

**Date:** 2026-10-09
**Status:** Accepted

## Context

ADR-0025 keeps every message in the job-search mailbox except mail from
excluded senders. A scan of the 705 stored messages (2026-10-09; subjects read
in session only) found three account-security messages from application
systems: an address-verification request, a one-time passcode, and a
one-time password. They come from the same addresses as those systems'
application mail, so excluding the sender would also drop confirmations and
replies. The codes had expired, but a credential-like message in write-once
storage is exactly what the privacy rules exist to prevent, and every new
application-system account sends one.

## Decision

- The exclusion file gets a `subjects` list. A message whose subject
  contains one of its patterns is excluded like an excluded sender: never
  downloaded beyond its headers, never written, never logged beyond a count.
  The subject is fetched with the other headers; it is never logged.
- Matching ignores case, with Turkish dotted and dotless i folded together
  ("TEK KULLANIMLIK ŞİFRE" matches "tek kullanımlık şifre"; plain
  case-folding would not).
- The initial patterns cover one-time codes, address verification, and
  password resets, in English and Turkish. On the 705 stored messages they
  match exactly the three security messages and nothing else (verified).
- The three stored messages are removed with ADR-0025's manual purge
  procedure.

## Rationale

Alternatives considered:

1. **Exclude the application systems' sender addresses.** Rejected: drops
   their application confirmations and replies.
2. **Accept expired codes in storage.** Rejected: the privacy rule is about
   what is stored, not whether it is still usable; new codes keep arriving.
3. **Detect security mail from the body.** Rejected: needs the body, which
   would then already have been downloaded.

## Consequences

**Positive:**

- Credential-like mail stays out of storage without losing application mail.
- Patterns depend on a few stable phrases, not on which companies the owner
  applies to.

**Negative / trade-offs:**

- A security message with an unfamiliar subject still gets through; the
  purge procedure remains the remedy, and its pattern is then added.
- A pattern that is too broad could exclude application mail; patterns are
  checked against stored mail before they are added.
