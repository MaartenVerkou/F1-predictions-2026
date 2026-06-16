"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  buildLeaderboardFocusSet,
  buildLeaderboardRows,
  buildRoundDeltas,
  buildSelectedParticipantBreakdown,
  buildSelectedParticipantInsights,
  buildSnapshotHistory,
  rankLeaderboardRows,
  resolveSelectedParticipantId
} = require("../src/leaderboard-model");

const questions = [
  { id: "q1", prompt: "Question one", type: "single_choice", points: 10 },
  { id: "q2", prompt: "Question two", type: "single_choice", points: 8 },
  { id: "q3", prompt: "Question three", type: "single_choice", points: 5 }
];

function member(id, name = `Player ${id}`) {
  return { participant_id: String(id), user_name: name };
}

function response(id, questionId, answer) {
  return { participant_id: String(id), question_id: questionId, answer };
}

test("leaderboard rows score participants and retain question details", () => {
  const rows = buildLeaderboardRows({
    members: [member(1, "Alice"), member(2, "Bob")],
    responses: [
      response(1, "q1", "A"),
      response(1, "q2", "B"),
      response(2, "q1", "C"),
      response(2, "q2", "B")
    ],
    questions,
    actualsByQuestion: { q1: "A", q2: "B" },
    includeDetails: true
  });

  assert.equal(rows[0].name, "Alice");
  assert.equal(rows[0].total, 18);
  assert.deepEqual(rows[0].byQuestion, { q1: 10, q2: 8 });
  assert.equal(rows[1].name, "Bob");
  assert.equal(rows[1].total, 8);
});

test("snapshot history replays scored leaderboard states for focus participants", () => {
  const members = [member(1, "Alice"), member(2, "Bob"), member(3, "Cara")];
  const responses = [
    response(1, "q1", "A"),
    response(1, "q2", "B"),
    response(2, "q1", "B"),
    response(2, "q2", "B"),
    response(3, "q1", "A"),
    response(3, "q2", "C")
  ];
  const snapshots = [
    { id: 11, roundNumber: 1, roundName: "Australian Grand Prix", label: "R1 - Australian Grand Prix" },
    { id: 12, roundNumber: 2, roundName: "Chinese Grand Prix", label: "R2 - Chinese Grand Prix" }
  ];
  const history = buildSnapshotHistory({
    snapshots,
    snapshotValuesById: {
      11: { q1: "A" },
      12: { q1: "B", q2: "B" }
    },
    members,
    responses,
    questions,
    focusParticipantIds: ["1", "3"]
  });

  assert.equal(history.hasEnoughHistory, true);
  assert.deepEqual(
    history.rounds.map((round) => round.roundNumber),
    [1, 2]
  );
  assert.deepEqual(
    history.series.find((row) => row.participantId === "1").points.map((point) => point.total),
    [10, 8]
  );
  assert.deepEqual(
    history.series.find((row) => row.participantId === "3").points.map((point) => point.rank),
    [2, 3]
  );
});

test("focus set includes top 10 plus current and selected participants", () => {
  const leaderboard = rankLeaderboardRows(
    Array.from({ length: 12 }, (_, index) => ({
      userId: String(index + 1),
      name: `Player ${index + 1}`,
      total: 120 - index
    }))
  );

  assert.equal(resolveSelectedParticipantId(leaderboard, "", "12"), "12");
  assert.deepEqual(
    buildLeaderboardFocusSet({
      leaderboard,
      currentParticipantId: "12",
      selectedParticipantId: "11"
    }),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "11"]
  );
});

test("latest-race deltas compare latest and previous ranked snapshots", () => {
  const previousRows = rankLeaderboardRows([
    { userId: "1", name: "Alice", total: 10 },
    { userId: "2", name: "Bob", total: 5 },
    { userId: "3", name: "Cara", total: 0 }
  ]);
  const latestRows = rankLeaderboardRows([
    { userId: "2", name: "Bob", total: 20 },
    { userId: "1", name: "Alice", total: 10 },
    { userId: "3", name: "Cara", total: 6 }
  ]);

  const deltas = buildRoundDeltas({ latestRows, previousRows });
  assert.deepEqual(
    {
      bob: deltas["2"],
      alice: deltas["1"]
    },
    {
      bob: {
        participantId: "2",
        userId: "2",
        pointsDelta: 15,
        rankDelta: 1,
        previousRank: 2,
        rank: 1,
        previousTotal: 5,
        total: 20
      },
      alice: {
        participantId: "1",
        userId: "1",
        pointsDelta: 0,
        rankDelta: -1,
        previousRank: 1,
        rank: 2,
        previousTotal: 10,
        total: 10
      }
    }
  );
});

test("selected participant insights and breakdown use scored question data", () => {
  const leaderboard = rankLeaderboardRows([
    {
      userId: "1",
      name: "Alice",
      total: 18,
      byQuestion: { q1: 10, q2: 8, q3: 0 },
      answersByQuestion: { q1: "A", q2: "B", q3: "A" }
    },
    {
      userId: "2",
      name: "Bob",
      total: 15,
      byQuestion: { q1: 10, q2: 0, q3: 5 },
      answersByQuestion: { q1: "A", q2: "A", q3: "C" }
    },
    {
      userId: "3",
      name: "Cara",
      total: 13,
      byQuestion: { q1: 0, q2: 8, q3: 5 },
      answersByQuestion: { q1: "C", q2: "B", q3: "C" }
    }
  ]);

  const insights = buildSelectedParticipantInsights({
    leaderboard,
    questions,
    selectedParticipantId: "3"
  });
  assert.equal(insights.selectedParticipant.name, "Cara");
  assert.equal(insights.gaps[0].questionId, "q1");
  assert.equal(insights.gaps[0].questionNumber, 1);
  assert.equal(insights.strengths[0].questionId, "q2");
  assert.equal(insights.strengths[0].questionNumber, 2);
  assert.ok(insights.distinctive.some((item) => item.questionId === "q1"));

  const scoredBreakdown = buildSelectedParticipantBreakdown({
    questions,
    selectedRow: leaderboard[2],
    actualsByQuestion: { q1: "A", q2: "B", q3: "C" },
    mode: "scored"
  });
  assert.deepEqual(
    scoredBreakdown.rows.map((row) => row.questionId),
    ["q2", "q3"]
  );

  const allBreakdown = buildSelectedParticipantBreakdown({
    questions,
    selectedRow: leaderboard[2],
    actualsByQuestion: { q1: "A", q2: "B", q3: "C" },
    mode: "all"
  });
  assert.equal(allBreakdown.rows.length, 3);
  assert.equal(allBreakdown.rows[0].isScored, false);
});
