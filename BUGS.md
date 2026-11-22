# MeFit release QA

Production was checked at mefit-fitness-planner.vercel.app. The candidate was checked at mefit-fitness-planner-8h1r8w0i1-sukumar9.vercel.app, commit `52ef08a`. Verification status applies to the environment named in each row.

| ID | Severity | Area | Steps | Expected | Actual | Root cause | Fix | Status |
|---|---|---|---|---|---|---|---|---|
| QA-01 | High | Production API availability | Request the Render health endpoint and the public /api/user route with a 15-second timeout | Timely health response and prompt 401 for an anonymous user lookup | Both timed out with no HTTP response. Candidate /fitness-api/health returned 200 in 0.71 s | Cause inside the Render service is unverified. The public API rewrite targets this Render origin | Candidate health is available. Verify Render workspace and deployment logs, then restore the production API or validate a compatible replacement with authenticated tests before promotion | Open |
| QA-02 | Medium | Production response headers | Compare HTTPS landing headers with curl -I | CSP, X-Content-Type-Options and Referrer-Policy are present | Production sent HSTS but lacked the three headers. Preview sent all four | The production release predates the Vercel header configuration | Candidate sends a baseline CSP restricting base URI, embedded objects and framing, plus nosniff and strict-origin-when-cross-origin | Verified on preview |
| QA-03 | Low | Mobile authentication headings | Inspect sign-in and registration heading structure at 390px | One visible page-level heading that names the form | Production's level-one heading is hidden on mobile. The visible form title is level two | The promotional panel owns the primary heading in production | Candidate promotes the visible form title to level one and leaves promotional text as a paragraph | Verified on preview |

## Test evidence

- Chromium passed 33/33 public route and viewport combinations on each deployment. Landing, sign-in and registration checks asserted HTTP 200, visible form or page titles, no document overflow and no console warnings or errors during the check. Coverage spans 360×740, 390×844, 414×896, 667×375, 768×1024, 820×1180, 1024×768, 1180×820, 1280×800, 1440×900 and 1920×1080.
- The signed-in loopback fixture passed planner-week restoration, duplicate measurement-submit protection, pound bounds, browser Back restoring exercise search, single-page layouts at 390, 768 and 1280px, and navigation across programs, workouts and exercises. The fixture does not exercise hosted Auth or RLS.
- Full npm audit found zero known vulnerabilities. Existing mobile Lighthouse evidence for the public landing is 100 in all four standard categories. Route-by-route desktop/mobile Lighthouse and axe coverage are pending.
- No test accounts or hosted rows were created. Two-account RLS, hosted sign-up through persistence and sign-out, password reset, MFA and expired-token recovery remain unverified. Firefox and WebKit were unavailable in the installed browser cache. Device and screenshot review, keyboard and screen reader coverage, offline/concurrency scenarios and exhaustive control testing remain pending.

## Release decision

No database changes were required or made. Production promotion is held by QA-01 and incomplete hosted authenticated smoke evidence. The Render connector reported no selected workspace for log inspection.
