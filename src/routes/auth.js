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
    claimGuestResponsesForUser
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

  app.get("/", (req, res) => {
    const user = getCurrentUser(req);
    res.render("home", { user });
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

  app.get("/start-predicting", (req, res) => {
    const user = getCurrentUser(req);
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
