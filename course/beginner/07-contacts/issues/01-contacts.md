# Contacts

I need to keep the people I deal with in one place.

## What it should do
- A Contacts item in the menu, opening `/contacts`: a table of name, email, phone and job title, newest first.
- "Add contact": a form with name (required), email (checked that it looks like an email), phone, job title and
  notes.
- Clicking a name opens the contact's page with every field, an "Edit" button and a "Delete" button.
- Delete asks "Delete <name>? This can't be undone." first.
- With no contacts yet, the page says "No contacts yet. Add your first."

## Done when
- [ ] I can add, view, edit and delete a contact.
- [ ] Tests: integration tests for creating, updating and deleting a contact; a Playwright test that adds, edits and
  deletes one.
- [ ] Tried in a browser
