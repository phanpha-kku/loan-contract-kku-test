import { useEffect, useState, useCallback } from "react";

const SHEET_ID   = "1xRrc4f-kpH6l7bgBudNx4stskGMIL5Zz0Bv1bE-_3FQ";
const SHEET_URL  = (sheet) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;
const GAS_NOTIFY = "https://script.google.com/macros/s/AKfycbwk9rrJhgW-XhzujBKQfrhti8es0Oz6yzO5FzTPanqi58ZoMNm14E0D793DbgZ71abY/exec";
const GAS_MAIN   = "https://script.google.com/macros/s/AKfycbxkJyzKI205FmLSjVQQlEksPi1InQTN1Hr0VxFDrGKiW9yk0TRK3yNT3B5q28wdFxb9ug/exec";

function fmtNum(n) {
  if (!n && n !== 0) return "-";
  return Number(n).toLocaleString("th-TH");
}
function parseSheetDate(v) {
  if (!v) return null;
  const m = String(v).match(/Date\((\d+),(\d+),(\d+)\)/);
  if (m) return new Date(+m[1], +m[2], +m[3]);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
function fmtDate(v) {
  const d = parseSheetDate(v);
  if (!d) return "-";
  return d.toLocaleDateString("th-TH", { day:"2-digit", month:"2-digit", year:"numeric" });
}
function daysDiff(v) {
  const d = parseSheetDate(v);
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function getLoanStatus(row) {
  const remaining = (parseFloat(row.amount)||0) - (parseFloat(row.returnAmount)||0) - (parseFloat(row.docAmount)||0);
  if (remaining <= 0) return "closed";
  const diff = daysDiff(row.dueDate);
  if (diff === null) return "ok";
  if (diff < 0) return "over";
  if (diff <= 7) return "wait";
  return "ok";
}
function getStatusLabel(s) {
  return { closed:"ปิดสัญญา", done:"หักล้างแล้ว", ok:"อนุมัติแล้ว", wait:"ใกล้ครบกำหนด", over:"เกินกำหนด" }[s] || "-";
}
const BADGE = {
  wait:   { background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D" },
  ok:     { background:"#D1FAE5", color:"#065F46", border:"1px solid #6EE7B7" },
  done:   { background:"#DBEAFE", color:"#1E40AF", border:"1px solid #93C5FD" },
  over:   { background:"#FEE2E2", color:"#991B1B", border:"1px solid #FCA5A5" },
  closed: { background:"#F3F4F6", color:"#374151", border:"1px solid #D1D5DB" },
};
const MODAL_FORMS = {
  return: {
    title:"บันทึกการรับคืนเงินยืม", action:"returnMoney",
    fields:[
      { label:"เลขที่สัญญา", key:"contractNo", type:"text" },
      { label:"จำนวนเงินที่รับคืน (บาท)", key:"returnAmount", type:"number" },
      { label:"วันที่รับคืน", key:"returnDate", type:"date" },
      { label:"เลขที่เอกสารอ้างอิง", key:"refDocNo", type:"text" },
      { label:"หมายเหตุ", key:"note", type:"text" },
    ],
  },
  doc: {
    title:"ส่งเอกสารเบิกจ่ายหักล้างเงินยืม", action:"docPayment",
    fields:[
      { label:"เลขที่สัญญา", key:"contractNo", type:"text" },
      { label:"เลขที่เอกสารเบิกจ่าย", key:"docNo", type:"text" },
      { label:"ยอดเบิกจ่าย (บาท)", key:"docAmount", type:"number" },
      { label:"วันที่ส่งเอกสาร", key:"docDate", type:"date" },
    ],
  },
};

async function fetchSheet(sheetName) {
  try {
    const res  = await fetch(SHEET_URL(sheetName));
    const text = await res.text();
    const json = JSON.parse(text.replace(/^.*?({.*}).*$/s, "$1"));
    return json.table?.rows || [];
  } catch { return []; }
}

async function sendToGAS(params) {
  return new Promise((resolve) => {
    const cbName = `_cb_${Date.now()}`;
    window[cbName] = (data) => { delete window[cbName]; resolve(data); };
    const qs = new URLSearchParams({ ...params, callback: cbName });
    const script = document.createElement("script");
    script.src = `${GAS_MAIN}?${qs.toString()}`;
    script.onerror = () => { delete window[cbName]; resolve({ success: false }); };
    document.head.appendChild(script);
    setTimeout(() => resolve({ success: false }), 10000);
  });
}

export default function AdminDashboard() {
  const [loans, setLoans]               = useState([]);
  const [lateStats, setLateStats]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState("");
  const [lateSearch, setLateSearch]     = useState("");
  const [modal, setModal]               = useState(null);
  const [formData, setFormData]         = useState({});
  const [activeMenu, setActiveMenu]     = useState("dashboard");
  const [saving, setSaving]             = useState(false);
  const [successMsg, setSuccessMsg]     = useState("");
  const [sending, setSending]           = useState({});
  const [selectedLoan, setSelectedLoan] = useState(null);
const [filterStatus, setFilterStatus] = useState("all");
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rows = await fetchSheet("สัญญา");
      const loanList = rows.map((r) => {
        const c = r.c;
        return {
          timestamp:      c[0]?.v  || "",
          contractNo:     String(c[1]?.v  || ""),
          contractDate:   c[2]?.v  || "",
          borrower:       c[3]?.v  || "",
          position:       c[4]?.v  || "",
          dept:           c[5]?.v  || "",
          email:          c[6]?.v  || "",
          refDoc:         c[7]?.v  || "",
          project:        c[8]?.v  || "",
          startDate:      c[9]?.v  || "",
          endDate:        c[10]?.v || "",
          dueDate:        c[11]?.v || "",
          amount:         c[12]?.v || 0,
          submitter:      c[13]?.v || "",
          submitterEmail: c[14]?.v || "",
          returnAmount:   0,
          docAmount:      0,
          returnHistory:  [],
          docHistory:     [],
        };
      });

      const returnRows = await fetchSheet("การคืนเงิน");
      const returnList = returnRows.map((r) => ({
        contractNo: String(r.c[1]?.v || ""),
        amount:     parseFloat(r.c[2]?.v) || 0,
        date:       r.c[3]?.v || "",
        note:       r.c[4]?.v || "",
        refDocNo:   r.c[5]?.v || "",
        recordedAt: r.c[0]?.v || "",
      }));

      const docRows = await fetchSheet("เอกสารเบิกจ่าย");
      const docList = docRows.map((r) => ({
        contractNo: String(r.c[1]?.v || ""),
        docNo:      r.c[2]?.v || "",
        amount:     parseFloat(r.c[3]?.v) || 0,
        date:       r.c[4]?.v || "",
        recordedAt: r.c[0]?.v || "",
      }));

      const merged = loanList.map((loan) => {
        const ret = returnList.filter((r) => r.contractNo === loan.contractNo);
        const doc = docList.filter((d) => d.contractNo === loan.contractNo);
        return {
          ...loan,
          returnAmount:  ret.reduce((s, r) => s + r.amount, 0),
          docAmount:     doc.reduce((s, d) => s + d.amount, 0),
          returnHistory: ret,
          docHistory:    doc,
        };
      });
      setLoans(merged);

     // ดึง Sheet สถิติการคืนช้า
      const lateRows = await fetchSheet("สถิติการคืนช้า");
      const lateList = lateRows.map((r) => ({
        recordedAt:  r.c[0]?.v || "",
        contractNo:  String(r.c[1]?.v || ""),
        borrower:    r.c[2]?.v || "",
        dept:        r.c[3]?.v || "",
        project:     r.c[4]?.v || "",
        amount:      r.c[5]?.v || 0,
        dueDate:     (() => { const v = r.c[6]?.v; if (!v) return "-"; const m = String(v).match(/Date\((\d+),(\d+),(\d+)\)/); if (m) { return `${String(+m[3]).padStart(2,"0")}/${String(+m[2]+1).padStart(2,"0")}/${+m[1]+543}`; } return String(v); })(),
closedDate:  (() => { const v = r.c[7]?.v; if (!v) return "-"; const m = String(v).match(/Date\((\d+),(\d+),(\d+)\)/); if (m) { return `${String(+m[3]).padStart(2,"0")}/${String(+m[2]+1).padStart(2,"0")}/${+m[1]+543}`; } return String(v); })(),
        lateDays:    r.c[8]?.v || 0,
        email:       r.c[9]?.v || "",
      }));
      setLateStats(lateList);

    } catch { setError("ไม่สามารถดึงข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ"); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalAmount = loans.reduce((s,r) => s + (parseFloat(r.amount)||0), 0);
  const pending     = loans.filter((r) => { const d = daysDiff(r.dueDate); return d !== null && d >= 0 && d <= 7 && getLoanStatus(r) !== "closed"; });
  const overdue     = loans.filter((r) => { const d = daysDiff(r.dueDate); return d !== null && d < 0 && getLoanStatus(r) !== "closed"; });
  const outstanding = loans.filter((r) => getLoanStatus(r) !== "closed").reduce((s,r) => s + ((parseFloat(r.amount)||0) - (parseFloat(r.returnAmount)||0) - (parseFloat(r.docAmount)||0)), 0);
  const alerts      = [...overdue, ...pending].slice(0, 6);

 const filtered = loans
  .slice()
  .reverse()
  .filter((r) => {
    if (filterStatus !== "all" && getLoanStatus(r) !== filterStatus) return false;
    return !search || [r.borrower, r.contractNo, r.project, r.dept]
      .some((v) => v?.toLowerCase().includes(search.toLowerCase()));
  });

  const filteredLate = lateStats.filter((r) =>
    !lateSearch || [r.borrower, r.contractNo, r.project, r.dept]
      .some((v) => v?.toLowerCase().includes(lateSearch.toLowerCase()))
  );

  async function sendAlert(r) {
    const remaining = (parseFloat(r.amount)||0) - (parseFloat(r.returnAmount)||0) - (parseFloat(r.docAmount)||0);
    setSending((prev) => ({ ...prev, [r.contractNo]: true }));
    try {
      const params = new URLSearchParams({
        action:"notify", email:r.email, borrower:r.borrower,
        contractNo:r.contractNo, project:r.project,
        dueDate:fmtDate(r.dueDate), remaining:fmtNum(remaining),
      });
      await new Promise((resolve) => {
        const cbName = `_cb_${Date.now()}`;
        window[cbName] = () => { delete window[cbName]; resolve(); };
        const script = document.createElement("script");
        script.src = `${GAS_NOTIFY}?${params.toString()}&callback=${cbName}`;
        script.onerror = () => { delete window[cbName]; resolve(); };
        document.head.appendChild(script);
        setTimeout(resolve, 8000);
      });
      setSuccessMsg(`ส่งแจ้งเตือนถึง ${r.borrower} แล้ว`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch { alert("ส่ง email ไม่สำเร็จ กรุณาลองใหม่"); }
    setSending((prev) => ({ ...prev, [r.contractNo]: false }));
  }

  function openModal(type, prefill={}) { setModal(type); setFormData(prefill); }
  function closeModal() { setModal(null); setFormData({}); }

  async function handleSave() {
    setSaving(true);
    try {
      const form = MODAL_FORMS[modal];
      const result = await sendToGAS({ action: form.action, ...formData });
      if (result.success !== false) {
        setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
        setTimeout(() => setSuccessMsg(""), 3000);
        closeModal();
        setTimeout(() => fetchData(), 1500);
      } else {
        alert("บันทึกไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setSaving(false);
  }

  const menuItems = [
    { key:"dashboard", label:"Dashboard",         icon:"▪" },
    { key:"stats",     label:"สถิติการคืนช้า",    icon:"📉" },
    { key:"return",    label:"รับคืนเงินยืม",      icon:"↩", action:() => openModal("return") },
    { key:"doc",       label:"ส่งเอกสารเบิกจ่าย", icon:"📄", action:() => openModal("doc") },
    { key:"sheets",    label:"Google Sheets",      icon:"↗", action:() => window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`,"_blank") },
  ];

  const inputStyle = {
    width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 14px",
    fontSize:16, color:"#1f2937", background:"white", fontFamily:"inherit", boxSizing:"border-box",
  };
  const actionBtnStyle = {
    fontSize:13, padding:"6px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
    background:"white", cursor:"pointer", color:"#374151", fontFamily:"inherit",
  };

  const DetailPanel = ({ r, onClose }) => {
    const principal = parseFloat(r.amount) || 0;
    const ret       = parseFloat(r.returnAmount) || 0;
    const doc       = parseFloat(r.docAmount) || 0;
    const remaining = principal - ret - doc;
    const status    = getLoanStatus(r);
    return (
      <div style={{ width:320, flexShrink:0, background:"white", borderLeft:"1px solid #f0f0f0", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:"#111827" }}>สัญญา {r.contractNo}</div>
            <div style={{ fontSize:14, color:"#9ca3af", marginTop:3 }}>{r.borrower}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9ca3af" }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"18px 20px" }}>
          <div style={{ background:remaining<=0?"#F0FDF4":"#FEF2F2", borderRadius:14, padding:"16px 18px", marginBottom:18 }}>
            <div style={{ fontSize:13, color:remaining<=0?"#065F46":"#991B1B", marginBottom:6 }}>ยอดคงเหลือ</div>
            <div style={{ fontSize:28, fontWeight:700, color:remaining<=0?"#065F46":"#7B1F1F" }}>
              {remaining<=0?"0":fmtNum(remaining)} บาท
            </div>
            <div style={{ marginTop:10 }}>
              <span style={{ ...BADGE[status], fontSize:12, padding:"4px 12px", borderRadius:20, fontWeight:600 }}>
                {getStatusLabel(status)}
              </span>
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", letterSpacing:0.5, marginBottom:10 }}>สรุปยอดเงิน</div>
          {[
            { label:"เงินต้น",     val:fmtNum(principal)+" บาท", color:"#111827" },
            { label:"ยอดคืนเงิน",  val:ret>0?fmtNum(ret)+" บาท":"-", color:ret>0?"#065F46":"#9ca3af" },
            { label:"ยอดเบิกจ่าย", val:doc>0?fmtNum(doc)+" บาท":"-", color:doc>0?"#1E40AF":"#9ca3af" },
            { label:"ยอดคงเหลือ",  val:(remaining<=0?"0":fmtNum(remaining))+" บาท", color:remaining<=0?"#065F46":"#991B1B" },
          ].map((item,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f9fafb", fontSize:14 }}>
              <span style={{ color:"#6b7280" }}>{item.label}</span>
              <span style={{ color:item.color, fontWeight:600 }}>{item.val}</span>
            </div>
          ))}
          {r.returnHistory && r.returnHistory.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", letterSpacing:0.5, marginBottom:10, marginTop:20 }}>ประวัติการรับคืนเงิน</div>
              {r.returnHistory.map((h,i) => (
                <div key={i} style={{ background:"#F0FDF4", borderRadius:10, padding:"10px 14px", marginBottom:8, fontSize:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#065F46", fontWeight:600 }}>+{fmtNum(h.amount)} บาท</span>
                    <span style={{ color:"#9ca3af", fontSize:12 }}>{h.date}</span>
                  </div>
                  {h.refDocNo && h.refDocNo !== "-" && <div style={{ color:"#6b7280", fontSize:12, marginTop:4 }}>เลขที่เอกสาร: {h.refDocNo}</div>}
                  {h.note && h.note !== "-" && <div style={{ color:"#6b7280", fontSize:12, marginTop:2 }}>{h.note}</div>}
                </div>
              ))}
            </>
          )}
          {r.docHistory && r.docHistory.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", letterSpacing:0.5, marginBottom:10, marginTop:20 }}>ประวัติเอกสารเบิกจ่าย</div>
              {r.docHistory.map((h,i) => (
                <div key={i} style={{ background:"#EFF6FF", borderRadius:10, padding:"10px 14px", marginBottom:8, fontSize:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#1E40AF", fontWeight:600 }}>+{fmtNum(h.amount)} บาท</span>
                    <span style={{ color:"#9ca3af", fontSize:12 }}>{h.date}</span>
                  </div>
                  {h.docNo && <div style={{ color:"#6b7280", fontSize:12, marginTop:4 }}>เลขที่: {h.docNo}</div>}
                </div>
              ))}
            </>
          )}
          <div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", letterSpacing:0.5, marginBottom:10, marginTop:20 }}>ข้อมูลผู้ยืม</div>
          {[
            { label:"ชื่อ", val:r.borrower },
            { label:"ตำแหน่ง", val:r.position||"-" },
            { label:"สังกัด", val:r.dept||"-" },
            { label:"อีเมล", val:r.email||"-" },
          ].map((item,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f9fafb", fontSize:14 }}>
              <span style={{ color:"#9ca3af", flexShrink:0 }}>{item.label}</span>
              <span style={{ color:"#111827", fontWeight:500, textAlign:"right", marginLeft:8, wordBreak:"break-word", maxWidth:180 }}>{item.val}</span>
            </div>
          ))}
          <div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", letterSpacing:0.5, marginBottom:10, marginTop:20 }}>โครงการ</div>
          {[
            { label:"กิจกรรม", val:r.project||"-" },
            { label:"วันจัดกิจกรรม", val:fmtDate(r.startDate) },
            { label:"วันสิ้นสุด", val:fmtDate(r.endDate) },
            { label:"วันครบกำหนด", val:fmtDate(r.dueDate) },
          ].map((item,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f9fafb", fontSize:14 }}>
              <span style={{ color:"#9ca3af", flexShrink:0 }}>{item.label}</span>
              <span style={{ color:"#111827", fontWeight:500, textAlign:"right", marginLeft:8, wordBreak:"break-word", maxWidth:180 }}>{item.val}</span>
            </div>
          ))}
          <div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", letterSpacing:0.5, marginBottom:12, marginTop:20 }}>ความเคลื่อนไหว</div>
          {[
            { text:"สร้างสัญญา", date:fmtDate(r.contractDate), done:true },
            { text:"อนุมัติสัญญา", date:fmtDate(r.contractDate), done:true },
            ...(r.returnHistory||[]).map(h => ({ text:`รับคืนเงิน ${fmtNum(h.amount)} บาท`, date:h.date, done:true })),
            ...(r.docHistory||[]).map(h => ({ text:`เบิกจ่าย ${fmtNum(h.amount)} บาท`, date:h.date, done:true })),
            remaining<=0
              ? { text:"ปิดสัญญาแล้ว", date:"-", done:true }
              : { text:`รอคืนเงิน ${fmtNum(remaining)} บาท`, date:fmtDate(r.dueDate), done:false },
          ].map((t,i) => (
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:t.done?"#7B1F1F":"#e5e7eb", flexShrink:0, marginTop:3 }}></div>
              <div>
                <div style={{ fontSize:14, color:"#374151" }}>{t.text}</div>
                <div style={{ fontSize:12, color:"#9ca3af" }}>{t.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'IBM Plex Sans Thai','Sarabun',sans-serif", background:"#F8F7F4" }}>
      {/* Sidebar */}
      <div style={{ width:230, background:"#e8aa97", flexShrink:0, display:"flex", flexDirection:"column", minHeight:"100vh", position:"sticky", top:0, height:"100vh", overflowY:"auto" }}>
        <div style={{ padding:"22px 16px 16px", borderBottom:"1px solid rgba(255,255,255,0.12)", display:"flex", flexDirection:"column", alignItems:"center" }}>
          <img src="logo.png" alt="TE KKU"
            style={{ width:"100%", maxWidth:120, display:"block" }}
            onError={(e) => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }}
          />
          <div style={{ display:"none", fontSize:20, fontWeight:700, color:"white" }}>TE KKU</div>
          <div style={{ fontSize:14, color:"#333", marginTop:8 }}>Admin · ระบบยืมเงิน</div>
        </div>
        <div style={{ padding:"14px 0", flex:1 }}>
          {menuItems.map((m) => (
            <div key={m.key}
              onClick={() => { if (m.action) m.action(); else setActiveMenu(m.key); }}
              style={{
                display:"flex", alignItems:"center", gap:12, padding:"14px 20px",
                color: activeMenu===m.key ? "white" : "#1a1a1a",
                cursor:"pointer", fontSize:16,
                borderLeft:activeMenu===m.key?"3px solid white":"3px solid transparent",
                background:activeMenu===m.key?"rgba(255,255,255,0.15)":"transparent",
                transition:"background 0.15s",
              }}>
              <span style={{ fontSize:16 }}>{m.icon}</span>{m.label}
            </div>
          ))}
        </div>
        <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.1)", fontSize:15, color:"#333", cursor:"pointer" }}>
          ออกจากระบบ
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, padding:"32px 36px", overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
          <div>
            <div style={{ fontSize:28, fontWeight:700, color:"#111827" }}>
              {activeMenu === "stats" ? "สถิติการคืนเงินช้า" : "Dashboard"}
            </div>
            <div style={{ fontSize:16, color:"#9ca3af", marginTop:5 }}>ระบบสัญญายืมเงิน คณะเทคโนโลยี มข.</div>
          </div>
          <button onClick={fetchData}
            style={{ border:"1.5px solid #e5e7eb", borderRadius:12, padding:"12px 24px", fontSize:16, cursor:"pointer", fontWeight:500, fontFamily:"inherit", background:"white", color:"#374151" }}>
            ↻ ซิงค์ข้อมูล
          </button>
        </div>

        {successMsg && <div style={{ background:"#D1FAE5", border:"1px solid #6EE7B7", borderRadius:14, padding:"14px 20px", marginBottom:22, fontSize:16, color:"#065F46" }}>✓ {successMsg}</div>}
        {error && <div style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:14, padding:"14px 20px", marginBottom:22, fontSize:16, color:"#991B1B" }}>{error}</div>}
        {loading && <div style={{ textAlign:"center", padding:80, color:"#9ca3af", fontSize:18 }}>กำลังโหลดข้อมูล...</div>}

        {/* หน้าสถิติการคืนช้า */}
        {!loading && !error && activeMenu === "stats" && (
          <div style={{ background:"white", borderRadius:18, padding:"24px 26px", border:"1px solid #f0f0f0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:"#111827" }}>รายชื่อผู้ยืมที่เกินกำหนดคืนเงิน</div>
                <div style={{ fontSize:14, color:"#9ca3af", marginTop:4 }}>นับจากวันครบกำหนดถึงวันที่ปิดสัญญาจริง</div>
              </div>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
    style={{ border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 14px", fontSize:15, fontFamily:"inherit", background:"white", color:"#374151", cursor:"pointer" }}>
    <option value="all">ทุกสถานะ</option>
    <option value="ok">อนุมัติแล้ว</option>
    <option value="wait">ใกล้ครบกำหนด</option>
    <option value="over">เกินกำหนด</option>
    <option value="closed">ปิดสัญญา</option>
  </select>
  <input placeholder="🔍 ค้นหาชื่อผู้ยืม / เลขที่สัญญา..."
    value={search} onChange={(e) => setSearch(e.target.value)}
    style={{ ...inputStyle, width:280, padding:"10px 16px", fontSize:15 }} />
</div>
                <div style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:12, padding:"10px 20px", fontSize:15, fontWeight:700, color:"#991B1B", whiteSpace:"nowrap" }}>
                  ทั้งหมด {filteredLate.length} ราย
                </div>
              </div>
            </div>
            {filteredLate.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:"#d1d5db", fontSize:16 }}>ยังไม่มีข้อมูลการคืนช้า 🎉</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr>
                      {["เลขที่สัญญา","ชื่อผู้ยืม","สังกัด","โครงการ","จำนวนเงิน (฿)","วันครบกำหนด","วันที่ปิดสัญญา","เกินกำหนด (วัน)"].map((h,i) => (
                        <th key={i} style={{ textAlign:i>=4&&i<=7?"right":"left", color:"#9ca3af", fontWeight:600, padding:"11px 12px", fontSize:14, whiteSpace:"nowrap", borderBottom:"2px solid #f3f4f6" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLate.map((r,i) => (
                      <tr key={i}
                        onMouseEnter={(e) => e.currentTarget.style.background="#fafafa"}
                        onMouseLeave={(e) => e.currentTarget.style.background="white"}
                        style={{ borderBottom:"1px solid #f9fafb", transition:"background 0.1s" }}>
                        <td style={{ padding:"13px 12px", fontSize:15, fontWeight:700, color:"#374151", whiteSpace:"nowrap" }}>{r.contractNo||"-"}</td>
                        <td style={{ padding:"13px 12px", fontSize:15, color:"#111827", whiteSpace:"nowrap" }}>{r.borrower||"-"}</td>
                        <td style={{ padding:"13px 12px", fontSize:13, color:"#9ca3af" }}>{r.dept||"-"}</td>
                        <td style={{ padding:"13px 12px", fontSize:14, color:"#374151", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.project||"-"}</td>
                        <td style={{ padding:"13px 12px", fontSize:15, fontWeight:700, textAlign:"right", color:"#991B1B" }}>{fmtNum(r.amount)}</td>
                        <td style={{ padding:"13px 12px", fontSize:14, color:"#374151", textAlign:"right", whiteSpace:"nowrap" }}>{r.dueDate||"-"}</td>
                        <td style={{ padding:"13px 12px", fontSize:14, color:"#374151", textAlign:"right", whiteSpace:"nowrap" }}>{r.closedDate||"-"}</td>
                        <td style={{ padding:"13px 12px", textAlign:"right" }}>
                          <span style={{ background:"#FEE2E2", color:"#991B1B", border:"1px solid #FCA5A5", fontSize:13, padding:"4px 12px", borderRadius:20, fontWeight:700 }}>
                            {r.lateDays} วัน
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* หน้า Dashboard */}
        {!loading && !error && activeMenu === "dashboard" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:18, marginBottom:26 }}>
              {[
                { icon:"📄", label:"สัญญาทั้งหมด",      val:loans.length,                            sub:"ทุกสถานะ",     color:"#7B1F1F" },
                { icon:"💰", label:"ยอดค้างเงินยืม",     val:`${fmtNum(Math.max(0,outstanding))} ฿`, sub:"ยังไม่ได้คืน", color:"#991B1B" },
                { icon:"⏰", label:"ใกล้/เกินกำหนด",    val:pending.length+overdue.length,           sub:"รายการ",       color:"#92400E" },
                { icon:"📊", label:"ยอดเงินรวมทั้งหมด",  val:`${fmtNum(totalAmount)} ฿`,             sub:"บาท",          color:"#065F46" },
              ].map((s,i) => (
                <div key={i} style={{ background:"white", borderRadius:18, padding:"24px 26px", border:"1px solid #f0f0f0" }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{s.icon}</div>
                  <div style={{ fontSize:15, color:"#9ca3af", marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1.2 }}>{s.val}</div>
                  <div style={{ fontSize:14, color:"#d1d5db", marginTop:5 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {alerts.length > 0 && (
              <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:18, padding:"20px 24px", marginBottom:26 }}>
                <div style={{ fontSize:17, fontWeight:700, color:"#92400E", marginBottom:14 }}>⚠ แจ้งเตือน — ใกล้/เกินกำหนดคืนเงิน</div>
                {alerts.map((r,i) => {
                  const diff = daysDiff(r.dueDate);
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:i<alerts.length-1?"1px solid rgba(252,211,77,0.35)":"none" }}>
                      <div>
                        <span style={{ fontSize:16, fontWeight:700, color:"#78350F" }}>{r.contractNo}</span>
                        <span style={{ fontSize:15, color:"#92400E", marginLeft:10 }}>{r.borrower} · {r.project}</span>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:diff<0?"#991B1B":"#92400E", flexShrink:0, marginLeft:16, background:diff<0?"#FEE2E2":"#FEF3C7", padding:"6px 16px", borderRadius:20 }}>
                        {diff<0?`เกินกำหนด ${Math.abs(diff)} วัน`:`อีก ${diff} วัน`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display:"flex", gap:0, background:"white", borderRadius:18, border:"1px solid #f0f0f0", overflow:"hidden" }}>
              <div style={{ flex:1, overflow:"auto", padding:"24px 26px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                  <div style={{ fontSize:19, fontWeight:700, color:"#111827" }}>
                    รายการสัญญาทั้งหมด
                    <span style={{ fontSize:16, fontWeight:400, color:"#9ca3af", marginLeft:10 }}>({filtered.length} รายการ)</span>
                  </div>
                  <input
                    placeholder="🔍 ค้นหาชื่อผู้ยืม / เลขที่สัญญา..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ ...inputStyle, width:280, padding:"10px 16px", fontSize:15 }}
                  />
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        {["เลขที่สัญญา","ผู้ยืม","โครงการ","เงินต้น (฿)","ยอดคงเหลือ (฿)","วันครบกำหนด","สถานะ","จัดการ"].map((h,i) => (
                          <th key={i} style={{ textAlign:i>=3&&i<=4?"right":"left", color:"#9ca3af", fontWeight:600, padding:"11px 12px", fontSize:14, whiteSpace:"nowrap", borderBottom:"2px solid #f3f4f6" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && <tr><td colSpan={8} style={{ padding:40, textAlign:"center", color:"#d1d5db", fontSize:17 }}>ไม่พบข้อมูล</td></tr>}
                      {filtered.map((r,i) => {
                        const status    = getLoanStatus(r);
                        const principal = parseFloat(r.amount) || 0;
                        const ret       = parseFloat(r.returnAmount) || 0;
                        const doc       = parseFloat(r.docAmount) || 0;
                        const remaining = principal - ret - doc;
                        const isSelected = selectedLoan?.contractNo === r.contractNo;
                        return (
                          <tr key={i}
                            onClick={() => setSelectedLoan(isSelected?null:r)}
                            onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background="#fafafa"; }}
                            onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.background="white"; }}
                            style={{ borderBottom:"1px solid #f9fafb", transition:"background 0.1s", cursor:"pointer", background:isSelected?"#FFF5F5":"white" }}>
                            <td style={{ padding:"14px 12px", fontSize:15, fontWeight:700, color:"#374151", whiteSpace:"nowrap" }}>{r.contractNo||"-"}</td>
                            <td style={{ padding:"14px 12px", fontSize:15, color:"#111827", whiteSpace:"nowrap" }}>{r.borrower||"-"}</td>
                            <td style={{ padding:"14px 12px", fontSize:14, color:"#374151", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.project||"-"}</td>
                            <td style={{ padding:"14px 12px", fontSize:15, fontWeight:700, textAlign:"right", whiteSpace:"nowrap", color:"#111827" }}>{fmtNum(principal)}</td>
                            <td style={{ padding:"14px 12px", fontSize:15, fontWeight:700, textAlign:"right", whiteSpace:"nowrap", color:remaining<=0?"#065F46":remaining>principal*0.5?"#991B1B":"#92400E" }}>
                              {remaining<=0?"0":fmtNum(remaining)}
                            </td>
                            <td style={{ padding:"14px 12px", fontSize:14, color:"#374151", whiteSpace:"nowrap" }}>{fmtDate(r.dueDate)}</td>
                            <td style={{ padding:"14px 12px" }}>
                              <span style={{ ...BADGE[status], display:"inline-block", fontSize:12, padding:"4px 12px", borderRadius:20, fontWeight:600, whiteSpace:"nowrap" }}>
                                {getStatusLabel(status)}
                              </span>
                            </td>
                            <td style={{ padding:"14px 12px", whiteSpace:"nowrap" }} onClick={(e)=>e.stopPropagation()}>
                              {status !== "closed" && (
                                <>
                                  <button onClick={()=>openModal("return",{contractNo:r.contractNo})} style={{ ...actionBtnStyle, marginRight:4 }}>↩ รับคืน</button>
                                  <button onClick={()=>openModal("doc",{contractNo:r.contractNo})} style={{ ...actionBtnStyle, marginRight:4 }}>📄 เบิกจ่าย</button>
                                  <button onClick={()=>sendAlert(r)} disabled={sending[r.contractNo]}
                                    style={{ ...actionBtnStyle, background:"#FEF3C7", color:"#92400E", border:"1.5px solid #FCD34D" }}>
                                    {sending[r.contractNo]?"กำลังส่ง...":"📧 แจ้งเตือน"}
                                  </button>
                                </>
                              )}
                              {status==="closed" && <span style={{ fontSize:14, color:"#9ca3af" }}>ปิดแล้ว</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {selectedLoan && <DetailPanel r={selectedLoan} onClose={()=>setSelectedLoan(null)} />}
            </div>
          </>
        )}
      </div>

      {modal && (
        <div onClick={(e)=>{if(e.target===e.currentTarget)closeModal();}}
          style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:22, padding:32, width:440, maxWidth:"90vw", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ fontSize:20, fontWeight:700, color:"#111827", marginBottom:22 }}>{MODAL_FORMS[modal].title}</div>
            {MODAL_FORMS[modal].fields.map((f) => (
              <div key={f.key} style={{ marginBottom:16 }}>
                <label style={{ fontSize:15, color:"#6b7280", marginBottom:7, display:"block" }}>{f.label}</label>
                <input type={f.type} value={formData[f.key]||""}
                  onChange={(e)=>setFormData({...formData,[f.key]:e.target.value})}
                  style={inputStyle} />
              </div>
            ))}
            <div style={{ display:"flex", gap:12, marginTop:24, justifyContent:"flex-end" }}>
              <button onClick={closeModal}
                style={{ border:"1.5px solid #e5e7eb", borderRadius:12, padding:"12px 24px", fontSize:16, cursor:"pointer", fontFamily:"inherit", background:"white", color:"#374151" }}>
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ border:"none", borderRadius:12, padding:"12px 28px", fontSize:16, cursor:"pointer", fontFamily:"inherit", background:"#7B1F1F", color:"white", fontWeight:700 }}>
                {saving?"กำลังบันทึก...":"บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
