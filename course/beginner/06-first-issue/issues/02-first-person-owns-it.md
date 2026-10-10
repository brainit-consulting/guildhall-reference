# The first person to sign up owns the Guildhall

Guildhall is for my business only. The first account should be mine, as the owner, and nobody else should get in
unless I've added their email address.

## What it should do
- The first account ever created becomes the owner.
- After that, sign-up is refused unless the email is on the allowed list, with the message "Ask the owner to add your
  email in Settings."
- A `/settings` page only the owner can open, with "People who may sign up": add an email, see the list, remove one.
- Anyone else opening `/settings` is sent to `/home`.

## Done when
- [ ] The first account is the owner; a second sign-up with an unlisted email is refused with that message.
- [ ] After the owner adds an email in Settings, that person can sign up.
- [ ] Tests: integration tests for the owner rule and the allowed list; a Playwright test for adding an email in
  Settings.
- [ ] Tried in a browser

Depends on #<number of the issue "Sign-up and sign-in pages">
