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

  app.get("/admin/login", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    return res.redirect("/admin/overview");
  });

  app.get("/admin/actuals", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const questions = getQuestions();
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
    const responsesPerPage = 50;
    const requestedPage = Number(req.query.page || 1);
    const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
    const users = db
      .prepare("SELECT id, name, email, created_at, is_admin FROM users ORDER BY created_at DESC")
      .all();
    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, u.name as owner_name, g.created_at
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        ORDER BY g.created_at DESC
        `
      )
      .all();
    const memberships = db
      .prepare(
        `
        SELECT gm.user_id, gm.group_id, gm.role, gm.joined_at, u.name as user_name, g.name as group_name
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        JOIN groups g ON g.id = gm.group_id
        ORDER BY gm.joined_at DESC
        `
      )
      .all();
    const responseCountRow = db
      .prepare("SELECT COUNT(*) as count FROM responses")
      .get();
    const totalResponses = Number(responseCountRow?.count || 0);
    const totalResponsePages = Math.max(
      1,
      Math.ceil(totalResponses / responsesPerPage)
    );
    const safePage = Math.min(currentPage, totalResponsePages);
    const responseOffset = (safePage - 1) * responsesPerPage;
    const responses = db
      .prepare(
        `
        SELECT r.user_id, u.name as user_name, r.group_id, g.name as group_name, r.question_id, r.answer, r.updated_at
        FROM responses r
        JOIN users u ON u.id = r.user_id
        JOIN groups g ON g.id = r.group_id
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
      currentResponsePage: safePage,
      totalResponsePages
    });
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
    const groupId = Number(req.params.groupId);
    if (!groupId) return res.redirect("/admin/overview");
    db.prepare("DELETE FROM responses WHERE group_id = ?").run(groupId);
    db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
    db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
    db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
    res.redirect("/admin/overview");
  });

  app.get("/admin", (req, res) => {
    res.redirect("/admin/overview");
  });
}

module.exports = {
  registerAdminRoutes
};
