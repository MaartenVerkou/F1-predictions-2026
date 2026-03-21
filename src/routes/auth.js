function registerAuthRoutes(app, deps) {
  const MIN_PASSWORD_LENGTH = 6;
  const {
    db,
    bcrypt,
    ADMIN_EMAILS,
    ensureUserInGlobalGroup,
    generateToken,
    hashToken,
    BASE_URL,
    getMailer,
    SMTP_USER,
    SMTP_FROM,
    COMPANY_NAME,
    getCurrentUser,
    sendError,
    requireAuth,
    DEV_AUTO_LOGIN,
    NODE_ENV,
    claimGuestResponsesForUser,
    predictionsClosed,
    getQuestions
  } = deps;

  const BRAND_NAME = String(COMPANY_NAME || "Wheel of Knowledge").trim() || "Wheel of Knowledge";
  const TEAM_SIGNOFF = `The ${BRAND_NAME} Team`;
  const EMAIL_SENDER = String(SMTP_FROM || "").trim()
    || (SMTP_USER ? `${BRAND_NAME} <${SMTP_USER}>` : BRAND_NAME);

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getGreetingName = (name) => {
    const normalized = String(name || "").trim();
    return normalized || "there";
  };

  const sanitizeRedirectPath = (rawValue) => {
    const raw = String(rawValue || "").trim();
    if (!raw) return "/";
    if (raw.startsWith("/")) return raw;
    try {
      const parsed = new URL(raw);
      return `${parsed.pathname || "/"}${parsed.search || ""}`;
    } catch (err) {
      return "/";
    }
  };

  async function issueAndSendVerificationEmail(userId, email, name = "", options = {}) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId);
    db.prepare(
      "INSERT INTO email_verifications (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
    ).run(userId, tokenHash, expiresAt, now);

    const redirectTo = sanitizeRedirectPath(options.redirectTo || "/");
    const verifyUrl =
      redirectTo && redirectTo !== "/"
        ? `${BASE_URL}/verify?token=${token}&redirect=${encodeURIComponent(redirectTo)}`
        : `${BASE_URL}/verify?token=${token}`;
    const mailer = getMailer();
    if (!mailer) {
      return {
        ok: false,
        reason: "smtp_missing",
        verifyUrl
      };
    }

    try {
      const greetingName = getGreetingName(name);
      const safeGreetingName = escapeHtml(greetingName);
      await mailer.sendMail({
        from: EMAIL_SENDER,
        to: email,
        subject: `Verify your ${BRAND_NAME} account`,
        text:
          `Hey ${greetingName}!\n\n` +
          `Please verify your ${BRAND_NAME} account:\n` +
          `${verifyUrl}\n\n` +
          "Thanks,\n" +
          `${TEAM_SIGNOFF}`,
        html:
          `<p>Hey ${safeGreetingName}!</p>` +
          `<p>Please verify your ${escapeHtml(BRAND_NAME)} account:</p>` +
          `<p><a href="${verifyUrl}">${verifyUrl}</a></p>` +
          `<p>Thanks,<br>${escapeHtml(TEAM_SIGNOFF)}</p>`
      });
      return { ok: true };
    } catch (err) {
      console.error("Failed to send verification email:", err);
      return {
        ok: false,
        reason: "send_failed",
        verifyUrl
      };
    }
  }

  const buildLeaderboardPreviewRows = (leaderboard, currentParticipantId, limit = 5) => {
    const safeLimit = Math.max(1, Number(limit) || 5);
    const rankedRows = leaderboard.map((row, index) => ({
      rank: index + 1,
      ...row
    }));
    if (rankedRows.length <= safeLimit) {
      return rankedRows;
    }
    const currentId = String(currentParticipantId || "");
    const currentIndex = currentId
      ? rankedRows.findIndex((row) => String(row.userId) === currentId)
      : -1;
    if (currentIndex < 0 || currentIndex < safeLimit) {
      return rankedRows.slice(0, safeLimit);
    }
    return [...rankedRows.slice(0, safeLimit - 1), rankedRows[currentIndex]];
  };

  function getHomeGlobalLeaderboard(locale, currentUserId) {
    const globalGroup = db.prepare("SELECT id, name FROM groups WHERE is_global = 1 LIMIT 1").get();
    if (!globalGroup) return null;

    const questions = typeof getQuestions === "function" ? getQuestions(locale) : [];
    if (!Array.isArray(questions) || questions.length === 0) return null;

    const actualRows = db.prepare("SELECT question_id, value FROM actuals").all();
    if (actualRows.length === 0) return null;
    const actuals = actualRows.reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});

    const questionMap = questions.reduce((acc, question) => {
      acc[question.id] = question;
      return acc;
    }, {});

    const parseStoredValue = (question, raw) => {
      if (!raw) return null;
      const text = String(raw).trim();
      const type = question.type || "text";
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
          return JSON.parse(raw);
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
    };

    const isMatch = (actualValue, predictedValue) => {
      if (actualValue == null || predictedValue == null) return false;
      if (Array.isArray(actualValue)) return actualValue.includes(predictedValue);
      return String(actualValue) === String(predictedValue);
    };

    const scoreQuestion = (question, predictedRaw, actualRaw) => {
      if (actualRaw == null || predictedRaw == null) return 0;
      const type = question.type || "text";
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
        return isMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
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
          if (isMatch(actualValue, predictedValue)) {
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
        if (actualDriver && predictedDriver && isMatch(actualDriver, predictedDriver)) {
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
    };

    const globalGroupId = Number(globalGroup.id);
    const members = db.prepare(
      `
      SELECT participant_id, user_name
      FROM (
        SELECT
          CAST(u.id AS TEXT) as participant_id,
          u.name as user_name
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
          AND COALESCE(u.hide_from_global, 0) = 0

        UNION ALL

        SELECT
          ngm.guest_id as participant_id,
          ngm.display_name as user_name
        FROM named_guest_group_members ngm
        WHERE ngm.group_id = ?
      ) combined_members
      `
    ).all(globalGroupId, globalGroupId);
    if (members.length === 0) return null;

    const scoreByUser = {};
    members.forEach((member) => {
      scoreByUser[member.participant_id] = {
        userId: member.participant_id,
        name: member.user_name,
        total: 0
      };
    });

    const responses = db.prepare(
      `
      SELECT participant_id, question_id, answer
      FROM (
        SELECT
          CAST(u.id AS TEXT) as participant_id,
          r.question_id,
          r.answer
        FROM responses r
        JOIN users u ON u.id = r.user_id
        WHERE r.group_id = ?
          AND COALESCE(u.hide_from_global, 0) = 0

        UNION ALL

        SELECT
          gr.guest_id as participant_id,
          gr.question_id,
          gr.answer
        FROM guest_responses gr
        JOIN named_guest_group_members ngm
          ON ngm.group_id = gr.group_id
         AND ngm.guest_id = gr.guest_id
        WHERE gr.group_id = ?
      ) combined_responses
      `
    ).all(globalGroupId, globalGroupId);

    responses.forEach((row) => {
      const question = questionMap[row.question_id];
      const scoreRow = scoreByUser[row.participant_id];
      if (!question || !scoreRow) return;
      const actual = parseStoredValue(question, actuals[question.id]);
      const predicted = parseStoredValue(question, row.answer);
      scoreRow.total += scoreQuestion(question, predicted, actual);
    });

    const rows = buildLeaderboardPreviewRows(
      Object.values(scoreByUser).sort(
        (a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name))
      ),
      currentUserId,
      10
    ).map((row) => ({
      rank: row.rank,
      name: row.name,
      total: row.total
    }));

    if (rows.length === 0) return null;

    return {
      groupName: String(globalGroup.name || "Global"),
      rows
    };
  }

  app.get("/", (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    res.render("home", {
      user,
      predictionsClosed: typeof predictionsClosed === "function" ? predictionsClosed() : false,
      globalLeaderboard: getHomeGlobalLeaderboard(locale, user ? user.id : null),
      globalLeaderboardHref: user
        ? "/global/leaderboard"
        : `/login?redirectTo=${encodeURIComponent("/global/leaderboard")}`
    });
  });

  app.get("/about", (req, res) => {
    const user = getCurrentUser(req);
    res.render("about", { user });
  });

  const renderSignup = (res, options = {}) => {
    const error = options.error || null;
    const form = options.form || {};
    res.render("signup", {
      error,
      form: {
        name: String(form.name || ""),
        email: String(form.email || ""),
        redirectTo: sanitizeRedirectPath(form.redirectTo || "/")
      }
    });
  };

  const normalizeSuggestedUserName = (rawValue) =>
    String(rawValue || "")
      .replace(/\s+/g, " ")
      .trim();

  const parseStoredValue = (question, raw) => {
    if (!raw) return null;
    const text = String(raw).trim();
    const type = question.type || "text";
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
        return JSON.parse(raw);
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
  };

  const isMatch = (actualValue, predictedValue) => {
    if (actualValue == null || predictedValue == null) return false;
    if (Array.isArray(actualValue)) return actualValue.includes(predictedValue);
    return String(actualValue) === String(predictedValue);
  };

  const scoreQuestion = (question, predictedRaw, actualRaw) => {
    if (actualRaw == null || predictedRaw == null) return 0;
    const type = question.type || "text";
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
      return isMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
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
        if (isMatch(actualValue, predictedValue)) {
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
      if (actualDriver && predictedDriver && isMatch(actualDriver, predictedDriver)) {
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
  };

  const buildGroupLeaderboard = (groupId, questions, actualsByQuestion, options = {}) => {
    const excludeHiddenAdmins = Boolean(options.excludeHiddenAdmins);
    const questionMap = questions.reduce((acc, question) => {
      acc[question.id] = question;
      return acc;
    }, {});

    const members = db.prepare(
      `
      SELECT participant_id, user_name
      FROM (
        SELECT
          CAST(u.id AS TEXT) as participant_id,
          u.name as user_name
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
          ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}

        UNION ALL

        SELECT
          ngm.guest_id as participant_id,
          ngm.display_name as user_name
        FROM named_guest_group_members ngm
        WHERE ngm.group_id = ?
      ) combined_members
      `
    ).all(groupId, groupId);

    const scoreByUser = {};
    members.forEach((member) => {
      scoreByUser[member.participant_id] = {
        userId: member.participant_id,
        name: member.user_name,
        total: 0
      };
    });

    const responses = db.prepare(
      `
      SELECT participant_id, question_id, answer
      FROM (
        SELECT
          CAST(u.id AS TEXT) as participant_id,
          r.question_id,
          r.answer
        FROM responses r
        JOIN users u ON u.id = r.user_id
        WHERE r.group_id = ?
          ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}

        UNION ALL

        SELECT
          gr.guest_id as participant_id,
          gr.question_id,
          gr.answer
        FROM guest_responses gr
        JOIN named_guest_group_members ngm
          ON ngm.group_id = gr.group_id
         AND ngm.guest_id = gr.guest_id
        WHERE gr.group_id = ?
      ) combined_responses
      `
    ).all(groupId, groupId);

    responses.forEach((row) => {
      const question = questionMap[row.question_id];
      const scoreRow = scoreByUser[row.participant_id];
      if (!question || !scoreRow) return;
      const actual = parseStoredValue(question, actualsByQuestion[question.id]);
      const predicted = parseStoredValue(question, row.answer);
      scoreRow.total += scoreQuestion(question, predicted, actual);
    });

    return Object.values(scoreByUser).sort(
      (a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name))
    );
  };

  const getDashboardGroupPositionMap = (locale, userId, groups) => {
    if (!Array.isArray(groups) || groups.length === 0) return {};
    const questions = typeof getQuestions === "function" ? getQuestions(locale) : [];
    if (!Array.isArray(questions) || questions.length === 0) return {};

    const actualRows = db.prepare("SELECT question_id, value FROM actuals").all();
    if (actualRows.length === 0) return {};
    const actualsByQuestion = actualRows.reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});

    const participantId = String(userId);
    return groups.reduce((acc, group) => {
      const groupId = Number(group.id);
      if (!Number.isFinite(groupId) || groupId <= 0) return acc;
      const leaderboard = buildGroupLeaderboard(groupId, questions, actualsByQuestion, {
        excludeHiddenAdmins: Number(group.is_global) === 1
      });
      const rankIndex = leaderboard.findIndex((row) => row.userId === participantId);
      if (rankIndex >= 0) {
        acc[groupId] = {
          rank: rankIndex + 1,
          total: leaderboard.length
        };
      }
      return acc;
    }, {});
  };

  const buildAvailableUserNameSuggestion = (rawBaseName) => {
    const baseName = normalizeSuggestedUserName(rawBaseName);
    if (!baseName) return "";

    const existingBase = db
      .prepare("SELECT id FROM users WHERE name = ?")
      .get(baseName);
    if (!existingBase) return baseName;

    const randomTwoDigits = () => String(Math.floor(Math.random() * 90) + 10);
    for (let i = 0; i < 80; i += 1) {
      const candidate = `${baseName}_${randomTwoDigits()}`;
      const exists = db
        .prepare("SELECT id FROM users WHERE name = ?")
        .get(candidate);
      if (!exists) return candidate;
    }

    // Fallback if random retries collide unusually often.
    for (let n = 100; n < 1000; n += 1) {
      const candidate = `${baseName}_${n}`;
      const exists = db
        .prepare("SELECT id FROM users WHERE name = ?")
        .get(candidate);
      if (!exists) return candidate;
    }

    return baseName;
  };

  app.get(["/signup", "/register"], (req, res) => {
    const namedGuestDisplayName = String(req.session?.namedGuestAccess?.displayName || "");
    const suggestedName = buildAvailableUserNameSuggestion(namedGuestDisplayName);
    renderSignup(res, {
      form: {
        name: suggestedName,
        redirectTo: sanitizeRedirectPath(req.query.redirectTo || "/")
      }
    });
  });

  app.get("/api/users/check-name", (req, res) => {
    const normalizedName = String(req.query.name || "").trim();
    const normalizedEmail = String(req.query.email || "").trim().toLowerCase();
    if (!normalizedName) {
      return res.json({ available: false, reason: "empty" });
    }
    const existingByEmail = normalizedEmail
      ? db
        .prepare("SELECT id, is_verified FROM users WHERE email = ?")
        .get(normalizedEmail)
      : null;
    const exists = existingByEmail && !existingByEmail.is_verified
      ? db
        .prepare("SELECT id FROM users WHERE name = ? AND id <> ?")
        .get(normalizedName, existingByEmail.id)
      : db.prepare("SELECT id FROM users WHERE name = ?").get(normalizedName);
    return res.json({ available: !exists });
  });

  app.post("/signup", async (req, res) => {
    const { password, passwordConfirm } = req.body;
    const rawName = String(req.body.name || "");
    const rawEmail = String(req.body.email || "");
    const redirectTo = sanitizeRedirectPath(req.body.redirectTo || "/");
    const normalizedName = rawName.trim();
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const isDevVerifyShortcut =
      NODE_ENV !== "production" && normalizedEmail === "verify@account.com";
    const effectiveEmail = isDevVerifyShortcut
      ? `verify-${Date.now()}-${String(generateToken()).slice(0, 8)}@example.local`
      : normalizedEmail;
    const signupForm = { name: normalizedName, email: normalizedEmail, redirectTo };

    if (!normalizedName || !normalizedEmail || !password || !passwordConfirm) {
      return renderSignup(res, {
        error: "All fields are required.",
        form: signupForm
      });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return renderSignup(res, {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        form: signupForm
      });
    }
    if (password !== passwordConfirm) {
      return renderSignup(res, {
        error: "Passwords do not match.",
        form: signupForm
      });
    }

    const shouldBeAdmin = ADMIN_EMAILS.has(effectiveEmail);
    const existing = db
      .prepare("SELECT id, is_verified FROM users WHERE email = ?")
      .get(effectiveEmail);
    const nameTaken = existing && !existing.is_verified
      ? db
        .prepare("SELECT id FROM users WHERE name = ? AND id <> ?")
        .get(normalizedName, existing.id)
      : db.prepare("SELECT id FROM users WHERE name = ?").get(normalizedName);
    if (nameTaken) {
      return renderSignup(res, {
        error: "Name already in use.",
        form: signupForm
      });
    }
    if (existing && existing.is_verified) {
      return renderSignup(res, {
        error: "Email already registered.",
        form: signupForm
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    let userId = existing ? existing.id : null;
    if (userId) {
      db.prepare(
        "UPDATE users SET name = ?, password_hash = ?, created_at = ?, is_verified = 0, verified_at = NULL, is_admin = ? WHERE id = ?"
      ).run(normalizedName, passwordHash, now, shouldBeAdmin ? 1 : 0, userId);
    } else {
      const stmt = db.prepare(
        "INSERT INTO users (name, email, password_hash, created_at, is_verified, is_admin) VALUES (?, ?, ?, ?, 0, ?)"
      );
      const info = stmt.run(
        normalizedName,
        effectiveEmail,
        passwordHash,
        now,
        shouldBeAdmin ? 1 : 0
      );
      userId = info.lastInsertRowid;
    }
    ensureUserInGlobalGroup(userId);
    const pendingGuestId = String(req.session?.guestId || "").trim();
    if (pendingGuestId) {
      db.prepare(
        `
        INSERT INTO pending_guest_claims (user_id, guest_id, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET
          guest_id = excluded.guest_id,
          created_at = excluded.created_at
        `
      ).run(userId, pendingGuestId, now);
    } else {
      db.prepare("DELETE FROM pending_guest_claims WHERE user_id = ?").run(userId);
    }
    if (isDevVerifyShortcut) {
      db.prepare(
        "UPDATE users SET is_verified = 1, verified_at = COALESCE(verified_at, ?) WHERE id = ?"
      ).run(now, userId);
      req.session.userId = userId;
      const pendingGuestClaim = db
        .prepare("SELECT guest_id FROM pending_guest_claims WHERE user_id = ?")
        .get(userId);
      const fallbackGuestId = String(pendingGuestClaim?.guest_id || "").trim();
      if (typeof claimGuestResponsesForUser === "function") {
        claimGuestResponsesForUser(req, userId, { fallbackGuestId });
      }
      db.prepare("DELETE FROM pending_guest_claims WHERE user_id = ?").run(userId);
      if (req.session) {
        req.session.postVerifyRedirect = null;
      }
      return res.redirect(redirectTo && redirectTo !== "/" ? redirectTo : "/");
    }

    req.session.postVerifyRedirect = redirectTo;

    const result = await issueAndSendVerificationEmail(
      userId,
      effectiveEmail,
      normalizedName,
      { redirectTo }
    );
    if (!result.ok && result.reason === "smtp_missing") {
      return res.render("verify_notice", {
        email: effectiveEmail,
        message: "SMTP is not configured. Use the link below to verify.",
        verifyUrl: result.verifyUrl,
        redirectTo,
        allowResend: true
      });
    }
    if (!result.ok && result.reason === "send_failed") {
      return res.render("verify_notice", {
        email: effectiveEmail,
        message: "Email failed to send. Use the link below to verify.",
        verifyUrl: result.verifyUrl,
        redirectTo,
        allowResend: true
      });
    }

    return res.render("verify_notice", {
      email: effectiveEmail,
      message: "Verification email sent. Please check your inbox and spam/junk folder.",
      verifyUrl: null,
      redirectTo,
      allowResend: true
    });
  });

  app.get("/login", (req, res) => {
    const notice =
      req.query.reset === "1" ? "Password updated. You can log in now." : null;
    res.render("login", {
      error: null,
      notice,
      unverifiedEmail: null,
      email: ""
    });
  });

  app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!email || !password) {
      return res.render("login", {
        error: "Email and password required.",
        notice: null,
        unverifiedEmail: null,
        email: normalizedEmail
      });
    }
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(normalizedEmail);
    if (!user) {
      return res.render("login", {
        error: "No account found for that email.",
        notice: null,
        unverifiedEmail: null,
        email: normalizedEmail
      });
    }
    if (!user.is_verified) {
      return res.render("login", {
        error: "Please verify your email first.",
        notice: null,
        unverifiedEmail: normalizedEmail,
        email: normalizedEmail
      });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", {
        error: "Password is incorrect.",
        notice: null,
        unverifiedEmail: null,
        email: normalizedEmail
      });
    }
    req.session.userId = user.id;
    if (typeof claimGuestResponsesForUser === "function") {
      claimGuestResponsesForUser(req, user.id);
    }
    db.prepare("DELETE FROM pending_guest_claims WHERE user_id = ?").run(user.id);
    return res.redirect("/dashboard");
  });

  app.post("/resend-verification", async (req, res) => {
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    const redirectTo = sanitizeRedirectPath(req.body.redirectTo || "/");
    const returnToVerifyNotice = req.body.returnToVerifyNotice === "1";
    if (!normalizedEmail) {
      if (returnToVerifyNotice) {
        return res.render("verify_notice", {
          email: "",
          message: "Email is required.",
          verifyUrl: null,
          redirectTo,
          allowResend: true
        });
      }
      return res.render("login", {
        error: "Email is required.",
        notice: null,
        unverifiedEmail: null,
        email: ""
      });
    }

    const user = db
      .prepare("SELECT id, name, is_verified FROM users WHERE email = ?")
      .get(normalizedEmail);

    if (!user || user.is_verified) {
      if (returnToVerifyNotice) {
        return res.render("verify_notice", {
          email: normalizedEmail,
          message: "If your account exists and is unverified, a new verification email was sent.",
          verifyUrl: null,
          redirectTo,
          allowResend: true
        });
      }
      return res.render("login", {
        error: null,
        notice: "If your account exists and is unverified, a new verification email was sent.",
        unverifiedEmail: null,
        email: normalizedEmail
      });
    }

    const result = await issueAndSendVerificationEmail(
      user.id,
      normalizedEmail,
      user.name,
      { redirectTo }
    );
    if (!result.ok && result.verifyUrl) {
      if (returnToVerifyNotice) {
        return res.render("verify_notice", {
          email: normalizedEmail,
          message:
            result.reason === "smtp_missing"
              ? "SMTP is not configured. Use the link below to verify."
              : "Email failed to send. Use the link below to verify.",
          verifyUrl: result.verifyUrl,
          redirectTo,
          allowResend: true
        });
      }
      return res.render("verify_notice", {
        email: normalizedEmail,
        message:
          result.reason === "smtp_missing"
            ? "SMTP is not configured. Use the link below to verify."
            : "Email failed to send. Use the link below to verify.",
        verifyUrl: result.verifyUrl,
        redirectTo,
        allowResend: true
      });
    }

    if (returnToVerifyNotice) {
      return res.render("verify_notice", {
        email: normalizedEmail,
        message: "Verification email re-sent. Please check your inbox and spam/junk folder.",
        verifyUrl: null,
        redirectTo,
        allowResend: true
      });
    }

    return res.render("login", {
      error: null,
      notice: "Verification email re-sent. Please check your inbox and spam/junk folder.",
      unverifiedEmail: null,
      email: normalizedEmail
    });
  });

  app.get("/forgot-password", (req, res) => {
    res.render("forgot_password", {
      error: null,
      message: null
    });
  });

  app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.render("forgot_password", {
        error: "Email is required.",
        message: null
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db
      .prepare("SELECT id, name FROM users WHERE email = ?")
      .get(normalizedEmail);

    if (user) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
      db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
      db.prepare(
        "INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
      ).run(user.id, tokenHash, expiresAt, now);

      const mailer = getMailer();
      if (mailer) {
        try {
          const greetingName = getGreetingName(user.name);
          const safeGreetingName = escapeHtml(greetingName);
          await mailer.sendMail({
            from: EMAIL_SENDER,
            to: normalizedEmail,
            subject: "Password reset request",
            text:
              `Hey ${greetingName}!\n\n` +
              `You requested a password reset for ${BRAND_NAME}.\n\n` +
              `Reset link: ${resetUrl}\n\n` +
              "If you did not request this, you can ignore this email.\n\n" +
              "Thanks,\n" +
              `${TEAM_SIGNOFF}`,
            html:
              `<p>Hey ${safeGreetingName}!</p>` +
              `<p>You requested a password reset for ${escapeHtml(BRAND_NAME)}.</p>` +
              `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
              "<p>If you did not request this, you can ignore this email.</p>" +
              `<p>Thanks,<br>${escapeHtml(TEAM_SIGNOFF)}</p>`
          });
        } catch (err) {
          console.error("Failed to send password reset email:", err);
        }
      }

      return res.render("forgot_password", {
        error: null,
        message: "If that email exists, a reset link has been sent. Check spam/junk too."
      });
    }

    return res.render("forgot_password", {
      error: null,
      message: "If that email exists, a reset link has been sent. Check spam/junk too."
    });
  });

  app.get("/reset-password", (req, res) => {
    const token = String(req.query.token || "");
    if (!token) {
      return res.render("reset_password", {
        token: "",
        error: "Reset link is invalid or expired."
      });
    }

    const tokenHash = hashToken(token);
    const reset = db
      .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?")
      .get(tokenHash, new Date().toISOString());
    if (!reset) {
      return res.render("reset_password", {
        token: "",
        error: "Reset link is invalid or expired."
      });
    }

    return res.render("reset_password", { token, error: null });
  });

  app.post("/reset-password", async (req, res) => {
    const token = String(req.body.token || "");
    const { password, passwordConfirm } = req.body;
    if (!token || !password || !passwordConfirm) {
      return res.render("reset_password", {
        token,
        error: "All fields are required."
      });
    }
    if (password !== passwordConfirm) {
      return res.render("reset_password", {
        token,
        error: "Passwords do not match."
      });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.render("reset_password", {
        token,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      });
    }

    const tokenHash = hashToken(token);
    const reset = db
      .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?")
      .get(tokenHash, new Date().toISOString());
    if (!reset) {
      return res.render("reset_password", {
        token: "",
        error: "Reset link is invalid or expired."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      passwordHash,
      reset.user_id
    );
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(reset.user_id);
    return res.redirect("/login?reset=1");
  });

  app.post("/logout", (req, res) => {
    if (NODE_ENV !== "production" && DEV_AUTO_LOGIN) {
      req.session.userId = null;
      req.session.devAutoLoginSkipOnce = true;
      return req.session.save(() => {
        res.redirect("/");
      });
    }
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  app.get("/verify", (req, res) => {
    const { token } = req.query;
    if (!token) {
      return sendError(req, res, 400, "Missing token.");
    }
    const tokenHash = hashToken(String(token));
    const verification = db
      .prepare(
        "SELECT * FROM email_verifications WHERE token_hash = ? AND expires_at > ?"
      )
      .get(tokenHash, new Date().toISOString());
    if (!verification) {
      return sendError(req, res, 400, "Invalid or expired token.");
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE users SET is_verified = 1, verified_at = ? WHERE id = ?").run(
      now,
      verification.user_id
    );
    db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(
      verification.user_id
    );
    req.session.userId = verification.user_id;
    const pendingGuestClaim = db
      .prepare("SELECT guest_id FROM pending_guest_claims WHERE user_id = ?")
      .get(verification.user_id);
    const fallbackGuestId = String(pendingGuestClaim?.guest_id || "").trim();
    if (typeof claimGuestResponsesForUser === "function") {
      claimGuestResponsesForUser(req, verification.user_id, {
        fallbackGuestId
      });
    }
    db.prepare("DELETE FROM pending_guest_claims WHERE user_id = ?").run(
      verification.user_id
    );
    const queryRedirect = sanitizeRedirectPath(req.query.redirect || "/");
    const sessionRedirect = sanitizeRedirectPath(req.session?.postVerifyRedirect || "/");
    const target = queryRedirect && queryRedirect !== "/" ? queryRedirect : sessionRedirect;
    if (req.session) {
      req.session.postVerifyRedirect = null;
    }
    return res.redirect(target && target !== "/" ? target : "/");
  });

  app.get("/account", requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const error = req.query.error ? String(req.query.error) : null;
    const success = req.query.success ? String(req.query.success) : null;
    return res.render("account", { user, error, success });
  });

  app.post("/account/password", requireAuth, async (req, res) => {
    const user = getCurrentUser(req);
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return res.redirect(
        `/account?error=${encodeURIComponent("All password fields are required.")}`
      );
    }
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.redirect(
        `/account?error=${encodeURIComponent(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        )}`
      );
    }
    if (newPassword !== newPasswordConfirm) {
      return res.redirect(
        `/account?error=${encodeURIComponent("New passwords do not match.")}`
      );
    }

    const fullUser = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(user.id);
    if (!fullUser) {
      return res.redirect("/login");
    }
    const currentOk = await bcrypt.compare(currentPassword, fullUser.password_hash);
    if (!currentOk) {
      return res.redirect(
        `/account?error=${encodeURIComponent("Current password is incorrect.")}`
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      passwordHash,
      user.id
    );
    return res.redirect(
      `/account?success=${encodeURIComponent("Password updated.")}`
    );
  });

  app.post("/account/delete", requireAuth, async (req, res) => {
    const user = getCurrentUser(req);
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.redirect(
        `/account?error=${encodeURIComponent("Current password is required to delete your account.")}`
      );
    }

    const fullUser = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(user.id);
    if (!fullUser) {
      return res.redirect("/login");
    }
    const currentOk = await bcrypt.compare(currentPassword, fullUser.password_hash);
    if (!currentOk) {
      return res.redirect(
        `/account?error=${encodeURIComponent("Current password is incorrect.")}`
      );
    }

    const ownedGroups = db
      .prepare(
        `
        SELECT g.id, g.name
        FROM groups g
        WHERE g.owner_id = ?
        ORDER BY g.created_at ASC
        `
      )
      .all(user.id);
    if (ownedGroups.length > 0) {
      const firstOwned = ownedGroups[0].name;
      return res.redirect(
        `/account?error=${encodeURIComponent(
          `You still own ${ownedGroups.length} group(s), starting with "${firstOwned}". Transfer ownership or leave those groups first.`
        )}`
      );
    }

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM responses WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM group_members WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM invites WHERE created_by = ?").run(user.id);
      db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    });
    tx();

    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  app.get("/dashboard", requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const dashboardPageSize = 8;
    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, g.is_global, gm.role
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.created_at DESC
        `
      )
      .all(user.id);

    const groupPositions = getDashboardGroupPositionMap(locale, user.id, groups);
    const groupsWithPositions = groups.map((group) => ({
      ...group,
      dashboardPosition: groupPositions[Number(group.id)] || null
    }));
    const featuredGlobalGroup =
      groupsWithPositions.find((group) => Number(group.is_global) === 1) || null;
    const regularGroups = groupsWithPositions.filter((group) => Number(group.is_global) !== 1);
    const requestedGroupsPage = Number(req.query.groupsPage || 1);
    const currentGroupsPage =
      Number.isFinite(requestedGroupsPage) && requestedGroupsPage > 0
        ? Math.floor(requestedGroupsPage)
        : 1;
    const totalGroupsPages = Math.max(1, Math.ceil(regularGroups.length / dashboardPageSize));
    const safeGroupsPage = Math.min(currentGroupsPage, totalGroupsPages);
    const pagedRegularGroups = regularGroups.slice(
      (safeGroupsPage - 1) * dashboardPageSize,
      safeGroupsPage * dashboardPageSize
    );

    const publicGroups = db
      .prepare(
        `
        SELECT g.id, g.name, u.name as owner_name, g.created_at, g.is_global
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE g.is_public = 1
        AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
        ORDER BY g.created_at DESC
        `
      )
      .all(user.id);
    const requestedPublicGroupsPage = Number(req.query.publicGroupsPage || 1);
    const currentPublicGroupsPage =
      Number.isFinite(requestedPublicGroupsPage) && requestedPublicGroupsPage > 0
        ? Math.floor(requestedPublicGroupsPage)
        : 1;
    const totalPublicGroupsPages = Math.max(1, Math.ceil(publicGroups.length / dashboardPageSize));
    const safePublicGroupsPage = Math.min(currentPublicGroupsPage, totalPublicGroupsPages);
    const pagedPublicGroups = publicGroups.slice(
      (safePublicGroupsPage - 1) * dashboardPageSize,
      safePublicGroupsPage * dashboardPageSize
    );

    return res.render("dashboard", {
      user,
      groups: groupsWithPositions,
      featuredGlobalGroup,
      regularGroups: pagedRegularGroups,
      currentGroupsPage: safeGroupsPage,
      totalGroupsPages,
      globalLeaderboard: getHomeGlobalLeaderboard(locale, user.id),
      globalLeaderboardHref: "/global/leaderboard",
      publicGroups: pagedPublicGroups,
      currentPublicGroupsPage: safePublicGroupsPage,
      totalPublicGroupsPages,
      error: null,
      success: null
    });
  });

  app.get("/start-predicting", (req, res) => {
    const user = getCurrentUser(req);
    const isClosed = typeof predictionsClosed === "function" && predictionsClosed();
    if (isClosed) {
      return res.redirect(user ? "/dashboard" : "/");
    }
    if (!user) return res.redirect("/global/questions");

    const globalGroup = ensureUserInGlobalGroup(user.id);
    if (!globalGroup || !globalGroup.id) {
      return sendError(req, res, 500, "Global group is not available.");
    }
    return res.redirect("/global/questions");
  });
}

module.exports = {
  registerAuthRoutes
};
