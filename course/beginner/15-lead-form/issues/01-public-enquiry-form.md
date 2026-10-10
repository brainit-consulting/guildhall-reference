# The public enquiry form

People who find my website should be able to ask for a quote, and land straight in my pipeline.

## What it should do
- A public page `/enquire` (no sign-in) in Guildhall's look, with my business name: name, email, phone, company and
  "What do you need?", and a "Send" button.
- Sending it:
  - finds the contact with that email, or creates one (and the company, if given and new);
  - creates a New deal "Enquiry from <name>" with source "Web form";
  - logs the message as a note on the deal.
- Then a thank-you page: "Thanks, <name>. We'll be in touch."
- A hidden field that people don't see and bots fill in; when it's filled, show the thank-you page but save nothing.
- At most 5 enquiries per email address per day; after that, show the thank-you page and save nothing.

## Done when
- [ ] Sending the form while signed out creates the contact, the New deal and the note.
- [ ] Sending again with the same email reuses the contact.
- [ ] Tests: integration tests for both, the hidden field and the daily limit; a Playwright test that sends the form.
- [ ] Tried in a browser
