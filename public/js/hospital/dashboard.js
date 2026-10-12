// Dashboard: patient analytics only (no financial data).
// Data comes from /dashboard-data; charts are drawn as plain SVG/HTML.
(function () {
    "use strict";

    const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
    const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
    const el = (tag, attrs = {}, text) => {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const svgEl = (tag, attrs = {}) => {
        const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
        return node;
    };

    let data = null;
    let range = "daily";

    // ---------------------------------------------------------------- stat tiles
    function renderStats() {
        const { patients, today, visits, beds, admitted, dischargedThisMonth } = data;

        setStat("statPatients", fmt(patients.total),
            `${fmt(patients.new_this_month)} new this month · ${fmt(patients.new_last_month)} last month`);
        setStat("statToday", fmt(today.total),
            `${fmt(today.waiting)} waiting · ${fmt(today.completed)} seen`);
        setStat("statAdmitted", fmt(admitted.length),
            `${fmt(beds.occupied)} of ${fmt(beds.total)} beds marked occupied · ${fmt(dischargedThisMonth)} discharged this month`);
        setStat("statVisits", fmt(visits.this_month),
            `this month so far · ${fmt(visits.last_month)} last month`);
    }

    function setStat(id, value, note) {
        document.getElementById(id).textContent = value;
        document.getElementById(id + "Note").textContent = note;
    }

    // ------------------------------------------------------ patient visits chart
    // Two series of the same unit (patients) on one shared y-axis, grouped columns.
    const SERIES = [
        { key: "visits", label: "OPD visits", cssVar: "--series-1" },
        { key: "new_patients", label: "New patients", cssVar: "--series-2" },
    ];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function periodLabel(period, long) {
        const [y, m, d] = period.split("-").map(Number);
        if (d) return long ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
        return long ? `${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${String(y).slice(2)}`;
    }

    function niceMax(value) {
        if (value <= 5) return 5;
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4) * magnitude;
        return Math.ceil(value / step) * step;
    }

    // Column with 4px rounded top corners, square at the baseline
    function columnPath(x, y, w, h) {
        if (h <= 0) return "";
        const r = Math.min(4, w / 2, h);
        return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
    }

    function renderVisits() {
        const rows = range === "daily" ? data.visitsDaily : data.visitsMonthly;
        const host = document.getElementById("visitsChart");
        const tooltip = document.getElementById("visitsTooltip");
        host.querySelectorAll("svg").forEach((s) => s.remove());

        const styles = getComputedStyle(host);
        const color = (v) => styles.getPropertyValue(v).trim();

        const width = Math.max(host.clientWidth, 320);
        const height = 280;
        const m = { top: 12, right: 8, bottom: 30, left: 40 };
        const plotW = width - m.left - m.right;
        const plotH = height - m.top - m.bottom;

        const max = niceMax(Math.max(1, ...rows.flatMap((r) => SERIES.map((s) => r[s.key]))));
        const y = (v) => m.top + plotH - (v / max) * plotH;
        const band = plotW / rows.length;
        const barW = Math.max(2, Math.min(18, (band - 6) / 2 - 1));
        const gap = 2;

        const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img",
            "aria-label": `OPD visits and new patients, ${range === "daily" ? "last 30 days" : "last 12 months"}` });

        // recessive grid + y labels
        const ticks = 4;
        for (let i = 0; i <= ticks; i++) {
            const v = (max / ticks) * i;
            const gy = y(v);
            svg.appendChild(svgEl("line", { x1: m.left, x2: width - m.right, y1: gy, y2: gy,
                stroke: color(i === 0 ? "--axis" : "--grid"), "stroke-width": 1 }));
            const t = svgEl("text", { x: m.left - 6, y: gy + 4, "text-anchor": "end", class: "dash-axis-text" });
            t.textContent = fmt(v);
            svg.appendChild(t);
        }

        const highlight = svgEl("rect", { y: m.top, height: plotH, width: band, fill: color("--hover"), opacity: 0 });
        svg.appendChild(highlight);

        // x labels: thin out so they never collide; the latest period is always labelled
        const every = Math.ceil(rows.length / Math.max(1, Math.floor(plotW / 56)));
        const last = rows.length - 1;
        const labelled = (i) => i === last || (i % every === 0 && last - i >= every);
        rows.forEach((r, i) => {
            const cx = m.left + band * i + band / 2;
            SERIES.forEach((s, si) => {
                const v = r[s.key];
                const bx = cx - barW - gap / 2 + si * (barW + gap);
                const d = columnPath(bx, y(v), barW, m.top + plotH - y(v));
                if (d) svg.appendChild(svgEl("path", { d, fill: color(s.cssVar) }));
            });
            if (labelled(i)) {
                const t = svgEl("text", { x: cx, y: height - 10, "text-anchor": "middle", class: "dash-axis-text" });
                t.textContent = periodLabel(r.period, false);
                svg.appendChild(t);
            }
        });

        // hover: one hit area per period, wider than the bars
        rows.forEach((r, i) => {
            const hit = svgEl("rect", { x: m.left + band * i, y: m.top, width: band, height: plotH, fill: "transparent" });
            hit.addEventListener("mouseenter", () => {
                highlight.setAttribute("x", m.left + band * i);
                highlight.setAttribute("opacity", 1);
                tooltip.replaceChildren(
                    el("div", { class: "dash-tooltip-title" }, periodLabel(r.period, true)),
                    ...SERIES.map((s) => {
                        const line = el("div", { class: "dash-tooltip-row" });
                        line.append(el("span", { class: "dash-swatch", style: `background:var(${s.cssVar})` }),
                            el("span", {}, s.label), el("strong", {}, fmt(r[s.key])));
                        return line;
                    })
                );
                tooltip.hidden = false;
                const left = Math.min(Math.max(m.left + band * i + band / 2 - tooltip.offsetWidth / 2, 0), width - tooltip.offsetWidth);
                tooltip.style.left = `${left}px`;
            });
            hit.addEventListener("mouseleave", () => {
                highlight.setAttribute("opacity", 0);
                tooltip.hidden = true;
            });
            svg.appendChild(hit);
        });

        host.prepend(svg);
        renderVisitsTable(rows);
    }

    function renderVisitsTable(rows) {
        const table = el("table", { class: "table table-sm mb-0" });
        const head = el("tr");
        ["Period", ...SERIES.map((s) => s.label)].forEach((h) => head.append(el("th", {}, h)));
        table.append(el("thead"));
        table.tHead.append(head);
        const body = el("tbody");
        rows.forEach((r) => {
            const tr = el("tr");
            tr.append(el("td", {}, periodLabel(r.period, true)), ...SERIES.map((s) => el("td", {}, fmt(r[s.key]))));
            body.append(tr);
        });
        table.append(body);
        document.getElementById("visitsTable").replaceChildren(table);
    }

    // ------------------------------------------------------ horizontal bar lists
    function renderBars(id, rows, { showPercent = false, empty = "No data yet" } = {}) {
        const host = document.getElementById(id);
        if (!rows.length) {
            host.replaceChildren(el("p", { class: "text-muted mb-0" }, empty));
            return;
        }
        const total = rows.reduce((sum, r) => sum + r.count, 0);
        const max = Math.max(...rows.map((r) => r.count));
        host.replaceChildren(...rows.map((r) => {
            const value = showPercent ? `${fmt(r.count)} · ${pct(r.count, total)}%` : fmt(r.count);
            const row = el("div", { class: "dash-bar-row", title: `${r.label}: ${value}` });
            const track = el("span", { class: "dash-bar-track" });
            track.append(el("span", { class: "dash-bar", style: `width:${(r.count / max) * 100}%` }));
            row.append(el("span", { class: "dash-bar-label" }, r.label), track, el("span", { class: "dash-bar-value" }, value));
            return row;
        }));
    }

    // ---------------------------------------------------- currently admitted list
    function renderAdmitted() {
        const body = document.getElementById("admittedRows");
        document.getElementById("admittedBadge").textContent = `${fmt(data.admitted.length)} admitted`;
        document.getElementById("dischargedBadge").textContent = `${fmt(data.dischargedThisMonth)} discharged this month`;

        if (!data.admitted.length) {
            const tr = el("tr");
            tr.append(el("td", { colspan: 7, class: "text-center text-muted" }, "No patients are admitted right now."));
            body.replaceChildren(tr);
            return;
        }
        body.replaceChildren(...data.admitted.map((a) => {
            const tr = el("tr");
            const open = el("a", { href: `/view-ipd-appointment/${a.id}`, class: "btn btn-sm btn-outline-primary" }, "Open");
            const bed = [a.room_type, a.room_no && `Room ${a.room_no}`, a.bed_no && `Bed ${a.bed_no}`].filter(Boolean).join(" · ");
            const days = Number(a.days_admitted);
            tr.append(
                el("td", {}, a.patient_name),
                el("td", {}, a.patient_id),
                el("td", {}, bed || "—"),
                el("td", {}, a.doctor_name || "—"),
                el("td", {}, a.admission_date),
                el("td", {}, `${fmt(days)} ${days === 1 ? "day" : "days"}`)
            );
            const action = el("td");
            action.append(open);
            tr.append(action);
            return tr;
        }));
    }

    // ------------------------------------------------------------------- wiring
    function renderAll() {
        renderStats();
        renderVisits();
        renderBars("genderBars", data.gender, { showPercent: true });
        renderBars("ageBars", data.ageGroups, { showPercent: true });
        renderBars("complaintBars", data.topComplaints, { empty: "No complaints recorded in the last 90 days." });
        renderBars("doctorBars", data.appointmentsByDoctor, { empty: "No appointments this month yet." });
        renderAdmitted();
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-range]").forEach((btn) =>
            btn.addEventListener("click", () => {
                range = btn.dataset.range;
                document.querySelectorAll("[data-range]").forEach((b) => b.classList.toggle("active", b === btn));
                if (data) renderVisits();
            })
        );

        let resizeTimer;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => data && renderVisits(), 150);
        });

        // Redraw when the sidebar's dark / high-contrast switches change the theme
        new MutationObserver(() => data && renderVisits())
            .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        fetch("/dashboard-data")
            .then((response) => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then((json) => {
                data = json;
                renderAll();
            })
            .catch((error) => {
                console.error("Error loading dashboard:", error);
                document.getElementById("dashboardError").hidden = false;
            });
    });
})();
