# Sign-up and sign-in pages

People need to get into Guildhall. Give them a page to create an account and a page to sign in, and send them to a
simple Home page once they're in.

## What it should do
- `/signup`: name, email and password (at least 8 characters), and a "Create account" button.
- `/signin`: email and password, and a "Sign in" button. Each page links to the other.
- Mistakes are explained in plain words next to the form, for example "That email and password don't match."
- After signing up or signing in, go to `/home`, which says "Welcome, <name>." and needs you to be signed in.
- A "Sign out" button on Home that returns you to `/signin`.
- The welcome page at `/` gets "Sign in" and "Create account" links, and sends anyone already signed in to `/home`.
- Follow `DESIGN.md`.

## Done when
- [ ] I can create an account, sign out, and sign back in.
- [ ] Opening `/home` while signed out takes me to `/signin`.
- [ ] Tests: a Playwright test that signs up, signs out and signs in.
- [ ] Tried in a browser
