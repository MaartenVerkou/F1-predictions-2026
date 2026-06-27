# Wheel of Knowledge

Domain language for the F1 predictions game.

## Language

**Visitor**:
A person using public parts of the game without a named guest slot or registered account.
_Avoid_: Anonymous user, unauthenticated user, guest

**Named Guest**:
A person who has joined one or more friend groups with a display name, appears in those groups' rosters and answers, but has not created a verified account.
_Avoid_: Guest account, anonymous user, temporary user

**Guest Recovery Secret**:
A private secret chosen by a Named Guest that proves they can resume or convert that Named Guest later across all groups they joined from a fresh browser. It is a Recovery PIN by default, or an answer to a playful F1-themed prompt when the guest chooses recovery-question mode. A first-time Named Guest can skip self-recovery, but then fresh-browser recovery requires owner/admin help.
_Avoid_: Claim secret in user-facing copy, security question, verification question, password

**Named Guest Claim**:
The act of proving control of a Named Guest by selecting that guest within an accessible group and entering the Guest Recovery Secret.
_Avoid_: Login, name lookup, guest verification

**Guest Conversion**:
The transfer of all of a Named Guest's group memberships and predictions into a Registered Member, after which the Named Guest no longer exists as a separate participant.
_Avoid_: Guest upgrade, merge account, claim account

**Group Predictions**:
A participant's saved predictions for one specific friend group.
_Avoid_: Group answers, private answers

**Global League Predictions**:
A participant's saved predictions for the site-wide competition, which may be reused as a baseline for friend groups.
_Avoid_: Global answers, main answers

**Registered Member**:
A person with a verified account who can own durable predictions and memberships across sessions.
_Avoid_: Account user, dedicated account, real user

**Leaderboard**:
The ranked score view for a group or the global game, calculated from participants' predictions against a chosen set of actual outcomes.
_Avoid_: Standings, table

**Leaderboard Focus Set**:
The participants highlighted in a leaderboard trend view: the current top 10 plus the logged-in participant and selected participant when either is outside the top 10.
_Avoid_: Chart users, selected people

**Emphasized Participant**:
A participant whose trend line is visually stronger than the baseline top-10 lines because they are the logged-in participant or the selected participant.
_Avoid_: Active line, special user

**Leaderboard Insight**:
A short explanation of why a participant is ahead, behind, or unusual compared with nearby competitors, based on question-level score differences and distinctive predictions.
_Avoid_: Score detail, tooltip

**Round Movers**:
Page-level leaderboard context showing notable points gained between the latest actual snapshot and the previous actual snapshot, with rank movement as supporting context.
_Avoid_: Activity feed, recent changes

**Question Breakdown**:
The per-question view for one participant, showing their prediction, the actual outcome, and points scored for each question; it defaults to scored questions with an option to show all questions.
_Avoid_: More info, details table

**Actual Snapshot**:
A saved set of actual outcomes for a specific completed race round, used to score the leaderboard as it stood after that round.
_Avoid_: Result backup, historical actuals

**Actual Autofill**:
The automated process that fills current actuals and race-round actual snapshots after race data becomes available.
_Avoid_: Admin fill, import

**Actual Review**:
An admin confirmation that an autofilled actual snapshot has been checked and accepted, or manually corrected after review.
_Avoid_: Approval, audit

**Admin Idea**:
An admin-recorded future question, feature, improvement, or reported problem that can be triaged before it becomes planned work.
_Avoid_: Ticket, task, backlog item

**Resolution Run**:
An auditable attempt to investigate or solve an Admin Idea, including its objective, outcome, review state, and follow-up iterations.
_Avoid_: AI job, Codex session, task run

**Preview Environment**:
A temporary admin-only place to inspect a Resolution Run's candidate behavior before it is approved for production.
_Avoid_: Staging when referring to a single run preview, test page

**Deploy Candidate**:
A Resolution Run that has passed required validation and has been explicitly marked by an admin as eligible for production deployment.
_Avoid_: Finished fix, auto deploy, release
