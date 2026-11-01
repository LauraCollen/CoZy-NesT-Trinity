(function (global) {
  "use strict";

  const SESSION_KEY = "cozynest_session_v2";
  const USERS_KEY = "cozynest_users_v2";
  const GENERIC_ERROR = "Data tidak valid. Periksa kembali dan coba lagi.";
  const ROLE_HOME = { owner: "dashboard", tenant: "tenant-home", guest: "browse-rooms" };

  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    return sha256(`${salt}:${password}`);
  }

  const CozyAuth = {
    GENERIC_ERROR,
    ROLE_HOME,
    ready: null,
    hashPassword,
    sha256,

    listUsers() {
      try {
        const parsed = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },

    saveUsers(users) {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    },

    getSession() {
      try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      } catch (_) {
        return null;
      }
    },

    setSession(user) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId || null,
          phone: user.phone || "",
          loggedInAt: new Date().toISOString(),
        })
      );
    },

    logout() {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem("cozynest_reset_preview");
    },

    async seed() {
      const users = this.listUsers();
      if (users.length) {
        let changed = false;
        for (const u of users) {
          if (u.password && !u.passwordHash) {
            u.salt = randomHex(16);
            u.passwordHash = await hashPassword(u.password, u.salt);
            delete u.password;
            changed = true;
          }
        }
        if (changed) this.saveUsers(users);
        return;
      }

      const demos = [
        { id: "user_admin", name: "Admin CoZyNesT", email: "admin@cozynest.id", password: "admin123", role: "owner", phone: "081234567890" },
        { id: "user_siti", name: "Siti Nurhaliza", email: "siti@email.com", password: "penghuni123", role: "tenant", tenantId: "tenant_siti", phone: "0822222222" },
        { id: "user_ahmad", name: "Ahmad Rizki", email: "ahmad@email.com", password: "penghuni123", role: "tenant", tenantId: "tenant_ahmad", phone: "0811111111" },
        { id: "user_fajar", name: "Fajar Nugroho", email: "fajar@email.com", password: "calon123", role: "guest", phone: "0866666666" },
      ];
      const seeded = [];
      for (const d of demos) {
        const salt = randomHex(16);
        seeded.push({
          id: d.id,
          name: d.name,
          email: d.email,
          phone: d.phone,
          role: d.role,
          tenantId: d.tenantId || null,
          salt,
          passwordHash: await hashPassword(d.password, salt),
          createdAt: new Date().toISOString(),
        });
      }
      this.saveUsers(seeded);
    },

    validateAuthInput(email, password, extra = {}) {
      const e = String(email || "").trim();
      const p = String(password || "");
      if (!e || !p) return false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
      if (p.length < 6) return false;
      if (extra.nameRequired && !String(extra.name || "").trim()) return false;
      if (extra.role && !["owner", "guest"].includes(extra.role)) return false;
      return true;
    },

    async login(email, password) {
      await this.ready;
      if (!this.validateAuthInput(email, password)) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const clean = String(email).trim().toLowerCase();
      const user = this.listUsers().find((u) => u.email.toLowerCase() === clean);
      if (!user || !user.passwordHash || !user.salt) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const hashed = await hashPassword(password, user.salt);
      if (hashed !== user.passwordHash) {
        return { ok: false, message: GENERIC_ERROR };
      }
      this.setSession(user);
      return { ok: true, user };
    },

    async register({ name, email, password, phone, role }) {
      await this.ready;
      const chosen = role === "owner" ? "owner" : "guest";
      if (!this.validateAuthInput(email, password, { nameRequired: true, name, role: chosen })) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const cleanEmail = String(email).trim().toLowerCase();
      const users = this.listUsers();
      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const salt = randomHex(16);
      const user = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(name).trim(),
        email: cleanEmail,
        phone: String(phone || "").trim(),
        role: chosen,
        tenantId: null,
        salt,
        passwordHash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      this.saveUsers(users);
      this.setSession(user);
      return { ok: true, user };
    },

    async requestReset(email) {
      await this.ready;
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const clean = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const users = this.listUsers();
      const user = users.find((u) => u.email.toLowerCase() === clean);
      if (user) {
        user.resetTokenHash = await sha256(code);
        user.resetExpires = Date.now() + 30 * 60 * 1000;
        this.saveUsers(users);
      }
      return { ok: true, previewCode: code };
    },

    async resetPassword(email, code, newPassword) {
      await this.ready;
      if (!this.validateAuthInput(email, newPassword) || !String(code || "").trim()) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const users = this.listUsers();
      const user = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
      const codeHash = await sha256(String(code).trim());
      if (!user || !user.resetTokenHash || user.resetTokenHash !== codeHash || Date.now() > user.resetExpires) {
        return { ok: false, message: GENERIC_ERROR };
      }
      user.salt = randomHex(16);
      user.passwordHash = await hashPassword(newPassword, user.salt);
      delete user.resetTokenHash;
      delete user.resetExpires;
      this.saveUsers(users);
      return { ok: true };
    },

    async updateProfile(sessionId, { name, phone, email }) {
      const users = this.listUsers();
      const user = users.find((u) => u.id === sessionId);
      if (!user) return { ok: false, message: GENERIC_ERROR };
      const nextEmail = String(email || user.email).trim().toLowerCase();
      if (!name || !nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return { ok: false, message: GENERIC_ERROR };
      }
      if (users.some((u) => u.id !== sessionId && u.email.toLowerCase() === nextEmail)) {
        return { ok: false, message: GENERIC_ERROR };
      }
      user.name = String(name).trim();
      user.phone = String(phone || "").trim();
      user.email = nextEmail;
      this.saveUsers(users);
      this.setSession(user);
      return { ok: true, user };
    },

    async changePassword(sessionId, oldPass, newPass) {
      if (!newPass || newPass.length < 6 || !oldPass) {
        return { ok: false, message: GENERIC_ERROR };
      }
      const users = this.listUsers();
      const user = users.find((u) => u.id === sessionId);
      if (!user) return { ok: false, message: GENERIC_ERROR };
      const oldHash = await hashPassword(oldPass, user.salt);
      if (oldHash !== user.passwordHash) return { ok: false, message: GENERIC_ERROR };
      user.salt = randomHex(16);
      user.passwordHash = await hashPassword(newPass, user.salt);
      this.saveUsers(users);
      return { ok: true };
    },

    linkTenant(userId, tenantId) {
      const users = this.listUsers();
      const user = users.find((u) => u.id === userId);
      if (!user) return;
      user.role = "tenant";
      user.tenantId = tenantId;
      this.saveUsers(users);
      const session = this.getSession();
      if (session && session.id === userId) this.setSession(user);
    },

    findByEmail(email) {
      return this.listUsers().find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    },

    createTenantUser({ name, email, phone, tenantId, password }) {
      const users = this.listUsers();
      const clean = String(email || "").trim().toLowerCase();
      if (!clean) return null;
      const existing = users.find((u) => u.email.toLowerCase() === clean);
      if (existing) {
        existing.role = "tenant";
        existing.tenantId = tenantId;
        existing.name = name || existing.name;
        existing.phone = phone || existing.phone;
        this.saveUsers(users);
        return existing;
      }
      return null;
    },

    async ensureTenantUser({ name, email, phone, tenantId }) {
      const existing = this.createTenantUser({ name, email, phone, tenantId });
      if (existing) return existing;
      const salt = randomHex(16);
      const password = "penghuni123";
      const user = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        email: String(email).trim().toLowerCase(),
        phone,
        role: "tenant",
        tenantId,
        salt,
        passwordHash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      const users = this.listUsers();
      users.push(user);
      this.saveUsers(users);
      return user;
    },

    homeView(role) {
      return ROLE_HOME[role] || "browse-rooms";
    },

    canAccess(view) {
      const session = this.getSession();
      if (!session) return false;
      const map = {
        owner: [
          "dashboard", "profile", "rooms", "tenants", "print-tenants", "reservations",
          "finance", "reports", "occupancy", "invoices", "verify-payments", "arrears",
          "complaints-admin", "account",
        ],
        tenant: ["tenant-home", "tenant-bills", "tenant-upload", "tenant-payments", "tenant-complaints", "account"],
        guest: ["browse-rooms", "room-detail", "book-room", "my-bookings", "account"],
      };
      return (map[session.role] || []).includes(view);
    },

    requireDashboard() {
      if (!this.getSession()) {
        window.location.replace("login.html");
        return false;
      }
      return true;
    },

    redirectIfLoggedIn() {
      const session = this.getSession();
      if (session) {
        window.location.replace(`dashboard.html#${this.homeView(session.role)}`);
        return true;
      }
      return false;
    },
  };

  CozyAuth.ready = CozyAuth.seed();
  global.CozyAuth = CozyAuth;
})(window);
