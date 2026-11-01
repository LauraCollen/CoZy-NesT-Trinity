(function (global) {
  "use strict";

  const STORAGE_KEY = "cozynest_data_v2";
  const roomLocks = Object.create(null);

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function monthKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthLabel(key) {
    const [y, m] = key.split("-");
    const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${names[Number(m) - 1]} ${y}`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultState() {
    return {
      profile: {
        name: "CoZyNesT Residence",
        address: "Jl. Melati No. 12, RT 03/RW 05",
        city: "Yogyakarta",
        postal: "55281",
        phone: "081234567890",
        email: "hello@cozynest.id",
        owner: "Satoru Management",
        npwp: "",
        description: "Kost nyaman dengan WiFi unlimited, AC, kamar mandi dalam, dapur bersama, dan area parkir motor.",
        bankAccount: "BCA 1234567890 a.n. CoZyNesT",
        logoUrl: "",
      },
      rooms: [],
      tenants: [],
      reservations: [],
      finance: [],
      invoices: [],
      complaints: [],
      activity: [],
    };
  }

  function seedDemoData(s) {
    const types = [
      { type: "Standard", price: 850000, facilities: "Kasur, lemari, kamar mandi luar" },
      { type: "Deluxe", price: 1200000, facilities: "AC, kamar mandi dalam, WiFi" },
      { type: "Premium", price: 1500000, facilities: "AC, TV, kamar mandi dalam, balkon mini" },
    ];
    for (let i = 1; i <= 8; i++) {
      const t = types[(i - 1) % 3];
      s.rooms.push({
        id: `room_${100 + i}`,
        number: String(100 + i),
        type: t.type,
        price: t.price,
        status: "available",
        facilities: t.facilities,
      });
    }

    const tenantSeed = [
      { id: "tenant_ahmad", name: "Ahmad Rizki", ktp: "3401123456789001", phone: "0811111111", email: "ahmad@email.com", room: 0, months: 12 },
      { id: "tenant_siti", name: "Siti Nurhaliza", ktp: "3401987654321002", phone: "0822222222", email: "siti@email.com", room: 1, months: 6 },
      { id: "tenant_budi", name: "Budi Santoso", ktp: "3401556677889903", phone: "0833333333", email: "budi@email.com", room: 2, months: 8 },
      { id: "tenant_dewi", name: "Dewi Lestari", ktp: "3401445566778804", phone: "0844444444", email: "dewi@email.com", room: 3, months: 4 },
      { id: "tenant_eko", name: "Eko Prasetyo", ktp: "3401334455667705", phone: "0855555555", email: "eko@email.com", room: 4, months: 10 },
    ];

    tenantSeed.forEach((t, idx) => {
      const room = s.rooms[t.room];
      const checkIn = new Date(Date.now() - (idx + 2) * 30 * 86400000).toISOString().slice(0, 10);
      s.tenants.push({
        id: t.id,
        userId: t.id === "tenant_siti" ? "user_siti" : t.id === "tenant_ahmad" ? "user_ahmad" : null,
        name: t.name,
        ktp: t.ktp,
        phone: t.phone,
        email: t.email,
        roomId: room.id,
        checkIn,
        durationMonths: t.months,
        monthlyRent: room.price,
        deposit: room.price,
        status: "active",
        notes: "",
      });
    });

    s.reservations.push({
      id: "res_fajar",
      userId: "user_fajar",
      guestName: "Fajar Nugroho",
      phone: "0866666666",
      email: "fajar@email.com",
      roomId: "room_107",
      checkIn: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      durationMonths: 3,
      status: "pending",
      notes: "Butuh kamar tenang",
      createdAt: new Date().toISOString(),
    });

    s.reservations.push({
      id: "res_gita",
      userId: null,
      guestName: "Gita Maharani",
      phone: "0877777777",
      email: "gita@email.com",
      roomId: "room_108",
      checkIn: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      durationMonths: 6,
      status: "confirmed",
      notes: "",
      createdAt: new Date().toISOString(),
    });

    const mk = monthKey();
    const prev = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return monthKey(d);
    })();

    s.invoices.push({
      id: "inv_overdue",
      number: "INV/DEMO/0001",
      tenantId: "tenant_siti",
      periodKey: prev,
      period: monthLabel(prev),
      issueDate: `${prev}-01`,
      dueDate: `${prev}-07`,
      lines: [{ desc: `Sewa kamar 102 — ${monthLabel(prev)}`, qty: 1, price: 1200000 }],
      total: 1200000,
      status: "menunggak",
      proof: null,
      rejectReason: "",
      postedFinanceId: null,
      verifiedAt: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
    });

    s.invoices.push({
      id: "inv_wait",
      number: "INV/DEMO/0002",
      tenantId: "tenant_ahmad",
      periodKey: mk,
      period: monthLabel(mk),
      issueDate: `${mk}-01`,
      dueDate: `${mk}-10`,
      lines: [{ desc: `Sewa kamar 101 — ${monthLabel(mk)}`, qty: 1, price: 850000 }],
      total: 850000,
      status: "menunggu_verifikasi",
      proof: { fileName: "bukti-transfer.jpg", mime: "image/jpeg", dataUrl: "", uploadedAt: new Date().toISOString() },
      rejectReason: "",
      postedFinanceId: null,
      verifiedAt: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
    });

    s.finance.push(
      { id: uid("fin"), date: `${mk}-05`, type: "expense", category: "Listrik & Air", description: "Rekening PLN & PDAM", amount: 850000 },
      { id: uid("fin"), date: `${mk}-10`, type: "expense", category: "Kebersihan", description: "Gaji cleaning service", amount: 600000 },
      { id: uid("fin"), date: `${mk}-12`, type: "expense", category: "Perbaikan", description: "Perbaikan pompa air", amount: 350000 },
      { id: uid("fin"), date: `${mk}-15`, type: "income", category: "Deposit", description: "Deposit penghuni baru", amount: 1200000 }
    );

    s.complaints.push({
      id: uid("cmp"),
      tenantId: "tenant_siti",
      category: "Fasilitas kamar",
      description: "AC kamar 102 berbunyi keras pada malam hari.",
      photoName: "",
      photoData: "",
      status: "baru",
      note: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    s.activity.unshift({ id: uid("act"), text: "Data demo CoZyNesT dimuat", at: new Date().toISOString() });
  }

  let state = null;

  const Store = {
    GENERIC: "Data tidak valid. Periksa kembali dan coba lagi.",

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          state = { ...defaultState(), ...JSON.parse(raw) };
          ["rooms", "tenants", "reservations", "finance", "invoices", "complaints", "activity"].forEach((k) => {
            if (!Array.isArray(state[k])) state[k] = [];
          });
        } else {
          state = defaultState();
          seedDemoData(state);
        }
      } catch (_) {
        state = defaultState();
        seedDemoData(state);
      }
      this.syncRoomStatus();
      this.markOverdue();
      this.ensureAutoInvoices();
      this.save();
      return state;
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },

    get() {
      if (!state) this.load();
      return state;
    },

    uid,
    monthKey,
    monthLabel,
    todayISO,

    formatCurrency(n) {
      return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(n) || 0);
    },

    formatDate(d) {
      if (!d) return "-";
      return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
    },

    formatDateTime(d) {
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(d));
    },

    maskKtp(ktp) {
      const s = String(ktp || "");
      if (s.length < 8) return "••••";
      return `${s.slice(0, 4)}${"•".repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
    },

    logActivity(text) {
      state.activity.unshift({ id: uid("act"), text, at: new Date().toISOString() });
      state.activity = state.activity.slice(0, 40);
      this.save();
    },

    getRoom(id) {
      return state.rooms.find((r) => r.id === id);
    },

    getTenant(id) {
      return state.tenants.find((t) => t.id === id);
    },

    tenantForUser(user) {
      if (!user) return null;
      if (user.tenantId) return this.getTenant(user.tenantId);
      return state.tenants.find((t) => t.email && t.email.toLowerCase() === user.email.toLowerCase()) || null;
    },

    occupancy() {
      const total = state.rooms.length;
      const occupied = state.rooms.filter((r) => r.status === "occupied").length;
      const pct = total ? Math.round((occupied / total) * 100) : 0;
      return { total, occupied, available: state.rooms.filter((r) => r.status === "available").length, pct };
    },

    syncRoomStatus() {
      state.rooms.forEach((r) => {
        if (r.status === "maintenance") return;
        const active = state.tenants.some((t) => t.roomId === r.id && t.status === "active");
        const reserved = state.reservations.some(
          (res) => res.roomId === r.id && (res.status === "pending" || res.status === "confirmed") && !active
        );
        if (active) r.status = "occupied";
        else if (reserved) r.status = "reserved";
        else r.status = "available";
      });
    },

    isRoomFree(roomId, exceptResId) {
      const room = this.getRoom(roomId);
      if (!room || room.status === "maintenance") return false;
      const occupied = state.tenants.some((t) => t.roomId === roomId && t.status === "active");
      if (occupied) return false;
      return !state.reservations.some(
        (res) => res.id !== exceptResId && res.roomId === roomId && (res.status === "pending" || res.status === "confirmed")
      );
    },

    markOverdue() {
      const today = todayISO();
      state.invoices.forEach((inv) => {
        if (["lunas", "menunggu_verifikasi"].includes(inv.status)) return;
        if (inv.dueDate && inv.dueDate < today && inv.status !== "ditolak") {
          inv.status = "menunggak";
        }
      });
    },

    nextInvoiceNumber() {
      const n = state.invoices.length + 1;
      const d = new Date();
      return `INV/${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}/${String(n).padStart(4, "0")}`;
    },

    ensureAutoInvoices() {
      const periodKey = monthKey();
      const period = monthLabel(periodKey);
      state.tenants
        .filter((t) => t.status === "active")
        .forEach((tenant) => {
          const exists = state.invoices.some((i) => i.tenantId === tenant.id && i.periodKey === periodKey);
          if (exists) return;
          this.createInvoice(tenant.id, periodKey, period, [], { silent: true });
        });
    },

    createInvoice(tenantId, periodKey, periodLabel, extraLines = [], opts = {}) {
      const tenant = this.getTenant(tenantId);
      if (!tenant) return { ok: false, message: this.GENERIC };
      const key = periodKey || monthKey();
      if (state.invoices.some((i) => i.tenantId === tenantId && i.periodKey === key)) {
        return { ok: false, message: "Tagihan periode ini sudah ada." };
      }
      const room = this.getRoom(tenant.roomId);
      const lines = [
        { desc: `Sewa kamar ${room ? room.number : ""} — ${periodLabel || monthLabel(key)}`, qty: 1, price: Number(tenant.monthlyRent) || 0 },
        ...extraLines,
      ];
      const total = lines.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0);
      const issue = todayISO();
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const inv = {
        id: uid("inv"),
        number: this.nextInvoiceNumber(),
        tenantId,
        periodKey: key,
        period: periodLabel || monthLabel(key),
        issueDate: issue,
        dueDate: due.toISOString().slice(0, 10),
        lines,
        total,
        status: "belum_lunas",
        proof: null,
        rejectReason: "",
        postedFinanceId: null,
        verifiedAt: null,
        sentAt: null,
        createdAt: new Date().toISOString(),
      };
      state.invoices.push(inv);
      if (!opts.silent) this.logActivity(`Invoice ${inv.number} dibuat untuk ${tenant.name}`);
      this.save();
      return { ok: true, invoice: inv };
    },

    saveRoom(payload, id) {
      const number = String(payload.number || "").trim();
      const type = String(payload.type || "").trim();
      const price = Number(payload.price);
      const facilities = String(payload.facilities || "").trim();
      const status = payload.status || "available";
      if (!number || !type || !(price > 0)) return { ok: false, message: this.GENERIC };
      const dup = state.rooms.some((r) => r.number.toLowerCase() === number.toLowerCase() && r.id !== id);
      if (dup) return { ok: false, message: this.GENERIC };
      if (id) {
        Object.assign(this.getRoom(id), { number, type, price, facilities, status });
        this.logActivity(`Kamar ${number} diperbarui`);
      } else {
        state.rooms.push({ id: uid("room"), number, type, price, facilities, status });
        this.logActivity(`Kamar ${number} ditambahkan`);
      }
      this.syncRoomStatus();
      this.save();
      return { ok: true };
    },

    deleteRoom(id) {
      const room = this.getRoom(id);
      if (!room) return { ok: false, message: this.GENERIC };
      const occupied = state.tenants.some((t) => t.roomId === id && t.status === "active");
      const reserved = state.reservations.some((r) => r.roomId === id && (r.status === "pending" || r.status === "confirmed"));
      if (occupied || reserved) return { ok: false, message: "Kamar tidak dapat dihapus karena masih dipakai atau memiliki reservasi aktif." };
      state.rooms = state.rooms.filter((r) => r.id !== id);
      this.logActivity(`Kamar ${room.number} dihapus`);
      this.save();
      return { ok: true };
    },

    saveTenant(payload, id) {
      const name = String(payload.name || "").trim();
      const phone = String(payload.phone || "").trim();
      const roomId = payload.roomId;
      const monthlyRent = Number(payload.monthlyRent);
      const checkIn = payload.checkIn;
      if (!name || !phone || !roomId || !(monthlyRent > 0) || !checkIn) {
        return { ok: false, message: this.GENERIC };
      }
      const data = {
        name,
        ktp: String(payload.ktp || "").trim(),
        phone,
        email: String(payload.email || "").trim().toLowerCase(),
        roomId,
        checkIn,
        durationMonths: Number(payload.durationMonths) || 1,
        monthlyRent,
        deposit: Number(payload.deposit) || 0,
        status: payload.status === "inactive" ? "inactive" : "active",
        notes: String(payload.notes || "").trim(),
      };
      if (id) {
        Object.assign(this.getTenant(id), data);
        this.logActivity(`Data penghuni ${name} diperbarui`);
      } else {
        const tenant = { id: uid("tenant"), userId: null, ...data };
        state.tenants.push(tenant);
        this.logActivity(`Penghuni baru: ${name}`);
        if (data.deposit > 0) {
          state.finance.push({
            id: uid("fin"),
            date: todayISO(),
            type: "income",
            category: "Deposit",
            description: `Deposit ${name}`,
            amount: data.deposit,
          });
        }
        id = tenant.id;
      }
      this.syncRoomStatus();
      this.save();
      return { ok: true, tenantId: id };
    },

    deleteTenant(id) {
      const t = this.getTenant(id);
      if (!t) return { ok: false };
      state.tenants = state.tenants.filter((x) => x.id !== id);
      this.syncRoomStatus();
      this.logActivity(`Penghuni ${t.name} dihapus`);
      this.save();
      return { ok: true };
    },

    placeBooking({ user, guestName, phone, email, roomId, checkIn, durationMonths, notes }) {
      const name = String(guestName || "").trim();
      const p = String(phone || "").trim();
      const e = String(email || "").trim().toLowerCase();
      const months = Number(durationMonths);
      if (!name || !p || !e || !roomId || !checkIn || !(months >= 1)) {
        return { ok: false, message: this.GENERIC };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, message: this.GENERIC };
      if (checkIn < todayISO()) return { ok: false, message: this.GENERIC };

      const lockKey = `cozynest_lock_${roomId}`;
      const now = Date.now();
      const held = Number(localStorage.getItem(lockKey) || 0);
      if (roomLocks[roomId] || (held && now - held < 2000)) {
        return { ok: false, message: "Kamar tidak tersedia." };
      }
      roomLocks[roomId] = true;
      localStorage.setItem(lockKey, String(now));
      try {
        this.load();
        if (!this.isRoomFree(roomId)) {
          return { ok: false, message: "Kamar tidak tersedia." };
        }
        const res = {
          id: uid("res"),
          userId: user ? user.id : null,
          guestName: name,
          phone: p,
          email: e,
          roomId,
          checkIn,
          durationMonths: months,
          status: "pending",
          notes: String(notes || "").trim(),
          createdAt: new Date().toISOString(),
        };
        state.reservations.push(res);
        this.syncRoomStatus();
        this.logActivity(`Reservasi baru: ${name}`);
        this.save();
        return { ok: true, reservation: res };
      } finally {
        roomLocks[roomId] = false;
        localStorage.removeItem(lockKey);
      }
    },

    saveReservation(payload, id) {
      if (payload.checkIn && payload.checkIn < todayISO() && !id) {
        return { ok: false, message: this.GENERIC };
      }
      if (!payload.guestName || !payload.phone || !payload.roomId || !payload.checkIn) {
        return { ok: false, message: this.GENERIC };
      }
      if (id) {
        const current = state.reservations.find((r) => r.id === id);
        if (!current) return { ok: false, message: this.GENERIC };
        if ((payload.status === "pending" || payload.status === "confirmed") && !this.isRoomFree(payload.roomId, id) && payload.roomId !== current.roomId) {
          return { ok: false, message: "Kamar tidak tersedia." };
        }
        if ((payload.status === "pending" || payload.status === "confirmed") && payload.roomId === current.roomId && !this.isRoomFree(payload.roomId, id)) {
          /* same room ok */
        }
        Object.assign(current, payload);
      } else {
        if (!this.isRoomFree(payload.roomId)) return { ok: false, message: "Kamar tidak tersedia." };
        state.reservations.push({
          id: uid("res"),
          userId: null,
          ...payload,
          durationMonths: Number(payload.durationMonths) || 1,
          createdAt: new Date().toISOString(),
        });
      }
      this.syncRoomStatus();
      this.save();
      return { ok: true };
    },

    setReservationStatus(id, status) {
      const res = state.reservations.find((r) => r.id === id);
      if (!res) return { ok: false };
      if (status === "confirmed" && !this.isRoomFree(res.roomId, id) && res.status !== "confirmed") {
        const occupied = state.tenants.some((t) => t.roomId === res.roomId && t.status === "active");
        if (occupied) return { ok: false, message: "Kamar tidak tersedia." };
      }
      res.status = status;
      this.syncRoomStatus();
      this.logActivity(`Reservasi ${res.guestName} — ${status}`);
      this.save();
      return { ok: true };
    },

    addFinance({ date, type, category, description, amount }) {
      const amt = Number(amount);
      if (!date || !category || !description || !(amt > 0) || !["income", "expense"].includes(type)) {
        return { ok: false, message: this.GENERIC };
      }
      state.finance.push({ id: uid("fin"), date, type, category: category.trim(), description: description.trim(), amount: amt });
      this.logActivity(`${type === "income" ? "Pemasukan" : "Pengeluaran"}: ${description}`);
      this.save();
      return { ok: true };
    },

    deleteFinance(id) {
      state.finance = state.finance.filter((f) => f.id !== id);
      this.save();
      return { ok: true };
    },

    validateProofFile(file) {
      if (!file) return { ok: false, message: this.GENERIC };
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(file.type) || file.size > 2 * 1024 * 1024) {
        return { ok: false, message: this.GENERIC };
      }
      return { ok: true };
    },

    uploadProof(invoiceId, tenantId, proof) {
      const inv = state.invoices.find((i) => i.id === invoiceId);
      if (!inv || inv.tenantId !== tenantId) return { ok: false, message: this.GENERIC };
      if (inv.status === "lunas") return { ok: false, message: this.GENERIC };
      inv.proof = proof;
      inv.status = "menunggu_verifikasi";
      inv.rejectReason = "";
      this.logActivity(`Bukti bayar diunggah untuk ${inv.number}`);
      this.save();
      return { ok: true };
    },

    verifyPayment(invoiceId, approve, reason) {
      const inv = state.invoices.find((i) => i.id === invoiceId);
      if (!inv) return { ok: false, message: this.GENERIC };
      if (inv.status === "lunas" || inv.postedFinanceId) {
        return { ok: false, message: "Pembayaran ini sudah diverifikasi." };
      }
      if (inv.status !== "menunggu_verifikasi") {
        return { ok: false, message: this.GENERIC };
      }
      if (approve) {
        inv.status = "lunas";
        inv.verifiedAt = new Date().toISOString();
        const tenant = this.getTenant(inv.tenantId);
        const fin = {
          id: uid("fin"),
          date: todayISO(),
          type: "income",
          category: "Sewa Kamar",
          description: `Invoice ${inv.number} — ${tenant ? tenant.name : ""}`,
          amount: inv.total,
        };
        state.finance.push(fin);
        inv.postedFinanceId = fin.id;
        this.logActivity(`Pembayaran ${inv.number} disetujui`);
      } else {
        if (!String(reason || "").trim()) return { ok: false, message: this.GENERIC };
        inv.status = "ditolak";
        inv.rejectReason = String(reason).trim();
        this.logActivity(`Pembayaran ${inv.number} ditolak`);
      }
      this.markOverdue();
      this.save();
      return { ok: true };
    },

    addComplaint({ tenantId, category, description, photoName, photoData }) {
      if (!tenantId || !category || !String(description || "").trim()) {
        return { ok: false, message: this.GENERIC };
      }
      const item = {
        id: uid("cmp"),
        tenantId,
        category,
        description: String(description).trim(),
        photoName: photoName || "",
        photoData: photoData || "",
        status: "baru",
        note: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.complaints.push(item);
      this.logActivity("Pengaduan baru masuk");
      this.save();
      return { ok: true, complaint: item };
    },

    updateComplaint(id, { status, note }) {
      const c = state.complaints.find((x) => x.id === id);
      if (!c) return { ok: false };
      if (status) c.status = status;
      if (note != null) c.note = note;
      c.updatedAt = new Date().toISOString();
      this.save();
      return { ok: true };
    },

    invoiceStatusLabel(status) {
      return {
        belum_lunas: "Belum lunas",
        menunggu_verifikasi: "Menunggu verifikasi",
        lunas: "Lunas",
        ditolak: "Ditolak",
        menunggak: "Menunggak",
      }[status] || status;
    },

    roomStatusLabel(status) {
      return { available: "Tersedia", occupied: "Occupied", reserved: "Reserved", maintenance: "Maintenance" }[status] || status;
    },
  };

  global.CozyStore = Store;
})(window);
