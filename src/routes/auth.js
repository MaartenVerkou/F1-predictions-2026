function registerAuthRoutes(app, deps) {
  const MIN_PASSWORD_LENGTH = 6;
  const {
    db,
    bcrypt,
    ADMIN_EMAILS,
    ensureGlobalGroup,
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
    NODE_ENV
  } = deps;

  const BRAND_NAME = String(COMPANY_NAME || "F1 Predictions").trim() || "F1 Predictions";
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

  async function issueAndSendVerificationEmail(userId, email, name = "") {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId);
    db.prepare(
      "INSERT INTO email_verifications (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
    ).run(userId, tokenHash, expiresAt, now);

    const verifyUrl = `${BASE_URL}/verify?token=${token}`;
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

  app.get("/", (req, res) => {
    const user = getCurrentUser(req);
    res.render("home", { user });
  });

  app.get(["/signup", "/register"], (req, res) => {
    res.render("signup", { error: null });
  });

  app.get("/api/users/check-name", (req, res) => {
    const normalizedName = String(req.query.name || "").trim();
    if (!normalizedName) {
      return res.json({ available: false, reason: "empty" });
    }
    const exists = db.prepare("SELECT id FROM users WHERE name = ?").get(normalizedName);
    return res.json({ available: !exists });
  });

  app.post("/signup", async (req, res) => {
    const { name, email, password, passwordConfirm } = req.body;
    if (!name || !email || !password || !passwordConfirm) {
      return res.render("signup", { error: "All fields are required." });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.render("signup", {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      });
    }
    if (password !== passwordConfirm) {
      return res.render("signup", { error: "Passwords do not match." });
    }

    const normalizedName = name.trim();
    const nameTaken = db
      .prepare("SELECT id FROM users WHERE name = ?")
      .get(normalizedName);
    if (nameTaken) {
      return res.render("signup", { error: "Name already in use." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const shouldBeAdmin = ADMIN_EMAILS.has(normalizedEmail);
    const existing = db
      .prepare("SELECT id, is_verified FROM users WHERE email = ?")
      .get(normalizedEmail);
    if (existing && existing.is_verified) {
      return res.render("signup", { error: "Email already registered." });
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
        normalizedEmail,
        passwordHash,
        now,
        shouldBeAdmin ? 1 : 0
      );
      userId = info.lastInsertRowid;
    }
    ensureGlobalGroup(userId);

    const result = await issueAndSendVerificationEmail(
      userId,
      normalizedEmail,
      normalizedName
    );
    if (!result.ok && result.reason === "smtp_missing") {
      return res.render("verify_notice", {
        email: normalizedEmail,
        message: "SMTP is not configured. Use the link below to verify.",
        verifyUrl: result.verifyUrl
      });
    }
    if (!result.ok && result.reason === "send_failed") {
      return res.render("verify_notice", {
        email: normalizedEmail,
        message: "Email failed to send. Use the link below to verify.",
        verifyUrl: result.verifyUrl
      });
    }

    return res.render("verify_notice", {
      email: normalizedEmail,
      message: "Verification email sent. Please check your inbox.",
      verifyUrl: null
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
    return res.redirect("/dashboard");
  });

  app.post("/resend-verification", async (req, res) => {
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
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
      user.name
    );
    if (!result.ok && result.verifyUrl) {
      return res.render("verify_notice", {
        email: normalizedEmail,
        message:
          result.reason === "smtp_missing"
            ? "SMTP is not configured. Use the link below to verify."
            : "Email failed to send. Use the link below to verify.",
        verifyUrl: result.verifyUrl
      });
    }

    return res.render("login", {
      error: null,
      notice: "Verification email re-sent. Please check your inbox.",
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
        message: "If that email exists, a reset link has been sent."
      });
    }

    return res.render("forgot_password", {
      error: null,
      message: "If that email exists, a reset link has been sent."
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
    return res.redirect("/dashboard");
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
    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, gm.role
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.created_at DESC
        `
      )
      .all(user.id);

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

    return res.render("dashboard", {
      user,
      groups,
      publicGroups,
      error: null,
      success: null
    });
  });
}

module.exports = {
  registerAuthRoutes
};
