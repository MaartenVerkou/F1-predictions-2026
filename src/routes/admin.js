const crypto = require("crypto");
const bcrypt = require("bcrypt");

function registerAdminRoutes(app, deps) {
  const {
    db,
    requireAdmin,
    getCurrentUser,
    getQuestions,
    getRoster,
    getRaces,
    clampNumber
  } = deps;

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

  function randomAnswerForQuestion(question, roster, races) {
    const type = question.type || "text";
    const explicitOptions = Array.isArray(question.options) ? question.options : [];
    const sourceOptions = sourceOptionsForQuestion(question, roster, races);
    const mergedOptions = dedupeOptions([...explicitOptions, ...sourceOptions]);

    if (type === "ranking") {
      const count = Math.max(1, Number(question.count) || 3);
      if (mergedOptions.length === 0) return null;
      return JSON.stringify(randomUniqueSubset(mergedOptions, count));
    }

    if (type === "single_choice") {
      const pick = randomOne(mergedOptions);
      return pick == null ? null : String(pick);
    }

    if (type === "multi_select") {
      if (mergedOptions.length === 0) return null;
      const maxPick = Math.max(1, Math.min(6, mergedOptions.length));
      const count = randomInt(1, maxPick);
      return JSON.stringify(randomUniqueSubset(mergedOptions, count));
    }

    if (type === "multi_select_limited") {
      if (!Array.isArray(races) || races.length === 0) return null;
      const count = Math.max(1, Number(question.count) || 3);
      return JSON.stringify(randomUniqueSubset(races, count));
    }

    if (type === "teammate_battle") {
      const winners = dedupeOptions(explicitOptions);
      if (winners.length === 0) return null;
      const isTie = Math.random() < 0.12;
      if (isTie) return JSON.stringify({ winner: "tie", diff: null });
      return JSON.stringify({
        winner: randomOne(winners),
        diff: randomInt(0, 220)
      });
    }

    if (type === "boolean_with_optional_driver") {
      const yes = Math.random() < 0.5;
      const drivers = roster.drivers || [];
      return JSON.stringify({
        choice: yes ? "yes" : "no",
        driver: yes ? randomOne(drivers) : null
      });
    }

    if (type === "numeric_with_driver") {
      const drivers = roster.drivers || [];
      return JSON.stringify({
        value: randomInt(0, 30),
        driver: randomOne(drivers)
      });
    }

    if (type === "single_choice_with_driver") {
      const drivers = roster.drivers || [];
      const valueOptions = dedupeOptions(explicitOptions);
      const value = randomOne(valueOptions);
      if (value == null) return null;
      return JSON.stringify({
        value,
        driver: randomOne(drivers)
      });
    }

    if (type === "boolean") {
      return Math.random() < 0.5 ? "yes" : "no";
    }

    if (type === "numeric") {
      return String(randomInt(0, 30));
    }

    if (type === "textarea" || type === "text") {
      const pick = randomOne(mergedOptions);
      if (pick != null) return String(pick);
      return `Simulated answer ${randomInt(1, 999)}`;
    }

    return null;
  }

  app.get("/admin/login", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    return res.redirect("/admin/overview");
  });

  app.get("/admin/questions", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const saveError = req.query.error ? String(req.query.error) : null;
    const saveSuccess = req.query.success ? String(req.query.success) : null;
    const questions = getQuestions(locale, {
      includeExcluded: true,
      includeMeta: true
    });
    res.render("admin_questions", {
      user,
      questions,
      saveError,
      saveSuccess
    });
  });

  app.post("/admin/questions", requireAdmin, (req, res) => {
    const questions = getQuestions("en", {
      includeExcluded: true,
      includeMeta: true
    });
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `
      INSERT INTO question_settings (question_id, included, points_override, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET
        included = excluded.included,
        points_override = excluded.points_override,
        updated_at = excluded.updated_at
      `
    );

    try {
      const tx = db.transaction(() => {
        for (const question of questions) {
          const includeKey = `${question.id}__included`;
          const pointsKey = `${question.id}__points`;
          const included = req.body[includeKey] ? 1 : 0;
          const rawOverride = String(req.body[pointsKey] || "").trim();
          let storedOverride = null;
          if (rawOverride) {
            const parsedOverride = parsePointsOverrideInput(
              rawOverride,
              question.id
            );
            validatePointsOverrideType(question, parsedOverride);
            storedOverride = JSON.stringify(parsedOverride);
          }
          upsert.run(question.id, included, storedOverride, now);
        }
      });
      tx();
    } catch (err) {
      return res.redirect(
        `/admin/questions?error=${encodeURIComponent(err.message)}`
      );
    }

    return res.redirect(
      `/admin/questions?success=${encodeURIComponent("Question settings saved.")}`
    );
  });

  app.get("/admin/actuals", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const questions = getQuestions(locale);
    const roster = getRoster();
    const races = getRaces();
    const actualRows = db.prepare("SELECT * FROM actuals").all();
    const actuals = actualRows.reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});

    res.render("admin_actuals", { user, questions, roster, races, actuals });
  });

  app.post("/admin/actuals", requireAdmin, (req, res) => {
    const questions = getQuestions();
    const races = getRaces();
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `
      INSERT INTO actuals (question_id, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
    );

    const tx = db.transaction(() => {
      for (const question of questions) {
        const type = question.type || "text";
        if (type === "ranking") {
          const count = Number(question.count) || 3;
          const selections = [];
          for (let i = 1; i <= count; i += 1) {
            const value = req.body[`${question.id}_${i}`];
            if (!value) continue;
            selections.push(value);
          }
          if (selections.length === 0) continue;
          upsert.run(question.id, JSON.stringify(selections), now);
          continue;
        }
        if (type === "multi_select") {
          const selected = req.body[question.id];
          if (!selected) continue;
          const selections = Array.isArray(selected) ? selected : [selected];
          upsert.run(question.id, JSON.stringify(selections), now);
          continue;
        }
        if (type === "multi_select_limited") {
          const dnfByRace = {};
          races.forEach((race, index) => {
            const value = req.body[`${question.id}_dnf_${index}`];
            const countValue = clampNumber(value, 0, 999);
            if (countValue != null) {
              dnfByRace[race] = countValue;
            }
          });
          upsert.run(question.id, JSON.stringify({ dnf_by_race: dnfByRace }), now);
          continue;
        }
        if (type === "teammate_battle") {
          const winner = req.body[`${question.id}_winner`];
          const diffRaw = req.body[`${question.id}_diff`];
          if ((!winner || winner === "") && (diffRaw === "" || diffRaw === undefined)) {
            continue;
          }
          const diff = winner === "tie" ? null : clampNumber(diffRaw, 0, 999);
          upsert.run(question.id, JSON.stringify({ winner, diff }), now);
          continue;
        }
        if (type === "boolean_with_optional_driver") {
          const choice = req.body[question.id];
          const driver = req.body[`${question.id}_driver`];
          if (!choice) continue;
          upsert.run(question.id, JSON.stringify({ choice, driver }), now);
          continue;
        }
        if (type === "numeric_with_driver") {
          const valueRaw = req.body[`${question.id}_value`];
          const driver = req.body[`${question.id}_driver`];
          if ((valueRaw === "" || valueRaw === undefined) && (!driver || driver === "")) {
            continue;
          }
          const value = clampNumber(valueRaw, 0, 999);
          upsert.run(question.id, JSON.stringify({ value, driver }), now);
          continue;
        }
        if (type === "single_choice_with_driver") {
          const value = req.body[`${question.id}_value`];
          const driver = req.body[`${question.id}_driver`];
          if ((!value || value === "") && (!driver || driver === "")) {
            continue;
          }
          upsert.run(question.id, JSON.stringify({ value, driver }), now);
          continue;
        }

        const answer = req.body[question.id];
        if (answer === undefined || answer === "") continue;
        if (type === "numeric") {
          const value = clampNumber(answer, 0, 999);
          if (value == null) continue;
          upsert.run(question.id, String(value), now);
          continue;
        }
        upsert.run(question.id, String(answer).trim(), now);
      }
    });
    tx();

    res.redirect("/admin/actuals");
  });

  app.get("/admin/overview", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const adminError = req.query.error ? String(req.query.error) : null;
    const adminSuccess = req.query.success ? String(req.query.success) : null;
    const groupsPerPage = 10;
    const usersPerPage = 10;
    const membershipsPerPage = 10;
    const responsesPerPage = 10;

    const requestedGroupPage = Number(req.query.groupPage || 1);
    const currentGroupPage = Number.isFinite(requestedGroupPage) && requestedGroupPage > 0
      ? Math.floor(requestedGroupPage)
      : 1;

    const requestedUsersPage = Number(req.query.usersPage || 1);
    const currentUsersPage = Number.isFinite(requestedUsersPage) && requestedUsersPage > 0
      ? Math.floor(requestedUsersPage)
      : 1;

    const requestedMembershipsPage = Number(req.query.membershipsPage || 1);
    const currentMembershipsPage =
      Number.isFinite(requestedMembershipsPage) && requestedMembershipsPage > 0
        ? Math.floor(requestedMembershipsPage)
        : 1;

    const requestedResponsePage = Number(req.query.responsePage || req.query.page || 1);
    const currentResponsePage = Number.isFinite(requestedResponsePage) && requestedResponsePage > 0
      ? Math.floor(requestedResponsePage)
      : 1;

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
      .prepare("SELECT COUNT(*) as count FROM users WHERE is_simulated = 0")
      .get();
    const totalUsers = Number(userCountRow?.count || 0);
    const totalUserPages = Math.max(
      1,
      Math.ceil(totalUsers / usersPerPage)
    );
    const safeUsersPage = Math.min(currentUsersPage, totalUserPages);
    const usersOffset = (safeUsersPage - 1) * usersPerPage;
    const users = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin
        FROM users
        WHERE is_simulated = 0
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(usersPerPage, usersOffset);

    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, u.name as owner_name, g.created_at
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(groupsPerPage, groupOffset);

    const membershipCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        JOIN groups g ON g.id = gm.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();
    const totalMemberships = Number(membershipCountRow?.count || 0);
    const totalMembershipPages = Math.max(
      1,
      Math.ceil(totalMemberships / membershipsPerPage)
    );
    const safeMembershipsPage = Math.min(currentMembershipsPage, totalMembershipPages);
    const membershipsOffset = (safeMembershipsPage - 1) * membershipsPerPage;

    const memberships = db
      .prepare(
        `
        SELECT gm.user_id, gm.group_id, gm.role, gm.joined_at, u.name as user_name, g.name as group_name
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        JOIN groups g ON g.id = gm.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY gm.joined_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(membershipsPerPage, membershipsOffset);

    const responseCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM responses r
        JOIN users u ON u.id = r.user_id
        JOIN groups g ON g.id = r.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();
    const totalResponses = Number(responseCountRow?.count || 0);
    const totalResponsePages = Math.max(
      1,
      Math.ceil(totalResponses / responsesPerPage)
    );
    const safeResponsePage = Math.min(currentResponsePage, totalResponsePages);
    const responseOffset = (safeResponsePage - 1) * responsesPerPage;
    const responses = db
      .prepare(
        `
        SELECT r.user_id, u.name as user_name, r.group_id, g.name as group_name, r.question_id, r.answer, r.updated_at
        FROM responses r
        JOIN users u ON u.id = r.user_id
        JOIN groups g ON g.id = r.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY r.updated_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(responsesPerPage, responseOffset);

    res.render("admin_overview", {
      user,
      adminError,
      adminSuccess,
      users,
      groups,
      memberships,
      responses,
      currentGroupPage: safeGroupPage,
      totalGroupPages,
      groupsPerPage,
      currentUserPage: safeUsersPage,
      totalUserPages,
      usersPerPage,
      currentMembershipsPage: safeMembershipsPage,
      totalMembershipPages,
      membershipsPerPage,
      currentResponsePage: safeResponsePage,
      totalResponsePages,
      responsesPerPage
    });
  });

  app.get("/admin/testing", requireAdmin, (req, res) => {
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
          owner.name as owner_name,
          SUM(CASE WHEN member_user.is_simulated = 1 THEN 1 ELSE 0 END) as fake_players,
          COUNT(gm.user_id) as total_members,
          (
            SELECT COUNT(*)
            FROM responses r
            WHERE r.group_id = g.id
          ) as total_responses
        FROM groups g
        JOIN users owner ON owner.id = g.owner_id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        LEFT JOIN users member_user ON member_user.id = gm.user_id
        WHERE COALESCE(g.is_simulated, 0) = 1
          AND COALESCE(g.is_global, 0) = 0
        GROUP BY g.id, g.name, g.created_at, owner.name
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
  });

  app.post("/admin/test-group", requireAdmin, (req, res) => {
    const adminUser = getCurrentUser(req);
    if (!adminUser) return res.redirect("/login");

    const now = new Date().toISOString();
    const requestedName = String(req.body.groupName || "").trim();
    const groupName =
      requestedName || `Test Group ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const rawCount = Number(req.body.fakePlayerCount || 0);
    const fakePlayerCount = Number.isFinite(rawCount)
      ? Math.max(1, Math.min(5000, Math.floor(rawCount)))
      : 20;

    const questions = getQuestions("en");
    const roster = getRoster();
    const races = getRaces();
    const sharedFakePasswordHash = bcrypt.hashSync(
      crypto.randomBytes(12).toString("hex"),
      10
    );

    const insertGroup = db.prepare(
      `
      INSERT INTO groups (
        name, owner_id, created_at, is_public, join_code, join_password_hash, rules_text, is_global, is_simulated
      )
      VALUES (?, ?, ?, 0, NULL, NULL, ?, 0, 1)
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
          `Generated by admin on ${new Date().toLocaleString()}.`;
        const groupInfo = insertGroup.run(
          groupName,
          adminUser.id,
          now,
          rulesText
        );
        const groupId = Number(groupInfo.lastInsertRowid);
        createdGroupId = groupId;
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

          for (const question of questions) {
            const answer = randomAnswerForQuestion(question, roster, races);
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
        `/admin/testing?error=${encodeURIComponent(message)}`
      );
    }

    return res.redirect(
      `/admin/testing?success=${encodeURIComponent(
        `Created test group "${groupName}" (#${createdGroupId}) with ${fakePlayerCount} fake players.`
      )}`
    );
  });

  app.post("/admin/users/:userId/make-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.redirect("/admin/overview");
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("User not found.")}`
      );
    }
    if (target.is_admin === 1) {
      return res.redirect(
        `/admin/overview?success=${encodeURIComponent("User is already an admin.")}`
      );
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE users SET is_admin = 1, is_verified = 1, verified_at = COALESCE(verified_at, ?) WHERE id = ?"
    ).run(now, userId);
    return res.redirect(
      `/admin/overview?success=${encodeURIComponent("Admin rights granted.")}`
    );
  });

  app.post("/admin/users/:userId/remove-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.redirect("/admin/overview");
    const currentUser = getCurrentUser(req);
    if (currentUser && currentUser.id === userId) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("You cannot remove your own admin rights.")}`
      );
    }
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("User not found.")}`
      );
    }
    if (target.is_admin !== 1) {
      return res.redirect(
        `/admin/overview?success=${encodeURIComponent("User is not an admin.")}`
      );
    }
    db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(userId);
    return res.redirect(
      `/admin/overview?success=${encodeURIComponent("Admin rights removed.")}`
    );
  });

  app.post("/admin/users/:userId/delete", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.redirect("/admin/overview");
    db.prepare("DELETE FROM responses WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM group_members WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM groups WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM invites WHERE created_by = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    res.redirect("/admin/overview");
  });

  app.post("/admin/groups/:groupId/delete", requireAdmin, (req, res) => {
    const source = String(req.query.from || "").trim().toLowerCase();
    const redirectPath = source === "testing" ? "/admin/testing" : "/admin/overview";
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
  registerAdminRoutes
};
