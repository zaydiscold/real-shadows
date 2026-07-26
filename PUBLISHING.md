# publishing

how this package gets to npm. written down because the first release and every
release after it work differently, and that difference is not obvious.

## the short version

| what | command |
|---|---|
| first ever publish | `npm publish` (needs an otp; done once, for 1.0.0) |
| every release after | `npm version patch` then `git push --follow-tags` |

## why the first one is special

npm's trusted publishing (OIDC) is configured **per package**, on the package's
own settings page. that page does not exist until the package does, so the
first version cannot be published by CI. see [npm/cli#8544][issue].

this account also runs two-factor at the `auth-and-writes` level, so a manual
publish asks for a one-time code from an authenticator app. that is the whole
reason 1.0.0 went out by hand.

```bash
npm login          # once per machine
npm publish        # prompts for the otp
```

[issue]: https://github.com/npm/cli/issues/8544

## after 1.0.0: wire up trusted publishing, once

on npmjs.com, at **npmjs.com/package/real-shadows/access**, under
*trusted publisher*:

| field | value |
|---|---|
| publisher | github actions |
| organization or user | `zaydiscold` |
| repository | `real-shadows` |
| workflow filename | `release.yml` |
| environment | leave blank |

that tells npm to accept a publish that proves, cryptographically, that it came
from this repository running this workflow file. no token is created, so there
is no token to leak, rotate, or forget. provenance attestation is automatic, and
npm shows the verified badge on the package page.

## every release after that

```bash
npm version patch      # or minor / major. bumps package.json, commits, tags
git push --follow-tags
```

the tag push triggers `.github/workflows/release.yml`, which runs typecheck,
the full test suite (including the accuracy oracle against astronomy-engine),
the build, `publint`, and `arethetypeswrong` before it publishes. a failure at
any step means nothing reaches npm.

update `CHANGELOG.md` before tagging. the version in the tag and the version in
`package.json` must match, which `npm version` guarantees by doing both.

## checking a release went out clean

```bash
npm view real-shadows                    # version, dist-tags, files
npm view real-shadows dist.attestations  # provenance present?
npx publint real-shadows                 # package shape, as published
```

the demo redeploys separately, on every push to `main`, via
`.github/workflows/pages.yml`.
