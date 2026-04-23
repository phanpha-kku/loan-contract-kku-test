import { useEffect, useState, useCallback } from "react";

const SHEET_ID = "1xRrc4f-kpH6l7bgBudNx4stskGMIL5Zz0Bv1bE-_3FQ";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=สัญญา`;

function fmtNum(n) {
  if (!n && n !== 0) return "-";
  return Number(n).toLocaleString("th-TH");
}

function fmtDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  return Math.round((due - today) / 86400000);
}

function getLoanStatus(row) {
  if (row.returned) return "done";
  const diff = daysDiff(row.dueDate);
  if (diff === null) return "ok";
  if (diff < 0) return "over";
  if (diff <= 7) return "wait";
  return "ok";
}

function getStatusLabel(s) {
  return { done:"หักล้างแล้ว", ok:"อนุมัติแล้ว", wait:"ใกล้ครบกำหนด", over:"เกินกำหนด" }[s] || "-";
}

const BADGE = {
  wait: { background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D" },
  ok:   { background:"#D1FAE5", color:"#065F46", border:"1px solid #6EE7B7" },
  done: { background:"#DBEAFE", color:"#1E40AF", border:"1px solid #93C5FD" },
  over: { background:"#FEE2E2", color:"#991B1B", border:"1px solid #FCA5A5" },
};

const MODAL_FORMS = {
  return: {
    title: "บันทึกการรับคืนเงินยืม",
    fields: [
      { label:"เลขที่สัญญา", key:"contractNo", type:"text" },
      { label:"จำนวนเงินที่รับคืน (บาท)", key:"returnAmount", type:"number" },
      { label:"วันที่รับคืน", key:"returnDate", type:"date" },
      { label:"หมายเหตุ", key:"note", type:"text" },
    ],
  },
  doc: {
    title: "ส่งเอกสารเบิกจ่ายหักล้างเงินยืม",
    fields: [
      { label:"เลขที่สัญญา", key:"contractNo", type:"text" },
      { label:"เลขที่เอกสารเบิกจ่าย", key:"docNo", type:"text" },
      { label:"ยอดเบิกจ่าย (บาท)", key:"docAmount", type:"number" },
      { label:"วันที่ส่งเอกสาร", key:"docDate", type:"date" },
    ],
  },
};

export default function AdminDashboard() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(SHEET_URL);
      const text = await res.text();
      const json = JSON.parse(text.replace(/^.*?({.*}).*$/s, "$1"));
      const rows = json.table.rows.map((r) => {
        const c = r.c;
        return {
          timestamp: c[0]?.v || "",
          contractNo: c[1]?.v || "",
          contractDate: c[2]?.v || "",
          borrower: c[3]?.v || "",
          position: c[4]?.v || "",
          dept: c[5]?.v || "",
          email: c[6]?.v || "",
          refDoc: c[7]?.v || "",
          project: c[8]?.v || "",
          startDate: c[9]?.v || "",
          endDate: c[10]?.v || "",
          dueDate: c[11]?.v || "",
          amount: c[12]?.v || 0,
          submitter: c[13]?.v || "",
          submitterEmail: c[14]?.v || "",
          returned: false,
        };
      });
      setLoans(rows);
    } catch { setError("ไม่สามารถดึงข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ"); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalAmount = loans.reduce((s,r) => s + (parseFloat(r.amount)||0), 0);
  const pending = loans.filter((r) => !r.returned && daysDiff(r.dueDate) !== null && daysDiff(r.dueDate) <= 7 && daysDiff(r.dueDate) >= 0);
  const overdue = loans.filter((r) => !r.returned && daysDiff(r.dueDate) !== null && daysDiff(r.dueDate) < 0);
  const outstanding = loans.filter((r) => !r.returned).reduce((s,r) => s + (parseFloat(r.amount)||0), 0);
  const filtered = loans.filter((r) =>
    !search || [r.borrower, r.contractNo, r.project, r.dept].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );
  const alerts = [...overdue, ...pending].slice(0, 6);

  function openModal(type, prefill={}) { setModal(type); setFormData(prefill); }
  function closeModal() { setModal(null); setFormData({}); }
  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false); closeModal();
      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 800);
  }

  const menuItems = [
    { key:"dashboard", label:"Dashboard",           icon:"▪" },
    { key:"list",      label:"รายการสัญญา",          icon:"≡" },
    { key:"return",    label:"รับคืนเงินยืม",        icon:"↩", action:() => openModal("return") },
    { key:"doc",       label:"ส่งเอกสารเบิกจ่าย",   icon:"📄", action:() => openModal("doc") },
    { key:"alert",     label:"การแจ้งเตือน",         icon:"⚠" },
    { key:"sheets",    label:"Google Sheets",        icon:"↗", action:() => window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`,"_blank") },
  ];

  const inputStyle = {
    width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 14px",
    fontSize:15, color:"#1f2937", background:"white", fontFamily:"inherit", boxSizing:"border-box",
  };

  const actionBtnStyle = {
    fontSize:13, padding:"6px 14px", borderRadius:8, border:"1.5px solid #e5e7eb",
    background:"white", cursor:"pointer", color:"#374151", fontFamily:"inherit",
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'Sarabun', sans-serif", background:"#F8F7F4" }}>

      {/* Sidebar */}
      <div style={{ width:240, background:"#7B1F1F", flexShrink:0, display:"flex", flexDirection:"column", minHeight:"100vh" }}>
        <div style={{ padding:"28px 20px 20px", borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontSize:18, fontWeight:700, color:"white" }}>ระบบยืมเงิน</div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", marginTop:5 }}>Admin · คณะเทคโนโลยี มข.</div>
        </div>
        <div style={{ padding:"14px 0", flex:1 }}>
          {menuItems.map((m) => (
            <div key={m.key}
              onClick={() => { if (m.action) m.action(); else setActiveMenu(m.key); }}
              style={{
                display:"flex", alignItems:"center", gap:12, padding:"13px 20px",
                color: activeMenu===m.key ? "white" : "rgba(255,255,255,0.65)",
                cursor:"pointer", fontSize:15,
                borderLeft: activeMenu===m.key ? "3px solid white" : "3px solid transparent",
                background: activeMenu===m.key ? "rgba(255,255,255,0.15)" : "transparent",
                transition:"background 0.15s",
              }}>
              <span style={{ fontSize:15 }}>{m.icon}</span>
              {m.label}
            </div>
          ))}
        </div>
        <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.1)", fontSize:14, color:"rgba(255,255,255,0.4)", cursor:"pointer" }}>
          ออกจากระบบ
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, padding:"36px 40px", overflow:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
          <div>
            <div style={{ fontSize:26, fontWeight:700, color:"#111827" }}>Dashboard</div>
            <div style={{ fontSize:15, color:"#9ca3af", marginTop:5 }}>ระบบสัญญายืมเงิน คณะเทคโนโลยี มข.</div>
          </div>
          <button onClick={fetchData}
            style={{ border:"1.5px solid #e5e7eb", borderRadius:12, padding:"11px 22px", fontSize:15, cursor:"pointer", fontWeight:500, fontFamily:"inherit", background:"white", color:"#374151" }}>
            ↻ ซิงค์ข้อมูล
          </button>
        </div>

        {successMsg && (
          <div style={{ background:"#D1FAE5", border:"1px solid #6EE7B7", borderRadius:14, padding:"14px 20px", marginBottom:22, fontSize:15, color:"#065F46" }}>
            ✓ {successMsg}
          </div>
        )}
        {error && (
          <div style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:14, padding:"14px 20px", marginBottom:22, fontSize:15, color:"#991B1B" }}>
            {error}
          </div>
        )}
        {loading && (
          <div style={{ textAlign:"center", padding:80, color:"#9ca3af", fontSize:17 }}>กำลังโหลดข้อมูล...</div>
        )}

        {!loading && !error && (
          <>
            {/* Stat cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:18, marginBottom:26 }}>
              {[
                { icon:"📄", label:"สัญญาทั้งหมด",     val:loans.length,             sub:"ทุกสถานะ",      color:"#7B1F1F" },
                { icon:"💰", label:"ยอดค้างเงินยืม",    val:`${fmtNum(outstanding)} ฿`, sub:"ยังไม่ได้คืน", color:"#991B1B" },
                { icon:"⏰", label:"ใกล้/เกินกำหนด",   val:pending.length+overdue.length, sub:"รายการ",    color:"#92400E" },
                { icon:"📊", label:"ยอดเงินรวมทั้งหมด", val:`${fmtNum(totalAmount)} ฿`, sub:"บาท",         color:"#065F46" },
              ].map((s,i) => (
                <div key={i} style={{ background:"white", borderRadius:18, padding:"22px 24px", border:"1px solid #f0f0f0" }}>
                  <div style={{ fontSize:26, marginBottom:12 }}>{s.icon}</div>
                  <div style={{ fontSize:14, color:"#9ca3af", marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1.2 }}>{s.val}</div>
                  <div style={{ fontSize:13, color:"#d1d5db", marginTop:5 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:18, padding:"20px 24px", marginBottom:26 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"#92400E", marginBottom:14 }}>⚠ แจ้งเตือน — ใกล้/เกินกำหนดคืนเงิน</div>
                {alerts.map((r,i) => {
                  const diff = daysDiff(r.dueDate);
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom: i<alerts.length-1 ? "1px solid rgba(252,211,77,0.35)" : "none" }}>
                      <div>
                        <span style={{ fontSize:15, fontWeight:700, color:"#78350F" }}>{r.contractNo}</span>
                        <span style={{ fontSize:15, color:"#92400E", marginLeft:10 }}>{r.borrower} · {r.project}</span>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color: diff<0 ? "#991B1B":"#92400E", flexShrink:0, marginLeft:16, background: diff<0 ? "#FEE2E2":"#FEF3C7", padding:"5px 14px", borderRadius:20 }}>
                        {diff<0 ? `เกินกำหนด ${Math.abs(diff)} วัน` : `อีก ${diff} วัน`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table */}
            <div style={{ background:"white", borderRadius:18, padding:"24px 26px", border:"1px solid #f0f0f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#111827" }}>
                  รายการสัญญาทั้งหมด
                  <span style={{ fontSize:15, fontWeight:400, color:"#9ca3af", marginLeft:10 }}>({filtered.length} รายการ)</span>
                </div>
                <input
                  placeholder="ค้นหาชื่อ / เลขที่ / โครงการ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...inputStyle, width:260, padding:"9px 16px", fontSize:14 }}
                />
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"2px solid #f3f4f6" }}>
                      {["เลขที่สัญญา","ผู้ยืม","สังกัด","โครงการ","จำนวนเงิน","วันครบกำหนด","สถานะ","จัดการ"].map((h) => (
                        <th key={h} style={{ textAlign:"left", color:"#9ca3af", fontWeight:600, padding:"10px 14px", fontSize:14, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} style={{ padding:40, textAlign:"center", color:"#d1d5db", fontSize:16 }}>ไม่พบข้อมูล</td></tr>
                    )}
                    {filtered.map((r,i) => {
                      const status = getLoanStatus(r);
                      return (
                        <tr key={i}
                          onMouseEnter={(e) => e.currentTarget.style.background="#fafafa"}
                          onMouseLeave={(e) => e.currentTarget.style.background="white"}
                          style={{ borderBottom:"1px solid #f9fafb", transition:"background 0.1s" }}>
                          <td style={{ padding:"14px", fontSize:14, fontWeight:700, color:"#374151", whiteSpace:"nowrap" }}>{r.contractNo||"-"}</td>
                          <td style={{ padding:"14px", fontSize:15, color:"#111827", whiteSpace:"nowrap" }}>{r.borrower||"-"}</td>
                          <td style={{ padding:"14px", fontSize:13, color:"#9ca3af" }}>{r.dept||"-"}</td>
                          <td style={{ padding:"14px", fontSize:14, color:"#374151", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.project||"-"}</td>
                          <td style={{ padding:"14px", fontSize:15, fontWeight:700, textAlign:"right", whiteSpace:"nowrap", color:"#111827" }}>{fmtNum(r.amount)}</td>
                          <td style={{ padding:"14px", fontSize:14, color:"#374151", whiteSpace:"nowrap" }}>{fmtDate(r.dueDate)}</td>
                          <td style={{ padding:"14px" }}>
                            <span style={{ ...BADGE[status], display:"inline-block", fontSize:13, padding:"5px 14px", borderRadius:20, fontWeight:600 }}>
                              {getStatusLabel(status)}
                            </span>
                          </td>
                          <td style={{ padding:"14px", whiteSpace:"nowrap" }}>
                            <button onClick={() => openModal("return",{contractNo:r.contractNo})} style={{ ...actionBtnStyle, marginRight:8 }}>
                              ↩ รับคืน
                            </button>
                            <button onClick={() => openModal("doc",{contractNo:r.contractNo})} style={actionBtnStyle}>
                              📄 เบิกจ่าย
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div onClick={(e) => { if(e.target===e.currentTarget) closeModal(); }}
          style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:22, padding:32, width:420, maxWidth:"90vw", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ fontSize:20, fontWeight:700, color:"#111827", marginBottom:22 }}>{MODAL_FORMS[modal].title}</div>
            {MODAL_FORMS[modal].fields.map((f) => (
              <div key={f.key} style={{ marginBottom:16 }}>
                <label style={{ fontSize:14, color:"#6b7280", marginBottom:7, display:"block" }}>{f.label}</label>
                <input type={f.type} value={formData[f.key]||""}
                  onChange={(e) => setFormData({...formData,[f.key]:e.target.value})}
                  style={inputStyle} />
              </div>
            ))}
            <div style={{ display:"flex", gap:12, marginTop:24, justifyContent:"flex-end" }}>
              <button onClick={closeModal}
                style={{ border:"1.5px solid #e5e7eb", borderRadius:12, padding:"11px 22px", fontSize:15, cursor:"pointer", fontFamily:"inherit", background:"white", color:"#374151" }}>
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ border:"none", borderRadius:12, padding:"11px 28px", fontSize:15, cursor:"pointer", fontFamily:"inherit", background:"#7B1F1F", color:"white", fontWeight:700 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
