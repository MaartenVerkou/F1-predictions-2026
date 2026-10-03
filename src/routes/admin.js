const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { runActualsAutoUpdate } = require("../actuals-auto-update");
const { resolveConfiguredRaceName } = require("../race-names");
const {
  REVIEW_STATUS_PENDING,
  loadPublishedActuals,
  fetchSnapshotValues: loadSnapshotValues,
  findLatestRoundSnapshotForSeason: loadLatestRoundSnapshotForSeason,
  findSnapshotById,
  linkEvidenceToActualSnapshot,
  listLatestSnapshotsForSeason,
  markSnapshotReviewed,
  publishActualSnapshot,
  upsertSnapshotForRound
} = require("../actuals-snapshots");
const {
  findRaceDataSnapshot,
  listRaceDataSnapshotRevisions,
  listRaceDataSnapshots,
  saveCorrectedRaceDataSnapshot,
  summarizeEvidence
} = require("../race-data-evidence");
const { deriveSnapshotsFromPersistedEvidence } = require("../../scripts/backfill-actuals-2026");
const {
  addEntityAlias,
  addProviderReference,
  listSeasonInputs,
  listSeasonMappings,
  removeSeasonMembership,
  upsertDriver,
  upsertDriverTeamAssignment,
  upsertRace,
  upsertSeasonDriver,
  upsertSeasonTeam,
  upsertTeam
} = require("../season-inputs");
const { buildCanonicalCatalog, canonicalizeQuestionValue } = require("../canonical-answers");
const { buildSeasonCatalog } = require("../season-catalog");
const {
  applyTeamLineupHistory,
  applySeasonLineup,
  buildLineupProjection,
  buildTeamLineupHistory,
  buildTeamLineupHistoryPlan,
  historicalCorrectionRequired
} = require("../season-lineup");
const {
  assertSeasonMutationAllowed,
  listAdminSeasons,
  readSeasonMutationFlags,
  resolveAdminSeasonContext
} = require("../admin-season-context");
const {
  applyDriverPointsMetric,
  applyRaceDataFocus,
  defaultRaceDataHighlightMode
} = require("../race-data-audit");
const {
  buildRaceResultColumns,
  buildRaceDataMetricOptions,
  formatRaceFinishLabel,
  getRaceSessionRows
} = require("../race-data-review-model");
const {
  auditResultLabel,
  auditNonClassifiedLabel,
  formatRaceStatusLabel,
  formatRacePositionLabel,
  fallbackEntityCode,
  fallbackRaceCode,
  isSafeRaceDataReturnPath,
  sortAuditRows,
  matchesAuditEntity,
  buildAuditMarkerMeta,
  buildConstructorPodiumPosition,
  buildAuditPodiumSummary,
  buildAuditMatrixCell
} = require("../admin-race-data-presentation");
const { buildActualsOverview } = require("../actuals-overview");
const leaderboardModel = require("../leaderboard-model");
const { topDamageEntities } = require("../destructors-damage");
const { compactQuestionLabel, raceDataFocusLabel } = require("../race-data-focus");
const {
  buildQuestionInputRows,
  normalizeQuestionInputEdits
} = require("../question-admin-model");
const { upsertSeasonQuestionSettings } = require("../season-question-settings");
const {
  listQuestionDefinitions,
  upsertQuestionDefinition
} = require("../question-definitions");
const {
  DEFAULT_SCORING_RULES,
  deriveStandingsForRounds,
  reconcileStandings,
  readSeasonScoringRules,
  scoringRulesTableValue
} = require("../season-scoring-rules");

function buildRaceDataFocusOptions(questions = [], { pointsLabel = "Championship points", metricOptions = [] } = {}) {
  const options = [{
    id: "points",
    view: "all",
    metric: "points",
    questionId: null,
    questionNumber: null,
    group: "standings",
    label: pointsLabel,
    focusLabel: raceDataFocusLabel({ metric: "points" })
  }];
  const seen = new Set(["points"]);
  for (const metricOption of metricOptions || []) {
    const id = String(metricOption?.id || "").trim();
    if (!id || seen.has(id)) continue;
    options.push({ ...metricOption });
    seen.add(id);
  }
  let questionNumber = 0;
  for (const question of questions || []) {
    const projection = question?.race_data_focus;
    const id = String(question?.id || "").trim();
    const view = String(projection?.view || "").trim().toLowerCase();
    const metric = String(projection?.metric || "").trim().toLowerCase();
    if (!id || seen.has(id) || !["drivers", "constructors"].includes(view)) continue;
    const inferredGroup = ["championship_top3", "last_standing", "all_teams_points"].includes(metric)
      ? "standings"
      : ["podiums", "dnfs", "grid_wins", "driver_of_day", "sprint_points", "dnf_by_race"].includes(metric)
        ? "race"
        : ["teammate_points", "qualifying_h2h", "alpine_comparison"].includes(metric)
          ? "comparisons"
          : ["damage", "engine_switch"].includes(metric)
            ? "external"
            : "other";
    const group = String(projection?.group || inferredGroup).trim().toLowerCase();
    questionNumber += 1;
    options.push({
      id,
      view,
      metric,
      matrixMetric: String(projection?.matrixMetric || (metric === "points" || metric === "podiums" ? metric : "points")).trim().toLowerCase(),
      cellMode: String(projection?.cellMode || "").trim().toLowerCase() || null,
      highlightMode: String(
        projection?.highlightMode || defaultRaceDataHighlightMode(metric)
      ).trim().toLowerCase(),
      footerMode: String(projection?.footerMode || "").trim().toLowerCase() || null,
      sort: String(projection?.sort || "desc").trim().toLowerCase(),
      kind: String(projection?.kind || "matrix").trim().toLowerCase(),
      // Every question is a season derivation. A selected round is only a
      // temporary effective season end in the audit workspace, not a
      // question-specific scope or a truncated source dataset.
      scope: "season",
      group,
      options: Array.isArray(question.options) ? question.options.slice() : [],
      compareDrivers: Array.isArray(projection?.compareDrivers) ? projection.compareDrivers.slice() : [],
      compareTeams: Array.isArray(projection?.compareTeams) ? projection.compareTeams.slice() : [],
      targetTeam: String(projection?.targetTeam || "").trim() || null,
      targetEngine: String(projection?.targetEngine || "").trim() || null,
      requiredEvidence: Array.isArray(projection?.requiredEvidence) ? projection.requiredEvidence.slice() : [],
      questionId: id,
      questionNumber,
      label: String(question.prompt || id),
      shortLabel: compactQuestionLabel(question, metric),
      focusLabel: raceDataFocusLabel(question)
    });
    seen.add(id);
  }
  return options;
}

function resolveRaceDataFocus({ questions = [], focusId = "points", viewMode = "drivers", pointsLabel = "Championship points", metricOptions = [] } = {}) {
  const options = buildRaceDataFocusOptions(questions, { pointsLabel, metricOptions });
  const requested = options.find((option) => option.id === String(focusId || "points"));
  if (requested && (requested.view === "all" || requested.view === viewMode)) {
    return { ...requested, view: viewMode };
  }
  return { ...options[0], view: viewMode };
}

function resolveActiveRaceDataMetricId({ focus = null, metricOptions = [] } = {}) {
  const metric = String(focus?.matrixMetric || focus?.metric || "points").trim().toLowerCase();
  const preferredId = ["points", "championship_points_results"].includes(metric)
    ? metric
    : `metric:${metric}`;
  return metricOptions.some((option) => option.id === preferredId) ? preferredId : "points";
}

function auditSourceState(evidence, roundNumber, latestEvidenceRound) {
  if (evidence) return evidence.coverage_status || evidence.payload?.coverage?.status || "incomplete";
  return Number(roundNumber) > Number(latestEvidenceRound || 0) ? "future" : "not_synced";
}

function attachSeasonCatalogToQuestions(questions, seasonCatalog) {
  const canonical = seasonCatalog?.canonical || { driver: [], team: [], race: [] };
  return (questions || []).map((question) => {
    const attached = { ...question };
    Object.defineProperty(attached, "_canonicalCatalog", {
      value: canonical,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(attached, "_catalogRevision", {
      value: seasonCatalog?.catalogRevision || null,
      enumerable: false,
      configurable: true
    });
    return attached;
  });
}

function attachSnapshotReviewerNames(db, snapshots = []) {
  const reviewerIds = Array.from(new Set(
    (snapshots || [])
      .map((snapshot) => Number(snapshot?.reviewed_by_user_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  ));
  if (!reviewerIds.length) return snapshots || [];
  const placeholders = reviewerIds.map(() => "?").join(", ");
  const reviewers = db.prepare(
    `SELECT id, name FROM users WHERE id IN (${placeholders})`
  ).all(...reviewerIds);
  const namesById = new Map(
    reviewers.map((reviewer) => [Number(reviewer.id), String(reviewer.name || "").trim() || null])
  );
  return (snapshots || []).map((snapshot) => ({
    ...snapshot,
    reviewed_by_name: namesById.get(Number(snapshot.reviewed_by_user_id)) || null
  }));
}

function buildRoundAwareRoster({ db, season, roundNumber, races, fallbackRoster, seasonCatalog }) {
  const base = fallbackRoster || { drivers: [], teams: [], races: races || [] };
  const catalog = seasonCatalog || listSeasonInputs(db, season);
  if (!catalog.season || !Number.isInteger(Number(roundNumber)) || Number(roundNumber) < 1) return base;
  const projection = buildLineupProjection({
    teams: catalog.teams,
    drivers: catalog.drivers,
    assignments: catalog.assignments,
    roundNumber: Number(roundNumber)
  });
  const driverCatalogById = new Map(
    (catalog.drivers || []).map((driver) => [Number(driver.id), driver])
  );
  const teamCatalogById = new Map(
    (catalog.teams || []).map((team) => [Number(team.id), team])
  );
  const drivers = Array.from(new Map(
    projection.flatMap((team) => team.seats)
      .filter((seat) => seat.driverId != null && seat.driverName)
      .map((seat) => [String(seat.driverName), String(seat.driverName)])
  ).values());
  const teams = projection.map((team) => team.teamName);
  const driverEntities = Array.from(new Map(
    projection.flatMap((team) => team.seats.map((seat) => ({ seat, team })))
      .filter(({ seat }) => seat.driverId != null && seat.driverName)
      .map(({ seat, team }) => [Number(seat.driverId), {
        id: Number(seat.driverId),
        name: String(seat.driverName),
        code: driverCatalogById.get(Number(seat.driverId))?.driver_code || null,
        teamId: Number(team.teamId),
        teamName: String(team.teamName),
        seatNumber: Number(seat.seatNumber)
      }])
  ).values());
  const teamEntities = projection
    .filter((team) => team.teamId != null && team.teamName)
    .map((team) => ({
      id: Number(team.teamId),
      name: String(team.teamName),
      code: teamCatalogById.get(Number(team.teamId))?.team_code || null,
      powerUnit: teamCatalogById.get(Number(team.teamId))?.power_unit || null,
      seats: team.seats.map((seat) => ({
        seatNumber: Number(seat.seatNumber),
        driverId: seat.driverId == null ? null : Number(seat.driverId),
        driverName: seat.driverName || null
      }))
    }));
  return {
    ...base,
    drivers: drivers.length ? drivers : base.drivers || [],
    teams: teams.length ? teams : base.teams || [],
    driver_entities: driverEntities,
    team_entities: teamEntities,
    driver_options: drivers.length ? drivers : base.driver_options || base.drivers || [],
    team_options: teams.length ? teams : base.team_options || base.teams || [],
    race_options: races || base.race_options || base.races || [],
    races: races || base.races || []
  };
}

function expandRaceDataRosterWithHistoricalParticipants({ driverEntities, teamEntities, rounds, cutoffRoundNumber }) {
  const drivers = (driverEntities || []).map((entity) => ({ ...entity }));
  const teams = (teamEntities || []).map((entity) => ({ ...entity }));
  const driverById = new Map(
    drivers
      .filter((entity) => entity.id != null)
      .map((entity) => [Number(entity.id), entity])
  );
  const driverByName = new Map(drivers.map((entity) => [String(entity.name || ""), entity]));
  const teamById = new Map(
    teams
      .filter((entity) => entity.id != null)
      .map((entity) => [Number(entity.id), entity])
  );
  const teamByName = new Map(teams.map((entity) => [String(entity.name || ""), entity]));
  const asPositiveInteger = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  for (const round of rounds || []) {
    if (round.roundNumber > cutoffRoundNumber || !round.evidence) continue;
    const payload = round.evidence.payload || {};
    const rows = [
      ...(payload.race?.rows || []),
      ...(payload.sprint?.rows || [])
    ];
    for (const row of rows) {
      const name = String(row.driver || row.driver_label || "").trim();
      if (!name) continue;
      const driverId = asPositiveInteger(row.driver_id);
      const teamName = String(row.constructor || row.team_label || "").trim() || null;
      const teamId = asPositiveInteger(row.team_id);
      let entity = (driverId != null ? driverById.get(driverId) : null) || driverByName.get(name);
      if (!entity) {
        entity = {
          id: driverId,
          name,
          code: fallbackEntityCode(name, "driver"),
          teamId,
          teamName,
          seatNumber: null,
          historical: true
        };
        drivers.push(entity);
        if (driverId != null) driverById.set(driverId, entity);
        driverByName.set(name, entity);
      } else if (entity.historical) {
        entity.teamId = teamId ?? entity.teamId ?? null;
        entity.teamName = teamName || entity.teamName || null;
      }

      if (!teamName) continue;
      let team = (teamId != null ? teamById.get(teamId) : null) || teamByName.get(teamName);
      if (!team) {
        team = {
          id: teamId,
          name: teamName,
          code: fallbackEntityCode(teamName, "team"),
          powerUnit: null,
          historical: true
        };
        teams.push(team);
        if (teamId != null) teamById.set(teamId, team);
        teamByName.set(teamName, team);
      }
    }
  }
  return { drivers, teams };
}

function buildRaceDataAuditView({ races, roster, evidenceRows, snapshotRows, selectedRound, catalogRevision = null, focus = null, showRaceResult = true, scoringRules = DEFAULT_SCORING_RULES }) {
  const activeFocus = {
    id: "points",
    metric: "points",
    view: "drivers",
    label: "Championship points",
    ...(focus || {})
  };
  const evidenceByRound = new Map(
    evidenceRows.map((row) => [Number(row.round_number), row])
  );
  const snapshotByRound = new Map(
    snapshotRows.map((row) => [Number(row.round_number), row])
  );
  const latestEvidenceRound = evidenceRows.reduce(
    (max, row) => Math.max(max, Number(row.round_number) || 0),
    0
  );
  const requestedCutoff = Number(selectedRound);
  const cutoffRoundNumber = Math.min(
    Math.max(Number.isFinite(requestedCutoff) && requestedCutoff > 0 ? requestedCutoff : 1, 1),
    Math.max(races.length, 1)
  );
  const rounds = races.map((raceName, index) => {
    const roundNumber = index + 1;
    const evidence = evidenceByRound.get(roundNumber) || null;
    const calendarState = String(
      evidence?.calendar_state || evidence?.payload?.calendarState || ""
    ).toLowerCase();
    const baseState = calendarState === "cancelled"
      ? "cancelled"
      : calendarState === "partial"
        ? "incomplete"
        : !evidence && /cancel+ed|afgelast/i.test(String(raceName))
          ? "cancelled"
          : auditSourceState(evidence, roundNumber, latestEvidenceRound);
    const state = roundNumber > cutoffRoundNumber ? "future" : baseState;
    return {
      roundNumber,
      raceName,
      label: "R" + roundNumber + " - " + raceName,
      evidence,
      snapshot: snapshotByRound.get(roundNumber) || null,
      state: baseState,
      afterCutoff: roundNumber > cutoffRoundNumber,
      baseState,
      summary: evidence ? summarizeEvidence(evidence.payload) : null
    };
  });
  const latestEvidence = evidenceRows[evidenceRows.length - 1] || null;
  const selected = rounds.find((round) => round.roundNumber === cutoffRoundNumber) || rounds[0] || null;
  const selectedSummary = selected?.summary
    ? {
        ...selected.summary,
        status: selected.state === "incomplete"
          ? "incomplete"
          : selected.state === "cancelled"
            ? "cancelled"
            : selected.summary.status
      }
    : null;
  const derivedStandingsByRound = deriveStandingsForRounds(
    evidenceRows.map((row) => ({
      roundNumber: Number(row.round_number),
      raceRows: row.payload?.race?.rows || [],
      sprintRows: row.payload?.sprint?.rows || []
    })),
    scoringRules
  );
  const selectedPayload = selected?.evidence?.payload || null;
  const selectedDerivedStandings = derivedStandingsByRound.get(cutoffRoundNumber) || { drivers: [], constructors: [] };
  const selectedLegacyStandings = selectedPayload?.legacyStandings || selectedPayload?.standings || { drivers: [], constructors: [] };
  const selectedDriverStandings = selectedDerivedStandings.drivers.length
    ? selectedDerivedStandings.drivers
    : (selectedPayload?.standings?.drivers || []);
  const selectedConstructorStandings = selectedDerivedStandings.constructors.length
    ? selectedDerivedStandings.constructors
    : (selectedPayload?.standings?.constructors || []);
  const selectedDriverMap = new Map(selectedDriverStandings.map((row) => [row.entity, row]));
  const selectedConstructorMap = new Map(selectedConstructorStandings.map((row) => [row.entity, row]));
  const selectedLegacyDriverMap = new Map(selectedLegacyStandings.drivers.map((row) => [row.entity, row]));
  const selectedLegacyConstructorMap = new Map(selectedLegacyStandings.constructors.map((row) => [row.entity, row]));
  const selectedDriverIdMap = new Map(
    selectedDriverStandings
      .filter((row) => row.entity_id != null)
      .map((row) => [Number(row.entity_id), row])
  );
  const selectedConstructorIdMap = new Map(
    selectedConstructorStandings
      .filter((row) => row.entity_id != null)
      .map((row) => [Number(row.entity_id), row])
  );

  const drivers = Array.isArray(roster?.drivers) ? roster.drivers : [];
  const teams = Array.isArray(roster?.teams) ? roster.teams : [];
  const baseDriverEntities = Array.isArray(roster?.driver_entities)
    ? roster.driver_entities
    : drivers.map((name) => ({ id: null, name }));
  const baseTeamEntities = Array.isArray(roster?.team_entities)
    ? roster.team_entities
    : teams.map((name) => ({ id: null, name }));
  const expandedRoster = expandRaceDataRosterWithHistoricalParticipants({
    driverEntities: baseDriverEntities,
    teamEntities: baseTeamEntities,
    rounds,
    cutoffRoundNumber
  });
  const driverEntities = expandedRoster.drivers;
  const teamEntities = expandedRoster.teams;
  const podiumFocus = activeFocus.matrixMetric === "podiums" || ["podiums", "ferrari_podium"].includes(activeFocus.metric);
  const driverRows = sortAuditRows(driverEntities.map((entity) => {
    const driver = entity.name;
    const cells = rounds.map((round) => {
      const raceRows = round.evidence?.payload?.race?.rows || [];
      const qualifyingRows = round.evidence?.payload?.qualifying?.rows || [];
      const row = raceRows.find((item) => matchesAuditEntity(item, entity, {
        idField: "driver_id",
        nameField: "driver"
      })) || null;
      const qualifying = qualifyingRows.find((item) => matchesAuditEntity(item, entity, {
        idField: "driver_id",
        nameField: "driver"
      })) || null;
      const afterCutoff = round.roundNumber > cutoffRoundNumber;
      const qualifyingOutcome = auditNonClassifiedLabel(qualifying);
      const pole = Boolean(qualifying?.pole || Number(qualifying?.position) === 1);
      const fastestLap = Boolean(row?.fastestLap);
      const podiumPosition = !afterCutoff && [1, 2, 3].includes(Number(row?.position))
        ? Number(row.position)
        : null;
      const podiumHit = !afterCutoff && Boolean(row) && [1, 2, 3].includes(Number(row.position));
      const resultLabel = podiumFocus
        ? (round.evidence && row ? (podiumHit ? "1" : "0") : "—")
        : round.evidence
          ? (row ? auditResultLabel(row) : qualifyingOutcome || "—")
          : "—";
      const markerMeta = podiumFocus ? buildAuditMarkerMeta() : buildAuditMarkerMeta({ pole, fastestLap });
      const resultTitle = podiumFocus
        ? (round.evidence && row
          ? (podiumHit ? "Podium finish" : "No podium finish")
          : round.evidence ? "No classified row" : "Evidence unavailable")
        : row || qualifyingOutcome
          ? [row?.status || qualifyingOutcome || resultLabel, row?.grid != null ? "grid " + row.grid : null, row?.calculatedPoints != null || row?.points != null ? (row.calculatedPoints ?? row.points) + " pts" : null, markerMeta.markerTitle || null]
            .filter(Boolean)
            .join(" · ")
          : round.evidence ? "No classified row" : "Evidence unavailable";
      return {
        ...buildAuditMatrixCell({
          round,
          cutoffRoundNumber,
          label: resultLabel,
          title: resultTitle,
          podiumPosition: podiumFocus ? null : podiumPosition,
          focusHit: podiumFocus && podiumHit,
          ...markerMeta
        }),
        pole,
        fastestLap,
        row
      };
    });
    const standing = (entity.id != null ? selectedDriverIdMap.get(Number(entity.id)) : null)
      || selectedDriverMap.get(driver)
      || null;
    const legacyStanding = selectedLegacyDriverMap.get(driver) || null;
    const constructor = entity.teamName || cells.map((cell) => cell.row?.constructor).find(Boolean) || null;
    const constructorEntity = teamEntities.find((item) => item.name === constructor);
    const summaryValue = podiumFocus
      ? cells.filter((cell) => cell.focusHit).length
      : standing?.points ?? null;
    return {
      name: driver,
      code: entity.code || fallbackEntityCode(driver, "driver"),
      id: entity.id,
      teamId: entity.teamId ?? null,
      seatNumber: entity.seatNumber == null ? null : Number(entity.seatNumber),
      constructor,
      constructorCode: constructorEntity?.code || (constructor ? fallbackEntityCode(constructor, "team") : null),
      cells,
      points: standing?.points ?? null,
      legacyPoints: legacyStanding?.points ?? null,
      reconciliationStatus: legacyStanding == null || standing == null
        ? "missing"
        : Number(legacyStanding.points) === Number(standing.points) ? "match" : "difference",
      summaryValue,
      championshipPosition: standing?.position ?? null
    };
  }), podiumFocus ? "summaryValue" : "points");

  const constructorRows = sortAuditRows(teamEntities.map((entity) => {
    const team = entity.name;
    const cells = rounds.map((round) => {
      if (!round.evidence) {
        return buildAuditMatrixCell({
          round,
          cutoffRoundNumber,
          label: "—",
          title: "Evidence unavailable"
        });
      }
      const raceRows = round.evidence.payload?.race?.rows || [];
      const sprintRows = round.evidence.payload?.sprint?.rows || [];
      const points = raceRows
        .filter((row) => matchesAuditEntity(row, entity, {
          idField: "team_id",
          nameField: "constructor"
        }))
        .concat(sprintRows.filter((row) => matchesAuditEntity(row, entity, {
          idField: "team_id",
          nameField: "constructor"
        })))
        .reduce((total, row) => total + Number(row.calculatedPoints ?? row.points ?? 0), 0);
      const podiumPosition = buildConstructorPodiumPosition(raceRows, entity);
      return buildAuditMatrixCell({
        round,
        cutoffRoundNumber,
        label: points,
        title: points + " points from race and sprint",
        podiumPosition
      });
    });
    const standing = (entity.id != null ? selectedConstructorIdMap.get(Number(entity.id)) : null)
      || selectedConstructorMap.get(team)
      || null;
    const legacyStanding = selectedLegacyConstructorMap.get(team) || null;
    return {
      name: team,
      code: entity.code || fallbackEntityCode(team, "team"),
      id: entity.id,
      powerUnit: entity.powerUnit || null,
      cells,
      points: standing?.points ?? null,
      legacyPoints: legacyStanding?.points ?? null,
      reconciliationStatus: legacyStanding == null || standing == null
        ? "missing"
        : Number(legacyStanding.points) === Number(standing.points) ? "match" : "difference",
      summaryValue: standing?.points ?? null,
      championshipPosition: standing?.position ?? null,
      podiumSummary: buildAuditPodiumSummary(cells)
    };
  }));

  const focusProjection = applyRaceDataFocus({
    focus: activeFocus,
    rounds,
    driverRows,
    constructorRows,
    cutoffRoundNumber,
    standingsByRound: derivedStandingsByRound,
    scoringRules
  });
  driverRows.splice(0, driverRows.length, ...focusProjection.drivers);
  constructorRows.splice(0, constructorRows.length, ...focusProjection.constructors);

  const buildUnavailableDriverRow = (team, seatNumber) => ({
    name: "—",
    code: "—",
    id: null,
    teamId: team.id ?? null,
    seatNumber,
    constructor: team.name,
    constructorCode: team.code || fallbackEntityCode(team.name, "team"),
    isEmpty: true,
    cells: rounds.map((round) => buildAuditMatrixCell({
      round,
      cutoffRoundNumber,
      label: "—",
      title: `Seat ${seatNumber} unavailable`
    })),
    points: null,
    summaryValue: null,
    championshipPosition: null
  });

  const constructorPointsMode = activeFocus.view === "constructors"
    && String(activeFocus.matrixMetric || activeFocus.metric || "points") === "championship_points_results";

  const constructorGroups = constructorRows.map((summary) => {
    const team = teamEntities.find((entity) => (
      summary.id != null && entity.id != null
        ? Number(entity.id) === Number(summary.id)
        : entity.name === summary.name
    )) || summary;
    const teamDrivers = driverRows
      .filter((row) => (
        summary.id != null && row.teamId != null
          ? Number(row.teamId) === Number(summary.id)
          : row.constructor === summary.name
      ))
      .sort((left, right) => (
        (Number(left.seatNumber) || 999) - (Number(right.seatNumber) || 999)
          || left.name.localeCompare(right.name)
      ));
    const displayTeamDrivers = constructorPointsMode
      ? teamDrivers.map((driver) => applyDriverPointsMetric({
        ...driver,
        cells: (driver.cells || []).map((cell) => ({ ...cell }))
      }, rounds))
      : teamDrivers;
    const driversBySeat = [1, 2].map((seatNumber) => (
      displayTeamDrivers.find((row) => Number(row.seatNumber) === seatNumber)
        || (displayTeamDrivers.every((row) => row.seatNumber == null)
          ? displayTeamDrivers[seatNumber - 1]
          : null)
        || buildUnavailableDriverRow({
          id: team.id,
          name: team.name,
          code: team.code
        }, seatNumber)
    ));
    return {
      id: summary.id,
      name: summary.name,
      summary,
      focusRow: Boolean(summary.focusRow),
      drivers: driversBySeat
    };
  });

  const payload = selected?.evidence?.payload || null;
  const raceRows = payload?.race?.rows || [];
  const sessionRowsByKey = {
    practice1: getRaceSessionRows(payload, "practice1"),
    practice2: getRaceSessionRows(payload, "practice2"),
    practice3: getRaceSessionRows(payload, "practice3"),
    sprintQualifying: getRaceSessionRows(payload, "sprintQualifying"),
    sprint: getRaceSessionRows(payload, "sprint"),
    qualifying: getRaceSessionRows(payload, "qualifying")
  };
  const qualifyingRows = sessionRowsByKey.qualifying;
  const sprintRows = sessionRowsByKey.sprint;
  const raceByDriver = new Map(raceRows.map((row) => [row.driver, row]));
  const raceResultOrderByDriver = new Map(
    raceRows.map((row, index) => [String(row.driver || ""), index])
  );
  const qualifyingByDriver = new Map(qualifyingRows.map((row) => [row.driver, row]));
  const sprintByDriver = new Map(sprintRows.map((row) => [row.driver, row]));
  const sessionDriverNames = Object.values(sessionRowsByKey)
    .flatMap((rows) => rows.map((row) => row.driver));
  const detailNames = Array.from(
    new Set(
      drivers.concat(
        raceRows.map((row) => row.driver),
        sessionDriverNames
      )
    )
  ).filter(Boolean);
  const driverCodeByName = new Map(
    driverEntities.map((entity) => [
      entity.name,
      entity.code || fallbackEntityCode(entity.name, "driver")
    ])
  );
  const teamCodeByName = new Map(
    teamEntities.map((entity) => [
      entity.name,
      entity.code || fallbackEntityCode(entity.name, "team")
    ])
  );
  const findSessionRow = (rows, driver) => rows.find((row) => String(row.driver || "") === String(driver)) || null;
  const buildSessionDetail = (row) => row ? {
    label: auditResultLabel(row),
    title: [row.status || null, row.position != null ? `position ${row.position}` : null]
      .filter(Boolean)
      .join(" · ") || auditResultLabel(row)
  } : null;
  const buildSessionEditorValue = (row) => row ? {
    driverId: row.driver_id == null ? null : Number(row.driver_id),
    driver: row.driver || null,
    constructor: row.constructor || null,
    position: row.position == null ? null : Number(row.position),
    positionText: row.positionText || null,
    status: row.status || null
  } : null;
  const detailRows = detailNames.map((driver) => {
    const race = raceByDriver.get(driver) || null;
    const qualifying = qualifyingByDriver.get(driver) || null;
    const sprint = sprintByDriver.get(driver) || null;
    const allSessionRows = Object.values(sessionRowsByKey).map((rows) => findSessionRow(rows, driver));
    const driverId = race?.driver_id
      ?? qualifying?.driver_id
      ?? sprint?.driver_id
      ?? allSessionRows.find((row) => row?.driver_id != null)?.driver_id
      ?? null;
    const constructor = race?.constructor
      || qualifying?.constructor
      || sprint?.constructor
      || allSessionRows.find((row) => row?.constructor)?.constructor
      || null;
    return {
      driver,
      driverCode: driverCodeByName.get(driver) || fallbackEntityCode(driver, "driver"),
      driverId,
      hasEvidence: Boolean(race || qualifying || sprint || allSessionRows.some(Boolean)),
      constructor,
      constructorCode: teamCodeByName.get(constructor || "")
        || fallbackEntityCode(constructor || "", "team"),
      sessions: Object.fromEntries(
        Object.entries(sessionRowsByKey).map(([sessionKey, rows]) => [
          sessionKey,
          buildSessionDetail(findSessionRow(rows, driver))
        ])
      ),
      sessionValues: Object.fromEntries(
        Object.entries(sessionRowsByKey).map(([sessionKey, rows]) => [
          sessionKey,
          buildSessionEditorValue(findSessionRow(rows, driver))
        ])
      ),
      grid: race?.grid ?? null,
      qualifyingPosition: qualifying?.position ?? null,
      sprintPosition: sprint?.position ?? null,
      sprintStatus: sprint?.status || null,
      sprintPoints: sprint?.points ?? null,
      // A provider may encode a non-classified result with position `0`.
      // Keep the numeric finish position only for classified finishers so the
      // detail table can use the status label (Ret/DNS/DNQ) for the others.
      racePositionNumber: Number(race?.position) > 0 ? Number(race.position) : null,
      racePosition: Number(race?.position) > 0 ? String(race.position) : null,
      finishLabel: formatRaceFinishLabel(race?.position),
      raceLabel: formatRacePositionLabel(race),
      raceStatus: race?.status || null,
      raceStatusLabel: formatRaceStatusLabel(race),
      raceLaps: race?.laps ?? null,
      raceGap: race?.sessionGap ?? race?.gap_to_leader ?? null,
      raceResultOrder: raceResultOrderByDriver.get(String(driver)) ?? Number.MAX_SAFE_INTEGER,
      racePoints: race?.calculatedPoints ?? race?.points ?? null
    };
  }).sort((left, right) => {
    const leftPosition = Number(left.racePosition);
    const rightPosition = Number(right.racePosition);
    const leftClassified = Number.isFinite(leftPosition) && leftPosition > 0;
    const rightClassified = Number.isFinite(rightPosition) && rightPosition > 0;
    if (leftClassified && rightClassified) {
      return leftPosition - rightPosition || String(left.driver).localeCompare(String(right.driver));
    }
    if (leftClassified !== rightClassified) return leftClassified ? -1 : 1;
    const leftLaps = Number.isFinite(Number(left.raceLaps)) ? Number(left.raceLaps) : -1;
    const rightLaps = Number.isFinite(Number(right.raceLaps)) ? Number(right.raceLaps) : -1;
    return rightLaps - leftLaps
      || left.raceResultOrder - right.raceResultOrder
      || String(left.driver).localeCompare(String(right.driver));
  });

  return {
    rounds,
    drivers: driverRows,
    constructors: constructorRows,
    constructorGroups,
    selectedRound: selected,
    selectedRoundNumber: selected?.roundNumber || cutoffRoundNumber,
    // This is the semantic name used by the UI: the selected round is the
    // temporary end of the observed season, not a destructive data cutoff.
    effectiveEndRound: cutoffRoundNumber,
    hasSelectedRound: showRaceResult !== false,
    cutoffRoundNumber,
    selectedEvidence: selected?.evidence || null,
    selectedSnapshotId: selected?.evidence?.id || null,
    selectedSummary,
    detailRows,
    latestEvidence,
    latestEvidenceRound,
    snapshotRows,
    catalogRevision,
    focus: activeFocus,
    focusId: activeFocus.id,
    focusSummary: focusProjection.summary,
    focusFooter: focusProjection.footer,
    scoringRules: scoringRulesTableValue(scoringRules),
    selectedReconciliation: {
      drivers: reconcileStandings(selectedLegacyStandings.drivers, selectedDerivedStandings.drivers),
      constructors: reconcileStandings(selectedLegacyStandings.constructors, selectedDerivedStandings.constructors)
    }
  };
}

function parseCorrectionNumber(raw, label, { integer = true, min = 0, max = 1000 } = {}) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    throw new Error(`${label} must be empty or a valid value between ${min} and ${max}.`);
  }
  return value;
}

function correctionRowsInput(rawRows) {
  if (Array.isArray(rawRows)) return rawRows;
  if (!rawRows || typeof rawRows !== "object") return [];
  return Object.keys(rawRows)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => rawRows[key]);
}

function correctionLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function correctionIdentity(row) {
  const driverId = Number(row?.driverId || row?.driver_id || 0);
  if (Number.isInteger(driverId) && driverId > 0) return `id:${driverId}`;
  const driver = correctionLookupKey(row?.driver || row?.driver_name || "");
  return driver ? `name:${driver}` : null;
}

function evidenceRowIdentity(row) {
  const driverId = Number(row?.driver_id || 0);
  if (Number.isInteger(driverId) && driverId > 0) return `id:${driverId}`;
  const driver = correctionLookupKey(row?.driver || row?.driver_name || "");
  return driver ? `name:${driver}` : null;
}

function correctedSessionValue(raw, label) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return { position: null, positionText: null, status: null };
  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 99) {
    return { position: numeric, positionText: String(numeric), status: "Finished" };
  }
  if (text.length > 120) throw new Error(`${label} is too long.`);
  return { position: null, positionText: text, status: text };
}

function evidenceRowCollections(payload) {
  return [
    ["race", payload?.race?.rows],
    ["sessions.race", payload?.sessions?.race?.rows],
    ["qualifying", payload?.qualifying?.rows],
    ["sessions.qualifying", payload?.sessions?.qualifying?.rows],
    ["sprint", payload?.sprint?.rows],
    ["sessions.sprint", payload?.sessions?.sprint?.rows],
    ["practice1", payload?.practice?.practice1?.rows],
    ["sessions.practice1", payload?.sessions?.practice1?.rows],
    ["practice2", payload?.practice?.practice2?.rows],
    ["sessions.practice2", payload?.sessions?.practice2?.rows],
    ["practice3", payload?.practice?.practice3?.rows],
    ["sessions.practice3", payload?.sessions?.practice3?.rows],
    ["sprintQualifying", payload?.sprintQualifying?.rows],
    ["sessions.sprintQualifying", payload?.sessions?.sprintQualifying?.rows]
  ].filter(([, rows]) => Array.isArray(rows));
}

function buildCorrectedRaceEvidence(baseSnapshot, input) {
  const payload = baseSnapshot?.payload;
  if (!payload || !Array.isArray(payload.race?.rows)) {
    throw new Error("The selected race evidence cannot be edited.");
  }
  const submittedRows = correctionRowsInput(input.rows);
  if (!submittedRows.length) throw new Error("The complete race table is required.");

  const nextPayload = JSON.parse(JSON.stringify(payload));
  const collections = evidenceRowCollections(nextPayload);
  const knownIdentities = new Set(
    collections.flatMap(([, rows]) => rows.map(evidenceRowIdentity).filter(Boolean))
  );
  const seenIdentities = new Set();
  const normalizedRows = submittedRows.map((submitted, index) => {
    const identity = correctionIdentity(submitted);
    if (!identity || !knownIdentities.has(identity)) {
      throw new Error(`Row ${index + 1} does not match a persisted driver identity.`);
    }
    if (seenIdentities.has(identity)) {
      throw new Error(`Driver row ${index + 1} is duplicated in the correction.`);
    }
    seenIdentities.add(identity);
    return { submitted, identity, index };
  });
  if (seenIdentities.size !== knownIdentities.size) {
    throw new Error("The complete race table must include every persisted driver row.");
  }

  const updateRows = (rows, identity, updater) => {
    const target = rows.find((candidate) => evidenceRowIdentity(candidate) === identity);
    if (target) updater(target);
  };
  const sessionKeys = ["practice1", "practice2", "practice3", "sprintQualifying", "sprint", "qualifying"];
  normalizedRows.forEach(({ submitted, identity, index }) => {
    const position = parseCorrectionNumber(submitted.position, `Row ${index + 1} finish position`, { min: 1, max: 99 });
    const grid = parseCorrectionNumber(submitted.grid, `Row ${index + 1} grid position`, { min: 1, max: 99 });
    const points = parseCorrectionNumber(submitted.points, `Row ${index + 1} points`, { integer: false, min: 0, max: 200 });
    const status = String(submitted.status == null ? "" : submitted.status).trim();
    if (status.length > 120) throw new Error(`Row ${index + 1} status is too long.`);
    collections.forEach(([collection, rows]) => {
      if (collection === "race" || collection === "sessions.race") {
        updateRows(rows, identity, (target) => {
          target.position = position;
          target.positionText = position == null ? (status || null) : String(position);
          target.grid = grid;
          target.points = points == null ? 0 : points;
          target.calculatedPoints = points == null ? 0 : points;
          target.status = status || (position != null ? "Finished" : null);
        });
      }
    });
    const sessionInput = submitted.sessions || {};
    sessionKeys.forEach((sessionKey) => {
      if (!Object.prototype.hasOwnProperty.call(sessionInput, sessionKey)) return;
      const corrected = correctedSessionValue(sessionInput[sessionKey], `Row ${index + 1} ${sessionKey}`);
      collections.forEach(([collection, rows]) => {
        if (collection === sessionKey || collection === `sessions.${sessionKey}`) {
          updateRows(rows, identity, (target) => {
            target.position = corrected.position;
            target.positionText = corrected.positionText;
            target.status = corrected.status;
          });
        }
      });
    });
  });
  return nextPayload;
}

function rederiveActualSnapshotFromRaceEvidence({
  db,
  season,
  roundNumber,
  roundName,
  questions,
  roster,
  races,
  catalog,
  evidenceSnapshot
}) {
  const derived = deriveSnapshotsFromPersistedEvidence(db, {
    season,
    rounds: [Number(roundNumber)],
    questions,
    roster,
    races,
    totalRounds: races.length
  })[0];
  const values = derived?.values || {};
  const result = upsertSnapshotForRound(db, {
    season,
    roundNumber,
    roundName: roundName || derived?.roundName || `Round ${roundNumber}`,
    valuesByQuestion: values,
    sourceType: "race_data_derivation",
    sourceNote: "Derived from the persisted race-data evidence revision",
    label: `R${roundNumber} - ${roundName || derived?.roundName || `Round ${roundNumber}`}`,
    reviewStatus: REVIEW_STATUS_PENDING,
    preserveReviewIfUnchanged: true,
    catalogRevision: catalog?.catalogRevision || null,
    evidenceRevision: evidenceSnapshot?.payload_revision || evidenceSnapshot?.sync_id || null,
    derivationVersion: "race-data-derivation-v5"
  });
  if (result?.snapshotId && evidenceSnapshot?.id) {
    linkEvidenceToActualSnapshot(db, result.snapshotId, evidenceSnapshot.id, evidenceSnapshot.import_id || null);
  }
  return { ...result, valueCount: Object.keys(values).length };
}

function registerAdminRoutes(app, deps) {
  const {
    db,
    requireAdmin,
    getCurrentUser,
    getQuestions,
    getRoster,
    getRaces,
    generateUniqueGroupId,
    dataDir,
    dbPath,
    databaseUrl,
    questionsPath,
    rosterPath,
    racesPath,
    logEvent,
    runActualsAutoUpdate: runAutoUpdate = runActualsAutoUpdate
  } = deps;
  const CURRENT_SEASON = Number(process.env.F1_SEASON || 2026);
  const logAdminEvent = (level, event, fields = {}) => {
    const season = Number(fields.season);
    if (!Number.isInteger(season) || season < 1900 || fields.catalogRevision != null) {
      return logEvent(level, event, fields);
    }
    try {
      const questions = getQuestions("en", {
        includeExcluded: true,
        includeMeta: true,
        season: Number.isInteger(season) && season >= 1900 ? season : CURRENT_SEASON
      });
      const catalog = buildSeasonCatalog(db, season, { questions });
      return logEvent(level, event, { ...fields, catalogRevision: catalog.catalogRevision || null });
    } catch (err) {
      return logEvent(level, event, { ...fields, catalogRevision: null });
    }
  };
  function buildQuestionResultsModel({ season, locale, seasonContext }) {
    const sourceQuestions = getQuestions(locale, { season });
    // Results remain useful for a valid season even when a legacy/test database
    // has not populated the season catalog yet; the evidence and question
    // settings are still keyed by the selected year.
    let catalog = null;
    try {
      catalog = buildSeasonCatalog(db, season, { questions: sourceQuestions });
    } catch (error) {
      catalog = null;
    }
    const questions = attachSeasonCatalogToQuestions(sourceQuestions, catalog);
    const races = (catalog?.races?.length
      ? catalog.races.map((race) => race.display_name)
      : getRaces()) || [];
    const publishedActuals = loadPublishedActuals(db, season);
    const latestSnapshots = listLatestSnapshotsForSeason(db, season, {
      maxRoundNumber: races.length || null
    });
    const latestRoundSnapshot = findLatestRoundSnapshotForSeason(season, {
      maxRoundNumber: races.length || null
    });
    const latestRoundNumber = Number.isFinite(Number(latestRoundSnapshot?.round_number))
      ? Number(latestRoundSnapshot.round_number)
      : null;
    const overview = buildActualsOverview({
      season,
      races,
      questions,
      snapshots: latestSnapshots,
      latestRoundNumber,
      publishedActuals,
      fetchSnapshotValues: (snapshotId) => loadSnapshotValues(db, snapshotId)
    });
    return {
      resultsQuestions: questions,
      races,
      actualOverviewRows: overview.rows,
      actualOverviewTargets: overview.targets,
      catalogRevision: catalog?.catalogRevision || null,
      catalogReadiness: catalog?.readiness || null
    };
  }
  const MULTI_ACTUAL_SINGLE_CHOICE_IDS = new Set([
    "most_driver_of_the_day",
    "most_dnfs_driver",
    "destructors_driver",
    "destructors_team",
    "most_points_no_podium",
    "closest_qualifying_teammates"
  ]);
  const MULTI_ACTUAL_DRIVER_FIELD_IDS = new Set([
    "lowest_grid_win_position"
  ]);
  const ADMIN_IDEA_TYPES = ["question", "feature", "other"];
  const ADMIN_IDEA_STATUSES = ["open", "resolved", "ignored"];

  function parsePointsOverrideInput(raw, questionId) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Question "${questionId}": points override must be valid JSON (for example: 10 or {"1st":50,"2nd":25}).`
      );
    }
    const isPlainObject =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed);
    if (typeof parsed === "number") {
      if (!Number.isFinite(parsed)) {
        throw new Error(`Question "${questionId}": points number must be finite.`);
      }
      return parsed;
    }
    if (isPlainObject) return parsed;
    throw new Error(
      `Question "${questionId}": points override must be a number or JSON object.`
    );
  }

  function withQueryParam(path, key, value) {
    const fullPath = String(path || "");
    const hashIndex = fullPath.indexOf("#");
    const basePath = hashIndex >= 0 ? fullPath.slice(0, hashIndex) : fullPath;
    const hash = hashIndex >= 0 ? fullPath.slice(hashIndex) : "";
    const separator = basePath.includes("?") ? "&" : "?";
    return `${basePath}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
  }

  function normalizeAdminIdeaType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ADMIN_IDEA_TYPES.includes(normalized) ? normalized : "question";
  }

  function normalizeAdminIdeaStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ADMIN_IDEA_STATUSES.includes(normalized) ? normalized : null;
  }

  function mapAdminIdeaRow(row) {
    return {
      ...row,
      id: Number(row.id),
      created_by_user_id:
        row.created_by_user_id == null ? null : Number(row.created_by_user_id),
      updated_by_user_id:
        row.updated_by_user_id == null ? null : Number(row.updated_by_user_id)
    };
  }

  function listAdminIdeas() {
    return db
      .prepare(
        `
        SELECT
          ai.*,
          creator.name AS created_by_name,
          updater.name AS updated_by_name
        FROM admin_ideas ai
        LEFT JOIN users creator ON creator.id = ai.created_by_user_id
        LEFT JOIN users updater ON updater.id = ai.updated_by_user_id
        ORDER BY
          CASE ai.status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END,
          COALESCE(ai.updated_at, ai.created_at) DESC,
          ai.id DESC
        `
      )
      .all()
      .map(mapAdminIdeaRow);
  }

  function getSnapshotRoundOptions(season = CURRENT_SEASON) {
    const catalog = listSeasonInputs(db, season);
    return { maxRoundNumber: catalog.races.length || getRaces().length };
  }

  function findLatestRoundSnapshotForSeason(season, options = {}) {
    return loadLatestRoundSnapshotForSeason(db, season, {
      ...getSnapshotRoundOptions(season),
      ...options
    });
  }

  function fetchSnapshotValues(snapshotId) {
    return loadSnapshotValues(db, snapshotId);
  }


  function validatePointsOverrideType(question, parsedOverride) {
    const basePoints = question?._basePoints;
    const baseIsObject =
      basePoints &&
      typeof basePoints === "object" &&
      !Array.isArray(basePoints);
    const baseIsNumber = typeof basePoints === "number";
    const overrideIsObject =
      parsedOverride &&
      typeof parsedOverride === "object" &&
      !Array.isArray(parsedOverride);
    const overrideIsNumber = typeof parsedOverride === "number";

    if (baseIsObject && !overrideIsObject) {
      throw new Error(
        `Question "${question.id}": this question expects points as a JSON object.`
      );
    }
    if (baseIsNumber && !overrideIsNumber) {
      throw new Error(
        `Question "${question.id}": this question expects points as a number.`
      );
    }
  }

  function sourceOptionsForQuestion(question, roster, races) {
    if (question.options_source === "drivers") return roster.drivers || [];
    if (question.options_source === "teams") return roster.teams || [];
    if (question.options_source === "races") return races || [];
    return [];
  }

  function dedupeOptions(values) {
    const seen = new Set();
    const out = [];
    for (const raw of values || []) {
      const value = String(raw);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }

  function randomInt(min, max) {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.max(1e-12, Math.random());
    const u2 = Math.max(1e-12, Math.random());
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomOne(values) {
    if (!values || values.length === 0) return null;
    return values[randomInt(0, values.length - 1)];
  }

  function randomUniqueSubset(values, count) {
    const copy = [...(values || [])];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
  }

  function rankByScore(values, scoreMap, count = 1, ascending = false) {
    return [...(values || [])]
      .sort((a, b) => {
        const aScore = Number(scoreMap[a] || 0);
        const bScore = Number(scoreMap[b] || 0);
        return ascending ? aScore - bScore : bScore - aScore;
      })
      .slice(0, Math.max(1, count));
  }

  function buildPredictionModel(roster) {
    const drivers = roster?.drivers || [];
    const teams = roster?.teams || [];
    const teamBase = {
      McLaren: 95,
      Ferrari: 92,
      "Red Bull Racing": 90,
      Mercedes: 88,
      Williams: 75,
      "Aston Martin": 73,
      "Racing Bulls": 69,
      "Haas F1 Team": 66,
      Audi: 63,
      Alpine: 60,
      Cadillac: 55
    };
    const driverTeam = {
      "Max Verstappen": "Red Bull Racing",
      "Sergio Perez": "Red Bull Racing",
      "Lando Norris": "McLaren",
      "Oscar Piastri": "McLaren",
      "Charles Leclerc": "Ferrari",
      "Lewis Hamilton": "Ferrari",
      "George Russell": "Mercedes",
      "Kimi Antonelli": "Mercedes",
      "Fernando Alonso": "Aston Martin",
      "Lance Stroll": "Aston Martin",
      "Carlos Sainz Jr.": "Williams",
      "Alexander Albon": "Williams",
      "Esteban Ocon": "Haas F1 Team",
      "Oliver Bearman": "Haas F1 Team",
      "Liam Lawson": "Racing Bulls",
      "Arvid Lindblad": "Racing Bulls",
      "Pierre Gasly": "Alpine",
      "Isack Hadjar": "Alpine",
      "Nico Hulkenberg": "Audi",
      "Gabriel Bortoleto": "Audi",
      "Valtteri Bottas": "Cadillac",
      "Franco Colapinto": "Cadillac"
    };
    const driverSkill = {
      "Max Verstappen": 98,
      "Lando Norris": 95,
      "Oscar Piastri": 94,
      "Charles Leclerc": 93,
      "Lewis Hamilton": 92,
      "George Russell": 91,
      "Kimi Antonelli": 88,
      "Carlos Sainz Jr.": 86,
      "Fernando Alonso": 86,
      "Sergio Perez": 85,
      "Alexander Albon": 84,
      "Pierre Gasly": 82,
      "Esteban Ocon": 81,
      "Nico Hulkenberg": 80,
      "Liam Lawson": 79,
      "Oliver Bearman": 78,
      "Valtteri Bottas": 77,
      "Lance Stroll": 76,
      "Arvid Lindblad": 75,
      "Isack Hadjar": 74,
      "Gabriel Bortoleto": 73,
      "Franco Colapinto": 72
    };

    for (const team of teams) {
      if (!Object.prototype.hasOwnProperty.call(teamBase, team)) {
        teamBase[team] = 62;
      }
    }
    for (const driver of drivers) {
      if (!Object.prototype.hasOwnProperty.call(driverTeam, driver)) {
        driverTeam[driver] = teams[0] || "";
      }
      if (!Object.prototype.hasOwnProperty.call(driverSkill, driver)) {
        driverSkill[driver] = 75;
      }
    }

    const teamDrivers = {};
    for (const team of teams) teamDrivers[team] = [];
    for (const driver of drivers) {
      const team = driverTeam[driver];
      if (!teamDrivers[team]) teamDrivers[team] = [];
      teamDrivers[team].push(driver);
    }

    const expectedDriver = {};
    for (const driver of drivers) {
      expectedDriver[driver] =
        Number(teamBase[driverTeam[driver]] || 60) +
        Number(driverSkill[driver] || 75) * 0.45;
    }

    const expectedTeam = {};
    for (const team of teams) {
      expectedTeam[team] = (teamDrivers[team] || []).reduce(
        (sum, driver) => sum + Number(expectedDriver[driver] || 0),
        0
      );
    }

    return {
      teamBase,
      driverTeam,
      driverSkill,
      teamDrivers,
      expectedDriver,
      expectedTeam
    };
  }

  function createPredictionProfile() {
    return {
      knowledge: clamp(0.62 + randomNormal(0, 0.16), 0.2, 0.96),
      boldness: clamp(0.45 + randomNormal(0, 0.18), 0.05, 0.95)
    };
  }

  function smartAnswerForQuestion(question, roster, races, model, profile) {
    const drivers = roster.drivers || [];
    const teams = roster.teams || [];
    const options = dedupeOptions([
      ...(Array.isArray(question.options) ? question.options : []),
      ...sourceOptionsForQuestion(question, roster, races)
    ]);
    const noise = 22 * (1 - profile.knowledge) + 2;
    const pickBoolean = (priorYes) => {
      const pull = 0.55 + profile.knowledge * 0.85;
      const p = clamp(0.5 + (priorYes - 0.5) * pull + randomNormal(0, 0.06), 0.02, 0.98);
      return Math.random() < p ? "yes" : "no";
    };

    const id = question.id;
    if (id === "drivers_championship_top_3") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise)])
      );
      return rankByScore(drivers, scores, 3);
    }
    if (id === "drivers_championship_last") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise)])
      );
      return rankByScore(drivers, scores, 1, true)[0] || null;
    }
    if (id === "constructors_championship_top_3") {
      const scores = Object.fromEntries(
        teams.map((team) => [team, Number(model.expectedTeam[team] || 0) + randomNormal(0, noise * 0.8)])
      );
      return rankByScore(teams, scores, 3);
    }
    if (id === "constructors_championship_last") {
      const scores = Object.fromEntries(
        teams.map((team) => [team, Number(model.expectedTeam[team] || 0) + randomNormal(0, noise * 0.8)])
      );
      return rankByScore(teams, scores, 1, true)[0] || null;
    }
    if (id === "all_teams_score_points") return pickBoolean(0.44);
    if (id === "most_driver_of_the_day") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise * 0.55)])
      );
      return rankByScore(drivers, scores, 1)[0] || null;
    }
    if (id === "most_dnfs_driver" || id === "destructors_driver") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, (100 - Number(model.driverSkill[driver] || 75)) + randomNormal(0, noise * 0.7)])
      );
      return rankByScore(drivers, scores, 1)[0] || null;
    }
    if (id === "destructors_team") {
      const orderedByExpected = rankByScore(teams, model.expectedTeam, teams.length, true);
      const rankByTeam = new Map(orderedByExpected.map((team, idx) => [team, idx]));
      const lastIndex = Math.max(1, orderedByExpected.length - 1);
      const volatility = 0.08 + (1 - profile.knowledge) * 0.22 + profile.boldness * 0.1;

      const weighted = teams.map((team) => {
        const rankIndex = Number(rankByTeam.get(team) || 0);
        const rankRisk = 1 - rankIndex / lastIndex;
        const teamDrivers = model.teamDrivers[team] || [];
        const avgSkill = teamDrivers.length
          ? teamDrivers.reduce((sum, driver) => sum + Number(model.driverSkill[driver] || 75), 0) / teamDrivers.length
          : 75;
        const driverRisk = clamp((100 - avgSkill) / 28, 0.05, 1.2);
        const riskScore = clamp(
          0.62 * rankRisk + 0.38 * driverRisk + randomNormal(0, volatility),
          0.01,
          1.5
        );
        const weight = Math.max(0.01, Math.pow(riskScore, 0.9));
        return { team, weight };
      });

      const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
      if (totalWeight <= 0) return randomOne(teams) || null;
      let roll = Math.random() * totalWeight;
      for (const entry of weighted) {
        roll -= entry.weight;
        if (roll <= 0) return entry.team;
      }
      return weighted[weighted.length - 1]?.team || null;
    }
    if (id === "all_podium_finishers") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise * 0.55)])
      );
      const count = clamp(Math.round(7 + profile.knowledge * 5 + randomNormal(0, 1.8)), 4, Math.min(16, drivers.length));
      return rankByScore(drivers, scores, count);
    }
    if (question.type === "teammate_battle") {
      const pair = Array.isArray(question.options) ? question.options.slice(0, 2) : [];
      if (pair.length < 2) return null;
      const left = pair[0];
      const right = pair[1];
      const baseLeft = Number(model.expectedDriver[left] || 0);
      const baseRight = Number(model.expectedDriver[right] || 0);
      const spread = Math.max(0.35, noise * 0.12);
      const leftScore = baseLeft + randomNormal(0, spread);
      const rightScore = baseRight + randomNormal(0, spread);
      const gap = Math.abs(leftScore - rightScore);
      const tieWindow = clamp(0.35 + (1 - profile.knowledge) * 0.55, 0.35, 0.9);
      const tieChance =
        gap < tieWindow
          ? clamp(0.72 - gap / (tieWindow * 1.5), 0.12, 0.72)
          : 0.06;
      const winner = Math.random() < tieChance ? "tie" : (leftScore > rightScore ? left : right);
      const diff =
        winner === "tie"
          ? 0
          : Math.max(0, Math.round(gap * 3 + randomNormal(0, noise * 0.45)));
      return { winner, diff };
    }
    if (id === "alpine_vs_cadillac_audi") {
      const alpine = Number(model.expectedTeam.Alpine || 0);
      const combined =
        Number(model.expectedTeam.Cadillac || 0) +
        Number(model.expectedTeam.Audi || 0) +
        Number(model.expectedTeam["Aston Martin"] || 0);
      const prior = alpine > combined ? 0.6 : 0.12;
      const pMore = clamp(prior + (profile.boldness - 0.5) * 0.08, 0.02, 0.95);
      return Math.random() < pMore ? "More" : "Less";
    }
    if (id === "most_points_no_podium") {
      const allPodiumLabel =
        options.find((value) => String(value).toLowerCase().includes("all teams scored a podium")) ||
        "All teams scored a podium";
      const orderedTeams = rankByScore(teams, model.expectedTeam, teams.length);
      const rankByTeam = new Map(orderedTeams.map((team, idx) => [team, idx]));
      const lastIndex = Math.max(1, orderedTeams.length - 1);
      const nonPodiumScores = Object.fromEntries(
        teams.map((team) => {
          const expected = Number(model.expectedTeam[team] || 0);
          const rankIndex = Number(rankByTeam.get(team) || 0);
          const podiumChance = clamp(0.88 - (rankIndex / lastIndex) * 0.78, 0.1, 0.88);
          const nonPodiumPotential = expected * (1 - podiumChance);
          return [team, nonPodiumPotential + randomNormal(0, noise * 0.45)];
        })
      );
      const likely = rankByScore(teams, nonPodiumScores, 1)[0] || allPodiumLabel;
      if (Math.random() < 0.03) return allPodiumLabel;
      return likely;
    }
    if (id === "race_ban") {
      const yes = pickBoolean(0.22) === "yes";
      if (!yes) return { choice: "no", driver: null };
      const riskScores = Object.fromEntries(
        drivers.map((driver) => [driver, (100 - Number(model.driverSkill[driver] || 75)) + randomNormal(0, noise * 0.7)])
      );
      return { choice: "yes", driver: rankByScore(drivers, riskScores, 1)[0] || null };
    }
    if (id === "lowest_grid_win_position") {
      const valueOptions = options.filter((value) => value != null && value !== "");
      const numeric = valueOptions
        .filter((value) => String(value).toLowerCase() !== "pitlane")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const min = numeric.length ? Math.min(...numeric) : 1;
      const max = numeric.length ? Math.max(...numeric) : 22;
      const mean = 3.3 + (1 - profile.knowledge) * 2.2 + randomNormal(0, 1.7);
      const position = clamp(Math.round(mean), min, max);
      const value = Math.random() < 0.02 ? "Pitlane" : String(position);
      const driverScores = Object.fromEntries(
        drivers.map((driver) => [
          driver,
          Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise * 0.65)
        ])
      );
      const driver = rankByScore(drivers, driverScores, 1)[0] || null;
      return { value, driver };
    }
    if (id === "select_three_races_dnfs") {
      const raceScores = Object.fromEntries(
        (races || []).map((race) => [
          race,
          (/monaco|singapore|azerbaijan|las vegas|sao paulo/i.test(race) ? 3 : 1) +
            randomNormal(0, (1 - profile.knowledge) * 1.2)
        ])
      );
      return rankByScore(races || [], raceScores, Math.max(1, Number(question.count) || 3));
    }
    if (id === "closest_qualifying_teammates") {
      const teamScores = {};
      for (const team of teams) {
        const pair = model.teamDrivers[team] || [];
        if (pair.length < 2) {
          teamScores[team] = -999;
          continue;
        }
        const diff = Math.abs(
          Number(model.driverSkill[pair[0]] || 75) -
            Number(model.driverSkill[pair[1]] || 75)
        );
        teamScores[team] = -diff + randomNormal(0, noise * 0.2);
      }
      return rankByScore(teams, teamScores, 1)[0] || null;
    }
    if (id === "races_before_title_decided") {
      const top2 = rankByScore(drivers, model.expectedDriver, 2);
      const lead = Math.abs(
        Number(model.expectedDriver[top2[0]] || 0) -
          Number(model.expectedDriver[top2[1]] || 0)
      );
      return clamp(Math.round(lead / 4.2 + randomNormal(0, 1.7 + (1 - profile.knowledge))), 0, 10);
    }
    if (id === "mini_q1_first_race_winner_champion") return pickBoolean(0.24);
    if (id === "mini_q2_mercedes_engines_top5") return pickBoolean(0.48);
    if (id === "mini_q3_ferrari_podium") return pickBoolean(0.66);
    if (id === "mini_q4_sprint_champion_same") return pickBoolean(0.56);
    if (id === "mini_q5_team_engine_switch_2027_2028") return pickBoolean(0.52);

    const type = question.type || "text";
    if (type === "ranking") {
      const count = Math.max(1, Number(question.count) || 3);
      if (options.length === 0) return null;
      return randomUniqueSubset(options, count);
    }
    if (type === "single_choice") return randomOne(options);
    if (type === "multi_select") {
      if (options.length === 0) return null;
      const count = randomInt(1, Math.max(1, Math.min(6, options.length)));
      return randomUniqueSubset(options, count);
    }
    if (type === "multi_select_limited") {
      if (!Array.isArray(races) || races.length === 0) return null;
      return randomUniqueSubset(races, Math.max(1, Number(question.count) || 3));
    }
    if (type === "teammate_battle") {
      const winners = dedupeOptions(question.options || []);
      if (winners.length === 0) return null;
      const tie = Math.random() < 0.1;
      return tie
        ? { winner: "tie", diff: 0 }
        : { winner: randomOne(winners), diff: randomInt(0, 220) };
    }
    if (type === "boolean_with_optional_driver") {
      const yes = Math.random() < 0.5;
      return {
        choice: yes ? "yes" : "no",
        driver: yes ? randomOne(roster.drivers || []) : null
      };
    }
    if (type === "numeric_with_driver") {
      return {
        value: randomInt(0, 30),
        driver: randomOne(roster.drivers || [])
      };
    }
    if (type === "single_choice_with_driver") {
      return {
        value: randomOne(options),
        driver: randomOne(roster.drivers || [])
      };
    }
    if (type === "boolean") return Math.random() < 0.5 ? "yes" : "no";
    if (type === "numeric") return randomInt(0, 30);
    if (type === "textarea" || type === "text") {
      return randomOne(options) || `Simulated answer ${randomInt(1, 999)}`;
    }
    return null;
  }

  function serializeAnswerForStorage(question, answerValue) {
    const canonical = (value) => canonicalizeQuestionValue(
      question,
      value,
      buildCanonicalCatalog(listSeasonInputs(db, CURRENT_SEASON))
    );
    if (answerValue == null || answerValue === "") return null;
    const type = question.type || "text";
    if (type === "single_choice" && Array.isArray(answerValue)) {
      return JSON.stringify(canonical(answerValue));
    }
    if (
      type === "ranking" ||
      type === "multi_select" ||
      type === "multi_select_limited" ||
      type === "teammate_battle" ||
      type === "boolean_with_optional_driver" ||
      type === "numeric_with_driver" ||
      type === "single_choice_with_driver"
    ) {
      return JSON.stringify(canonical(answerValue));
    }
    if (type === "numeric") return String(Number(answerValue));
    return String(canonical(answerValue));
  }

  const parseStoredValue = leaderboardModel.parseLeaderboardStoredValue;
  const scoreQuestion = leaderboardModel.scoreLeaderboardQuestion;

  function impactLabel(flipPercent, winnerShare) {
    if (flipPercent >= 35 || winnerShare >= 12) return "HIGH";
    if (flipPercent >= 15 || winnerShare >= 6) return "MED";
    return "LOW";
  }

  function buildLeaderboardRows({ questions, actualsMap, members, responses }) {
    const questionMap = questions.reduce((acc, q) => {
      acc[q.id] = q;
      return acc;
    }, {});
    const scoreByUser = {};

    members.forEach((member) => {
      scoreByUser[member.user_id] = {
        userId: member.user_id,
        name: member.user_name,
        total: 0,
        byQuestion: {},
        answersByQuestion: {}
      };
    });

    responses.forEach((row) => {
      const question = questionMap[row.question_id];
      if (!question) return;
      const userScore = scoreByUser[row.user_id];
      if (!userScore) return;
      const actual = parseStoredValue(question, actualsMap[question.id]);
      const predicted = parseStoredValue(question, row.answer);
      const points = scoreQuestion(question, predicted, actual);
      userScore.total += points;
      userScore.byQuestion[row.question_id] = points;
      userScore.answersByQuestion[row.question_id] = row.answer;
    });

    return Object.values(scoreByUser).sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    );
  }

  function buildGroupAnalysis(groupId, questions, actualsMap, simulatedMembers, responses) {
    let scoredQuestionCount = 0;
    for (const question of questions) {
      const actual = parseStoredValue(question, actualsMap[question.id]);
      if (actual != null) scoredQuestionCount += 1;
    }

    const ranking = buildLeaderboardRows({
      questions,
      actualsMap,
      members: simulatedMembers,
      responses
    });
    const winner = ranking[0] || null;
    const winnerTotal = Number(winner?.total || 0);

    const rows = [];
    const memberCount = ranking.length;
    for (const question of questions) {
      const actual = parseStoredValue(question, actualsMap[question.id]);
      if (actual == null) continue;
      const perUser = ranking.map((userRow) => Number(userRow.byQuestion[question.id] || 0));
      const sum = perUser.reduce((acc, value) => acc + value, 0);
      const winnerPoints = Number(winner?.byQuestion?.[question.id] || 0);
      const winnerShare = winnerTotal > 0 ? (winnerPoints / winnerTotal) * 100 : 0;
      const altTotals = ranking.map((userRow, index) => Number(userRow.total || 0) - perUser[index]);
      const topAlt = Math.max(...altTotals);
      const altWinnerIndex = altTotals.findIndex((value) => value === topAlt);
      const winnerFlips = altWinnerIndex !== 0;
      const flipPercent = winnerFlips ? 100 : 0;
      const dominance = flipPercent * 0.65 + winnerShare * 0.35;
      rows.push({
        id: question.id,
        flipPercent,
        winnerShare,
        avgWinner: winnerPoints,
        avgPlayer: memberCount > 0 ? sum / memberCount : 0,
        impact: impactLabel(flipPercent, winnerShare),
        dominance,
        winnerFlips
      });
    }

    rows.sort((a, b) => b.dominance - a.dominance || b.winnerShare - a.winnerShare);

    return {
      mode: "actuals",
      groupId,
      memberCount,
      questionCount: questions.length,
      scoredQuestionCount,
      winner,
      winnerTotal,
      rows
    };
  }

  function buildSyntheticSeasonActuals(questions, roster, races, model) {
    const drivers = roster.drivers || [];
    const teams = roster.teams || [];
    const questionById = Object.fromEntries((questions || []).map((q) => [q.id, q]));

    const driverScore = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Number(model.expectedDriver[driver] || 0) + randomNormal(0, 15)
      ])
    );
    const driverOrder = rankByScore(drivers, driverScore, drivers.length);
    const teamScore = Object.fromEntries(
      teams.map((team) => [
        team,
        (model.teamDrivers[team] || []).reduce(
          (sum, driver) => sum + Number(driverScore[driver] || 0),
          0
        )
      ])
    );
    const teamOrder = rankByScore(teams, teamScore, teams.length);

    const dnfByDriver = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Math.max(
          0,
          Math.round(
            (100 - Number(model.driverSkill[driver] || 75)) / 7.5 + randomNormal(0, 2.4)
          )
        )
      ])
    );
    const damageByDriver = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Number(dnfByDriver[driver] || 0) * (0.9 + (100 - Number(model.driverSkill[driver] || 75)) / 60) +
          Math.max(0, randomNormal(0, 1.4))
      ])
    );
    const dodByDriver = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Number(model.expectedDriver[driver] || 0) * 0.03 + randomNormal(0, 0.8)
      ])
    );

    const podiumCount = clamp(Math.round(8 + Math.random() * 6), 5, Math.min(16, drivers.length));
    const podiumSet = rankByScore(drivers, driverScore, podiumCount);
    const podiumTeamSet = new Set(podiumSet.map((driver) => model.driverTeam[driver]));
    const teamsWithoutPodium = teams.filter((team) => !podiumTeamSet.has(team));

    const dnfByRace = Object.fromEntries(
      (races || []).map((race) => [race, clamp(Math.round(2.2 + randomNormal(0, 1.4)), 0, 8)])
    );

    const pairResult = (questionId) => {
      const opts = questionById[questionId]?.options || [];
      const left = opts[0];
      const right = opts[1];
      const leftScore = Number(driverScore[left] || 0);
      const rightScore = Number(driverScore[right] || 0);
      if (leftScore === rightScore) return { winner: "tie", diff: 0 };
      return {
        winner: leftScore > rightScore ? left : right,
        diff: Math.round(Math.abs(leftScore - rightScore) * 3)
      };
    };

    const lowestGrid = clamp(Math.round(2.8 + randomNormal(0, 2.2)), 1, 22);
    const topTwo = driverOrder.slice(0, 2);
    const titleLead =
      Math.abs(
        Number(driverScore[topTwo[0]] || 0) - Number(driverScore[topTwo[1]] || 0)
      ) || 0;
    const racesBeforeTitleDecided = clamp(Math.round(titleLead / 6 + randomNormal(0, 1.8)), 0, 10);
    const ferrariDrivers = model.teamDrivers?.Ferrari || [];
    const ferrariBothPodium =
      ferrariDrivers.length >= 2 &&
      podiumSet.includes(ferrariDrivers[0]) &&
      podiumSet.includes(ferrariDrivers[1]);

    const actuals = {
      drivers_championship_top_3: driverOrder.slice(0, 3),
      drivers_championship_last: driverOrder[driverOrder.length - 1],
      constructors_championship_top_3: teamOrder.slice(0, 3),
      constructors_championship_last: teamOrder[teamOrder.length - 1],
      all_teams_score_points: Object.values(teamScore).every((value) => Number(value) > 0) ? "yes" : "no",
      most_driver_of_the_day: rankByScore(drivers, dodByDriver, 1)[0] || null,
      most_dnfs_driver: rankByScore(drivers, dnfByDriver, 1)[0] || null,
      destructors_team: rankByScore(
        teams,
        Object.fromEntries(
          teams.map((team) => [
            team,
            (model.teamDrivers[team] || []).reduce(
              (sum, driver) => sum + Number(damageByDriver[driver] || 0),
              0
            )
          ])
        ),
        1
      )[0] || null,
      destructors_driver: rankByScore(drivers, damageByDriver, 1)[0] || null,
      all_podium_finishers: podiumSet,
      teammate_battle_antonelli_russell: pairResult("teammate_battle_antonelli_russell"),
      teammate_battle_lawson_lindblad: pairResult("teammate_battle_lawson_lindblad"),
      alpine_vs_cadillac_audi:
        Number(teamScore.Alpine || 0) >
        Number(teamScore.Cadillac || 0) +
          Number(teamScore.Audi || 0) +
          Number(teamScore["Aston Martin"] || 0)
          ? "More"
          : "Less",
      most_points_no_podium: teamsWithoutPodium.length
        ? rankByScore(teamsWithoutPodium, teamScore, 1)[0]
        : "All teams scored a podium",
      race_ban:
        Math.random() < 0.22
          ? {
              choice: "yes",
              driver:
                rankByScore(
                  drivers,
                  Object.fromEntries(
                    drivers.map((driver) => [
                      driver,
                      Number(dnfByDriver[driver] || 0) +
                        (100 - Number(model.driverSkill[driver] || 75)) / 10
                    ])
                  ),
                  1
                )[0] || null
            }
          : { choice: "no", driver: null },
      lowest_grid_win_position: {
        value: Math.random() < 0.02 ? "Pitlane" : String(lowestGrid),
        driver: driverOrder[0] || null
      },
      select_three_races_dnfs: { dnf_by_race: dnfByRace },
      closest_qualifying_teammates:
        rankByScore(
          teams,
          Object.fromEntries(
            teams.map((team) => {
              const pair = model.teamDrivers[team] || [];
              if (pair.length < 2) return [team, -999];
              const diff = Math.abs(
                Number(model.driverSkill[pair[0]] || 75) -
                  Number(model.driverSkill[pair[1]] || 75)
              );
              return [team, -diff + randomNormal(0, 0.8)];
            })
          ),
          1
        )[0] || null,
      races_before_title_decided: racesBeforeTitleDecided,
      mini_q1_first_race_winner_champion: Math.random() < 0.24 ? "yes" : "no",
      mini_q2_mercedes_engines_top5: Math.random() < 0.5 ? "yes" : "no",
      mini_q3_ferrari_podium: ferrariBothPodium ? "yes" : "no",
      mini_q4_sprint_champion_same:
        Math.random() < clamp(0.42 + titleLead / 80, 0.2, 0.9) ? "yes" : "no",
      mini_q5_team_engine_switch_2027_2028: Math.random() < 0.46 ? "yes" : "no"
    };

    return actuals;
  }

  function buildMonteCarloAnalysis({
    questions,
    roster,
    races,
    playerCount,
    seasons,
    originalPlayerCount
  }) {
    const model = buildPredictionModel(roster);
    const stats = Object.fromEntries(
      (questions || []).map((q) => [
        q.id,
        {
          flipCount: 0,
          totalPointsPlayers: 0,
          totalPointsWinner: 0
        }
      ])
    );

    let totalSamples = 0;
    let totalScore = 0;
    let totalScoreSq = 0;
    let winnerScoreSum = 0;
    let scoredQuestionCount = 0;

    for (let seasonIndex = 0; seasonIndex < seasons; seasonIndex += 1) {
      const seasonActuals = buildSyntheticSeasonActuals(questions, roster, races, model);
      const totals = new Array(playerCount).fill(0);
      const perQuestionScores = Object.fromEntries(
        (questions || []).map((q) => [q.id, new Array(playerCount).fill(0)])
      );

      let seasonScoredQuestions = 0;
      for (const question of questions) {
        if (seasonActuals[question.id] != null) seasonScoredQuestions += 1;
      }
      scoredQuestionCount += seasonScoredQuestions;

      for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
        const profile = createPredictionProfile();
        for (const question of questions) {
          const actual = seasonActuals[question.id];
          if (actual == null) continue;
          const predicted = smartAnswerForQuestion(
            question,
            roster,
            races,
            model,
            profile
          );
          const points = scoreQuestion(question, predicted, actual);
          totals[playerIndex] += points;
          perQuestionScores[question.id][playerIndex] = points;
        }
        totalSamples += 1;
        totalScore += totals[playerIndex];
        totalScoreSq += totals[playerIndex] * totals[playerIndex];
      }

      const winnerIndex = totals.findIndex((value) => value === Math.max(...totals));
      winnerScoreSum += Number(totals[winnerIndex] || 0);

      for (const question of questions) {
        const actual = seasonActuals[question.id];
        if (actual == null) continue;
        const arr = perQuestionScores[question.id];
        const sum = arr.reduce((acc, value) => acc + value, 0);
        stats[question.id].totalPointsPlayers += sum;
        stats[question.id].totalPointsWinner += Number(arr[winnerIndex] || 0);

        const altTotals = totals.map((value, index) => value - Number(arr[index] || 0));
        const altWinnerIndex = altTotals.findIndex(
          (value) => value === Math.max(...altTotals)
        );
        if (altWinnerIndex !== winnerIndex) stats[question.id].flipCount += 1;
      }
    }

    const averageWinnerScore = winnerScoreSum / Math.max(1, seasons);
    const rows = questions
      .map((question) => {
        const row = stats[question.id];
        const flipPercent = (row.flipCount / Math.max(1, seasons)) * 100;
        const avgWinner = row.totalPointsWinner / Math.max(1, seasons);
        const winnerShare =
          averageWinnerScore > 0 ? (avgWinner / averageWinnerScore) * 100 : 0;
        const avgPlayer =
          row.totalPointsPlayers / Math.max(1, seasons * playerCount);
        const dominance = flipPercent * 0.65 + winnerShare * 0.35;
        return {
          id: question.id,
          flipPercent,
          winnerShare,
          avgWinner,
          avgPlayer,
          impact: impactLabel(flipPercent, winnerShare),
          dominance,
          winnerFlips: flipPercent > 0
        };
      })
      .sort((a, b) => b.dominance - a.dominance || b.winnerShare - a.winnerShare);

    const avgTotalScore = totalScore / Math.max(1, totalSamples);
    const variance =
      totalScoreSq / Math.max(1, totalSamples) - avgTotalScore * avgTotalScore;
    const stdTotalScore = Math.sqrt(Math.max(0, variance));

    return {
      mode: "sim200",
      groupId: 0,
      memberCount: playerCount,
      originalPlayerCount: originalPlayerCount || playerCount,
      questionCount: questions.length,
      scoredQuestionCount: Math.round(scoredQuestionCount / Math.max(1, seasons)),
      winner: null,
      winnerTotal: averageWinnerScore,
      seasons,
      avgTotalScore,
      stdTotalScore,
      rows
    };
  }

  function randomAnswerForQuestion(question, roster, races, model, profile) {
    const smart = smartAnswerForQuestion(question, roster, races, model, profile);
    return serializeAnswerForStorage(question, smart);
  }

  app.get("/admin/login", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    return res.redirect("/admin/overview");
  });

  app.get("/admin/ideas", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const ideas = listAdminIdeas();
    res.render("admin_ideas", {
      user,
      ideas,
      openIdeas: ideas.filter((idea) => idea.status === "open"),
      triagedIdeas: ideas.filter((idea) => idea.status !== "open"),
      ideaTypes: ADMIN_IDEA_TYPES,
      adminError: req.query.error ? String(req.query.error) : null,
      adminSuccess: req.query.success ? String(req.query.success) : null
    });
  });

  app.post("/admin/ideas", requireAdmin, (req, res) => {
    const t = res.locals.t || ((key) => key);
    const adminUser = getCurrentUser(req);
    const type = normalizeAdminIdeaType(req.body.type);
    const title = String(req.body.title || "").trim();
    const notes = String(req.body.notes || "").trim();
    if (!title) {
      return res.redirect(
        withQueryParam("/admin/ideas", "error", t("admin_ideas.error_title_required"))
      );
    }
    if (title.length > 500) {
      return res.redirect(
        withQueryParam("/admin/ideas", "error", t("admin_ideas.error_title_too_long"))
      );
    }
    if (notes.length > 4000) {
      return res.redirect(
        withQueryParam("/admin/ideas", "error", t("admin_ideas.error_notes_too_long"))
      );
    }

    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO admin_ideas (
        type,
        title,
        notes,
        status,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (?, ?, ?, 'open', ?, ?, ?, ?)
      `
    ).run(
      type,
      title,
      notes || null,
      now,
      now,
      adminUser?.id || null,
      adminUser?.id || null
    );

    return res.redirect(
      withQueryParam("/admin/ideas", "success", t("admin_ideas.created_success"))
    );
  });

  app.post("/admin/ideas/:id/status", requireAdmin, (req, res) => {
    const t = res.locals.t || ((key) => key);
    const adminUser = getCurrentUser(req);
    const ideaId = Number(req.params.id);
    const status = normalizeAdminIdeaStatus(req.body.status);
    if (!Number.isFinite(ideaId) || ideaId <= 0 || !status) {
      return res.redirect(
        withQueryParam("/admin/ideas", "error", t("admin_ideas.error_invalid_status"))
      );
    }

    const result = db
      .prepare(
        `
        UPDATE admin_ideas
        SET status = ?,
            updated_at = ?,
            updated_by_user_id = ?
        WHERE id = ?
        `
      )
      .run(status, new Date().toISOString(), adminUser?.id || null, ideaId);

    if (result.changes === 0) {
      return res.redirect(
        withQueryParam("/admin/ideas", "error", t("admin_ideas.error_not_found"))
      );
    }

    return res.redirect(
      withQueryParam("/admin/ideas", "success", t("admin_ideas.status_updated_success"))
    );
  });

  app.get("/admin/inputs", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const requestedTab = String(req.query.tab || "").trim().toLowerCase();
    const tab = ["drivers", "teams", "races", "scoring", "definitions", "mappings"].includes(requestedTab)
      ? requestedTab
      : "teams";
    const seasonContext = resolveAdminSeasonContext(db, {
      requestedSeason: req.query.season,
      currentSeason: CURRENT_SEASON
    });
    const season = Number(seasonContext.year || CURRENT_SEASON);
    const catalog = seasonContext.selected
      ? listSeasonInputs(db, season)
      : { season: null, drivers: [], teams: [], races: [], assignments: [], unresolved: [] };
    const scoringRules = catalog.season?.id
      ? (() => {
          const rules = readSeasonScoringRules(db, catalog.season.id);
          return rules ? scoringRulesTableValue(rules) : null;
        })()
      : null;
    const explicitRound = Number(req.query.round);
    const latestEvidenceRound = Number(
      db.prepare("SELECT MAX(round_number) AS round_number FROM race_data_snapshots WHERE season = ?").get(Number(season))?.round_number || 0
    );
    const defaultLineupRound = latestEvidenceRound > 0 ? latestEvidenceRound + 1 : 1;
    const requestedRound = Number.isInteger(explicitRound) && explicitRound > 0
      ? explicitRound
      : defaultLineupRound;
    const lineupRound = catalog.races.length
      ? Math.min(Math.max(Number.isInteger(requestedRound) ? requestedRound : 1, 1), catalog.races.length)
      : 1;
    const teamLineupHistory = catalog.season
      ? buildTeamLineupHistory({
          teams: catalog.teams,
          drivers: catalog.drivers,
          assignments: catalog.assignments
        })
      : [];
    catalog.impact = getSeasonInputImpact(season);
    catalog.mappings = seasonContext.selected ? listSeasonMappings(db, season) : [];
    const unresolvedMappingCount = catalog.mappings.filter((mapping) => mapping.status !== "resolved").length;
    const definitionMode = String(req.query.mode || "").trim().toLowerCase() === "edit" ? "edit" : "view";
    const definitions = listQuestionDefinitions(db, {
      locale: res.locals.locale || "en",
      includeInactive: tab === "definitions" && definitionMode === "edit"
    });
    return res.render("admin_inputs", {
      user,
      season,
      tab,
      lineupRound,
      teamLineupHistory,
      catalog,
      scoringRules,
      definitions,
      definitionMode,
      definitionLocale: res.locals.locale || "en",
      unresolvedMappingCount,
      seasonContext,
      availableSeasons: seasonContext.availableSeasons,
      inputsReady: Boolean(catalog.season) && seasonContext.isValid,
      query: req.query
    });
  });

  function getSeasonInputImpact(season) {
    const impact = { evidenceSnapshots: 0, actualSnapshots: 0, actualValues: 0 };
    const queries = [
      ["evidenceSnapshots", "SELECT COUNT(*) AS count FROM race_data_snapshots WHERE season = ?", [Number(season)]],
      ["actualSnapshots", "SELECT COUNT(*) AS count FROM actual_snapshots WHERE season = ?", [Number(season)]],
      ["actualValues", "SELECT COUNT(*) AS count FROM actual_snapshot_values v JOIN actual_snapshots s ON s.id = v.snapshot_id WHERE s.season = ?", [Number(season)]]
    ];
    for (const [key, sql, params] of queries) {
      try {
        impact[key] = Number(db.prepare(sql).get(...params)?.count || 0);
      } catch (err) {
        impact[key] = 0;
      }
    }
    return impact;
  }

  function getLineupReviewState(season, roundNumber) {
    const reviewedRounds = db.prepare(
      "SELECT round_number FROM actual_snapshots WHERE season = ? AND review_status = 'reviewed' AND round_number >= ? ORDER BY round_number"
    ).all(Number(season), Number(roundNumber)).map((row) => Number(row.round_number));
    const evidenceRounds = db.prepare(
      "SELECT round_number FROM race_data_snapshots WHERE season = ? AND round_number >= ? ORDER BY round_number"
    ).all(Number(season), Number(roundNumber)).map((row) => Number(row.round_number));
    return {
      reviewedRounds,
      evidenceRounds,
      requiresConfirmation: historicalCorrectionRequired({ roundNumber, reviewedRounds, evidenceRounds })
    };
  }

  function redirectInputs(res, season, tab, key, value, extra = {}) {
    const params = new URLSearchParams({ season: String(season), tab: String(tab || "drivers") });
    if (key && value) params.set(key, String(value));
    Object.entries(extra).forEach(([name, extraValue]) => {
      if (extraValue != null && extraValue !== "") params.set(name, String(extraValue));
    });
    return res.redirect(`/admin/inputs?${params.toString()}`);
  }

  app.post("/admin/inputs/definitions", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const adminUser = getCurrentUser(req);
    try {
      const context = requireSeasonMutation(req, season);
      if (!context.selected || !context.isValid) throw new Error("A valid season is required.");
      const idValue = String(req.body.id || "").trim();
      const id = idValue ? Number(idValue) : null;
      if (idValue && (!Number.isInteger(id) || id <= 0)) throw new Error("The definition ID is invalid.");
      const termKey = String(req.body.term_key || "").trim();
      const label = String(req.body.label || "").trim();
      const explanation = String(req.body.explanation || "").trim();
      const questionIds = String(req.body.question_ids || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const aliases = String(req.body.aliases || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const definitionId = upsertQuestionDefinition(db, {
        id,
        termKey,
        label,
        explanation,
        aliases,
        questionIds,
        sortOrder: req.body.sort_order,
        isActive: (Array.isArray(req.body.is_active) ? req.body.is_active : [req.body.is_active])
          .map((value) => String(value || ""))
          .includes("1")
      }, {
        locale: res.locals.locale || "en"
      });
      logAdminEvent("info", "admin_definition_updated", {
        userId: adminUser?.id || null,
        season,
        definitionId,
        termKey,
        historicalCorrection: readSeasonMutationFlags(req).historicalCorrection
      });
      return redirectInputs(res, season, "definitions", "success", "Definition saved.", { mode: "edit" });
    } catch (err) {
      logAdminEvent("warn", "admin_definition_update_failed", {
        userId: adminUser?.id || null,
        season,
        error: { message: err.message }
      });
      return redirectInputs(res, season, "definitions", "error", err.message, { mode: "edit" });
    }
  });

  function requireSeasonMutation(req, season, options = {}) {
    const context = resolveAdminSeasonContext(db, {
      requestedSeason: season,
      currentSeason: CURRENT_SEASON
    });
    const requestFlags = readSeasonMutationFlags(req);
    const preparationSelected = context.status === "planned"
      && (requestFlags.preparation || !Object.prototype.hasOwnProperty.call(req.body || {}, "preparation_confirmed"));
    assertSeasonMutationAllowed(context, {
      historicalCorrection: options.historicalCorrection === true || requestFlags.historicalCorrection,
      preparation: options.preparation === true || preparationSelected
    });
    return context;
  }

  app.post("/admin/inputs/entity", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const entityType = String(req.body.entity_type || "").trim().toLowerCase();
    const entityId = Number(req.body.entity_id);
    const displayName = String(req.body.display_name || "").trim();
    const calendarState = String(req.body.calendar_state || "scheduled").trim().toLowerCase() || "scheduled";
    const displayOrderRaw = String(req.body.display_order || "").trim();
    const displayOrder = displayOrderRaw === "" ? null : Number(displayOrderRaw);
    const requestedOrderBasis = String(req.body.order_basis || "").trim().toLowerCase();
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      if (!catalog.season || !Number.isInteger(entityId) || entityId <= 0 || !displayName) {
        throw new Error("A valid season, entity and display name are required.");
      }
      if (entityType === "driver") {
        const row = catalog.drivers.find((item) => Number(item.id) === entityId);
        if (!row) throw new Error("Driver is not part of this season.");
        upsertDriver(db, {
          slug: row.slug,
          displayName,
          driverCode: req.body.driver_code,
          nationalityCode: req.body.nationality_code,
          dateOfBirth: req.body.date_of_birth
        });
        upsertSeasonDriver(db, {
          seasonId: catalog.season.id,
          driverId: entityId,
          driverNumber: req.body.driver_number == null ? row.driver_number : req.body.driver_number,
          displayNameOverride: row.display_name_override
        });
      } else if (entityType === "team") {
        const row = catalog.teams.find((item) => Number(item.id) === entityId);
        if (!row) throw new Error("Team is not part of this season.");
        upsertTeam(db, {
          slug: row.slug,
          displayName,
          shortName: row.short_name,
          teamCode: req.body.team_code,
          baseCountryCode: req.body.base_country_code,
          f1EntryYear: req.body.f1_entry_year,
          powerUnit: req.body.power_unit
        });
        const nextDisplayOrder = displayOrder == null ? Number(row.display_order || 0) : displayOrder;
        const orderBasis = requestedOrderBasis || row.order_basis || "manual";
        if (!Number.isInteger(nextDisplayOrder) || nextDisplayOrder < 0) throw new Error("Display order must be a non-negative number.");
        if (!["official", "previous_standings", "manual"].includes(orderBasis)) throw new Error("Unsupported order basis.");
        upsertSeasonTeam(db, { seasonId: catalog.season.id, teamId: entityId, displayOrder: nextDisplayOrder, orderBasis });
      } else if (entityType === "race") {
        const row = catalog.races.find((item) => Number(item.id) === entityId);
        if (!row) throw new Error("Race is not part of this season.");
        if (!["scheduled", "completed", "cancelled", "partial"].includes(calendarState)) {
          throw new Error("Unsupported calendar state.");
        }
        upsertRace(db, {
          seasonId: catalog.season.id,
          roundNumber: row.round_number,
          slug: row.slug,
          displayName,
          scheduledDate: row.scheduled_date,
          scheduledTimezone: row.scheduled_timezone,
          raceCode: req.body.race_code,
          countryCode: req.body.country_code,
          circuitName: req.body.circuit_name,
          calendarState
        });
      } else {
        throw new Error("Unsupported entity type.");
      }
      logAdminEvent("info", "admin_inputs_entity_updated", {
        userId: adminUser?.id || null,
        season,
        entityType,
        entityId,
        historicalCorrection: readSeasonMutationFlags(req).historicalCorrection
      });
      return redirectInputs(res, season, entityType === "race" ? "races" : `${entityType}s`, "success", "Entity updated.");
    } catch (err) {
      return redirectInputs(res, season, entityType === "race" ? "races" : `${entityType}s`, "error", err.message);
    }
  });

  app.post("/admin/inputs/team-order", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const teamId = Number(req.body.team_id);
    const direction = String(req.body.direction || "").trim().toLowerCase();
    const round = Number(req.body.round);
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    const extra = Number.isInteger(round) && round > 0 ? { round } : {};
    try {
      requireSeasonMutation(req, season);
      if (!catalog.season || !Number.isInteger(teamId) || teamId <= 0) {
        throw new Error("A valid team is required.");
      }
      if (!["up", "down"].includes(direction)) throw new Error("Choose a valid team direction.");
      const index = catalog.teams.findIndex((team) => Number(team.id) === teamId);
      if (index < 0) throw new Error("Team is not part of this season.");
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= catalog.teams.length) {
        return redirectInputs(res, season, "teams", null, null, extra);
      }

      const reordered = catalog.teams.slice();
      const current = reordered[index];
      reordered[index] = reordered[swapIndex];
      reordered[swapIndex] = current;
      const now = new Date().toISOString();
      const updateOrder = db.prepare(
        "UPDATE season_teams SET display_order = ?, order_basis = 'manual', updated_at = ? WHERE season_id = ? AND team_id = ?"
      );
      const tx = db.transaction(() => {
        reordered.forEach((team, orderIndex) => {
          updateOrder.run(orderIndex + 1, now, catalog.season.id, Number(team.id));
        });
      });
      tx();
      logAdminEvent("info", "admin_inputs_team_reordered", {
        userId: adminUser?.id || null,
        season,
        teamId,
        direction,
        historicalCorrection: readSeasonMutationFlags(req).historicalCorrection
      });
      return redirectInputs(res, season, "teams", "success", "Team order updated.", extra);
    } catch (err) {
      return redirectInputs(res, season, "teams", "error", err.message, extra);
    }
  });

  app.post("/admin/inputs/remove", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const entityType = String(req.body.entity_type || "").trim().toLowerCase();
    const entityId = Number(req.body.entity_id);
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    const tab = entityType === "driver" ? "drivers" : entityType === "team" ? "teams" : "assignments";
    try {
      requireSeasonMutation(req, season);
      if (!catalog.season || !Number.isInteger(entityId) || entityId <= 0) {
        throw new Error("A valid season input is required.");
      }
      if (entityType === "driver") {
        removeSeasonMembership(db, { seasonId: catalog.season.id, entityType, entityId });
      } else if (entityType === "team") {
        removeSeasonMembership(db, { seasonId: catalog.season.id, entityType, entityId });
      } else if (entityType === "assignment") {
        const row = catalog.assignments.find((item) => Number(item.id) === entityId);
        if (!row) throw new Error("Assignment is not part of this season.");
        const result = db.prepare("DELETE FROM driver_team_assignments WHERE id = ? AND season_id = ?").run(entityId, catalog.season.id);
        if (Number(result.changes || 0) !== 1) throw new Error("Assignment could not be removed.");
      } else {
        throw new Error("This input cannot be removed here.");
      }
      logAdminEvent("info", "admin_inputs_entity_removed", {
        userId: adminUser?.id || null,
        season,
        entityType,
        entityId,
        historicalCorrection: readSeasonMutationFlags(req).historicalCorrection
      });
      const message = entityType === "assignment" ? "Assignment removed." : `${entityType === "driver" ? "Driver" : "Team"} removed from season inputs.`;
      return redirectInputs(res, season, tab, "success", message);
    } catch (err) {
      return redirectInputs(res, season, tab, "error", err.message);
    }
  });

  app.post("/admin/inputs/driver", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const displayName = String(req.body.display_name || "").trim();
    const slug = String(req.body.slug || "").trim();
    const driverNumber = String(req.body.driver_number || "").trim() || null;
    const driverCode = req.body.driver_code;
    const nationalityCode = req.body.nationality_code;
    const dateOfBirth = req.body.date_of_birth;
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      if (!catalog.season || !displayName) throw new Error("A season and driver name are required.");
      const driverId = upsertDriver(db, {
        slug: slug || displayName,
        displayName,
        driverCode,
        nationalityCode,
        dateOfBirth
      });
      upsertSeasonDriver(db, {
        seasonId: catalog.season.id,
        driverId,
        driverNumber
      });
      logAdminEvent("info", "admin_inputs_driver_created", {
        userId: adminUser?.id || null,
        season,
        driverId,
        historicalCorrection: readSeasonMutationFlags(req).historicalCorrection
      });
      return redirectInputs(res, season, "drivers", "success", "Driver added to season.");
    } catch (err) {
      return redirectInputs(res, season, "drivers", "error", err.message);
    }
  });

  app.post("/admin/inputs/lineup", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const roundNumber = Number(req.body.round);
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      if (!catalog.season) throw new Error("Season inputs are not available.");
      if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > catalog.races.length) {
        throw new Error("Choose a valid season round.");
      }
      const desiredSeats = catalog.teams.flatMap((team) => [1, 2].map((seatNumber) => {
        const value = req.body[`team_${team.id}_seat_${seatNumber}`];
        return {
          teamId: Number(team.id),
          seatNumber,
          driverId: value == null || String(value).trim() === "" ? null : Number(value)
        };
      }));
      const reviewState = getLineupReviewState(season, roundNumber);
      const historicalCorrectionConfirmed = String(req.body.historical_correction || "") === "1";
      const result = applySeasonLineup(db, {
        seasonId: catalog.season.id,
        roundNumber,
        desiredSeats,
        reviewedRounds: reviewState.reviewedRounds,
        evidenceRounds: reviewState.evidenceRounds,
        historicalCorrectionConfirmed
      });
      logAdminEvent("info", "admin_inputs_lineup_updated", {
        userId: adminUser?.id || null,
        season,
        roundNumber,
        changedSeats: result.operations.length,
        historicalCorrection: historicalCorrectionConfirmed,
        affectedRounds: {
          from: roundNumber,
          to: catalog.races.length
        }
      });
      return redirectInputs(res, season, "teams", "success", `Lineup saved (${result.operations.length} changes).`, { round: roundNumber });
    } catch (err) {
      return redirectInputs(res, season, "teams", "error", err.message, { round: roundNumber });
    }
  });

  app.post("/admin/inputs/team-history", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const teamId = Number(req.body.team_id);
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    const historicalCorrectionConfirmed = String(req.body.historical_correction || "") === "1";
    const values = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
    const readPeriods = (seatNumber) => {
      const ids = values(req.body[`seat_${seatNumber}_assignment_id`]);
      const driverIds = values(req.body[`seat_${seatNumber}_driver_id`]);
      const fromRounds = values(req.body[`seat_${seatNumber}_from_round`]);
      const toRounds = values(req.body[`seat_${seatNumber}_to_round`]);
      const length = Math.max(ids.length, driverIds.length, fromRounds.length, toRounds.length);
      return Array.from({ length }, (_, index) => ({
        id: ids[index],
        driverId: driverIds[index],
        fromRound: fromRounds[index],
        toRound: toRounds[index]
      }));
    };
    try {
      requireSeasonMutation(req, season, { historicalCorrection: historicalCorrectionConfirmed });
      if (!catalog.season) throw new Error("Season inputs are not available.");
      if (!Number.isInteger(teamId) || teamId <= 0) throw new Error("Choose a valid team.");
      const seatPeriods = { 1: readPeriods(1), 2: readPeriods(2) };
      const plan = buildTeamLineupHistoryPlan({
        teams: catalog.teams,
        drivers: catalog.drivers,
        assignments: catalog.assignments,
        teamId,
        seatPeriods,
        seasonRoundCount: catalog.races.length
      });
      const reviewState = plan.affectedFromRound == null
        ? { reviewedRounds: [], evidenceRounds: [] }
        : getLineupReviewState(season, plan.affectedFromRound);
      const result = applyTeamLineupHistory(db, {
        seasonId: catalog.season.id,
        teamId,
        seatPeriods,
        reviewedRounds: reviewState.reviewedRounds,
        evidenceRounds: reviewState.evidenceRounds,
        historicalCorrectionConfirmed
      });
      logAdminEvent("info", "admin_inputs_team_history_updated", {
        userId: adminUser?.id || null,
        season,
        teamId,
        changedAssignments: result.operations.length,
        affectedFromRound: result.affectedFromRound,
        historicalCorrection: historicalCorrectionConfirmed
      });
      return redirectInputs(res, season, "teams", "success", `Team lineup saved (${result.operations.length} changes).`);
    } catch (err) {
      return redirectInputs(res, season, "teams", "error", err.message);
    }
  });

  app.post("/admin/inputs/assignment", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const id = String(req.body.id || "").trim() ? Number(req.body.id) : null;
    const driverId = Number(req.body.driver_id);
    const teamId = Number(req.body.team_id);
    const seatNumber = Number(req.body.seat_number || 1);
    const fromRound = Number(req.body.from_round);
    const toRoundRaw = String(req.body.to_round || "").trim();
    const toRound = toRoundRaw ? Number(toRoundRaw) : null;
    const source = String(req.body.source || "admin").trim().slice(0, 120) || "admin";
    const catalog = listSeasonInputs(db, season);
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      if (!catalog.season || !catalog.drivers.some((row) => Number(row.id) === driverId) || !catalog.teams.some((row) => Number(row.id) === teamId)) {
        throw new Error("Choose a driver and team from this season.");
      }
      if (![1, 2].includes(seatNumber)) throw new Error("Seat number must be 1 or 2.");
      if (!Number.isInteger(fromRound) || fromRound < 1 || fromRound > catalog.races.length) {
        throw new Error("From round must be a valid season round.");
      }
      if (toRound != null && (!Number.isInteger(toRound) || toRound < fromRound || toRound > catalog.races.length)) {
        throw new Error("To round must be empty or a valid round after the start round.");
      }
      const assignmentId = upsertDriverTeamAssignment(db, {
        id,
        seasonId: catalog.season.id,
        driverId,
        teamId,
        seatNumber,
        fromRound,
        toRound,
        source
      });
      logAdminEvent("info", "admin_inputs_assignment_updated", {
        userId: adminUser?.id || null,
        season,
        assignmentId,
        driverId,
        teamId,
        seatNumber,
        fromRound,
        toRound,
        historicalCorrection: readSeasonMutationFlags(req).historicalCorrection
      });
      return redirectInputs(res, season, "assignments", "success", "Assignment saved.");
    } catch (err) {
      return redirectInputs(res, season, "assignments", "error", err.message);
    }
  });

  app.post("/admin/inputs/alias", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const tab = String(req.body.tab || "mappings");
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      const entityType = String(req.body.entity_type || "").trim().toLowerCase();
      const entityId = Number(req.body.entity_id);
      if (!["driver", "team", "race"].includes(entityType) || !Number.isInteger(entityId) || entityId <= 0) {
        throw new Error("Choose a valid canonical entity.");
      }
      const catalog = listSeasonInputs(db, season);
      const entityRows = entityType === "driver" ? catalog.drivers : entityType === "team" ? catalog.teams : catalog.races;
      if (!catalog.season || !entityRows.some((row) => Number(row.id) === entityId)) {
        throw new Error("The canonical entity is not part of this season.");
      }
      addEntityAlias(db, {
        entityType,
        entityId,
        seasonId: String(req.body.global_alias || "") === "1" ? null : listSeasonInputs(db, season).season?.id,
        alias: req.body.alias,
        source: "admin"
      });
      logAdminEvent("info", "admin_inputs_alias_added", { userId: adminUser?.id || null, season, entityType, entityId, historicalCorrection: readSeasonMutationFlags(req).historicalCorrection });
      return redirectInputs(res, season, tab, "success", "Alias saved.");
    } catch (err) {
      return redirectInputs(res, season, tab, "error", err.message);
    }
  });

  app.post("/admin/inputs/provider-ref", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      const entityType = String(req.body.entity_type || "").trim().toLowerCase();
      const entityId = Number(req.body.entity_id);
      const provider = String(req.body.provider || "").trim();
      const providerKey = String(req.body.provider_key || "").trim();
      if (!["driver", "team", "race"].includes(entityType) || !Number.isInteger(entityId) || entityId <= 0 || !provider || !providerKey) {
        throw new Error("Provider, key and canonical entity are required.");
      }
      const catalog = listSeasonInputs(db, season);
      const entityRows = entityType === "driver" ? catalog.drivers : entityType === "team" ? catalog.teams : catalog.races;
      if (!catalog.season || !entityRows.some((row) => Number(row.id) === entityId)) {
        throw new Error("The canonical entity is not part of this season.");
      }
      addProviderReference(db, { entityType, entityId, provider, providerKey, providerLabel: req.body.provider_label || null });
      logAdminEvent("info", "admin_inputs_provider_reference_added", { userId: adminUser?.id || null, season, entityType, entityId, provider, historicalCorrection: readSeasonMutationFlags(req).historicalCorrection });
      return redirectInputs(res, season, "mappings", "success", "Provider mapping saved.");
    } catch (err) {
      return redirectInputs(res, season, "mappings", "error", err.message);
    }
  });

  app.post("/admin/inputs/mappings/resolve", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const mappingType = String(req.body.mapping_type || "").trim().toLowerCase();
    const mappingId = Number(req.body.mapping_id);
    const entityType = String(req.body.entity_type || "").trim().toLowerCase();
    const entityId = Number(req.body.entity_id);
    const adminUser = getCurrentUser(req);
    try {
      requireSeasonMutation(req, season);
      if (!["alias", "provider"].includes(mappingType) || !Number.isInteger(mappingId) || mappingId <= 0) {
        throw new Error("Choose a valid mapping.");
      }
      if (!["driver", "team", "race"].includes(entityType) || !Number.isInteger(entityId) || entityId <= 0) {
        throw new Error("Choose a valid canonical candidate.");
      }
      const catalog = listSeasonInputs(db, season);
      const entityRows = entityType === "driver" ? catalog.drivers : entityType === "team" ? catalog.teams : catalog.races;
      if (!catalog.season || !entityRows.some((row) => Number(row.id) === entityId)) {
        throw new Error("The canonical candidate is not part of this season.");
      }
      const table = mappingType === "alias" ? "entity_aliases" : "entity_provider_refs";
      const result = db.prepare(`UPDATE ${table} SET entity_type = ?, entity_id = ? WHERE id = ?`).run(entityType, entityId, mappingId);
      if (Number(result.changes || 0) !== 1) throw new Error("Mapping was not found.");
      logAdminEvent("info", "admin_inputs_mapping_resolved", { userId: adminUser?.id || null, season, mappingType, mappingId, entityType, entityId, historicalCorrection: readSeasonMutationFlags(req).historicalCorrection });
      return redirectInputs(res, season, "mappings", "success", "Mapping resolved.");
    } catch (err) {
      return redirectInputs(res, season, "mappings", "error", err.message);
    }
  });

  const legacyResultsRedirect = (req, res) => {
    const params = new URLSearchParams();
    if (req.query.season != null && String(req.query.season).trim()) {
      params.set("season", String(req.query.season));
    }
    if (req.query.error != null) params.set("error", String(req.query.error));
    if (req.query.success != null) params.set("success", String(req.query.success));
    const query = params.toString();
    return res.redirect(`/admin/results${query ? `?${query}` : ""}`);
  };

  app.get("/admin/questions", requireAdmin, (req, res) => {
    if (String(req.query.view || "").trim().toLowerCase() === "results") {
      return legacyResultsRedirect(req, res);
    }
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const saveError = req.query.error ? String(req.query.error) : null;
    const saveSuccess = req.query.success ? String(req.query.success) : null;
    const seasonContext = resolveAdminSeasonContext(db, {
      requestedSeason: req.query.season,
      currentSeason: CURRENT_SEASON
    });
    const season = Number(seasonContext.year || CURRENT_SEASON);
    const questions = getQuestions(locale, {
      includeExcluded: true,
      includeMeta: true,
      season
    });
    const questionRows = buildQuestionInputRows(questions);
    const requestedMode = String(req.query.mode || "").trim().toLowerCase();
    const mode = requestedMode === "edit" ? "edit" : "view";
    return res.render("admin_questions", {
      user,
      questions,
      questionRows,
      mode,
      season,
      seasonContext,
      availableSeasons: seasonContext.availableSeasons,
      saveError,
      saveSuccess
    });
  });

  app.get("/admin/results", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const saveError = req.query.error ? String(req.query.error) : null;
    const saveSuccess = req.query.success ? String(req.query.success) : null;
    const seasonContext = resolveAdminSeasonContext(db, {
      requestedSeason: req.query.season,
      currentSeason: CURRENT_SEASON
    });
    const season = Number(seasonContext.year || CURRENT_SEASON);
    const results = buildQuestionResultsModel({ season, locale, seasonContext });
    return res.render("admin_results", {
      user,
      season,
      seasonContext,
      availableSeasons: seasonContext.availableSeasons,
      ...results,
      saveError,
      saveSuccess
    });
  });

  app.post("/admin/questions", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const questions = getQuestions("en", {
      includeExcluded: true,
      includeMeta: true,
      season
    });
    const adminUser = getCurrentUser(req);
    try {
      const seasonContext = resolveAdminSeasonContext(db, {
        requestedSeason: season,
        currentSeason: CURRENT_SEASON
      });
      if (seasonContext.availableSeasons.length > 0 && (!seasonContext.selected || !seasonContext.isValid)) {
        throw new Error("The selected season is not available.");
      }
      const edits = normalizeQuestionInputEdits(questions, req.body, {
        parsePointsOverride: parsePointsOverrideInput,
        validatePointsOverrideType
      });
      const now = new Date().toISOString();
      upsertSeasonQuestionSettings(db, season, edits, now);
      logAdminEvent("info", "admin_questions_updated", {
        userId: adminUser?.id || null,
        season,
        questionIds: edits.map((edit) => edit.questionId),
        changedCount: edits.length
      });
      return res.redirect(
        `/admin/questions?season=${encodeURIComponent(season)}&success=${encodeURIComponent("Questions updated.")}`
      );
    } catch (err) {
      logAdminEvent("warn", "admin_questions_update_failed", {
        userId: adminUser?.id || null,
        season,
        error: { message: err.message }
      });
      return res.redirect(
        `/admin/questions?season=${encodeURIComponent(season)}&mode=edit&error=${encodeURIComponent(err.message)}`
      );
    }
  });

  app.post("/admin/race-data/correction", requireAdmin, (req, res) => {
    const season = Number(req.body.season || CURRENT_SEASON);
    const round = Number(req.body.round || 0);
    const viewMode = String(req.body.view || "drivers").toLowerCase() === "constructors"
      ? "constructors"
      : "drivers";
    const focus = String(req.body.focus || "points").trim() || "points";
    const redirectTo = `/admin/race-data?season=${encodeURIComponent(season)}&round=${encodeURIComponent(round)}&view=${encodeURIComponent(viewMode)}&focus=${encodeURIComponent(focus)}`;
    const adminUser = getCurrentUser(req);
    try {
      if (String(req.body.confirmCorrection || "") !== "1") {
        throw new Error("Confirm the protected race-data correction before saving.");
      }
      if (!Number.isInteger(season) || season < 1900 || !Number.isInteger(round) || round < 1) {
        throw new Error("Choose a valid season and round.");
      }
      const snapshot = findRaceDataSnapshot(db, season, round);
      if (!snapshot) throw new Error("No persisted race evidence exists for this round.");
      const snapshotId = Number(req.body.snapshotId);
      if (!Number.isInteger(snapshotId) || snapshotId !== Number(snapshot.id)) {
        throw new Error("This evidence changed while you were editing. Reload the round and try again.");
      }
      const correctedEvidence = buildCorrectedRaceEvidence(snapshot, req.body);
      const correctionId = saveCorrectedRaceDataSnapshot(db, {
        baseSnapshot: snapshot,
        evidence: correctedEvidence,
        correctedByUserId: adminUser?.id,
        correctionReason: req.body.correctionReason,
        sourceNote: "Admin correction from Race Data review"
      });
      const correctionSnapshot = findRaceDataSnapshot(db, season, round);
      const sourceQuestions = getQuestions("en", { includeMeta: true, season });
      const seasonContext = resolveAdminSeasonContext(db, {
        requestedSeason: season,
        currentSeason: CURRENT_SEASON
      });
      const catalog = seasonContext.selected
        ? buildSeasonCatalog(db, season, { questions: sourceQuestions })
        : null;
      const races = catalog?.races?.map((race) => race.display_name) || [];
      const roster = buildRoundAwareRoster({
        db,
        season,
        roundNumber: round,
        races,
        fallbackRoster: { drivers: [], teams: [], races },
        seasonCatalog: catalog
      });
      const derivation = rederiveActualSnapshotFromRaceEvidence({
        db,
        season,
        roundNumber: round,
        roundName: correctionSnapshot?.round_name || snapshot.round_name,
        questions: sourceQuestions,
        roster,
        races,
        catalog,
        evidenceSnapshot: correctionSnapshot
      });
      if (derivation?.snapshotId) {
        markSnapshotReviewed(db, {
          snapshotId: derivation.snapshotId,
          reviewedByUserId: adminUser?.id
        });
        publishActualSnapshot(db, {
          season,
          snapshotId: derivation.snapshotId,
          publishedByUserId: adminUser?.id
        });
      }
      logAdminEvent("info", "admin_race_data_correction_created", {
        userId: adminUser?.id || null,
        season,
        round,
        baseSnapshotId: snapshot.id,
        correctionSnapshotId: correctionId,
        derivedActualSnapshotId: derivation?.snapshotId || null,
        derivedValueCount: derivation?.valueCount || 0,
        driverId: req.body.driverId || null,
        reason: String(req.body.correctionReason || "").trim()
      });
      return res.redirect(redirectTo);
    } catch (err) {
      return res.redirect(withQueryParam(redirectTo, "error", err.message));
    }
  });

  app.post("/admin/race-data/refresh", requireAdmin, async (req, res) => {
    const adminUser = getCurrentUser(req);
    const season = Number(req.body.season || CURRENT_SEASON);
    const round = Number(req.body.round || 0);
    const viewMode = String(req.body.view || "drivers").toLowerCase() === "constructors"
      ? "constructors"
      : "drivers";
    const focus = String(req.body.focus || "points").trim() || "points";
    const redirectTo = `/admin/race-data?season=${encodeURIComponent(season)}&round=${encodeURIComponent(round)}&view=${encodeURIComponent(viewMode)}&focus=${encodeURIComponent(focus)}`;
    try {
      if (String(req.body.confirmRefresh || "") !== "1") {
        throw new Error("Confirm the source refresh before continuing.");
      }
      if (!Number.isInteger(season) || season < 1900 || !Number.isInteger(round) || round < 1) {
        throw new Error("Choose a valid season and round.");
      }
      const snapshot = findRaceDataSnapshot(db, season, round);
      if (!snapshot) throw new Error("No persisted race evidence exists for this round.");
      const result = await runAutoUpdate({
        season,
        round,
        dbPath,
        databaseUrl,
        dataDir,
        questionsPath,
        rosterPath,
        racesPath,
        dryRun: false
      });
      const refreshed = Array.isArray(result?.snapshots)
        && result.snapshots.some((item) => Number(item?.roundNumber) === round);
      if (!refreshed) throw new Error("The source returned no completed evidence for this round.");
      logAdminEvent("info", "admin_race_data_source_refreshed", {
        requestId: req.requestId,
        userId: adminUser?.id || null,
        season,
        round,
        previousSnapshotId: snapshot.id,
        refreshedSnapshotId: result.snapshots.find((item) => Number(item?.roundNumber) === round)?.id || null,
        reviewStatus: result.snapshots.find((item) => Number(item?.roundNumber) === round)?.reviewStatus || "pending"
      });
      return res.redirect(withQueryParam(redirectTo, "success", "Source refreshed; review required."));
    } catch (err) {
      logAdminEvent("warn", "admin_race_data_source_refresh_failed", {
        requestId: req.requestId,
        userId: adminUser?.id || null,
        season,
        round,
        error: { message: err.message }
      });
      return res.redirect(withQueryParam(redirectTo, "error", err.message));
    }
  });

  app.get("/admin/race-data", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const t = res.locals.t || ((key) => key);
    const seasonContext = resolveAdminSeasonContext(db, {
      requestedSeason: req.query.season,
      currentSeason: CURRENT_SEASON
    });
    const season = Number(seasonContext.year || CURRENT_SEASON);
    const sourceQuestions = getQuestions(locale, {
      includeMeta: true,
      season
    });
    const pointsLabel = "Results";
    const metricOptions = buildRaceDataMetricOptions(t, { pointsLabel });
    const focusOptions = buildRaceDataFocusOptions(sourceQuestions, { pointsLabel, metricOptions });
    const requestedFocusId = String(req.query.focus || "points").trim() || "points";
    const requestedFocus = focusOptions.find((option) => option.id === requestedFocusId) || null;
    const requestedView = String(req.query.view || "").trim().toLowerCase();
    const viewMode = requestedView === "constructors"
      ? "constructors"
      : requestedView === "drivers"
        ? "drivers"
        : requestedFocus?.view && requestedFocus.view !== "all"
          ? requestedFocus.view
          : "drivers";
    const focus = resolveRaceDataFocus({
      questions: sourceQuestions,
      focusId: requestedFocusId,
      viewMode,
      pointsLabel,
      metricOptions
    });
    const focusMetricLabels = {
      points: "Points",
      championship_points_results: "Points",
      podiums: t("admin_race_data.focus_podiums"),
      dnfs: t("admin_race_data.focus_dnfs"),
      grid_wins: t("admin_race_data.focus_grid_wins"),
      driver_of_day: t("admin_race_data.focus_driver_of_day"),
      sprint_points: t("admin_race_data.focus_sprint_points"),
      qualifying_h2h: t("admin_race_data.focus_qualifying_h2h"),
      no_podium_points: t("admin_race_data.focus_no_podium_points"),
      all_teams_points: t("admin_race_data.focus_team_coverage"),
      damage: t("admin_race_data.focus_damage"),
      engine_switch: t("admin_race_data.focus_external")
    };
    focus.metricLabel = focusMetricLabels[focus.matrixMetric || focus.metric] || t("admin_race_data.points");
    focus.footerRoundLabel = t("admin_race_data.focus_round_total");
    focus.footerTotalLabel = t("admin_race_data.focus_total");
    let catalog = null;
    try {
      catalog = buildSeasonCatalog(db, season, { questions: sourceQuestions });
    } catch (error) {
      catalog = null;
    }
    const scoringRules = catalog?.season?.id
      ? (readSeasonScoringRules(db, catalog.season.id) || DEFAULT_SCORING_RULES)
      : DEFAULT_SCORING_RULES;
    const races = (catalog?.races?.length
      ? catalog.races.map((race) => race.display_name)
      : getRaces()) || [];
    const evidenceRows = listRaceDataSnapshots(db, season);
    let snapshotRows = listLatestSnapshotsForSeason(db, season, {
      maxRoundNumber: races.length
    });
    snapshotRows = attachSnapshotReviewerNames(db, snapshotRows);
    const requestedRoundValue = String(req.query.round == null ? "" : req.query.round).trim();
    const requestedRound = Number(requestedRoundValue || 0);
    const hasSelectedRound = requestedRound > 0;
    const defaultRound =
      hasSelectedRound
        ? requestedRound
        : Number(evidenceRows.at(-1)?.round_number || 1);
    const roundRoster = buildRoundAwareRoster({
      db,
      season,
      roundNumber: defaultRound,
      races,
      fallbackRoster: { drivers: [], teams: [], races },
      seasonCatalog: catalog
    });
    const view = buildRaceDataAuditView({
      races,
      roster: roundRoster,
      evidenceRows,
      snapshotRows,
      selectedRound: defaultRound,
      showRaceResult: hasSelectedRound,
      catalogRevision: catalog?.catalogRevision || null,
      focus,
      scoringRules
    });
    const raceCodeByName = new Map(
      (catalog?.races || []).map((race) => [
        race.display_name,
        String(race.race_code || "").trim().toUpperCase() || fallbackRaceCode(race.display_name)
      ])
    );
    view.rounds = view.rounds.map((round) => ({
      ...round,
      code: raceCodeByName.get(round.raceName) || fallbackRaceCode(round.raceName)
    }));
    view.raceResultColumns = buildRaceResultColumns({
      payload: view.selectedEvidence?.payload || {},
      t
    });
    view.evidenceRevisions = view.selectedEvidence
      ? listRaceDataSnapshotRevisions(db, season, view.selectedRoundNumber)
      : [];
    view.focusOptions = focusOptions;
    view.metricOptions = metricOptions;
    view.activeMetricId = resolveActiveRaceDataMetricId({ focus, metricOptions });
    view.questionOptions = focusOptions.filter((option) => option.questionId);
    const model = {
      user,
      season,
      seasonContext,
      availableSeasons: seasonContext.availableSeasons,
      locale,
      view,
      viewMode,
      catalogRevision: catalog?.catalogRevision || null,
      catalogReadiness: catalog?.readiness || null,
      raceDataError: req.query.error ? String(req.query.error) : null,
      raceDataSuccess: req.query.success ? String(req.query.success) : null
    };
    if (String(req.query.fragment || "").trim().toLowerCase() === "round") {
      return res.render("partials/admin_race_data_round_region", model);
    }
    return res.render("admin_race_data", model);
  });

  app.get("/admin/actuals", requireAdmin, (req, res) => {
    return legacyResultsRedirect(req, res);
  });

  app.post("/admin/actuals/run-auto-update", requireAdmin, async (req, res) => {
    const adminUser = getCurrentUser(req);
    try {
      const requestedSeason = Number(req.body.season || CURRENT_SEASON);
      const seasonContext = resolveAdminSeasonContext(db, {
        requestedSeason,
        currentSeason: CURRENT_SEASON
      });
      if (requestedSeason !== CURRENT_SEASON || !seasonContext.syncable) {
        throw new Error("Automatic live sync is restricted to the active season.");
      }
      const result = await runActualsAutoUpdate({
        season: CURRENT_SEASON,
        dbPath,
        databaseUrl,
        dataDir,
        questionsPath,
        rosterPath,
        racesPath,
        dryRun: false
      });
      const latestSnapshot = Array.isArray(result?.snapshots) && result.snapshots.length > 0
        ? result.snapshots[result.snapshots.length - 1]
        : null;
      const summary = [];
      if (latestSnapshot?.roundNumber) {
        summary.push(`Season sync applied through R${latestSnapshot.roundNumber} - ${latestSnapshot.roundName || `Round ${latestSnapshot.roundNumber}`}`);
      } else if (Number.isFinite(Number(result?.latestRound)) && Number(result.latestRound) > 0) {
        summary.push(`Season sync applied through round ${Number(result.latestRound)}`);
      } else {
        summary.push("Season sync applied");
      }
      if (Array.isArray(result?.snapshots) && result.snapshots.length > 0) {
        summary.push(`updated ${result.snapshots.length} round snapshot${result.snapshots.length === 1 ? "" : "s"}`);
      }
      if (Number.isFinite(Number(result?.liveActualCount))) {
        summary.push(`live actuals now contain ${Number(result.liveActualCount)} filled field${Number(result.liveActualCount) === 1 ? "" : "s"}`);
      }
      summary.push("latest synced round is left pending review until an admin confirms it");

      if (typeof logEvent === "function") {
        logAdminEvent("info", "admin_actuals_auto_update_run", {
          requestId: req.requestId,
          adminUserId: adminUser?.id || null,
          season: CURRENT_SEASON,
          latestRound: Number(result?.latestRound || 0) || null,
          snapshotCount: Array.isArray(result?.snapshots) ? result.snapshots.length : 0
        });
      }

      return res.redirect(`/admin/results?season=${encodeURIComponent(requestedSeason)}&success=${encodeURIComponent(summary.join(" | "))}`);
    } catch (err) {
      if (typeof logEvent === "function") {
        logAdminEvent("warn", "admin_actuals_auto_update_failed", {
          requestId: req.requestId,
          adminUserId: adminUser?.id || null,
          season: CURRENT_SEASON,
          error: {
            message: err.message
          }
        });
      }
      return res.redirect(
        `/admin/results?season=${encodeURIComponent(Number(req.body.season || CURRENT_SEASON))}&error=${encodeURIComponent(`Automatic season sync failed: ${err.message}`)}`
      );
    }
  });

  app.post("/admin/race-data/review", requireAdmin, (req, res) => {
    const adminUser = getCurrentUser(req);
    const season = Number(req.body.season || req.query.season || CURRENT_SEASON);
    const seasonContext = resolveAdminSeasonContext(db, {
      requestedSeason: season,
      currentSeason: CURRENT_SEASON
    });
    const snapshotId = Number(req.body.snapshotId || 0);
    const target = String(req.body.target || "current").trim() || "current";
    const unlockPast = String(req.body.unlockPast || "").trim() === "1";
    const rawReturnTo = String(req.body.returnTo || "").trim();
    const returnTo = isSafeRaceDataReturnPath(rawReturnTo) ? rawReturnTo : null;
    const targetRound = /^round:(\d+)$/.exec(target)?.[1] || "";
    const fallbackPath = `/admin/race-data?season=${encodeURIComponent(season)}${targetRound ? `&round=${encodeURIComponent(targetRound)}` : ""}&view=drivers&focus=points`;
    const redirectReview = (key, message) => res.redirect(
      withQueryParam(returnTo || fallbackPath, key, message)
    );
    let snapshot = null;
    try {
      assertSeasonMutationAllowed(seasonContext, { historicalCorrection: unlockPast });
      snapshot = findSnapshotById(db, snapshotId, getSnapshotRoundOptions(season));
      if (snapshot && Number(snapshot.season) !== season) snapshot = null;
    } catch (err) {
      return redirectReview("error", err.message);
    }
    if (!snapshot) {
      return redirectReview("error", "Snapshot not found.");
    }

    markSnapshotReviewed(db, {
      snapshotId,
      reviewedByUserId: adminUser?.id
    });
    try {
      publishActualSnapshot(db, {
        season,
        snapshotId,
        publishedByUserId: adminUser?.id
      });
    } catch (err) {
      return redirectReview("error", err.message);
    }
    return res.redirect(returnTo || fallbackPath);
  });


  app.get("/admin/overview", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const adminError = req.query.error ? String(req.query.error) : null;
    const adminSuccess = req.query.success ? String(req.query.success) : null;
    const groupsPerPage = 10;
    const usersPerPage = 10;
    const namedGuestProfilesPerPage = 10;
    const visitorProfilesPerPage = 10;

    const requestedGroupPage = Number(req.query.groupPage || 1);
    const currentGroupPage = Number.isFinite(requestedGroupPage) && requestedGroupPage > 0
      ? Math.floor(requestedGroupPage)
      : 1;

    const requestedUsersPage = Number(req.query.usersPage || 1);
    const currentUsersPage = Number.isFinite(requestedUsersPage) && requestedUsersPage > 0
      ? Math.floor(requestedUsersPage)
      : 1;

    const requestedNamedGuestProfilesPage = Number(req.query.namedGuestPage || 1);
    const currentNamedGuestProfilesPage =
      Number.isFinite(requestedNamedGuestProfilesPage) && requestedNamedGuestProfilesPage > 0
        ? Math.floor(requestedNamedGuestProfilesPage)
        : 1;

    const rawVisitorPage = req.query.visitorPage || req.query.guestPage || 1;
    const requestedVisitorProfilesPage = Number(rawVisitorPage);
    const currentVisitorProfilesPage =
      Number.isFinite(requestedVisitorProfilesPage) && requestedVisitorProfilesPage > 0
        ? Math.floor(requestedVisitorProfilesPage)
        : 1;

    const nowMs = Date.now();
    const sessionRevealedEmails =
      req.session &&
      req.session.adminRevealedEmails &&
      typeof req.session.adminRevealedEmails === "object"
        ? req.session.adminRevealedEmails
        : {};
    const activeRevealedEmails = {};
    for (const [userId, expiresAtRaw] of Object.entries(sessionRevealedEmails)) {
      const expiresAt = Number(expiresAtRaw);
      if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
        activeRevealedEmails[userId] = expiresAt;
      }
    }
    if (req.session) {
      req.session.adminRevealedEmails = activeRevealedEmails;
    }
    const revealedEmailUserIds = Object.keys(activeRevealedEmails)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const groupCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM groups g
        WHERE COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();
    const totalGroups = Number(groupCountRow?.count || 0);
    const totalGroupPages = Math.max(
      1,
      Math.ceil(totalGroups / groupsPerPage)
    );
    const safeGroupPage = Math.min(currentGroupPage, totalGroupPages);
    const groupOffset = (safeGroupPage - 1) * groupsPerPage;

    const userCountRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM users WHERE is_simulated = 0 AND is_admin = 0"
      )
      .get();
    const totalUsers = Number(userCountRow?.count || 0);
    const totalUserPages = Math.max(
      1,
      Math.ceil(totalUsers / usersPerPage)
    );
    const safeUsersPage = Math.min(currentUsersPage, totalUserPages);
    const usersOffset = (safeUsersPage - 1) * usersPerPage;
    const admins = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin, COALESCE(hide_from_global, 0) as hide_from_global
        FROM users
        WHERE is_simulated = 0
          AND is_admin = 1
        ORDER BY created_at DESC
        `
      )
      .all();

    const users = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin, COALESCE(hide_from_global, 0) as hide_from_global
        FROM users
        WHERE is_simulated = 0
          AND is_admin = 0
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(usersPerPage, usersOffset);

    const userStats = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM users u WHERE u.is_simulated = 0 AND u.is_admin = 0) as user_count,
          (
            SELECT COUNT(*)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 0
              AND COALESCE(g.is_simulated, 0) = 0
          ) as response_count,
          (
            SELECT COUNT(DISTINCT r.group_id)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 0
              AND COALESCE(g.is_simulated, 0) = 0
          ) as groups_count,
          (
            SELECT MAX(r.updated_at)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 0
              AND COALESCE(g.is_simulated, 0) = 0
          ) as last_activity_at
        `
      )
      .get();

    const adminStats = db
      .prepare(
        `
        SELECT
          COUNT(*) as admin_count,
          (
            SELECT COUNT(*)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 1
              AND COALESCE(g.is_simulated, 0) = 0
          ) as response_count,
          (
            SELECT COUNT(DISTINCT r.group_id)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 1
              AND COALESCE(g.is_simulated, 0) = 0
          ) as groups_count,
          (
            SELECT MAX(r.updated_at)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 1
              AND COALESCE(g.is_simulated, 0) = 0
          ) as last_activity_at
        FROM users
        WHERE is_simulated = 0
          AND is_admin = 1
        `
      )
      .get();

    const groups = db
      .prepare(
        `
        SELECT
          g.id,
          g.name,
          g.owner_id,
          u.name as owner_name,
          g.created_at,
          (
            SELECT COUNT(*)
            FROM group_members gm
            JOIN users um ON um.id = gm.user_id
            WHERE gm.group_id = g.id
              AND COALESCE(um.is_simulated, 0) = 0
          ) + (
            SELECT COUNT(*)
            FROM named_guest_group_members ngm
            WHERE ngm.group_id = g.id
          ) as users_count
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(groupsPerPage, groupOffset);

    const namedGuestStats = db
      .prepare(
        `
        SELECT
          COUNT(DISTINCT gr.guest_id) as guest_count,
          COUNT(*) as response_count,
          COUNT(DISTINCT gr.group_id) as group_count,
          MAX(gr.updated_at) as last_activity_at
        FROM guest_responses gr
        JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();

    const namedGuestProfileCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM (
          SELECT gr.guest_id
          FROM guest_responses gr
          JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
          JOIN groups g ON g.id = gr.group_id
          WHERE COALESCE(g.is_simulated, 0) = 0
          GROUP BY gr.guest_id
        ) as named_guests
        `
      )
      .get();
    const totalNamedGuestProfiles = Number(namedGuestProfileCountRow?.count || 0);
    const totalNamedGuestProfilePages = Math.max(
      1,
      Math.ceil(totalNamedGuestProfiles / namedGuestProfilesPerPage)
    );
    const safeNamedGuestProfilesPage = Math.min(
      currentNamedGuestProfilesPage,
      totalNamedGuestProfilePages
    );
    const namedGuestProfilesOffset =
      (safeNamedGuestProfilesPage - 1) * namedGuestProfilesPerPage;

    const namedGuestProfiles = db
      .prepare(
        `
        SELECT
          gr.guest_id,
          MAX(ngp.display_name) as display_name,
          COUNT(*) as answers_count,
          COUNT(DISTINCT gr.group_id) as groups_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MIN(gr.created_at) as first_seen_at,
          MAX(gr.updated_at) as last_seen_at,
          COALESCE(
            (
              SELECT g2.name
              FROM guest_responses gr2
              JOIN groups g2 ON g2.id = gr2.group_id
              WHERE gr2.guest_id = gr.guest_id
                AND COALESCE(g2.is_simulated, 0) = 0
                AND COALESCE(g2.is_global, 0) = 0
              ORDER BY gr2.updated_at DESC
              LIMIT 1
            ),
            (
              SELECT g2.name
              FROM guest_responses gr2
              JOIN groups g2 ON g2.id = gr2.group_id
              WHERE gr2.guest_id = gr.guest_id
                AND COALESCE(g2.is_simulated, 0) = 0
              ORDER BY gr2.updated_at DESC
              LIMIT 1
            )
          ) as latest_group_name
        FROM guest_responses gr
        JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        GROUP BY gr.guest_id
        ORDER BY last_seen_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(namedGuestProfilesPerPage, namedGuestProfilesOffset);

    const visitorStats = db
      .prepare(
        `
        SELECT
          COUNT(DISTINCT gr.guest_id) as guest_count,
          COUNT(*) as response_count,
          COUNT(DISTINCT gr.group_id) as group_count,
          MAX(gr.updated_at) as last_activity_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM named_guest_profiles ngp
            WHERE ngp.guest_id = gr.guest_id
          )
        `
      )
      .get();

    const visitorProfileCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM (
          SELECT gr.guest_id
          FROM guest_responses gr
          JOIN groups g ON g.id = gr.group_id
          WHERE COALESCE(g.is_simulated, 0) = 0
            AND NOT EXISTS (
              SELECT 1
              FROM named_guest_profiles ngp
              WHERE ngp.guest_id = gr.guest_id
            )
          GROUP BY gr.guest_id
        ) as visitors
        `
      )
      .get();
    const totalVisitorProfiles = Number(visitorProfileCountRow?.count || 0);
    const totalVisitorProfilePages = Math.max(
      1,
      Math.ceil(totalVisitorProfiles / visitorProfilesPerPage)
    );
    const safeVisitorProfilesPage = Math.min(
      currentVisitorProfilesPage,
      totalVisitorProfilePages
    );
    const visitorProfilesOffset = (safeVisitorProfilesPage - 1) * visitorProfilesPerPage;

    const visitorProfiles = db
      .prepare(
        `
        SELECT
          gr.guest_id,
          COUNT(*) as answers_count,
          COUNT(DISTINCT gr.group_id) as groups_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MIN(gr.created_at) as first_seen_at,
          MAX(gr.updated_at) as last_seen_at,
          (
            SELECT g2.name
            FROM guest_responses gr2
            JOIN groups g2 ON g2.id = gr2.group_id
            WHERE gr2.guest_id = gr.guest_id
              AND COALESCE(g2.is_simulated, 0) = 0
            ORDER BY gr2.updated_at DESC
            LIMIT 1
          ) as latest_group_name
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM named_guest_profiles ngp
            WHERE ngp.guest_id = gr.guest_id
          )
        GROUP BY gr.guest_id
        ORDER BY last_seen_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(visitorProfilesPerPage, visitorProfilesOffset);

    res.render("admin_overview", {
      user,
      adminError,
      adminSuccess,
      revealedEmailUserIds,
      admins,
      adminStats,
      users,
      userStats,
      groups,
      currentGroupPage: safeGroupPage,
      totalGroupPages,
      groupsPerPage,
      currentUserPage: safeUsersPage,
      totalUserPages,
      usersPerPage,
      namedGuestStats,
      namedGuestProfiles,
      currentNamedGuestPage: safeNamedGuestProfilesPage,
      totalNamedGuestPages: totalNamedGuestProfilePages,
      namedGuestProfilesPerPage,
      visitorStats,
      visitorProfiles,
      currentVisitorPage: safeVisitorProfilesPage,
      totalVisitorPages: totalVisitorProfilePages,
      visitorProfilesPerPage
    });
  });

  app.get("/admin/groups/:id", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const groupId = Number(req.params.id);
    if (!groupId) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Invalid group id.")}`
      );
    }

    const rawReturnTo = String(req.query.returnTo || "/admin/overview#admin-groups").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview#admin-groups";

    const group = db
      .prepare(
        `
        SELECT
          g.id,
          g.name,
          g.owner_id,
          g.created_at,
          COALESCE(g.is_global, 0) as is_global,
          COALESCE(g.is_public, 0) as is_public,
          COALESCE(g.is_simulated, 0) as is_simulated,
          u.name as owner_name
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE g.id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        LIMIT 1
        `
      )
      .get(groupId);
    if (!group) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Group not found.")}`
      );
    }

    const groupStats = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = ?) as member_count,
          (SELECT COUNT(*) FROM named_guest_group_members ngm WHERE ngm.group_id = ?) as named_guest_count,
          (SELECT COUNT(*) FROM responses r WHERE r.group_id = ?) as member_responses,
          (SELECT COUNT(*) FROM guest_responses gr WHERE gr.group_id = ?) as guest_responses,
          (
            SELECT COUNT(DISTINCT question_id)
            FROM (
              SELECT r.question_id as question_id
              FROM responses r
              WHERE r.group_id = ?
              UNION
              SELECT gr.question_id as question_id
              FROM guest_responses gr
              WHERE gr.group_id = ?
            ) q
          ) as questions_answered,
          (
            SELECT MAX(updated_at)
            FROM (
              SELECT r.updated_at as updated_at
              FROM responses r
              WHERE r.group_id = ?
              UNION ALL
              SELECT gr.updated_at as updated_at
              FROM guest_responses gr
              WHERE gr.group_id = ?
            ) updates
          ) as last_activity_at
        `
      )
      .get(groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId);

    const members = db
      .prepare(
        `
        SELECT id, guest_id, name, role, member_type, joined_at
        FROM (
          SELECT
            u.id AS id,
            NULL AS guest_id,
            u.name AS name,
            gm.role AS role,
            'user' AS member_type,
            gm.joined_at AS joined_at
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?

          UNION ALL

          SELECT
            NULL AS id,
            ngm.guest_id AS guest_id,
            ngm.display_name AS name,
            'guest' AS role,
            'named_guest' AS member_type,
            ngm.joined_at AS joined_at
          FROM named_guest_group_members ngm
          WHERE ngm.group_id = ?
        ) combined_members
        ORDER BY joined_at ASC, name COLLATE NOCASE ASC
        `
      )
      .all(groupId, groupId);

    const responses = db
      .prepare(
        `
        SELECT group_id, group_name, is_global, question_id, answer, updated_at, member_type
        FROM (
          SELECT
            r.group_id as group_id,
            g.name as group_name,
            g.is_global as is_global,
            r.question_id as question_id,
            r.answer as answer,
            r.updated_at as updated_at,
            'user' as member_type
          FROM responses r
          JOIN groups g ON g.id = r.group_id
          WHERE r.group_id = ?

          UNION ALL

          SELECT
            gr.group_id as group_id,
            g.name as group_name,
            g.is_global as is_global,
            gr.question_id as question_id,
            gr.answer as answer,
            gr.updated_at as updated_at,
            'named_guest_or_visitor' as member_type
          FROM guest_responses gr
          JOIN groups g ON g.id = gr.group_id
          WHERE gr.group_id = ?
        ) combined_responses
        ORDER BY updated_at DESC
        LIMIT 500
        `
      )
      .all(groupId, groupId);

    return res.render("admin_group_detail", {
      user,
      group,
      groupStats,
      members,
      responses,
      returnTo
    });
  });

  app.post("/admin/users/:id/reveal-email", requireAdmin, (req, res) => {
    const targetUserId = Number(req.params.id);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo =
      rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/users/")
      || rawReturnTo.startsWith("/admin/groups/")
        ? rawReturnTo
        : "/admin/overview";

    if (!targetUserId) {
      return res.redirect(withQueryParam(returnTo, "error", "Invalid user id."));
    }

    const adminUser = getCurrentUser(req);
    if (!adminUser || !adminUser.id) {
      return res.redirect("/login");
    }

    const adminPassword = String(req.body.adminPassword || "");
    if (!adminPassword) {
      return res.redirect(
        withQueryParam(returnTo, "error", "Admin password is required to view email.")
      );
    }

    const adminRow = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ? AND is_admin = 1")
      .get(adminUser.id);
    if (!adminRow || !adminRow.password_hash) {
      return res.redirect(
        withQueryParam(returnTo, "error", "Admin account could not be verified.")
      );
    }

    let passwordOk = false;
    try {
      passwordOk = bcrypt.compareSync(adminPassword, adminRow.password_hash);
    } catch (err) {
      passwordOk = false;
    }
    if (!passwordOk) {
      return res.redirect(withQueryParam(returnTo, "error", "Incorrect admin password."));
    }

    const target = db
      .prepare("SELECT id FROM users WHERE id = ? AND is_simulated = 0")
      .get(targetUserId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }

    const activeMap =
      req.session &&
      req.session.adminRevealedEmails &&
      typeof req.session.adminRevealedEmails === "object"
        ? req.session.adminRevealedEmails
        : {};
    activeMap[String(targetUserId)] = Date.now() + 5 * 60 * 1000;
    if (req.session) {
      req.session.adminRevealedEmails = activeMap;
    }
    return res.redirect(returnTo);
  });

  app.get("/admin/users/:id", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const targetUserId = Number(req.params.id);
    if (!targetUserId) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Invalid user id.")}`
      );
    }

    const rawReturnTo = String(req.query.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/groups/")
      ? rawReturnTo
      : "/admin/overview";

    const targetUser = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin, is_verified, verified_at
        FROM users
        WHERE id = ?
          AND is_simulated = 0
        `
      )
      .get(targetUserId);

    if (!targetUser) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("User not found.")}`
      );
    }

    const memberships = db
      .prepare(
        `
        SELECT
          gm.group_id,
          g.name as group_name,
          g.is_global,
          gm.role,
          gm.joined_at
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY gm.joined_at DESC
        `
      )
      .all(targetUserId);

    const responseStats = db
      .prepare(
        `
        SELECT
          COUNT(*) as response_count,
          COUNT(DISTINCT r.group_id) as groups_count,
          COUNT(DISTINCT r.question_id) as questions_count,
          MAX(r.updated_at) as last_updated_at
        FROM responses r
        JOIN groups g ON g.id = r.group_id
        WHERE r.user_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get(targetUserId);

    const responses = db
      .prepare(
        `
        SELECT
          r.group_id,
          g.name as group_name,
          g.is_global,
          r.question_id,
          r.answer,
          r.updated_at
        FROM responses r
        JOIN groups g ON g.id = r.group_id
        WHERE r.user_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY r.updated_at DESC
        LIMIT 500
        `
      )
      .all(targetUserId);

    return res.render("admin_user_detail", {
      user,
      targetUser,
      memberships,
      responses,
      responseStats,
      returnTo
    });
  });

  app.get("/admin/guests/:guestId", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const guestId = String(req.params.guestId || "").trim();
    if (!guestId || !/^[A-Za-z0-9_-]{4,128}$/.test(guestId)) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Invalid guest id.")}`
      );
    }

    const rawReturnTo = String(req.query.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/groups/")
      ? rawReturnTo
      : "/admin/overview";

    const namedGuestProfile = db
      .prepare(
        `
        SELECT guest_id, display_name, source_group_id, created_at, updated_at
        FROM named_guest_profiles
        WHERE guest_id = ?
        `
      )
      .get(guestId);

    const guestStats = db
      .prepare(
        `
        SELECT
          COUNT(*) as response_count,
          COUNT(DISTINCT gr.group_id) as groups_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MIN(gr.created_at) as first_seen_at,
          MAX(gr.updated_at) as last_seen_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE gr.guest_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get(guestId);

    if (!guestStats || Number(guestStats.response_count || 0) === 0) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Guest not found.")}`
      );
    }

    const groups = db
      .prepare(
        `
        SELECT
          gr.group_id,
          g.name as group_name,
          g.is_global,
          COUNT(*) as responses_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MAX(gr.updated_at) as last_updated_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE gr.guest_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        GROUP BY gr.group_id, g.name, g.is_global
        ORDER BY last_updated_at DESC
        `
      )
      .all(guestId);

    const responses = db
      .prepare(
        `
        SELECT
          gr.group_id,
          g.name as group_name,
          g.is_global,
          gr.question_id,
          gr.answer,
          gr.updated_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE gr.guest_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY gr.updated_at DESC
        LIMIT 500
        `
      )
      .all(guestId);

    return res.render("admin_guest_detail", {
      user,
      guestId,
      namedGuestProfile,
      guestStats,
      groups,
      responses,
      returnTo
    });
  });

  app.get(["/admin/analysis", "/admin/testing"], requireAdmin, (req, res) => {
    try {
      const user = getCurrentUser(req);
      const adminError = req.query.error ? String(req.query.error) : null;
      const adminSuccess = req.query.success ? String(req.query.success) : null;
      const groupsPerPage = 10;
      const requestedPage = Number(req.query.page || 1);
      const currentPage =
        Number.isFinite(requestedPage) && requestedPage > 0
          ? Math.floor(requestedPage)
          : 1;

      const countRow = db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM groups g
          WHERE COALESCE(g.is_simulated, 0) = 1
            AND COALESCE(g.is_global, 0) = 0
          `
        )
        .get();
      const totalGroups = Number(countRow?.count || 0);
      const totalPages = Math.max(1, Math.ceil(totalGroups / groupsPerPage));
      const safePage = Math.min(currentPage, totalPages);
      const offset = (safePage - 1) * groupsPerPage;

      const groups = db
        .prepare(
          `
          SELECT
            g.id,
            g.name,
            g.created_at,
            COUNT(gm.user_id) as total_members
          FROM groups g
          LEFT JOIN group_members gm ON gm.group_id = g.id
          WHERE COALESCE(g.is_simulated, 0) = 1
            AND COALESCE(g.is_global, 0) = 0
          GROUP BY g.id, g.name, g.created_at
          ORDER BY g.created_at DESC
          LIMIT ? OFFSET ?
          `
        )
        .all(groupsPerPage, offset);

      return res.render("admin_testing", {
        user,
        adminError,
        adminSuccess,
        groups,
        groupsPerPage,
        currentPage: safePage,
        totalPages
      });
    } catch (err) {
      console.error("Admin analysis list failed:", err);
      return res.redirect(
        `/admin/analysis?error=${encodeURIComponent(`Admin analysis failed: ${err.message}`)}`
      );
    }
  });

  app.get(
    ["/admin/analysis/:groupId", "/admin/testing/:groupId/analysis"],
    requireAdmin,
    (req, res) => {
      try {
        const user = getCurrentUser(req);
        const groupId = Number(req.params.groupId);
        const mode = String(req.query.mode || "actuals").trim().toLowerCase();
        const analysisMode = mode === "sim200" ? "sim200" : "actuals";
        const analysisSeason = Number(req.query.season || CURRENT_SEASON);
        if (!groupId) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Invalid test group id.")}`
          );
        }

        const group = db
          .prepare(
            `
            SELECT id, name, created_at
            FROM groups
            WHERE id = ?
              AND COALESCE(is_simulated, 0) = 1
              AND COALESCE(is_global, 0) = 0
            `
          )
          .get(groupId);
        if (!group) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Test group not found.")}`
          );
        }

        const simulatedMembers = db
          .prepare(
            `
            SELECT u.id as user_id, u.name as user_name
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
              AND COALESCE(u.is_simulated, 0) = 1
            ORDER BY u.id ASC
            `
          )
          .all(groupId);
        if (simulatedMembers.length === 0) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent(
              "This test group has no simulated players."
            )}`
          );
        }

        const responses = db
          .prepare(
            `
            SELECT r.user_id, r.question_id, r.answer
            FROM responses r
            JOIN users u ON u.id = r.user_id
            WHERE r.group_id = ?
              AND COALESCE(u.is_simulated, 0) = 1
            `
          )
          .all(groupId);

        const questions = getQuestions("en");
        const roster = getRoster();
        const races = getRaces();
        let analysis;
        if (analysisMode === "sim200") {
          const originalPlayerCount = Math.max(2, simulatedMembers.length);
          const monteCarloPlayerCount = Math.min(originalPlayerCount, 1000);
          analysis = buildMonteCarloAnalysis({
            questions,
            roster,
            races,
            playerCount: monteCarloPlayerCount,
            seasons: 200,
            originalPlayerCount
          });
        } else {
          const actualsMap = loadPublishedActuals(db, analysisSeason).values || {};
          analysis = buildGroupAnalysis(
            groupId,
            questions,
            actualsMap,
            simulatedMembers,
            responses
          );
        }

        return res.render("admin_test_group_analysis", {
          user,
          group,
          analysis,
          analysisMode,
          questions
        });
      } catch (err) {
        console.error("Admin analysis detail failed:", err);
        return res.redirect(
          `/admin/analysis?error=${encodeURIComponent(`Analysis failed: ${err.message}`)}`
        );
      }
    }
  );

  app.get(
    ["/admin/analysis/:groupId/leaderboard", "/admin/testing/:groupId/leaderboard"],
    requireAdmin,
    (req, res) => {
      try {
        const user = getCurrentUser(req);
        const locale = res.locals.locale || "en";
        const groupId = Number(req.params.groupId);
        const mode = String(req.query.mode || "actuals").trim().toLowerCase();
        const leaderboardMode = mode === "sim200" ? "sim200" : "actuals";

        if (!groupId) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Invalid test group id.")}`
          );
        }
        if (leaderboardMode === "actuals") {
          return res.redirect(`/groups/${groupId}/leaderboard`);
        }

        const group = db
          .prepare(
            `
            SELECT id, name, created_at
            FROM groups
            WHERE id = ?
              AND COALESCE(is_simulated, 0) = 1
              AND COALESCE(is_global, 0) = 0
            `
          )
          .get(groupId);
        if (!group) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Test group not found.")}`
          );
        }

        const members = db
          .prepare(
            `
            SELECT u.id as user_id, u.name as user_name
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY u.name ASC
            `
          )
          .all(groupId);

        const responses = db
          .prepare(
            `
            SELECT r.user_id, r.question_id, r.answer
            FROM responses r
            WHERE r.group_id = ?
            `
          )
          .all(groupId);

        const questions = getQuestions(locale);
        const roster = getRoster();
        const races = getRaces();
        const model = buildPredictionModel(roster);
        const syntheticActuals = buildSyntheticSeasonActuals(
          questions,
          roster,
          races,
          model
        );
        const actualsMap = {};
        for (const question of questions) {
          const value = syntheticActuals[question.id];
          const raw = serializeAnswerForStorage(question, value);
          if (raw != null && raw !== "") {
            actualsMap[question.id] = raw;
          }
        }

        const fullLeaderboard = buildLeaderboardRows({
          questions,
          actualsMap,
          members,
          responses
        });

        const leaderboardPerPage = 10;
        const requestedLeaderboardPage = Number(req.query.page || 1);
        const currentLeaderboardPage =
          Number.isFinite(requestedLeaderboardPage) && requestedLeaderboardPage > 0
            ? Math.floor(requestedLeaderboardPage)
            : 1;
        const totalLeaderboardPages = Math.max(
          1,
          Math.ceil(fullLeaderboard.length / leaderboardPerPage)
        );
        const safeLeaderboardPage = Math.min(
          currentLeaderboardPage,
          totalLeaderboardPages
        );
        const leaderboardOffset = (safeLeaderboardPage - 1) * leaderboardPerPage;
        const pagedLeaderboard = fullLeaderboard
          .slice(leaderboardOffset, leaderboardOffset + leaderboardPerPage)
          .map((row, index) => ({
            ...row,
            rank: leaderboardOffset + index + 1
          }));

        return res.render("leaderboard", {
          user,
          group: {
            ...group,
            name: `${group.name} (Simulated season preview)`
          },
          questions,
          leaderboard: pagedLeaderboard,
          actuals: actualsMap,
          actualSnapshots: [],
          selectedActualSnapshotId: null,
          leaderboardHistory: {
            hasEnoughHistory: false,
            rounds: [],
            series: [],
            maxTotal: 0
          },
          leaderboardFocusParticipantIds: [],
          participantInsights: {
            selectedParticipant: null,
            comparisonRows: [],
            gaps: [],
            strengths: [],
            distinctive: [],
            emptyReason: null
          },
          selectedBreakdown: {
            mode: "scored",
            hasScoredRows: false,
            rows: []
          },
          canViewQuestionBreakdown: false,
          selectedParticipantId: null,
          selectedLatestRoundDelta: null,
          latestRoundDeltaMeta: null,
          leaderboardTotal: fullLeaderboard.length,
          leaderboardPerPage,
          currentLeaderboardPage: safeLeaderboardPage,
          totalLeaderboardPages,
          leaderboardBasePath: `/admin/analysis/${groupId}/leaderboard`,
          leaderboardQuery: "mode=sim200"
        });
      } catch (err) {
        console.error("Admin analysis leaderboard failed:", err);
        return res.redirect(
          `/admin/analysis?error=${encodeURIComponent(`Leaderboard failed: ${err.message}`)}`
        );
      }
    }
  );

  app.post("/admin/test-group", requireAdmin, (req, res) => {
    const adminUser = getCurrentUser(req);
    if (!adminUser) return res.redirect("/login");
    const MAX_FAKE_PLAYERS = 1000;

    const now = new Date().toISOString();
    const requestedName = String(req.body.groupName || "").trim();
    const groupName =
      requestedName || `Test Group ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const rawCount = Number(req.body.fakePlayerCount || 0);
    if (Number.isFinite(rawCount) && rawCount > MAX_FAKE_PLAYERS) {
      return res.redirect(
        `/admin/analysis?error=${encodeURIComponent(
          `Max fake players is ${MAX_FAKE_PLAYERS} to keep analysis stable.`
        )}`
      );
    }
    const fakePlayerCount = Number.isFinite(rawCount)
      ? Math.max(1, Math.min(MAX_FAKE_PLAYERS, Math.floor(rawCount)))
      : 200;

    const questions = getQuestions("en");
    const roster = getRoster();
    const races = getRaces();
    const predictionModel = buildPredictionModel(roster);
    const sharedFakePasswordHash = bcrypt.hashSync(
      crypto.randomBytes(12).toString("hex"),
      10
    );

    const insertGroup = db.prepare(
      `
      INSERT INTO groups (
        id, name, owner_id, created_at, is_public, join_code, join_password_hash, rules_text, is_global, is_simulated
      )
      VALUES (?, ?, ?, ?, 0, NULL, NULL, ?, 0, 1)
      `
    );
    const addMembership = db.prepare(
      "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    );
    const insertUser = db.prepare(
      `
      INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated)
      VALUES (?, ?, ?, ?, 1, ?, 0, 1)
      `
    );
    const upsertResponse = db.prepare(
      `
      INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, group_id, question_id)
      DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
      `
    );

    let createdGroupId = 0;
    try {
      const tx = db.transaction(() => {
        const rulesText =
          `Simulation group with ${fakePlayerCount} fake players. ` +
          `Generated by admin on ${new Date().toLocaleString()} using smart prediction profiles.`;
        const groupId = generateUniqueGroupId();
        insertGroup.run(groupId, groupName, adminUser.id, now, rulesText);
        createdGroupId = Number(groupId);
        addMembership.run(adminUser.id, groupId, "owner", now);

        for (let i = 1; i <= fakePlayerCount; i += 1) {
          const token = crypto.randomBytes(3).toString("hex");
          const fakeName = `Sim ${groupId}-${i}-${token}`;
          const fakeEmail = `sim-${groupId}-${i}-${token}@example.test`;
          const userInfo = insertUser.run(
            fakeName,
            fakeEmail,
            sharedFakePasswordHash,
            now,
            now
          );
          const fakeUserId = Number(userInfo.lastInsertRowid);
          addMembership.run(fakeUserId, groupId, "member", now);
          const predictionProfile = createPredictionProfile();

          for (const question of questions) {
            const answer = randomAnswerForQuestion(
              question,
              roster,
              races,
              predictionModel,
              predictionProfile
            );
            if (answer == null || answer === "") continue;
            upsertResponse.run(
              fakeUserId,
              groupId,
              question.id,
              String(answer),
              now,
              now
            );
          }
        }
      });
      tx();
    } catch (err) {
      const message =
        err && /UNIQUE constraint failed: groups\.name/i.test(String(err.message))
          ? "Group name already exists. Choose another test group name."
          : `Failed to create test group: ${err.message}`;
      return res.redirect(
        `/admin/analysis?error=${encodeURIComponent(message)}`
      );
    }

    return res.redirect(
      `/admin/analysis?success=${encodeURIComponent(
        `Created test group "${groupName}" (#${createdGroupId}) with ${fakePlayerCount} fake players.`
      )}`
    );
  });

  app.post("/admin/users/:userId/make-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(returnTo);
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }
    if (target.is_admin === 1) {
      return res.redirect(withQueryParam(returnTo, "success", "User is already an admin."));
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE users SET is_admin = 1, is_verified = 1, verified_at = COALESCE(verified_at, ?) WHERE id = ?"
    ).run(now, userId);
    return res.redirect(withQueryParam(returnTo, "success", "Admin rights granted."));
  });

  app.post("/admin/users/:userId/remove-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(returnTo);
    const currentUser = getCurrentUser(req);
    if (currentUser && currentUser.id === userId) {
      return res.redirect(
        withQueryParam(returnTo, "error", "You cannot remove your own admin rights.")
      );
    }
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }
    if (target.is_admin !== 1) {
      return res.redirect(withQueryParam(returnTo, "success", "User is not an admin."));
    }
    db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(userId);
    return res.redirect(withQueryParam(returnTo, "success", "Admin rights removed."));
  });

  app.post("/admin/users/:userId/hide-from-global", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(withQueryParam(returnTo, "error", "Invalid user id."));

    const target = db
      .prepare("SELECT id, is_admin FROM users WHERE id = ? AND is_simulated = 0")
      .get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }

    const hideFromGlobalRaw = req.body.hideFromGlobal;
    const hideFromGlobalValue = Array.isArray(hideFromGlobalRaw)
      ? hideFromGlobalRaw[hideFromGlobalRaw.length - 1]
      : hideFromGlobalRaw;
    const hideFromGlobal = hideFromGlobalValue === "1" ? 1 : 0;
    db.prepare("UPDATE users SET hide_from_global = ? WHERE id = ?").run(hideFromGlobal, userId);
    return res.redirect(
      withQueryParam(
        returnTo,
        "success",
        hideFromGlobal === 1
          ? "User hidden from global responses and leaderboard."
          : "User shown in global responses and leaderboard."
      )
    );
  });

  app.post("/admin/users/:userId/delete", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(returnTo);
    const currentUser = getCurrentUser(req);
    if (currentUser && Number(currentUser.id) === userId) {
      return res.redirect(
        withQueryParam(
          returnTo,
          "error",
          "You cannot delete your own user account from admin."
        )
      );
    }

    const target = db
      .prepare("SELECT id, name FROM users WHERE id = ?")
      .get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }

    try {
      const tx = db.transaction(() => {
        const now = new Date().toISOString();
        const ownedGlobalGroups = db
          .prepare("SELECT id FROM groups WHERE owner_id = ? AND is_global = 1")
          .all(userId);

        const selectFallbackOwner = db.prepare(
          `
          SELECT gm.user_id
          FROM group_members gm
          WHERE gm.group_id = ?
            AND gm.user_id != ?
          ORDER BY gm.joined_at ASC
          LIMIT 1
          `
        );

        for (const row of ownedGlobalGroups) {
          const groupId = Number(row.id);
          let fallbackOwnerId =
            currentUser && Number(currentUser.id) !== userId
              ? Number(currentUser.id)
              : null;
          if (!fallbackOwnerId) {
            const fallback = selectFallbackOwner.get(groupId, userId);
            fallbackOwnerId = fallback ? Number(fallback.user_id) : null;
          }
          if (!fallbackOwnerId) {
            throw new Error("Cannot delete user: Global group has no fallback owner.");
          }

          db.prepare(
            "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
          ).run(fallbackOwnerId, groupId, now);
          db.prepare("UPDATE group_members SET role = 'owner' WHERE user_id = ? AND group_id = ?")
            .run(fallbackOwnerId, groupId);
          db.prepare("UPDATE groups SET owner_id = ? WHERE id = ?")
            .run(fallbackOwnerId, groupId);
        }

        const ownedGroups = db
          .prepare("SELECT id FROM groups WHERE owner_id = ? AND is_global = 0")
          .all(userId);
        for (const row of ownedGroups) {
          const groupId = Number(row.id);
          db.prepare("DELETE FROM responses WHERE group_id = ?").run(groupId);
          db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
          db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
          db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
        }

        db.prepare("DELETE FROM responses WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM group_members WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM invites WHERE created_by = ?").run(userId);
        db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      });
      tx();
    } catch (err) {
      return res.redirect(
        withQueryParam(returnTo, "error", `Failed to delete user: ${err.message}`)
      );
    }

    return res.redirect(withQueryParam(returnTo, "success", `User "${target.name}" deleted.`));
  });

  app.post("/admin/guests/:guestId/delete", requireAdmin, (req, res) => {
    const guestId = String(req.params.guestId || "").trim();
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!guestId || !/^[A-Za-z0-9_-]{4,128}$/.test(guestId)) {
      return res.redirect(withQueryParam(returnTo, "error", "Invalid guest id."));
    }

    const namedGuest = db
      .prepare(
        `
        SELECT guest_id, display_name
        FROM named_guest_profiles
        WHERE guest_id = ?
        `
      )
      .get(guestId);
    const hasResponses = db
      .prepare("SELECT 1 FROM guest_responses WHERE guest_id = ? LIMIT 1")
      .get(guestId);
    const hasMemberships = db
      .prepare("SELECT 1 FROM named_guest_group_members WHERE guest_id = ? LIMIT 1")
      .get(guestId);
    if (!namedGuest && !hasResponses && !hasMemberships) {
      return res.redirect(withQueryParam(returnTo, "error", "Guest not found."));
    }

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM guest_responses WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM named_guest_group_members WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM named_guest_profiles WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM pending_guest_claims WHERE guest_id = ?").run(guestId);
    });
    tx();

    const deletedLabel = namedGuest?.display_name
      ? `Guest "${namedGuest.display_name}" deleted.`
      : "Guest deleted.";
    return res.redirect(withQueryParam(returnTo, "success", deletedLabel));
  });

  app.post("/admin/groups/:groupId/delete", requireAdmin, (req, res) => {
    const source = String(req.query.from || "").trim().toLowerCase();
    const fallbackRedirectPath =
      source === "testing" || source === "analysis"
        ? "/admin/analysis"
        : "/admin/overview";
    const rawReturnTo = String(req.body.returnTo || "").trim();
    const redirectPath =
      rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/analysis")
      || rawReturnTo.startsWith("/admin/groups/")
        ? rawReturnTo
        : fallbackRedirectPath;
    const groupId = Number(req.params.groupId);
    if (!groupId) return res.redirect(redirectPath);
    const memberRows = db
      .prepare("SELECT user_id FROM group_members WHERE group_id = ?")
      .all(groupId);
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM responses WHERE group_id = ?").run(groupId);
      db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
      db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
      db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);

      const hasMembership = db.prepare(
        "SELECT 1 FROM group_members WHERE user_id = ? LIMIT 1"
      );
      const deleteUser = db.prepare("DELETE FROM users WHERE id = ?");
      for (const row of memberRows) {
        const userId = Number(row.user_id);
        if (!userId) continue;
        const user = db
          .prepare("SELECT id, is_simulated FROM users WHERE id = ?")
          .get(userId);
        if (!user || Number(user.is_simulated) !== 1) continue;
        if (hasMembership.get(userId)) continue;
        deleteUser.run(userId);
      }
    });
    tx();
    res.redirect(redirectPath);
  });

  app.get("/admin", (req, res) => {
    res.redirect("/admin/overview");
  });
}

module.exports = {
  auditResultLabel,
  auditSourceState,
  compactQuestionLabel,
  fallbackEntityCode,
  fallbackRaceCode,
  buildRaceDataFocusOptions,
  buildRaceDataMetricOptions,
  resolveActiveRaceDataMetricId,
  resolveRaceDataFocus,
  buildRaceDataAuditView,
  buildCorrectedRaceEvidence,
  isSafeRaceDataReturnPath,
  registerAdminRoutes
};
