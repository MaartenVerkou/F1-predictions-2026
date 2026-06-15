# Wheel of Knowledge

Domain language for the F1 predictions game.

## Language

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
