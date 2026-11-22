# MeFit QA report

| ID | Severity | Area | Reproduce | Expected | Actual | Root cause | Fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MF-01 | Low | Planner | Navigate to another week and reload | Keep the selected week | Opens the current week | Week selection was only component state | Preserve the offset in the URL. Today removes it | Verified |
| MF-02 | Medium | Workout saves | Submit twice before React commits the disabled button | One write | The handler could start two writes in the same render | No synchronous guard | Use an in-flight guard and release it after success or failure | Verified |
| MF-03 | Low | Body measurements | Compare pound-mode input limits with database limits | Use equivalent limits in kg and lb | The rounded lb bounds accepted values outside the kg bounds | Separate rounded constants | Derive bounds from the conversion factor and account for rounding at the boundary | Verified |

| MF-04 | Medium | Exercise Library | Search, change a filter, edit the search, then press Back | Restore the earlier query and results | The stale search could replace the restored URL | Local search state survived navigation | Scope pending search text to its history entry | Verified |

## Scope

Automated tests and browser simulations exercise the app without customer records. The browser simulation does not verify hosted authentication, database policies, or physical devices. Account deletion, editing past logs, and the expanded workout timer described in the QA brief are outside the current implemented feature set. Full cross-browser, accessibility, production authenticated smoke, and per-route Lighthouse coverage are pending.
