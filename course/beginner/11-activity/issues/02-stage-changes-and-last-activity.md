# Stage changes and last activity

I want deals to remember when they were last touched, and every move between stages written down.

## What it should do
- Every stage change, from the board or the deal form, logs a "stage change" activity on the deal: "Moved from
  Contacted to Proposal".
- Each deal keeps a "last activity" date, updated whenever an activity is logged on the deal, its contact or its
  company.
- The deal page and the deals table show it ("Last activity: 3 days ago").

## Done when
- [ ] Moving a deal on the board shows "Moved from X to Y" on its timeline.
- [ ] Logging a call on a deal's contact updates the deal's last activity.
- [ ] Tests: integration tests for both rules.
- [ ] Tried in a browser

Depends on #<number of the issue "The activity log">
