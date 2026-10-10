# Contacts belong to companies

When I look at a company I want to see who I know there.

## What it should do
- The contact form gets a "Company" field: pick from a searchable list of companies, or "No company".
- The contacts table shows each contact's company, linked to its page.
- A company's page lists its contacts.
- Deleting a company keeps its contacts; they just have no company any more. Say so in the delete question.

## Done when
- [ ] I can put a contact in a company and see them on the company's page.
- [ ] Deleting the company leaves the contact in place with no company.
- [ ] Tests: integration tests for linking and for deleting a company with contacts; a Playwright test that picks a
  company on the contact form.
- [ ] Tried in a browser

Depends on #<number of the issue "Companies">
