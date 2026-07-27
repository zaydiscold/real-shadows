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

this is the step that ends the otp prompts for good. **do it from a real
terminal**, not from an agent or a script: the auth link it prints expires in a
couple of minutes, so it has to be approved while you are sitting there.

```bash
npm trust github real-shadows \
  --file release.yml \
  --repo zaydiscold/real-shadows \
  --allow-publish
```

needs npm 11.5.1 or later (`npm -v`). if the global npm is older and
`npm install -g npm@latest` fails on a file conflict, run it out of a throwaway
install instead:

```bash
mkdir -p /tmp/npm11 && cd /tmp/npm11 && npm i npm@latest
node /tmp/npm11/node_modules/npm/bin/npm-cli.js trust github real-shadows \
  --file release.yml --repo zaydiscold/real-shadows --allow-publish
```

it prints `Authenticate your account at: https://www.npmjs.com/auth/cli/<id>`.
open it, approve with the security key, and the command finishes on its own.
`npm trust list real-shadows` confirms it afterwards.

> the same thing can be done in the web ui at
> **npmjs.com/package/real-shadows/access** under *trusted publisher*:
> github actions / `zaydiscold` / `real-shadows` / `release.yml`, environment blank.

either way npm will then accept a publish that proves, cryptographically, that
it came from this repository running this workflow file. no token is created, so
there is nothing to leak, rotate, or forget. provenance attestation is
automatic, and npm shows the verified badge on the package page.

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
