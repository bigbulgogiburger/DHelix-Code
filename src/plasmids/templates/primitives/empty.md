---
id: ${id}
name: ${name}
description: ${description}
version: ${version}
tier: L1
scope: ${scope}
privacy: ${privacy}
locale: ${locale}
created: ${created}
updated: ${updated}
template: empty
---

# ${name}

${description}

This plasmid defines a single atomic rule. Replace this body with your own
concrete rule before activating. The frontmatter above is interpolated by the
generator; the body is what the runtime compiler reads.

## Rule

TODO — describe one concrete, testable rule in 1–3 sentences.

## Eval cases

- id: baseline-noop
  description: the empty template itself must parse and activate.
  input: ""
  expectations:
    - contains:

- id: body-not-empty
  description: authors must replace the placeholder before activation.
  input: "TODO"
  expectations:
    - not-contains:TODO
