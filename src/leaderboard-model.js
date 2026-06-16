"use strict";

function normalizeParticipantId(value) {
  return String(value ?? "").trim();
}

function normalizeMember(member) {
  const participantId = normalizeParticipantId(
    member?.participant_id ?? member?.user_id ?? member?.userId
  );
  return {
    participantId,
    name: String(member?.user_name ?? member?.name ?? member?.display_name ?? "Unknown").trim()
  };
}

function normalizeResponse(row) {
  return {
    participantId: normalizeParticipantId(row?.participant_id ?? row?.user_id ?? row?.userId),
    questionId: String(row?.question_id ?? row?.questionId ?? "").trim(),
    answer: row?.answer
  };
}

function parseLeaderboardStoredValue(question, raw) {
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw) || (raw && typeof raw === "object")) return raw;
  const text = String(raw).trim();
  if (!text) return null;
  const type = question?.type || "text";
  if (
    type === "ranking" ||
    type === "multi_select" ||
    type === "multi_select_limited" ||
    type === "teammate_battle" ||
    type === "boolean_with_optional_driver" ||
    type === "numeric_with_driver" ||
    type === "single_choice_with_driver"
  ) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch (err) {}
  }
  return raw;
}

function leaderboardValuesMatch(actualValue, predictedValue) {
  if (actualValue == null || predictedValue == null) return false;
  if (Array.isArray(actualValue)) return actualValue.includes(predictedValue);
  return String(actualValue) === String(predictedValue);
}

function scoreLeaderboardQuestion(question, predictedRaw, actualRaw) {
  if (actualRaw == null || predictedRaw == null) return 0;
  const type = question?.type || "text";
  if (type === "ranking") {
    const points = question.points || {};
    let score = 0;
    const positionLabels = ["1st", "2nd", "3rd", "4th", "5th"];
    const count = Number(question.count) || 3;
    for (let i = 0; i < count; i += 1) {
      const actual = actualRaw[i];
      const predicted = predictedRaw[i];
      const key = positionLabels[i] || String(i + 1);
      const value = Number(points[key] || 0);
      if (actual == null || predicted == null) continue;
      if (Array.isArray(actual) ? actual.includes(predicted) : actual === predicted) {
        score += value;
      }
    }
    return score;
  }
  if (type === "single_choice" || type === "text" || type === "boolean") {
    if (
      type === "single_choice" &&
      question.special_case === "all_podiums_bonus" &&
      String(actualRaw) === String(question.bonus_value)
    ) {
      return String(predictedRaw) === String(question.bonus_value)
        ? Number(question.bonus_points || 0)
        : 0;
    }
    return leaderboardValuesMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
  }
  if (type === "multi_select") {
    const points = Number(question.points || 0);
    const penalty = Number(question.penalty ?? points);
    const minimum = Number(question.minimum ?? 0);
    const actualSet = new Set(actualRaw || []);
    const predictedSet = new Set(predictedRaw || []);
    let correct = 0;
    let wrong = 0;
    let missing = 0;
    predictedSet.forEach((item) => {
      if (actualSet.has(item)) correct += 1;
      else wrong += 1;
    });
    actualSet.forEach((item) => {
      if (!predictedSet.has(item)) missing += 1;
    });
    return Math.max(minimum, correct * points - (wrong + missing) * penalty);
  }
  if (type === "teammate_battle") {
    const base = Number(question.points || 0);
    const tieBonus = Number(question.tie_bonus || 0);
    const actualWinner = actualRaw?.winner;
    const actualDiff = Number(actualRaw?.diff);
    const predictedWinner = predictedRaw?.winner;
    const predictedDiff = Number(predictedRaw?.diff);
    if (!actualWinner) return 0;
    if (actualWinner === "tie") return predictedWinner === "tie" ? tieBonus : 0;
    if (predictedWinner !== actualWinner) return 0;
    if (!Number.isFinite(actualDiff) || !Number.isFinite(predictedDiff)) return 0;
    return Math.max(0, base - Math.abs(predictedDiff - actualDiff));
  }
  if (type === "boolean_with_optional_driver") {
    const base = Number(question.points || 0);
    const bonus = Number(question.bonus_points || 0);
    const actualChoice = actualRaw?.choice;
    const actualDriver = actualRaw?.driver;
    const predictedChoice = predictedRaw?.choice;
    const predictedDriver = predictedRaw?.driver;
    if (actualChoice == null || predictedChoice == null) return 0;
    let score = 0;
    if (String(actualChoice) === String(predictedChoice)) {
      score += base;
      if (
        String(actualChoice) === "yes" &&
        actualDriver &&
        String(actualDriver) === String(predictedDriver)
      ) {
        score += bonus;
      }
    }
    return score;
  }
  if (type === "numeric_with_driver" || type === "single_choice_with_driver") {
    const points = question.points || {};
    const actualValue = actualRaw?.value;
    const predictedValue = predictedRaw?.value;
    const actualDriver = actualRaw?.driver;
    const predictedDriver = predictedRaw?.driver;
    let score = 0;
    if (actualValue != null && predictedValue != null) {
      if (leaderboardValuesMatch(actualValue, predictedValue)) {
        score += Number(points.position || 0);
      } else if (
        type === "single_choice_with_driver" &&
        question.position_nearby_points &&
        typeof question.position_nearby_points === "object"
      ) {
        const toGridNumber = (value) => {
          if (value == null) return null;
          const raw = String(value).trim().toLowerCase();
          if (!raw) return null;
          if (raw === "pitlane" || raw === "pit lane") return 23;
          const numeric = Number(raw);
          return Number.isFinite(numeric) ? numeric : null;
        };
        const actualGrid = toGridNumber(actualValue);
        const predictedGrid = toGridNumber(predictedValue);
        if (actualGrid != null && predictedGrid != null) {
          const diff = Math.abs(actualGrid - predictedGrid);
          score += Number(question.position_nearby_points[String(diff)] || 0);
        }
      }
    }
    if (actualDriver && predictedDriver && leaderboardValuesMatch(actualDriver, predictedDriver)) {
      score += Number(points.driver || 0);
    }
    return score;
  }
  if (type === "multi_select_limited") {
    const points = Number(question.points || 0);
    const dnfByRace = actualRaw?.dnf_by_race || {};
    let total = 0;
    (predictedRaw || []).forEach((race) => {
      total += Number(dnfByRace[race] || 0) * points;
    });
    return total;
  }
  if (type === "numeric") {
    return Number(actualRaw) === Number(predictedRaw) ? Number(question.points || 0) : 0;
  }
  return 0;
}

function rankLeaderboardRows(rows) {
  return (rows || [])
    .slice()
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || String(a.name).localeCompare(String(b.name)))
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));
}

function buildLeaderboardRows({ members, responses, questions, actualsByQuestion, includeDetails = false }) {
  const questionMap = (questions || []).reduce((acc, question) => {
    acc[question.id] = question;
    return acc;
  }, {});
  const scoreByParticipant = {};

  (members || []).forEach((member) => {
    const normalized = normalizeMember(member);
    if (!normalized.participantId) return;
    scoreByParticipant[normalized.participantId] = {
      userId: normalized.participantId,
      participantId: normalized.participantId,
      name: normalized.name,
      total: 0,
      byQuestion: includeDetails ? {} : undefined,
      answersByQuestion: includeDetails ? {} : undefined
    };
  });

  (responses || []).forEach((rawRow) => {
    const row = normalizeResponse(rawRow);
    const question = questionMap[row.questionId];
    const scoreRow = scoreByParticipant[row.participantId];
    if (!question || !scoreRow) return;
    const actual = parseLeaderboardStoredValue(question, actualsByQuestion?.[question.id]);
    const predicted = parseLeaderboardStoredValue(question, row.answer);
    const points = scoreLeaderboardQuestion(question, predicted, actual);
    scoreRow.total += points;
    if (includeDetails) {
      scoreRow.byQuestion[row.questionId] = points;
      scoreRow.answersByQuestion[row.questionId] = row.answer;
    }
  });

  return rankLeaderboardRows(Object.values(scoreByParticipant));
}

function buildLeaderboardPreviewRows(leaderboard, currentParticipantId, limit = 5) {
  const safeLimit = Math.max(1, Number(limit) || 5);
  const rankedRows = rankLeaderboardRows(leaderboard || []);
  if (rankedRows.length <= safeLimit) return rankedRows;
  const currentId = normalizeParticipantId(currentParticipantId);
  const currentIndex = currentId
    ? rankedRows.findIndex((row) => normalizeParticipantId(row.userId) === currentId)
    : -1;
  if (currentIndex < 0 || currentIndex < safeLimit) return rankedRows.slice(0, safeLimit);
  return [...rankedRows.slice(0, safeLimit - 1), rankedRows[currentIndex]];
}

function resolveSelectedParticipantId(leaderboard, requestedParticipantId, currentParticipantId) {
  const rows = leaderboard || [];
  const requestedId = normalizeParticipantId(requestedParticipantId);
  if (requestedId && rows.some((row) => normalizeParticipantId(row.userId) === requestedId)) {
    return requestedId;
  }
  const currentId = normalizeParticipantId(currentParticipantId);
  if (currentId && rows.some((row) => normalizeParticipantId(row.userId) === currentId)) {
    return currentId;
  }
  return normalizeParticipantId(rows[0]?.userId);
}

function buildLeaderboardFocusSet({
  leaderboard,
  currentParticipantId,
  selectedParticipantId,
  topLimit = 10
}) {
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    const normalized = normalizeParticipantId(id);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ids.push(normalized);
  };
  (leaderboard || []).slice(0, Math.max(1, Number(topLimit) || 10)).forEach((row) => add(row.userId));
  add(currentParticipantId);
  add(selectedParticipantId);
  return ids;
}

function normalizeSnapshot(snapshot) {
  const id = Number(snapshot?.id ?? snapshot?.snapshotId);
  const roundNumber = Number(snapshot?.roundNumber ?? snapshot?.round_number);
  return {
    ...snapshot,
    id,
    snapshotId: id,
    roundNumber,
    roundName: String(snapshot?.roundName ?? snapshot?.round_name ?? "").trim(),
    label: String(snapshot?.label || "").trim(),
    updatedAt: snapshot?.updatedAt ?? snapshot?.updated_at ?? snapshot?.createdAt ?? snapshot?.created_at ?? null
  };
}

function buildSnapshotHistory({
  snapshots,
  snapshotValuesById,
  members,
  responses,
  questions,
  focusParticipantIds
}) {
  const normalizedSnapshots = (snapshots || [])
    .map(normalizeSnapshot)
    .filter((snapshot) => Number.isFinite(snapshot.id) && Number.isFinite(snapshot.roundNumber) && snapshot.roundNumber > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber || a.id - b.id);
  const focusIds = (focusParticipantIds || []).map(normalizeParticipantId).filter(Boolean);
  const memberById = new Map((members || []).map((member) => {
    const normalized = normalizeMember(member);
    return [normalized.participantId, normalized];
  }));
  const seriesById = new Map();
  focusIds.forEach((id) => {
    const member = memberById.get(id);
    seriesById.set(id, {
      participantId: id,
      userId: id,
      name: member?.name || id,
      points: []
    });
  });

  let maxTotal = 0;
  const rankedRowsBySnapshotId = {};
  normalizedSnapshots.forEach((snapshot) => {
    const rows = buildLeaderboardRows({
      members,
      responses,
      questions,
      actualsByQuestion: snapshotValuesById?.[snapshot.id] || {},
      includeDetails: false
    });
    rankedRowsBySnapshotId[snapshot.id] = rows;
    const rowById = new Map(rows.map((row) => [normalizeParticipantId(row.userId), row]));
    focusIds.forEach((id) => {
      if (!seriesById.has(id)) return;
      const row = rowById.get(id);
      const total = Number(row?.total || 0);
      maxTotal = Math.max(maxTotal, total);
      seriesById.get(id).points.push({
        snapshotId: snapshot.id,
        roundNumber: snapshot.roundNumber,
        total,
        rank: row?.rank || null
      });
    });
  });

  return {
    hasEnoughHistory: normalizedSnapshots.length >= 2,
    rounds: normalizedSnapshots,
    series: Array.from(seriesById.values()),
    maxTotal,
    rankedRowsBySnapshotId
  };
}

function buildRoundDeltas({ latestRows, previousRows }) {
  const latestRanked = rankLeaderboardRows(latestRows || []);
  const previousRanked = rankLeaderboardRows(previousRows || []);
  if (latestRanked.length === 0 || previousRanked.length === 0) return {};

  const previousById = new Map(previousRanked.map((row) => [normalizeParticipantId(row.userId), row]));
  return latestRanked.reduce((acc, row) => {
    const id = normalizeParticipantId(row.userId);
    if (!id) return acc;
    const previous = previousById.get(id);
    const previousTotal = Number(previous?.total || 0);
    acc[id] = {
      participantId: id,
      userId: id,
      pointsDelta: Number(row.total || 0) - previousTotal,
      rankDelta: previous?.rank ? Number(previous.rank) - Number(row.rank) : 0,
      previousRank: previous?.rank || null,
      rank: row.rank,
      previousTotal,
      total: Number(row.total || 0)
    };
    return acc;
  }, {});
}

function questionScore(row, questionId) {
  return Number(row?.byQuestion?.[questionId] || 0);
}

function buildSelectedParticipantInsights({
  leaderboard,
  questions,
  selectedParticipantId,
  comparisonRadius = 5
}) {
  const ranked = rankLeaderboardRows(leaderboard || []);
  const selectedId = normalizeParticipantId(selectedParticipantId);
  const selectedIndex = ranked.findIndex((row) => normalizeParticipantId(row.userId) === selectedId);
  if (selectedIndex < 0) {
    return {
      selectedParticipant: null,
      comparisonRows: [],
      gaps: [],
      strengths: [],
      distinctive: [],
      emptyReason: "Select a scored participant to see leaderboard insights."
    };
  }

  const selected = ranked[selectedIndex];
  const radius = Math.max(1, Number(comparisonRadius) || 5);
  const aboveRows = ranked.slice(Math.max(0, selectedIndex - radius), selectedIndex);
  const belowRows = ranked.slice(selectedIndex + 1, selectedIndex + 1 + radius);
  const comparisonRows = selectedIndex === 0 ? belowRows : [...aboveRows, ...belowRows];
  const gapRows = selectedIndex === 0 ? belowRows : aboveRows;

  const gaps = [];
  const strengths = [];
  const distinctive = [];

  for (const [questionIndex, question] of (questions || []).entries()) {
    const questionNumber = questionIndex + 1;
    const selectedPoints = questionScore(selected, question.id);
    if (gapRows.length > 0) {
      const gapAverage =
        gapRows.reduce((sum, row) => sum + questionScore(row, question.id), 0) / gapRows.length;
      const difference = gapAverage - selectedPoints;
      if (difference > 0) {
        gaps.push({
          questionId: question.id,
          questionNumber,
          prompt: question.prompt,
          selectedPoints,
          comparisonAverage: Number(gapAverage.toFixed(2)),
          difference: Number(difference.toFixed(2))
        });
      }
    }

    if (comparisonRows.length > 0) {
      const comparisonAverage =
        comparisonRows.reduce((sum, row) => sum + questionScore(row, question.id), 0) /
        comparisonRows.length;
      const difference = selectedPoints - comparisonAverage;
      if (difference > 0) {
        strengths.push({
          questionId: question.id,
          questionNumber,
          prompt: question.prompt,
          selectedPoints,
          comparisonAverage: Number(comparisonAverage.toFixed(2)),
          difference: Number(difference.toFixed(2))
        });
      }

      const selectedAnswer = selected.answersByQuestion?.[question.id];
      if (selectedAnswer != null && selectedAnswer !== "") {
        const comparableAnswers = comparisonRows
          .map((row) => row.answersByQuestion?.[question.id])
          .filter((answer) => answer != null && answer !== "");
        if (comparableAnswers.length > 0) {
          const sameAnswerCount = comparableAnswers.filter(
            (answer) => String(answer) === String(selectedAnswer)
          ).length;
          if (sameAnswerCount <= Math.floor(comparableAnswers.length / 2)) {
            distinctive.push({
              questionId: question.id,
              questionNumber,
              prompt: question.prompt,
              selectedAnswer,
              selectedPoints,
              sameAnswerCount,
              comparisonCount: comparableAnswers.length
            });
          }
        }
      }
    }
  }

  gaps.sort((a, b) => b.difference - a.difference || String(a.prompt).localeCompare(String(b.prompt)));
  strengths.sort((a, b) => b.difference - a.difference || String(a.prompt).localeCompare(String(b.prompt)));
  distinctive.sort(
    (a, b) =>
      b.selectedPoints - a.selectedPoints ||
      a.sameAnswerCount - b.sameAnswerCount ||
      String(a.prompt).localeCompare(String(b.prompt))
  );

  return {
    selectedParticipant: selected,
    comparisonRows,
    gaps: gaps.slice(0, 3),
    strengths: strengths.slice(0, 3),
    distinctive: distinctive.slice(0, 3),
    emptyReason:
      gaps.length === 0 && strengths.length === 0 && distinctive.length === 0
        ? "Not enough scored question differences yet to explain this participant's position."
        : null
  };
}

function buildSelectedParticipantBreakdown({ questions, selectedRow, actualsByQuestion, mode = "scored" }) {
  const safeMode = mode === "all" ? "all" : "scored";
  const rows = (questions || []).map((question, index) => {
    const points = questionScore(selectedRow, question.id);
    return {
      questionId: question.id,
      question,
      questionNumber: index + 1,
      prompt: question.prompt,
      predictionRaw: selectedRow?.answersByQuestion?.[question.id] ?? null,
      actualRaw: actualsByQuestion?.[question.id] ?? null,
      points,
      isScored: points > 0
    };
  });
  const scoredRows = rows.filter((row) => row.isScored);
  return {
    mode: safeMode,
    hasScoredRows: scoredRows.length > 0,
    rows: safeMode === "all" ? rows : scoredRows
  };
}

module.exports = {
  buildLeaderboardFocusSet,
  buildLeaderboardPreviewRows,
  buildLeaderboardRows,
  buildRoundDeltas,
  buildSelectedParticipantBreakdown,
  buildSelectedParticipantInsights,
  buildSnapshotHistory,
  leaderboardValuesMatch,
  normalizeParticipantId,
  parseLeaderboardStoredValue,
  rankLeaderboardRows,
  resolveSelectedParticipantId,
  scoreLeaderboardQuestion
};
