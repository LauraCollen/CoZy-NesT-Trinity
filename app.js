(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const S = () => CozyStore.get();
  const GENERIC = CozyAuth.GENERIC_ERROR;

  const NAV = {
    owner: [
      ["dashboard", "📊", "Dashboard"],
      ["profile", "🏡", "Profile Kost"],
      ["rooms", "🚪", "Data Kamar"],
      ["tenants", "👥", "Data Penghuni"],
      ["print-tenants", "🖨️", "Cetak Penghuni"],
      ["reservations", "📅", "Reservasi Kamar"],
      ["verify-payments", "✅", "Verifikasi Pembayaran"],
      ["arrears", "⚠️", "Daftar Tunggakan"],
      ["complaints-admin", "🛠️", "Kelola Pengaduan"],
      ["finance", "💰", "Data Keuangan"],
      ["reports", "📈", "Laporan Keuangan"],
      ["occupancy", "🏘️", "Tingkat Hunian"],
      ["invoices", "📧", "Invoice Penghuni"],
      ["account", "👤", "Profil Akun"],
    ],
    tenant: [
      ["tenant-home", "📊", "Dashboard"],
      ["tenant-bills", "🧾", "Daftar Tagihan"],
      ["tenant-upload", "📤", "Unggah Bukti"],
      ["tenant-payments", "🗂️", "Riwayat Pembayaran"],
      ["tenant-complaints", "🛠️", "Pengaduan"],
      ["account", "👤", "Profil Akun"],
    ],
    guest: [
      ["browse-rooms", "🚪", "Daftar Kamar"],
      ["my-bookings", "📅", "Status Pemesanan"],
      ["account", "👤", "Profil Akun"],
    ],
  };

  const META = {
    dashboard: ["Dashboard", "Ringkasan operasional kost"],
    profile: ["Profile Kost", "Identitas dan kontak kost"],
    rooms: ["Data Kamar", "Kelola kamar dan tarif"],
    tenants: ["Data Penghuni", "Identitas, kamar, dan masa sewa"],
    "print-tenants": ["Cetak Penghuni", "Pratinjau dan cetak (KTP tersamar)"],
    reservations: ["Reservasi Kamar", "Pemesanan calon penghuni"],
    "verify-payments": ["Verifikasi Pembayaran", "Setujui atau tolak bukti transfer"],
    arrears: ["Daftar Tunggakan", "Tagihan melewati jatuh tempo"],
    "complaints-admin": ["Kelola Pengaduan", "Tindak lanjuti keluhan penghuni"],
    finance: ["Data Keuangan", "Pemasukan dan pengeluaran"],
    reports: ["Laporan Keuangan", "Analisis tahunan"],
    occupancy: ["Tingkat Hunian", "Persentase kamar terisi"],
    invoices: ["Invoice Penghuni", "Buat, cetak, dan kirim tagihan"],
    "browse-rooms": ["Daftar Kamar", "Kamar tersedia untuk dipesan"],
    "room-detail": ["Detail Kamar", "Informasi lengkap kamar"],
    "book-room": ["Form Pemesanan", "Isi data pemesanan kamar"],
    "my-bookings": ["Status Pemesanan", "Reservasi milik Anda"],
    "tenant-home": ["Dashboard Penghuni", "Ringkasan kamar, sewa, dan tagihan"],
    "tenant-bills": ["Daftar Tagihan", "Tagihan berdasarkan masa sewa"],
    "tenant-upload": ["Unggah Bukti Pembayaran", "Kirim bukti transfer"],
    "tenant-payments": ["Riwayat Pembayaran", "Lunas, ditolak, atau menunggak"],
    "tenant-complaints": ["Pengaduan", "Lapor kendala fasilitas"],
    account: ["Profil Akun", "Ubah data diri dan kata sandi"],
  };

  let session = null;
  let modalOnSubmit = null;
  let selectedInvoiceId = null;
  let detailRoomId = null;
  let bookRoomId = null;

  function toast(msg, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    $("#toastContainer").appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentTenant() {
    return CozyStore.tenantForUser(session);
  }

  function parseHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    const [view, extra] = raw.split(":");
    return { view: view || CozyAuth.homeView(session.role), extra: extra || "" };
  }

  function go(view, extra) {
    location.hash = extra ? `${view}:${extra}` : view;
  }

  function showView(view) {
    if (!META[view]) {
      window.location.replace("404.html");
      return;
    }
    if (!CozyAuth.canAccess(view)) {
      window.location.replace("403.html");
      return;
    }
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#pageTitle").textContent = META[view][0];
    $("#pageSubtitle").textContent = META[view][1];
    $("#sidebar").classList.remove("open");
    refresh(view);
  }

  function refresh(view) {
    CozyStore.syncRoomStatus();
    CozyStore.markOverdue();
    CozyStore.ensureAutoInvoices();
    CozyStore.save();
    const fn = {
      dashboard: renderDashboard,
      profile: renderKostProfile,
      rooms: () => renderRooms($("#roomSearch").value),
      tenants: () => renderTenants($("#tenantSearch").value),
      "print-tenants": renderPrintTenants,
      reservations: renderReservations,
      "verify-payments": renderVerify,
      arrears: renderArrears,
      "complaints-admin": renderAdminComplaints,
      finance: renderFinance,
      reports: renderReports,
      occupancy: renderOccupancy,
      invoices: renderInvoices,
      "browse-rooms": () => renderCatalog($("#browseSearch").value),
      "room-detail": renderRoomDetail,
      "book-room": renderBookForm,
      "my-bookings": renderMyBookings,
      "tenant-home": renderTenantHome,
      "tenant-bills": renderTenantBills,
      "tenant-upload": renderUpload,
      "tenant-payments": renderTenantPayments,
      "tenant-complaints": renderMyComplaints,
      account: renderAccount,
    }[view];
    if (fn) fn();
  }

  function buildNav() {
    const items = NAV[session.role] || [];
    $("#mainNav").innerHTML = items
      .map(
        ([view, icon, label]) =>
          `<button type="button" class="nav-item" data-view="${view}"><span class="nav-icon">${icon}</span> ${label}</button>`
      )
      .join("");
    $$(".nav-item").forEach((btn) =>
      btn.addEventListener("click", () => go(btn.dataset.view))
    );
  }

  /* -------- owner dashboard -------- */
  function renderDashboard() {
    const occ = CozyStore.occupancy();
    const pending = S().reservations.filter((r) => r.status === "pending").length;
    const mk = CozyStore.monthKey();
    const inc = S().finance.filter((f) => f.type === "income" && f.date.startsWith(mk)).reduce((a, f) => a + f.amount, 0);
    const exp = S().finance.filter((f) => f.type === "expense" && f.date.startsWith(mk)).reduce((a, f) => a + f.amount, 0);
    $("#statTotalRooms").textContent = occ.total;
    $("#statAvailRooms").textContent = occ.available;
    $("#statTenants").textContent = S().tenants.filter((t) => t.status === "active").length;
    $("#statOccupancy").textContent = occ.pct;
    $("#statReservations").textContent = pending;
    $("#statBalance").textContent = CozyStore.formatCurrency(inc - exp);

    const statuses = ["available", "occupied", "reserved", "maintenance"];
    const colors = { available: "#2d7a4f", occupied: "#c45c3e", reserved: "#2a6f6f", maintenance: "#c9922e" };
    const counts = statuses.map((s) => S().rooms.filter((r) => r.status === s).length);
    const max = Math.max(...counts, 1);
    $("#roomStatusBars").innerHTML = statuses
      .map(
        (s, i) => `<div class="status-row"><span>${CozyStore.roomStatusLabel(s)}</span>
        <div class="status-bar-track"><div class="status-bar-fill" style="width:${(counts[i] / max) * 100}%;background:${colors[s]}"></div></div>
        <strong>${counts[i]}</strong></div>`
      )
      .join("");
    $("#activityList").innerHTML = S().activity.length
      ? S().activity.slice(0, 8).map((a) => `<li>${escapeHtml(a.text)}<span class="activity-time">${CozyStore.formatDateTime(a.at)}</span></li>`).join("")
      : "<li class='muted'>Belum ada aktivitas.</li>";
  }

  function renderKostProfile() {
    const f = $("#profileForm");
    Object.entries(S().profile).forEach(([k, v]) => {
      if (f.elements[k]) f.elements[k].value = v || "";
    });
    const p = S().profile;
    $("#profilePreview").innerHTML = `<div class="profile-card-preview"><h4>${escapeHtml(p.name)}</h4>
      <p>${escapeHtml(p.address)}, ${escapeHtml(p.city)} ${escapeHtml(p.postal)}</p>
      <p>${escapeHtml(p.phone)} · ${escapeHtml(p.email)}</p>
      <p>${escapeHtml(p.owner)} · ${escapeHtml(p.bankAccount)}</p>
      <p>${escapeHtml(p.description)}</p></div>`;
  }

  function renderRooms(q = "") {
    const query = q.toLowerCase();
    const rows = S().rooms.filter((r) => `${r.number} ${r.type} ${r.price}`.toLowerCase().includes(query));
    $("#roomsTable tbody").innerHTML =
      rows
        .map(
          (r) => `<tr>
        <td><strong>${escapeHtml(r.number)}</strong></td>
        <td>${escapeHtml(r.type)}</td>
        <td>${CozyStore.formatCurrency(r.price)}</td>
        <td><span class="badge badge-${r.status}">${CozyStore.roomStatusLabel(r.status)}</span></td>
        <td>${escapeHtml(r.facilities)}</td>
        <td class="table-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit-room="${r.id}">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" data-del-room="${r.id}">Hapus</button>
        </td></tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">Tidak ada kamar.</td></tr>`;
    bind("[data-edit-room]", (id) => openRoomModal(id), "editRoom");
    bind("[data-del-room]", (id) => {
      const res = CozyStore.deleteRoom(id);
      toast(res.ok ? "Kamar dihapus" : res.message, res.ok ? "success" : "error");
      renderRooms($("#roomSearch").value);
    }, "delRoom");
  }

  function renderTenants(q = "") {
    const query = q.toLowerCase();
    const rows = S().tenants.filter(
      (t) => t.name.toLowerCase().includes(query) || (t.ktp && t.ktp.includes(query))
    );
    $("#tenantsTable tbody").innerHTML =
      rows
        .map((t) => {
          const room = CozyStore.getRoom(t.roomId);
          return `<tr>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td>${room ? escapeHtml(room.number) : "-"}</td>
          <td>${escapeHtml(t.phone)}<br><small>${escapeHtml(t.email)}</small></td>
          <td>${CozyStore.formatDate(t.checkIn)}</td>
          <td>${t.durationMonths || "-"} bln</td>
          <td>${CozyStore.formatCurrency(t.monthlyRent)}</td>
          <td><span class="badge badge-${t.status}">${t.status}</span></td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-tenant="${t.id}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm" data-del-tenant="${t.id}">Hapus</button>
          </td></tr>`;
        })
        .join("") || `<tr><td colspan="8" class="muted">Belum ada penghuni.</td></tr>`;
    bind("[data-edit-tenant]", (id) => openTenantModal(id), "editTenant");
    bind("[data-del-tenant]", (id) => {
      if (!confirm("Hapus data penghuni?")) return;
      CozyStore.deleteTenant(id);
      toast("Penghuni dihapus");
      renderTenants($("#tenantSearch").value);
    }, "delTenant");
  }

  function renderPrintTenants() {
    const status = $("#printFilterStatus").value;
    let list = [...S().tenants];
    if (status !== "all") list = list.filter((t) => t.status === status);
    const p = S().profile;
    $("#printKostHeader").innerHTML = `<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.address)}`;
    $("#printTenantsMeta").textContent = `Total: ${list.length} · Filter: ${status}`;
    $("#printDate").textContent = CozyStore.formatDateTime(new Date());
    $("#printTenantsTable tbody").innerHTML = list
      .map((t, i) => {
        const room = CozyStore.getRoom(t.roomId);
        return `<tr><td>${i + 1}</td><td>${escapeHtml(t.name)}</td><td>${escapeHtml(CozyStore.maskKtp(t.ktp))}</td>
          <td>${room ? escapeHtml(room.number) : "-"}</td><td>${escapeHtml(t.phone)}</td>
          <td>${CozyStore.formatDate(t.checkIn)}</td><td>${CozyStore.formatCurrency(t.monthlyRent)}</td><td>${t.status}</td></tr>`;
      })
      .join("");
  }

  function renderReservations() {
    const list = S().reservations;
    $("#reservationCards").innerHTML = list.length
      ? list
          .map((res) => {
            const room = CozyStore.getRoom(res.roomId);
            return `<article class="res-card">
            <h4>${escapeHtml(res.guestName)}</h4>
            <p>Kamar <strong>${room ? room.number : "-"}</strong></p>
            <p>Check-in ${CozyStore.formatDate(res.checkIn)} · ${res.durationMonths} bulan</p>
            <p>${escapeHtml(res.phone)} · ${escapeHtml(res.email)}</p>
            <p><span class="badge badge-${res.status}">${res.status}</span></p>
            <div class="actions">
              ${res.status === "pending" ? `<button type="button" class="btn btn-success btn-sm" data-confirm-res="${res.id}">Konfirmasi</button>` : ""}
              <button type="button" class="btn btn-ghost btn-sm" data-edit-res="${res.id}">Ubah</button>
              <button type="button" class="btn btn-ghost btn-sm" data-cancel-res="${res.id}">Batalkan</button>
            </div></article>`;
          })
          .join("")
      : `<p class="muted">Belum ada reservasi.</p>`;
    bind("[data-confirm-res]", (id) => {
      const r = CozyStore.setReservationStatus(id, "confirmed");
      toast(r.ok ? "Dikonfirmasi" : r.message || GENERIC, r.ok ? "success" : "error");
      renderReservations();
    }, "confirmRes");
    bind("[data-edit-res]", (id) => openReservationModal(id), "editRes");
    bind("[data-cancel-res]", (id) => {
      CozyStore.setReservationStatus(id, "cancelled");
      toast("Reservasi dibatalkan");
      renderReservations();
    }, "cancelRes");
  }

  function renderVerify() {
    const waiting = S().invoices.filter((i) => i.status === "menunggu_verifikasi");
    $("#verifyEmpty").textContent = waiting.length ? "" : "Tidak ada bukti yang menunggu verifikasi.";
    $("#verifyCards").innerHTML = waiting
      .map((inv) => {
        const t = CozyStore.getTenant(inv.tenantId);
        return `<article class="res-card">
          <h4>${escapeHtml(inv.number)}</h4>
          <p>${escapeHtml(t ? t.name : "-")} · ${CozyStore.formatCurrency(inv.total)}</p>
          <p>Periode ${escapeHtml(inv.period)} · jatuh tempo ${CozyStore.formatDate(inv.dueDate)}</p>
          <p>Berkas: ${escapeHtml(inv.proof?.fileName || "bukti transfer")}</p>
          ${inv.proof?.dataUrl && inv.proof.dataUrl.startsWith("data:image") ? `<img class="proof-thumb" alt="Bukti" src="${inv.proof.dataUrl}" />` : ""}
          <div class="actions">
            <button type="button" class="btn btn-success btn-sm" data-approve="${inv.id}">Setujui</button>
            <button type="button" class="btn btn-danger btn-sm" data-reject="${inv.id}">Tolak</button>
          </div></article>`;
      })
      .join("");
    bind("[data-approve]", (id) => {
      const r = CozyStore.verifyPayment(id, true);
      toast(r.ok ? "Disetujui, pemasukan dicatat" : r.message, r.ok ? "success" : "error");
      renderVerify();
    }, "approve");
    bind("[data-reject]", (id) => {
      const reason = prompt("Alasan penolakan:");
      if (reason == null) return;
      const r = CozyStore.verifyPayment(id, false, reason);
      toast(r.ok ? "Ditolak" : r.message, r.ok ? "success" : "error");
      renderVerify();
    }, "reject");
  }

  function renderArrears() {
    const today = CozyStore.todayISO();
    const rows = S().invoices.filter((i) => i.status !== "lunas" && i.dueDate < today);
    $("#arrearsTable tbody").innerHTML =
      rows
        .map((inv) => {
          const t = CozyStore.getTenant(inv.tenantId);
          return `<tr><td>${escapeHtml(t ? t.name : "-")}</td><td>${escapeHtml(inv.number)}</td>
            <td>${escapeHtml(inv.period)}</td><td>${CozyStore.formatDate(inv.dueDate)}</td>
            <td>${CozyStore.formatCurrency(inv.total)}</td>
            <td><span class="badge badge-cancelled">${CozyStore.invoiceStatusLabel(inv.status)}</span></td></tr>`;
        })
        .join("") || `<tr><td colspan="6" class="muted">Tidak ada tunggakan.</td></tr>`;
  }

  function renderAdminComplaints() {
    $("#adminComplaintsTable tbody").innerHTML =
      S()
        .complaints.map((c) => {
          const t = CozyStore.getTenant(c.tenantId);
          return `<tr>
            <td>${CozyStore.formatDateTime(c.createdAt)}</td>
            <td>${escapeHtml(t ? t.name : "-")}</td>
            <td>${escapeHtml(c.category)}</td>
            <td>${escapeHtml(c.description)}</td>
            <td><span class="badge badge-${c.status === "selesai" ? "confirmed" : c.status === "ditolak" ? "cancelled" : "pending"}">${c.status}</span></td>
            <td>${escapeHtml(c.note)}</td>
            <td><button type="button" class="btn btn-ghost btn-sm" data-cmp="${c.id}">Ubah</button></td>
          </tr>`;
        })
        .join("") || `<tr><td colspan="7" class="muted">Belum ada pengaduan.</td></tr>`;
    bind("[data-cmp]", (id) => openComplaintModal(id), "cmp");
  }

  function populateMonthSelect(sel) {
    const opts = new Set(S().finance.map((f) => f.date.slice(0, 7)));
    opts.add(CozyStore.monthKey());
    const sorted = [...opts].sort().reverse();
    const current = sel.value;
    sel.innerHTML = sorted.map((k) => `<option value="${k}">${CozyStore.monthLabel(k)}</option>`).join("");
    sel.value = current && sorted.includes(current) ? current : sorted[0];
  }

  function renderFinance() {
    populateMonthSelect($("#financeMonthFilter"));
    const mk = $("#financeMonthFilter").value;
    const items = S().finance.filter((f) => f.date.startsWith(mk)).sort((a, b) => b.date.localeCompare(a.date));
    const inc = items.filter((f) => f.type === "income").reduce((a, f) => a + f.amount, 0);
    const exp = items.filter((f) => f.type === "expense").reduce((a, f) => a + f.amount, 0);
    $("#financeIncomeTotal").textContent = CozyStore.formatCurrency(inc);
    $("#financeExpenseTotal").textContent = CozyStore.formatCurrency(exp);
    $("#financeNetTotal").textContent = CozyStore.formatCurrency(inc - exp);
    $("#financeTable tbody").innerHTML =
      items
        .map(
          (f) => `<tr><td>${CozyStore.formatDate(f.date)}</td>
        <td class="type-${f.type}">${f.type === "income" ? "Pemasukan" : "Pengeluaran"}</td>
        <td>${escapeHtml(f.category)}</td><td>${escapeHtml(f.description)}</td>
        <td>${CozyStore.formatCurrency(f.amount)}</td>
        <td><button type="button" class="btn btn-ghost btn-sm" data-del-fin="${f.id}">Hapus</button></td></tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">Tidak ada transaksi.</td></tr>`;
    bind("[data-del-fin]", (id) => {
      CozyStore.deleteFinance(id);
      renderFinance();
      toast("Transaksi dihapus");
    }, "delFin");
  }

  function renderReports() {
    const yearSel = $("#reportYear");
    const years = new Set(S().finance.map((f) => f.date.slice(0, 4)));
    years.add(String(new Date().getFullYear()));
    const sorted = [...years].sort().reverse();
    const keep = yearSel.value;
    yearSel.innerHTML = sorted.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearSel.value = keep && sorted.includes(keep) ? keep : sorted[0];
    const year = yearSel.value;
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const prefix = `${year}-${m}`;
      const inc = S().finance.filter((f) => f.type === "income" && f.date.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);
      const exp = S().finance.filter((f) => f.type === "expense" && f.date.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);
      return { month: m, inc, exp, net: inc - exp };
    });
    const maxVal = Math.max(...monthly.map((x) => Math.max(x.inc, x.exp)), 1);
    const names = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    $("#yearlyChart").innerHTML = monthly
      .map(
        (row, i) => `<div class="chart-col">
        <div class="chart-stack">
          <div class="chart-seg income" style="height:${(row.inc / maxVal) * 100}%"></div>
          <div class="chart-seg expense" style="height:${(row.exp / maxVal) * 100}%"></div>
        </div><span class="chart-label">${names[i]}</span></div>`
      )
      .join("");
    $("#reportSummaryTable tbody").innerHTML = monthly
      .map(
        (row) => `<tr><td>${CozyStore.monthLabel(`${year}-${row.month}`)}</td>
        <td class="type-income">${CozyStore.formatCurrency(row.inc)}</td>
        <td class="type-expense">${CozyStore.formatCurrency(row.exp)}</td>
        <td><strong>${CozyStore.formatCurrency(row.net)}</strong></td></tr>`
      )
      .join("");
    const catMap = {};
    S()
      .finance.filter((f) => f.date.startsWith(year))
      .forEach((f) => {
        const key = `${f.type}:${f.category}`;
        catMap[key] = (catMap[key] || 0) + f.amount;
      });
    $("#categoryBreakdown").innerHTML =
      Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => {
          const [type, cat] = k.split(":");
          return `<div class="category-item"><span>${type === "income" ? "↗" : "↘"} ${escapeHtml(cat)}</span><strong>${CozyStore.formatCurrency(v)}</strong></div>`;
        })
        .join("") || `<p class="muted">Belum ada data.</p>`;
  }

  function renderOccupancy() {
    const occ = CozyStore.occupancy();
    $("#occPct").textContent = `${occ.pct}%`;
    $("#occFilled").textContent = occ.occupied;
    $("#occTotal").textContent = occ.total;
    $("#occFill").style.width = `${occ.pct}%`;
    $("#occCaption").textContent = `${occ.occupied} dari ${occ.total} kamar terisi (${occ.pct}%).`;
  }

  function renderInvoices() {
    const sorted = [...S().invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    $("#invoiceList").innerHTML =
      sorted
        .map((inv) => {
          const tenant = CozyStore.getTenant(inv.tenantId);
          return `<li data-inv-id="${inv.id}" class="${selectedInvoiceId === inv.id ? "selected" : ""}">
            <strong>${escapeHtml(inv.number)}</strong><br>
            <small>${escapeHtml(tenant?.name || "—")} · ${CozyStore.formatCurrency(inv.total)}</small><br>
            <small class="muted">${CozyStore.invoiceStatusLabel(inv.status)}</small></li>`;
        })
        .join("") || `<li class="muted">Belum ada invoice.</li>`;
    $$("#invoiceList [data-inv-id]").forEach((li) =>
      li.addEventListener("click", () => {
        selectedInvoiceId = li.dataset.invId;
        renderInvoices();
      })
    );
    if (selectedInvoiceId) showInvoicePreview(selectedInvoiceId);
  }

  function showInvoicePreview(id) {
    const inv = S().invoices.find((i) => i.id === id);
    if (!inv) return;
    const tenant = CozyStore.getTenant(inv.tenantId);
    const room = tenant ? CozyStore.getRoom(tenant.roomId) : null;
    const p = S().profile;
    $("#invoicePreview").innerHTML = `
      <div class="invoice-doc-header"><div><h2>${escapeHtml(p.name)}</h2>
      <p>${escapeHtml(p.address)}<br>${escapeHtml(p.phone)}</p></div>
      <div style="text-align:right"><p><strong>INVOICE</strong></p><p>${escapeHtml(inv.number)}</p>
      <p>Jatuh tempo: ${CozyStore.formatDate(inv.dueDate)}</p></div></div>
      <div class="invoice-meta-grid"><div><strong>Tagihan kepada</strong><br>${escapeHtml(tenant?.name || "-")}<br>${escapeHtml(tenant?.email || "")}</div>
      <div>Kamar ${room ? escapeHtml(room.number) : "-"}<br>Periode ${escapeHtml(inv.period)}<br>${CozyStore.invoiceStatusLabel(inv.status)}</div></div>
      <table class="invoice-lines"><thead><tr><th>Deskripsi</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>
      ${inv.lines.map((l) => `<tr><td>${escapeHtml(l.desc)}</td><td>${l.qty}</td><td>${CozyStore.formatCurrency(l.price)}</td><td>${CozyStore.formatCurrency(l.qty * l.price)}</td></tr>`).join("")}
      </tbody></table>
      <p class="invoice-total">Total: ${CozyStore.formatCurrency(inv.total)}</p>
      <p>Transfer ke: ${escapeHtml(p.bankAccount)}</p>`;
    $("#invoiceActions").hidden = false;
    $("#invoiceActions").dataset.invoiceId = id;
  }

  /* guest */
  function renderCatalog(q = "") {
    const query = q.toLowerCase();
    const rooms = S().rooms.filter((r) => r.status === "available");
    const filtered = rooms.filter((r) => `${r.number} ${r.type} ${r.price} ${r.facilities}`.toLowerCase().includes(query));
    $("#roomCatalog").innerHTML = filtered.length
      ? filtered
          .map(
            (r) => `<article class="room-card">
            <h3>Kamar ${escapeHtml(r.number)}</h3>
            <p class="room-type">${escapeHtml(r.type)}</p>
            <p class="room-price">${CozyStore.formatCurrency(r.price)} / bulan</p>
            <p>${escapeHtml(r.facilities)}</p>
            <button type="button" class="btn btn-primary" data-detail="${r.id}">Lihat detail</button>
          </article>`
          )
          .join("")
      : `<p class="muted">Tidak ada kamar tersedia.</p>`;
    bind("[data-detail]", (id) => {
      detailRoomId = id;
      go("room-detail", id);
    }, "detail");
  }

  function renderRoomDetail() {
    const { extra } = parseHash();
    const id = extra || detailRoomId;
    const room = CozyStore.getRoom(id);
    if (!room) {
      $("#roomDetailCard").innerHTML = `<p>Kamar tidak ditemukan.</p>`;
      return;
    }
    detailRoomId = room.id;
    $("#roomDetailCard").innerHTML = `<h3>Kamar ${escapeHtml(room.number)}</h3>
      <p>Tipe: <strong>${escapeHtml(room.type)}</strong></p>
      <p>Harga: <strong>${CozyStore.formatCurrency(room.price)}</strong> / bulan</p>
      <p>Status: <span class="badge badge-${room.status}">${CozyStore.roomStatusLabel(room.status)}</span></p>
      <p>Fasilitas: ${escapeHtml(room.facilities)}</p>
      ${
        room.status === "available"
          ? `<button type="button" class="btn btn-primary" id="btnBookThis">Pesan kamar ini</button>`
          : `<p class="muted">Kamar ini tidak dapat dipesan saat ini.</p>`
      }`;
    const btn = $("#btnBookThis");
    if (btn)
      btn.addEventListener("click", () => {
        bookRoomId = room.id;
        go("book-room", room.id);
      });
  }

  function renderBookForm() {
    const { extra } = parseHash();
    const id = extra || bookRoomId;
    const room = CozyStore.getRoom(id);
    $("#bookError").hidden = true;
    if (!room) {
      $("#bookRoomHint").textContent = "Kamar tidak ditemukan.";
      return;
    }
    bookRoomId = room.id;
    $("#bookRoomId").value = room.id;
    $("#bookRoomHint").textContent = `Memesan kamar ${room.number} (${room.type}) — ${CozyStore.formatCurrency(room.price)}/bulan. Check-in tidak boleh tanggal lampau.`;
    const f = $("#bookForm");
    f.guestName.value = session.name || "";
    f.phone.value = session.phone || "";
    f.email.value = session.email || "";
    f.checkIn.value = CozyStore.todayISO();
    f.checkIn.min = CozyStore.todayISO();
  }

  function renderMyBookings() {
    const mine = S().reservations.filter(
      (r) => r.userId === session.id || (r.email && r.email.toLowerCase() === session.email.toLowerCase())
    );
    $("#myBookingCards").innerHTML = mine.length
      ? mine
          .map((res) => {
            const room = CozyStore.getRoom(res.roomId);
            return `<article class="res-card"><h4>Kamar ${room ? escapeHtml(room.number) : "-"}</h4>
            <p>Check-in ${CozyStore.formatDate(res.checkIn)} · ${res.durationMonths} bulan</p>
            <p><span class="badge badge-${res.status}">${res.status}</span></p></article>`;
          })
          .join("")
      : `<p class="muted">Anda belum memiliki pemesanan.</p>`;
  }

  /* tenant */
  function renderTenantHome() {
    const tenant = currentTenant();
    if (!tenant) {
      $("#tenantStats").innerHTML = `<p class="muted">Akun ini belum terhubung ke data penghuni.</p>`;
      $("#tenantActiveBills").innerHTML = "";
      return;
    }
    const room = CozyStore.getRoom(tenant.roomId);
    const bills = S().invoices.filter((i) => i.tenantId === tenant.id && i.status !== "lunas");
    $("#tenantStats").innerHTML = `
      <article class="stat-card stat-rooms"><div class="stat-label">Kamar</div>
        <div class="stat-value">${room ? escapeHtml(room.number) : "-"}</div>
        <div class="stat-detail">${room ? escapeHtml(room.type) : ""}</div></article>
      <article class="stat-card stat-tenants"><div class="stat-label">Masa sewa</div>
        <div class="stat-value">${tenant.durationMonths || "-"} bln</div>
        <div class="stat-detail">Masuk ${CozyStore.formatDate(tenant.checkIn)}</div></article>
      <article class="stat-card stat-balance"><div class="stat-label">Tagihan aktif</div>
        <div class="stat-value">${bills.length}</div>
        <div class="stat-detail">${CozyStore.formatCurrency(bills.reduce((a, b) => a + b.total, 0))}</div></article>`;
    $("#tenantActiveBills").innerHTML = bills.length
      ? `<ul class="activity-list">${bills
          .map(
            (b) =>
              `<li>${escapeHtml(b.period)} · ${CozyStore.formatCurrency(b.total)} · ${CozyStore.invoiceStatusLabel(b.status)}
            <span class="activity-time">Jatuh tempo ${CozyStore.formatDate(b.dueDate)}</span></li>`
          )
          .join("")}</ul>`
      : `<p class="muted">Tidak ada tagihan aktif.</p>`;
  }

  function tenantInvoices() {
    const tenant = currentTenant();
    if (!tenant) return [];
    return S().invoices.filter((i) => i.tenantId === tenant.id);
  }

  function renderTenantBills() {
    const rows = tenantInvoices();
    $("#tenantBillsTable tbody").innerHTML =
      rows
        .map(
          (inv) => `<tr>
        <td>${escapeHtml(inv.period)}</td>
        <td>${CozyStore.formatCurrency(inv.total)}</td>
        <td>${CozyStore.formatDate(inv.dueDate)}</td>
        <td><span class="badge badge-${inv.status === "lunas" ? "confirmed" : "pending"}">${CozyStore.invoiceStatusLabel(inv.status)}</span></td>
        <td>${inv.status === "lunas" ? "-" : `<button type="button" class="btn btn-ghost btn-sm" data-to-upload="${inv.id}">Unggah bukti</button>`}</td>
      </tr>`
        )
        .join("") || `<tr><td colspan="5" class="muted">Belum ada tagihan.</td></tr>`;
    bind("[data-to-upload]", (id) => {
      $("#uploadInvoiceSelect").value = id;
      go("tenant-upload");
    }, "toUpload");
  }

  function renderUpload() {
    const tenant = currentTenant();
    $("#uploadError").hidden = true;
    const open = tenantInvoices().filter((i) => i.status !== "lunas");
    $("#uploadInvoiceSelect").innerHTML = open.map((i) => `<option value="${i.id}">${i.number} — ${i.period} (${CozyStore.formatCurrency(i.total)})</option>`).join("");
  }

  function renderTenantPayments() {
    const hist = tenantInvoices().filter((i) => ["lunas", "ditolak", "menunggak"].includes(i.status));
    $("#tenantPayTable tbody").innerHTML =
      hist
        .map(
          (inv) => `<tr>
        <td>${escapeHtml(inv.number)}</td><td>${escapeHtml(inv.period)}</td>
        <td>${CozyStore.formatCurrency(inv.total)}</td>
        <td>${CozyStore.invoiceStatusLabel(inv.status)}</td>
        <td>${escapeHtml(inv.rejectReason || "-")}</td></tr>`
        )
        .join("") || `<tr><td colspan="5" class="muted">Belum ada riwayat.</td></tr>`;
  }

  function renderMyComplaints() {
    const tenant = currentTenant();
    $("#complaintError").hidden = true;
    const mine = tenant ? S().complaints.filter((c) => c.tenantId === tenant.id) : [];
    $("#myComplaints").innerHTML = mine.length
      ? mine
          .map(
            (c) =>
              `<li><strong>${escapeHtml(c.category)}</strong> — ${escapeHtml(c.description)}
          <span class="activity-time">${c.status}${c.note ? " · " + c.note : ""} · ${CozyStore.formatDateTime(c.updatedAt)}</span></li>`
          )
          .join("")
      : `<li class="muted">Belum ada pengaduan.</li>`;
  }

  function renderAccount() {
    $("#accountError").hidden = true;
    $("#passError").hidden = true;
    const f = $("#accountForm");
    f.name.value = session.name || "";
    f.email.value = session.email || "";
    f.phone.value = session.phone || "";
  }

  /* modal helpers */
  function bind(sel, fn, _key) {
    $$(sel).forEach((el) => {
      const id = el.dataset.editRoom || el.dataset.delRoom || el.dataset.editTenant || el.dataset.delTenant ||
        el.dataset.confirmRes || el.dataset.editRes || el.dataset.cancelRes || el.dataset.approve || el.dataset.reject ||
        el.dataset.cmp || el.dataset.delFin || el.dataset.invId || el.dataset.detail || el.dataset.toUpload;
      el.addEventListener("click", () => fn(id));
    });
  }

  function openModal(title, html, onSubmit) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = html;
    modalOnSubmit = onSubmit;
    $("#appModal").showModal();
  }

  function closeModal() {
    $("#appModal").close();
    modalOnSubmit = null;
  }

  function roomOptions(selectedId) {
    return S()
      .rooms.map((r) => `<option value="${r.id}" ${r.id === selectedId ? "selected" : ""}>${escapeHtml(r.number)} — ${r.type}</option>`)
      .join("");
  }

  function openRoomModal(id) {
    const r = id ? CozyStore.getRoom(id) : { number: "", type: "Standard", price: 850000, status: "available", facilities: "" };
    openModal(id ? "Edit Kamar" : "Tambah Kamar", `
      <div id="innerForm">
        <label class="field"><span>No. Kamar</span><input name="number" value="${escapeHtml(r.number)}" /></label>
        <label class="field"><span>Tipe</span><input name="type" value="${escapeHtml(r.type)}" /></label>
        <label class="field"><span>Harga / bulan</span><input name="price" type="number" min="1" value="${r.price || 0}" /></label>
        <label class="field"><span>Status</span><select name="status">
          ${["available", "occupied", "reserved", "maintenance"].map((s) => `<option value="${s}" ${r.status === s ? "selected" : ""}>${CozyStore.roomStatusLabel(s)}</option>`).join("")}
        </select></label>
        <label class="field"><span>Fasilitas</span><textarea name="facilities" rows="2">${escapeHtml(r.facilities)}</textarea></label>
      </div>`, (fd) => {
      const res = CozyStore.saveRoom(Object.fromEntries(fd), id);
      toast(res.ok ? "Kamar disimpan" : res.message, res.ok ? "success" : "error");
      if (res.ok) renderRooms($("#roomSearch").value);
    });
  }

  function openTenantModal(id) {
    const t = id
      ? CozyStore.getTenant(id)
      : { name: "", ktp: "", phone: "", email: "", roomId: S().rooms[0]?.id, checkIn: CozyStore.todayISO(), durationMonths: 6, monthlyRent: S().rooms[0]?.price || 0, deposit: 0, status: "active", notes: "" };
    openModal(id ? "Edit Penghuni" : "Tambah Penghuni", `
      <div id="innerForm">
        <label class="field"><span>Nama</span><input name="name" value="${escapeHtml(t.name)}" /></label>
        <label class="field"><span>No. KTP</span><input name="ktp" value="${escapeHtml(t.ktp)}" /></label>
        <label class="field"><span>Telepon</span><input name="phone" value="${escapeHtml(t.phone)}" /></label>
        <label class="field"><span>Email</span><input name="email" value="${escapeHtml(t.email)}" /></label>
        <label class="field"><span>Kamar</span><select name="roomId">${roomOptions(t.roomId)}</select></label>
        <label class="field"><span>Tanggal masuk</span><input name="checkIn" type="date" value="${t.checkIn || ""}" /></label>
        <label class="field"><span>Masa sewa (bulan)</span><input name="durationMonths" type="number" min="1" value="${t.durationMonths || 1}" /></label>
        <label class="field"><span>Sewa / bulan</span><input name="monthlyRent" type="number" min="1" value="${t.monthlyRent || 0}" /></label>
        <label class="field"><span>Deposit</span><input name="deposit" type="number" min="0" value="${t.deposit || 0}" /></label>
        <label class="field"><span>Status</span><select name="status">
          <option value="active" ${t.status === "active" ? "selected" : ""}>active</option>
          <option value="inactive" ${t.status === "inactive" ? "selected" : ""}>inactive</option>
        </select></label>
        <label class="field"><span>Catatan</span><textarea name="notes" rows="2">${escapeHtml(t.notes)}</textarea></label>
      </div>`, async (fd) => {
      const data = Object.fromEntries(fd);
      const res = CozyStore.saveTenant(data, id);
      if (res.ok && data.email) await CozyAuth.ensureTenantUser({ name: data.name, email: data.email, phone: data.phone, tenantId: res.tenantId });
      toast(res.ok ? "Penghuni disimpan" : res.message, res.ok ? "success" : "error");
      if (res.ok) renderTenants($("#tenantSearch").value);
    });
  }

  function openReservationModal(id) {
    const res = id
      ? S().reservations.find((r) => r.id === id)
      : { guestName: "", phone: "", email: "", roomId: S().rooms.find((r) => r.status === "available")?.id, checkIn: CozyStore.todayISO(), durationMonths: 1, status: "pending", notes: "" };
    openModal(id ? "Ubah Reservasi" : "Reservasi Baru", `
      <div id="innerForm">
        <label class="field"><span>Nama tamu</span><input name="guestName" value="${escapeHtml(res.guestName)}" /></label>
        <label class="field"><span>Telepon</span><input name="phone" value="${escapeHtml(res.phone)}" /></label>
        <label class="field"><span>Email</span><input name="email" value="${escapeHtml(res.email)}" /></label>
        <label class="field"><span>Kamar</span><select name="roomId">${roomOptions(res.roomId)}</select></label>
        <label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${res.checkIn}" /></label>
        <label class="field"><span>Durasi (bulan)</span><input name="durationMonths" type="number" min="1" value="${res.durationMonths}" /></label>
        <label class="field"><span>Status</span><select name="status">
          ${["pending", "confirmed", "cancelled"].map((s) => `<option value="${s}" ${res.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select></label>
        <label class="field"><span>Catatan</span><textarea name="notes">${escapeHtml(res.notes)}</textarea></label>
      </div>`, (fd) => {
      const data = Object.fromEntries(fd);
      const r = CozyStore.saveReservation(data, id);
      toast(r.ok ? "Reservasi disimpan" : r.message, r.ok ? "success" : "error");
      if (r.ok) renderReservations();
    });
  }

  function openComplaintModal(id) {
    const c = S().complaints.find((x) => x.id === id);
    openModal("Ubah pengaduan", `
      <div id="innerForm">
        <label class="field"><span>Status</span><select name="status">
          ${["baru", "diproses", "selesai", "ditolak"].map((s) => `<option value="${s}" ${c.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select></label>
        <label class="field"><span>Catatan</span><textarea name="note" rows="3">${escapeHtml(c.note)}</textarea></label>
      </div>`, (fd) => {
      CozyStore.updateComplaint(id, Object.fromEntries(fd));
      toast("Pengaduan diperbarui");
      renderAdminComplaints();
    });
  }

  function openFinanceModal(type) {
    openModal(type === "income" ? "Pemasukan" : "Pengeluaran", `
      <div id="innerForm">
        <label class="field"><span>Tanggal</span><input name="date" type="date" value="${CozyStore.todayISO()}" /></label>
        <label class="field"><span>Kategori</span><input name="category" /></label>
        <label class="field"><span>Keterangan</span><input name="description" /></label>
        <label class="field"><span>Jumlah</span><input name="amount" type="number" min="1" /></label>
      </div>`, (fd) => {
      const data = Object.fromEntries(fd);
      const r = CozyStore.addFinance({ ...data, type });
      toast(r.ok ? "Tercatat" : r.message, r.ok ? "success" : "error");
      if (r.ok) renderFinance();
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function bindEvents() {
    $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    $("#btnLogout").addEventListener("click", () => {
      CozyAuth.logout();
      window.location.replace("login.html");
    });
    $("#profileForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      S().profile = Object.fromEntries(new FormData(e.target).entries());
      CozyStore.save();
      CozyStore.logActivity("Profile kost diperbarui");
      renderKostProfile();
      toast("Profile disimpan");
    });
    $("#btnAddRoom")?.addEventListener("click", () => openRoomModal(null));
    $("#roomSearch")?.addEventListener("input", (e) => renderRooms(e.target.value));
    $("#btnAddTenant")?.addEventListener("click", () => openTenantModal(null));
    $("#tenantSearch")?.addEventListener("input", (e) => renderTenants(e.target.value));
    $("#btnPrintTenants")?.addEventListener("click", () => window.print());
    $("#printFilterStatus")?.addEventListener("change", renderPrintTenants);
    $("#btnAddReservation")?.addEventListener("click", () => openReservationModal(null));
    $("#btnAddIncome")?.addEventListener("click", () => openFinanceModal("income"));
    $("#btnAddExpense")?.addEventListener("click", () => openFinanceModal("expense"));
    $("#financeMonthFilter")?.addEventListener("change", renderFinance);
    $("#reportYear")?.addEventListener("change", renderReports);
    $("#btnExportReport")?.addEventListener("click", exportCsv);
    $("#btnCreateInvoice")?.addEventListener("click", openInvoiceModal);
    $("#btnPrintInvoice")?.addEventListener("click", () => window.print());
    $("#btnSendInvoice")?.addEventListener("click", sendInvoice);
    $("#browseSearch")?.addEventListener("input", (e) => renderCatalog(e.target.value));
    $("#btnBackBrowse")?.addEventListener("click", () => go("browse-rooms"));
    $("#bookForm")?.addEventListener("submit", onBook);
    $("#uploadForm")?.addEventListener("submit", onUpload);
    $("#complaintForm")?.addEventListener("submit", onComplaint);
    $("#accountForm")?.addEventListener("submit", onAccount);
    $("#passwordForm")?.addEventListener("submit", onPassword);
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalCancel").addEventListener("click", closeModal);
    $("#modalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData();
      $("#modalBody")
        .querySelectorAll("input, select, textarea")
        .forEach((el) => {
          if (el.name) fd.append(el.name, el.value);
        });
      if (modalOnSubmit) await modalOnSubmit(fd);
      closeModal();
    });
    window.addEventListener("hashchange", onHash);
  }

  function openInvoiceModal() {
    const tenants = S().tenants.filter((t) => t.status === "active");
    openModal("Buat Invoice", `
      <div id="innerForm">
        <label class="field"><span>Penghuni</span><select name="tenantId">${tenants.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Periode (YYYY-MM)</span><input name="periodKey" value="${CozyStore.monthKey()}" /></label>
        <label class="field"><span>Biaya tambahan</span><input name="extra" type="number" min="0" value="0" /></label>
        <label class="field"><span>Keterangan tambahan</span><input name="extraDesc" /></label>
      </div>`, (fd) => {
      const data = Object.fromEntries(fd);
      const extras = Number(data.extra) > 0 ? [{ desc: data.extraDesc || "Biaya tambahan", qty: 1, price: Number(data.extra) }] : [];
      const r = CozyStore.createInvoice(data.tenantId, data.periodKey, CozyStore.monthLabel(data.periodKey), extras);
      toast(r.ok ? "Invoice dibuat" : r.message, r.ok ? "success" : "error");
      if (r.ok) {
        selectedInvoiceId = r.invoice.id;
        renderInvoices();
      }
    });
  }

  function sendInvoice() {
    const id = $("#invoiceActions").dataset.invoiceId;
    const inv = S().invoices.find((i) => i.id === id);
    const tenant = inv ? CozyStore.getTenant(inv.tenantId) : null;
    if (!inv || !tenant) return;
    const body = encodeURIComponent(
      `Yth. ${tenant.name},\nTagihan ${inv.period} sebesar ${CozyStore.formatCurrency(inv.total)}.\nJatuh tempo ${CozyStore.formatDate(inv.dueDate)}.\nTransfer: ${S().profile.bankAccount}\n${S().profile.name}`
    );
    inv.sentAt = new Date().toISOString();
    CozyStore.save();
    if (tenant.email) window.open(`mailto:${tenant.email}?subject=${encodeURIComponent("Invoice " + inv.number)}&body=${body}`);
    else if (tenant.phone) window.open(`https://wa.me/${tenant.phone.replace(/\D/g, "").replace(/^0/, "62")}?text=${body}`);
    toast("Jendela pengiriman dibuka");
  }

  function exportCsv() {
    const year = $("#reportYear").value;
    const rows = [["Bulan", "Pemasukan", "Pengeluaran", "Saldo"]];
    for (let i = 1; i <= 12; i++) {
      const m = String(i).padStart(2, "0");
      const prefix = `${year}-${m}`;
      const inc = S().finance.filter((f) => f.type === "income" && f.date.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);
      const exp = S().finance.filter((f) => f.type === "expense" && f.date.startsWith(prefix)).reduce((a, f) => a + f.amount, 0);
      rows.push([CozyStore.monthLabel(prefix), inc, exp, inc - exp]);
    }
    const occ = CozyStore.occupancy();
    rows.push([]);
    rows.push(["Tingkat hunian", `${occ.pct}%`, occ.occupied, occ.total]);
    const blob = new Blob(["\ufeff" + rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Laporan-CoZyNesT-${year}.csv`;
    a.click();
  }

  function onBook(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = CozyStore.placeBooking({ user: session, ...data });
    const err = $("#bookError");
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.message;
      return;
    }
    toast("Pemesanan dikirim");
    go("my-bookings");
  }

  async function onUpload(e) {
    e.preventDefault();
    const tenant = currentTenant();
    const err = $("#uploadError");
    err.hidden = true;
    if (!tenant) {
      err.hidden = false;
      err.textContent = GENERIC;
      return;
    }
    const fd = new FormData(e.target);
    const file = fd.get("proof");
    const check = CozyStore.validateProofFile(file);
    if (!check.ok) {
      err.hidden = false;
      err.textContent = GENERIC;
      return;
    }
    const dataUrl = await readFile(file);
    const r = CozyStore.uploadProof(fd.get("invoiceId"), tenant.id, {
      fileName: file.name,
      mime: file.type,
      dataUrl,
      uploadedAt: new Date().toISOString(),
    });
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.message;
      return;
    }
    toast("Bukti terkirim, menunggu verifikasi");
    go("tenant-payments");
  }

  async function onComplaint(e) {
    e.preventDefault();
    const tenant = currentTenant();
    const err = $("#complaintError");
    err.hidden = true;
    if (!tenant) {
      err.hidden = false;
      err.textContent = GENERIC;
      return;
    }
    const fd = new FormData(e.target);
    const file = fd.get("photo");
    let photoName = "";
    let photoData = "";
    if (file && file.size) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
        err.hidden = false;
        err.textContent = GENERIC;
        return;
      }
      photoName = file.name;
      photoData = await readFile(file);
    }
    const r = CozyStore.addComplaint({
      tenantId: tenant.id,
      category: fd.get("category"),
      description: fd.get("description"),
      photoName,
      photoData,
    });
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.message;
      return;
    }
    e.target.reset();
    toast("Pengaduan terkirim");
    renderMyComplaints();
  }

  async function onAccount(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = await CozyAuth.updateProfile(session.id, data);
    const err = $("#accountError");
    if (!r.ok) {
      err.hidden = false;
      err.textContent = GENERIC;
      return;
    }
    session = CozyAuth.getSession();
    $("#sessionUser").textContent = session.name;
    toast("Profil disimpan");
  }

  async function onPassword(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = await CozyAuth.changePassword(session.id, data.oldPassword, data.newPassword);
    const err = $("#passError");
    if (!r.ok) {
      err.hidden = false;
      err.textContent = GENERIC;
      return;
    }
    toast("Kata sandi diperbarui");
    e.target.reset();
  }

  function onHash() {
    const { view, extra } = parseHash();
    if (view === "room-detail") detailRoomId = extra;
    if (view === "book-room") bookRoomId = extra;
    showView(view);
  }

  async function boot() {
    await CozyAuth.ready;
    if (!CozyAuth.requireDashboard()) return;
    session = CozyAuth.getSession();
    CozyStore.load();
    const tenant = CozyStore.tenantForUser(session);
    if (tenant && session.role === "tenant") {
      CozyAuth.linkTenant(session.id, tenant.id);
      session = CozyAuth.getSession();
    }
    $("#sessionUser").textContent = `${session.name} · ${session.role}`;
    $("#roleTagline").textContent =
      session.role === "owner" ? "Pengelola kost" : session.role === "tenant" ? "Portal penghuni" : "Portal calon penghuni";
    $("#todayDate").textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    buildNav();
    bindEvents();
    onHash();
  }

  boot();
})();
