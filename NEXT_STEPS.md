# Next Steps

- Improve onboarding to first insight in under 2 minutes (demo data, quick scan of accounts). JN
- Define and surface north-star metrics (savings rate, net worth trend, cash-flow).
- Add fast editing flows: bulk recategorize, split transactions, undo.
- Add explainable insights (spending spikes, MoM changes, goal progress).
- Accessibility (WCAG AA), offline-tolerant views, locale/currency support.
- Goal automation rules (round-ups, allocate X% on paycheck).
- Cash-flow forecasting (30/60/90 days) with confidence bands.
- Recurring transaction detection with reminders.
- Data quality: dedupe, reconciliation, import normalization. JN
- Categorization model with user overrides and feedback loop.
- Data integrity checks (balances vs transactions) with confidence indicators.
- Security: session management, anomaly detection.
- Encryption at rest/in transit; secret rotation; least-privilege RBAC.
- Privacy controls: export, delete account, retention policy.
- Background jobs with retries and dead-letter queue.
- Rate limiting, circuit breakers, and graceful degradation.
- Migration strategy tested on large datasets.
- Performance targets (P95) for key routes and dashboards.
- Observability: structured logs with correlation IDs, tracing, metrics.
- SLOs/alerts for failed imports and auth spikes; audit logs.
- Compliance: terms/privacy, consent, GDPR/CCPA readiness.
- Bank-connection provider compliance requirements (if applicable).
- Competition “wow”: money coach, scenario simulations, summaries, shareable report.

Need to do on John's End (Backend API):

✅ Net worth dashboard with assets/liabilities and trend. // Next step: john needs to create the backend API endpint for this functionality

- Budgeting modes: envelope, zero-based, and category caps.

John's TODO

- Recent Activity implemetaion, combined info latest uploads and login information
- implement contact support email fields
- change password should requires 2FA

Atharva's TODO

- check footer section and make necessary changes (news and updates, careers, community, tax tips and guides, privacy policy, terms of use)

Testing Phase

Home Page

- Able to register/log in
- Add/edit/delete manual records

Upload Page

- Upload a document
- scan only
- save and scan
- able to edit scanned document
- download a previous document
- delete reciept only
- delete reciept and record

Records

- Add/edit/delete manual records for income and expenses
- custom category when adding record for other
- search by filter
- export to csv
- when deleting, chose between reciept only or reciept and record

about page

- read to make sure no grammar errors

profile page

- able to change personal data
- able to change avatar

Budgeting Page

- change cadence
- change period
- add unused to savings or reallocate to a specific category
- Create/retrieve/save a budget
- export to csv
- Delete Account

Reports Page

- change date range
- be able to identify total expense total income

help page

- send a message/email
- get answers to frequently asked questions

settings page

- switch to dark mode
- languages, "coming soon"
- able to change time zones
- able to change dashboard view
- save settings
- enable/disable 2-factor authentication
- change password
- delete account
- sign out of all deviced

footer

- be able to click and understand where each page goes
