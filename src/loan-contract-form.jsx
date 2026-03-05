import { useState, useEffect } from "react";

// ─── Utilities ───────────────────────────────────────────────
const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const toThaiDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

const toThaiNum = (num) => {
  if (!num || isNaN(num)) return "";
  const n = Math.floor(parseFloat(num));
  if (n === 0) return "ศูนย์บาทถ้วน";
  const ones = ["","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
  const parts = [{v:1e6,s:"ล้าน"},{v:1e5,s:"แสน"},{v:1e4,s:"หมื่น"},{v:1e3,s:"พัน"},{v:100,s:"ร้อย"},{v:10,s:"สิบ"},{v:1,s:""}];
  let res = "", rem = n;
  for (const p of parts) {
    const q = Math.floor(rem / p.v); rem %= p.v;
    if (!q) continue;
    if (p.v === 10) res += q === 1 ? "สิบ" : q === 2 ? "ยี่สิบ" : ones[q] + "สิบ";
    else if (p.v === 1) res += (n > 10 && q === 1) ? "เอ็ด" : ones[q];
    else res += ones[q] + p.s;
  }
  return res + "บาทถ้วน";
};

const fmtNum = (n) => n !== "" && n !== undefined && n !== null ? Number(n).toLocaleString("th-TH") : "";
const today = () => new Date().toISOString().split("T")[0];

// ─── Initial state ────────────────────────────────────────────
const INIT = {
  // หน้า 1: ข้อมูลส่วนงาน
  unit: "", phone: "", docNo: "",
  contractDate: today(), contractNo: "",
  // ผู้ยืม
  borrowerName: "", position: "", department: "", email: "", eventEndDate: "",
  // หน้า 2: รายละเอียด
  refDocNo: "", project: "", budgetType: "งบประมาณเงินรายได้",
  totalAmount: "", totalAmountText: "", dueDate: "",
  inst1Amount: "", inst1NeedDate: "",
  useInst2: false, inst2Amount: "", inst2NeedDate: "",
  // หน้า 3: แผนการยืม
  planProject: "", planTotalAmount: "",
  planRows: [{ no: "1", needDate: "", items: [{ name: "", amount: "" }], reason: "" }],
  // หน้า 4: ผู้เกี่ยวข้อง
  fin1Name: "", fin1Note: "",
  fin2Name: "", fin2Note: "",
  dir3Name: "", dir3Date: "",
  approverName: "", approverDate: "", approvedAmount: "", approverNote: "",
};

const STEPS = [
  { id: 1, icon: "👤", label: "ข้อมูลผู้ยืม" },
  { id: 2, icon: "💰", label: "รายละเอียดยืม" },
  { id: 3, icon: "📋", label: "แผนการยืม" },
  { id: 4, icon: "✍️", label: "ผู้เกี่ยวข้อง" },
  { id: 5, icon: "🖨️", label: "พิมพ์สัญญา" },
];

const POSITIONS = ["คณบดี","รองคณบดี","ผู้อำนวยการกองบริหารงานคณะ","หัวหน้างาน",
  "ศาสตราจารย์","รองศาสตราจารย์","ผู้ช่วยศาสตราจารย์",
  "ชำนาญการพิเศษ","ชำนาญงานพิเศษ","ชำนาญการ","ชำนาญงาน","ปฏิบัติการ","ปฏิบัติงาน"];

const DEPARTMENTS = ["สำนักงาน","สาขาเทคโนโลยีชีวภาพ","สาขาเทคโนโลยีธรณี",
  "สาขาเทคโนโลยีการอาหาร","หลักสูตรเทคโนโลยีระบบการผลิตและการจัดการอุตสาหกรรม",
  "หลักสูตรวิทยาศาสตร์และเทคโนโลยีการประกอบอาหาร"];

// ─── Contract Preview (print) ─────────────────────────────────
function Blank({ val, w = 120 }) {
  return (
    <span style={{ display:"inline-block", borderBottom:"1px solid #000", minWidth:w,
      padding:"0 3px", minHeight:18, verticalAlign:"bottom", lineHeight:"20px" }}>
      {val || ""}
    </span>
  );
}
function Chk({ on }) {
  return (
    <span style={{ display:"inline-block", width:12, height:12, border:"1px solid #000",
      verticalAlign:"middle", textAlign:"center", lineHeight:"11px", fontSize:10, marginRight:2 }}>
      {on ? "✓" : ""}
    </span>
  );
}

function ContractPreview({ d }) {
  const S = { fontFamily:"'Sarabun','TH Sarabun New',Tahoma,sans-serif", fontSize:13.5, color:"#000", lineHeight:1.8 };
  const TD = { border:"1px solid #555", padding:"6px 8px", verticalAlign:"top" };
  const ROW = { display:"flex", flexWrap:"wrap", gap:"2px 4px", alignItems:"baseline", marginBottom:3 };

  // calc totals per planRow
  const rowTotal = (pr) => (pr.items||[]).reduce((s,it) => s + (parseFloat(it.amount)||0), 0);

  return (
    <div id="contract-print" style={S}>

      {/* ── PAGE 1 ── */}
      <div className="print-page" style={{ padding:"12mm 18mm 8mm 22mm", minHeight:"277mm", boxSizing:"border-box" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <div style={{ width:46, height:58, border:"1px solid #bbb", borderRadius:"50%",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:9, color:"#aaa", textAlign:"center", flexShrink:0 }}>โลโก้<br/>มข.</div>
            <div>
              <div><strong>ส่วนงาน</strong> <Blank val={d.unit} w={250}/> <strong>โทร.</strong> <Blank val={d.phone} w={90}/></div>
              <div><strong>ที่</strong> อว 660301.12.1.1<Blank val={d.docNo} w={110}/> &nbsp;<strong>วันที่</strong> <Blank val={toThaiDate(d.contractDate)} w={150}/></div>
            </div>
          </div>
          <table style={{ borderCollapse:"collapse", fontSize:13 }}>
            <tbody>
              <tr><td style={{ border:"1px solid #555", padding:"4px 10px", textAlign:"center", fontWeight:"bold" }}>เลขที่ <Blank val={d.contractNo} w={75}/></td></tr>
              <tr><td style={{ border:"1px solid #555", padding:"4px 10px", textAlign:"center" }}>วันครบกำหนด <Blank val={toThaiDate(d.dueDate)} w={75}/></td></tr>
            </tbody>
          </table>
        </div>

        <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:5 }}>
          <tbody>

            {/* Title */}
            <tr><td colSpan={2} style={{ ...TD, textAlign:"center", fontWeight:"bold", fontSize:15 }}>
              สัญญาการยืมเงิน(กรณียืมเงินรายได้มหาวิทยาลัย)&nbsp;&nbsp;ยื่นต่อ คณบดี
            </td></tr>

            {/* Borrower */}
            <tr><td colSpan={2} style={TD}>
              <div style={ROW}><span>ข้าพเจ้า</span><Blank val={d.borrowerName} w={190}/>
                <span>ตำแหน่ง</span><Blank val={d.position} w={140}/>
                <span>สังกัด</span><Blank val={d.department} w={140}/></div>
              <div style={ROW}><span>e-mail</span><Blank val={d.email} w={240}/></div>
              <div style={ROW}><span>มีความประสงค์ขอยืมเงินจากมหาวิทยาลัยขอนแก่น ตามหนังสือที่ อว</span><Blank val={d.refDocNo} w={190}/></div>
              <div style={ROW}><span>ที่ได้รับอนุมัติให้ดำเนินกิจกรรม/โครงการ</span><Blank val={d.project} w={240}/>
                <span>วันสิ้นสุดวันจัดกิจกรรม</span><Blank val={toThaiDate(d.eventEndDate)} w={110}/></div>
              <div style={{ ...ROW, marginTop:4 }}>
                <span>จากแหล่งเงินงบประมาณ</span>
                <span>&nbsp;<Chk on={d.budgetType==="งบประมาณแผ่นดิน"}/>งบประมาณแผ่นดิน</span>
                <span style={{ marginLeft:10 }}><Chk on={d.budgetType==="งบประมาณเงินรายได้"}/>งบประมาณเงินรายได้</span>
              </div>
              <div style={ROW}>
                <span>เป็นเงินจำนวน</span><Blank val={fmtNum(d.totalAmount)} w={110}/>
                <span>บาท (</span><Blank val={d.totalAmountText || toThaiNum(d.totalAmount)} w={240}/><span>)</span>
                <span>โดยมีแผนการยืมเงิน(ตามรายละเอียดแนบ)</span>
              </div>
              <div style={ROW}>
                <span>งวดที่ 1 จำนวน</span><Blank val={fmtNum(d.inst1Amount)} w={100}/>
                <span>บาท มีความจำเป็นต้องใช้เงินวันที่</span><Blank val={toThaiDate(d.inst1NeedDate)} w={105}/>
                <span>ส่งคืนวันที่</span><Blank val="" w={105}/>
              </div>
              {d.useInst2 && <div style={ROW}>
                <span>งวดที่ 2 จำนวน</span><Blank val={fmtNum(d.inst2Amount)} w={100}/>
                <span>บาท มีความจำเป็นต้องใช้เงินวันที่</span><Blank val={toThaiDate(d.inst2NeedDate)} w={105}/>
                <span>ส่งคืนวันที่</span><Blank val="" w={105}/>
              </div>}
              <div style={{ textAlign:"justify", margin:"5px 0", lineHeight:1.9, fontSize:13 }}>
                ข้าพเจ้าสัญญาว่าจะปฏิบัติตามระเบียบของทางราชการและประกาศของมหาวิทยาลัยที่เกี่ยวข้องอย่างเคร่งครัด
                และจะนำใบสำคัญคู่จ่ายที่ถูกต้องพร้อมทั้งเงินเหลือจ่าย(ถ้ามี) ส่งใช้ภายในกำหนดไว้
                และหากข้าพเจ้าไม่ส่งคืนเงินยืมตามกำหนดและพ้นวันครบกำหนดคืนเงินยืมทดรองจ่าย
                ข้าพเจ้ายินดีให้มหาวิทยาลัยขอนแก่น คิดดอกเบี้ย 7.5% ต่อปี
                และยินยอมให้หักเงินเดือน ค่าจ้าง เบี้ยหวัด บำเหน็จ บำนาญหรือเงินอื่นใดที่ข้าพเจ้าจะพึงได้รับจากทางราชการ
                เพื่อชดใช้จำนวนเงินที่ยืมไปจนครบ ได้ทันที
              </div>
              <div style={{ textAlign:"right", paddingRight:20 }}>
                <div>ลงชื่อ <Blank val="" w={150}/> ผู้ยืม</div>
                <div>(<Blank val={d.borrowerName} w={150}/>)</div>
              </div>
            </td></tr>

            {/* [1] & [2] */}
            <tr>
              <td style={{ ...TD, width:"50%" }}>
                <strong>[1] ความเห็นของเจ้าหน้าที่การเงินคณะ/หน่วยงาน</strong>
                <div style={{ lineHeight:1.85, margin:"4px 0 6px" }}>
                  ได้ตรวจสอบสิทธิของผู้ยืมเงินตามระเบียบฯ และพิจารณาความเหมาะสมของแผนการยืมเงินแล้วเห็นควรอนุมัติ
                </div>
                <div style={ROW}><span>ความเห็นเพิ่มเติม (ถ้ามี)</span><Blank val={d.fin1Note} w={160}/></div>
                <div style={{ marginTop:8 }}>
                  <div>ลงชื่อ <Blank val="" w={120}/></div>
                  <div>(<Blank val={d.fin1Name} w={120}/>)</div>
                  <div style={{ fontSize:12, color:"#333", marginTop:2 }}>เจ้าหน้าที่งานคลัง คณะ/หน่วยงาน</div>
                </div>
              </td>
              <td style={{ ...TD, width:"50%" }}>
                <strong>[2] ความเห็นหัวหน้างานคลังคณะฯ/ผู้ได้รับมอบหมาย</strong>
                <div style={{ lineHeight:1.85, margin:"4px 0 6px" }}>
                  เห็นชอบการยืมเงินของบุคลากรและได้ตรวจสอบว่าแผนการยืมเงิน(ตามเอกสารแนบ)เหมาะสม
                  โดยจะกำกับติดตามการใช้จ่ายเงินและส่งคืนเงินยืมตามกำหนดเวลาจนครบจำนวน
                </div>
                <div style={ROW}><span>ความเห็นเพิ่มเติม (ถ้ามี)</span><Blank val={d.fin2Note} w={130}/></div>
                <div style={{ marginTop:8 }}>
                  <div>ลงชื่อ <Blank val="" w={120}/></div>
                  <div>(<Blank val={d.fin2Name} w={120}/>)</div>
                  <div style={{ fontSize:12, color:"#333", marginTop:2 }}>หัวหน้างานคลังคณะฯ</div>
                </div>
              </td>
            </tr>

            {/* [3] & [4] */}
            <tr>
              <td style={TD}>
                <strong>[3] เรียน คณบดี</strong>
                <div style={{ lineHeight:1.85, margin:"4px 0 6px" }}>
                  ได้ตรวจสอบรายการยืมเงินของผู้ยืมถูกต้องตามประกาศที่เกี่ยวข้อง เห็นควรอนุมัติตามเสนอ
                </div>
                <div>ลงชื่อ <Blank val="" w={120}/> ผู้เสนอ</div>
                <div>(<Blank val={d.dir3Name} w={120}/>)</div>
                <div>ตำแหน่ง ผู้อำนวยการกองบริหารงานคณะฯ</div>
                <div>วันที่ <Blank val={toThaiDate(d.dir3Date)} w={135}/></div>
              </td>
              <td style={TD}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <strong>[4]</strong><strong style={{ textDecoration:"underline" }}>คำอนุมัติ</strong><span/>
                </div>
                <div style={ROW}>
                  <span>อนุมัติให้ยืมตามคำขอจำนวน</span>
                  <Blank val={fmtNum(d.approvedAmount || d.totalAmount)} w={90}/>
                  <span>บาท</span>
                </div>
                <div>(<Blank val={toThaiNum(d.approvedAmount || d.totalAmount)} w={185}/>)</div>
                <div style={ROW}><span>ความเห็นเพิ่มเติม (ถ้ามี)</span><Blank val={d.approverNote} w={140}/></div>
                <div style={{ marginTop:6 }}>
                  <div>ลงชื่อ <Blank val="" w={120}/> ผู้อนุมัติ</div>
                  <div>(<Blank val={d.approverName} w={120}/>)</div>
                  <div>วันที่ <Blank val={toThaiDate(d.approverDate)} w={125}/></div>
                </div>
              </td>
            </tr>

          </tbody>
        </table>

        {/* หมายเหตุ */}
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <strong>หมายเหตุ</strong> : 1. ค่าใช้จ่ายในการเดินทางไปราชการ ให้ผู้ยืมส่งใบสำคัญคู่จ่ายให้เร็วที่สุดแต่ไม่เกิน 15 วัน นับจากวันเดินทางกลับจากไปราชการ<br/>
          <span style={{ paddingLeft:52 }}>2. ค่าใช้จ่ายในการฝึกอบรม สัมมนา ศึกษาดูงาน ให้ผู้ยืมส่งใบสำคัญคู่จ่าย ภายใน 30 วันนับจากวันสิ้นสุดกิจกรรม</span>
        </div>
      </div>

      {/* ── PAGE 2: แผนการยืมเงิน ── */}
      <div style={{ padding:"12mm 18mm 8mm 22mm", minHeight:"277mm", boxSizing:"border-box" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <tbody>
            <tr><td colSpan={5} style={{ ...TD, textAlign:"center" }}>
              <strong style={{ fontSize:15 }}>แผนการยืมเงิน (เอกสารแนบสัญญาเงินยืม)</strong>
            </td></tr>
            <tr><td colSpan={5} style={TD}>
              เพื่อนำไปใช้จ่ายในการดำเนินการตามหน้าที่และการปฏิบัติงานของหน่วยงาน ในกรณีที่มีความจำเป็นต้องใช้เงินสดก่อน
            </td></tr>
            <tr><td colSpan={5} style={TD}>
              <div style={ROW}><strong>ชื่อโครงการ/กิจกรรม</strong><Blank val={d.planProject || d.project} w={360}/></div>
              <div style={ROW}><strong>จำนวนเงินโครงการที่ได้รับอนุมัติ</strong><Blank val={fmtNum(d.planTotalAmount || d.totalAmount)} w={110}/><span>บาท</span></div>
            </td></tr>
            <tr>
              {["งวดที่ยืม","วันที่มีความจำเป็นต้องใช้เงิน","รายการ","จำนวนเงิน (บาท)","เหตุผลความจำเป็น"].map((h,i)=>(
                <th key={i} style={{ ...TD, background:"#f0f0f0", textAlign:"center", padding:"6px",
                  width:i===0?"7%":i===1?"16%":i===2?"33%":i===3?"14%":"30%" }}>{h}</th>
              ))}
            </tr>
            {d.planRows.map((r,i) => {
              const total = (r.items||[]).reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
              return (
                <tr key={i}>
                  <td style={{ ...TD, textAlign:"center" }}>{r.no}</td>
                  <td style={{ ...TD, textAlign:"center" }}>{toThaiDate(r.needDate)}</td>
                  <td style={TD}>
                    {(r.items||[]).map((it,j) => (
                      <div key={j} style={{ display:"flex", justifyContent:"space-between", gap:6 }}>
                        <span>{j+1}. {String(it.name || "")}</span>
                        {it.amount ? <span style={{ flexShrink:0, color:"#333" }}>{fmtNum(it.amount)}</span> : null}
                      </div>
                    ))}
                  </td>
                  <td style={{ ...TD, textAlign:"right", fontWeight:"bold" }}>{total ? fmtNum(total) : ""}</td>
                  <td style={TD}>{r.reason}</td>
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, 6 - d.planRows.length) }).map((_,i) => (
              <tr key={`e${i}`}>{[1,2,3,4,5].map(j=><td key={j} style={{ ...TD, height:28 }}/>)}</tr>
            ))}
            <tr><td colSpan={5} style={TD}>
              <div style={{ marginBottom:6 }}>ขอรับรองว่าแผนการยืมเงินทดรองจ่ายเป็นความจริง</div>
              <div style={{ textAlign:"right", paddingRight:60 }}>
                <div>............................................................</div>
                <div>({d.borrowerName || "............................................"})</div>
                <strong>ผู้ยืม</strong>
              </div>
            </td></tr>
            <tr><td colSpan={5} style={{ ...TD, fontSize:12.5 }}>
              <strong>หมายเหตุ</strong> : หากช่วงระยะเวลาการใช้จ่ายเงินไม่เกิน 15 วัน ให้ยืมในงวดเดียวกัน
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
// ── Reusable UI Components (defined OUTSIDE App to prevent re-render) ──
const IS_STYLE = { width:"100%", background:"#0F1117", border:"1px solid #2D3148", color:"#E8EAF0",
  borderRadius:8, padding:"9px 12px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const LS_STYLE = { display:"block", fontSize:12, color:"#6B7280", marginBottom:5, fontWeight:500 };

function Field({ label, value, onChange, type="text", placeholder="" }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={LS_STYLE}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={IS_STYLE}/>
    </div>
  );
}
function Grid2({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>{children}</div>;
}
function Card({ title, color="#818CF8", children }) {
  return (
    <div style={{ background:"#0F1117", border:"1px solid #2D3148", borderRadius:10, padding:14, marginBottom:14 }}>
      <div style={{ fontWeight:600, fontSize:13, color, marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );
}
function SH({ text, color="#60A5FA" }) {
  return <div style={{ fontWeight:700, fontSize:15, color, borderBottom:"1px solid #2D3148", paddingBottom:8, marginBottom:18 }}>{text}</div>;
}

export default function App() {
  const [form, setForm] = useState(INIT);
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState(false);

  // Auto-running contract number
  const currentYear = new Date().getFullYear() + 543;
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    let seq = 1;
    try {
      if (window.storage) {
        window.storage.get("cnt_" + currentYear).then(r => {
          if (r?.value) seq = parseInt(r.value) + 1;
          setCounter(seq);
          setForm(p => ({ ...p, contractNo: `${currentYear}${String(seq).padStart(5,"0")}` }));
        }).catch(() => {
          setCounter(1);
          setForm(p => ({ ...p, contractNo: `${currentYear}00001` }));
        });
      } else {
        setCounter(1);
        setForm(p => ({ ...p, contractNo: `${currentYear}00001` }));
      }
    } catch {
      setCounter(1);
      setForm(p => ({ ...p, contractNo: `${currentYear}00001` }));
    }
  }, []);

  // Auto-sync plan rows when entering step 3
  useEffect(() => {
    if (step !== 3) return;
    setForm(p => {
      const makeRow = (no, needDate, amount, existing) => ({
        no: String(no), needDate: needDate || "",
        items: existing?.items?.length ? existing.items : [{ name:"", amount: amount || "" }],
        reason: existing?.reason || ""
      });
      const rows = [makeRow(1, p.inst1NeedDate, p.inst1Amount, p.planRows[0])];
      if (p.useInst2) rows.push(makeRow(2, p.inst2NeedDate, p.inst2Amount, p.planRows[1]));
      return { ...p, planRows: rows };
    });
  }, [step]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updateRow = (ri, key, val) => setForm(p => {
    const rows = p.planRows.map((r, i) => i === ri ? { ...r, [key]: val } : r);
    return { ...p, planRows: rows };
  });

  const addPlanRow = () => setForm(p => ({
    ...p,
    planRows: [...p.planRows, { no: String(p.planRows.length+1), needDate:"", items:[{name:"",amount:""}], reason:"" }]
  }));

  const delPlanRow = (ri) => setForm(p => ({
    ...p, planRows: p.planRows.filter((_,i)=>i!==ri)
  }));

  const updateItem = (ri, ii, key, val) => setForm(p => {
    const rows = p.planRows.map((r, i) => {
      if (i !== ri) return r;
      const items = r.items.map((it, j) => j === ii ? { ...it, [key]: val } : it);
      return { ...r, items };
    });
    return { ...p, planRows: rows };
  });

  const addItem = (ri) => setForm(p => ({
    ...p,
    planRows: p.planRows.map((r,i) => i===ri ? { ...r, items:[...r.items,{name:"",amount:""}] } : r)
  }));

  const delItem = (ri, ii) => setForm(p => ({
    ...p,
    planRows: p.planRows.map((r,i) => i===ri ? { ...r, items:r.items.filter((_,j)=>j!==ii) } : r)
  }));

  const handlePrint = () => {
    try {
      window.storage?.set("cnt_" + currentYear, String(counter)).catch(()=>{});
    } catch {}
    window.print();
  };

  // ─── Styles ─
  const IS = { width:"100%", background:"#0F1117", border:"1px solid #2D3148", color:"#E8EAF0",
    borderRadius:8, padding:"9px 12px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const LS = { display:"block", fontSize:12, color:"#6B7280", marginBottom:5, fontWeight:500 };
  const dropArrow = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`;
  const DROP = { ...IS, cursor:"pointer", appearance:"none", backgroundImage:dropArrow,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", paddingRight:36 };



  return (
    <div style={{ fontFamily:"'Sarabun','TH Sarabun New',sans-serif", background:"#0F1117", minHeight:"100vh", color:"#E8EAF0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#1A1D27}
        ::-webkit-scrollbar-thumb{background:#3A3D4D;border-radius:3px}
        @media print{
          body *{visibility:hidden!important}
          #contract-print,#contract-print *{visibility:visible!important}
          #contract-print{position:fixed!important;left:0!important;top:0!important;width:100%!important;background:white!important}
          .print-page{page-break-after:always}
        }
      `}</style>

      {/* Hidden print zone */}
      <div style={{ display:"none" }}><ContractPreview d={form}/></div>

      {!preview ? (
        <div style={{ maxWidth:800, margin:"0 auto", padding:"24px 16px" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
            <div style={{ width:42, height:42, background:"linear-gradient(135deg,#1D4ED8,#7C3AED)", borderRadius:11,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>📝</div>
            <div>
              <div style={{ fontWeight:700, fontSize:18 }}>สร้างสัญญาการยืมเงิน</div>
              <div style={{ fontSize:12, color:"#6B7280" }}>กรณียืมเงินรายได้ มหาวิทยาลัยขอนแก่น — คณะเทคโนโลยี</div>
            </div>
          </div>

          {/* Stepper */}
          <div style={{ display:"flex", alignItems:"flex-start", marginBottom:28 }}>
            {STEPS.map((s,i) => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", flex:1 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                  <div onClick={() => setStep(s.id)} style={{
                    width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center",
                    justifyContent:"center", fontWeight:700, fontSize:12, cursor:"pointer",
                    background: step===s.id?"#2563EB":step>s.id?"#059669":"#1A1D27",
                    border:`2px solid ${step===s.id?"#2563EB":step>s.id?"#059669":"#374151"}`,
                    color: step>=s.id?"white":"#6B7280"
                  }}>{step>s.id?"✓":s.icon}</div>
                  <div style={{ fontSize:10, color:step===s.id?"#60A5FA":"#6B7280", marginTop:4, textAlign:"center", maxWidth:64 }}>{s.label}</div>
                </div>
                {i<STEPS.length-1 && <div style={{ height:2, flex:0.3, background:step>s.id?"#059669":"#374151", marginBottom:16 }}/>}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div style={{ background:"#1A1D27", border:"1px solid #2D3148", borderRadius:16, padding:24 }}>

            {/* ── STEP 1 ── */}
            {step===1 && <>
              <SH text="👤 ข้อมูลส่วนงานและผู้ยืม"/>
              <Grid2>
                <Field label="ส่วนงาน / คณะ" value={form.unit} onChange={e=>set("unit",e.target.value)} placeholder="คณะเทคโนโลยี"/>
                <Field label="โทรศัพท์" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="043-202-XXX"/>
                <Field label="เลขที่หนังสือ (ต่อท้าย อว 660301.12.1.1/)" value={form.docNo} onChange={e=>set("docNo",e.target.value)}/>
                {/* Contract No - auto running, read-only */}
                <div style={{ marginBottom:14 }}>
                  <label style={LS_STYLE}>เลขที่สัญญา (Auto Running)</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ ...IS, flex:1, display:"flex", alignItems:"center", justifyContent:"space-between",
                      background:"rgba(37,99,235,.08)", border:"1px solid rgba(37,99,235,.35)" }}>
                      <span style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"#60A5FA", letterSpacing:2 }}>{form.contractNo}</span>
                      <span style={{ fontSize:10, color:"#4B5563" }}>ปีพ.ศ. + 5 หลัก</span>
                    </div>
                    <button onClick={() => {
                      const s2 = counter + 1; setCounter(s2);
                      set("contractNo", `${currentYear}${String(s2).padStart(5,"0")}`);
                    }} title="สร้างเลขใหม่"
                      style={{ background:"rgba(37,99,235,.15)", border:"1px solid rgba(37,99,235,.3)", color:"#60A5FA",
                        borderRadius:8, padding:"0 14px", cursor:"pointer", fontSize:18, fontFamily:"inherit", flexShrink:0 }}>🔄</button>
                  </div>
                  <div style={{ fontSize:11, color:"#4B5563", marginTop:4 }}>เลขจะบันทึกเมื่อกดพิมพ์สัญญา</div>
                </div>
                {/* Contract date - read only today */}
                <div style={{ marginBottom:14 }}>
                  <label style={LS_STYLE}>วันที่ทำสัญญา</label>
                  <div style={{ ...IS, display:"flex", alignItems:"center", justifyContent:"space-between",
                    background:"rgba(255,255,255,.04)", border:"1px solid #374151", cursor:"not-allowed" }}>
                    <span style={{ fontWeight:600 }}>{toThaiDate(form.contractDate)}</span>
                    <span style={{ fontSize:11, color:"#4B5563" }}>🔒 วันปัจจุบัน</span>
                  </div>
                </div>
                <Field label="วันสิ้นสุดวันจัดกิจกรรม" value={form.eventEndDate} onChange={e=>set("eventEndDate",e.target.value)} type="date"/>
              </Grid2>
              <Field label="ชื่อ-สกุล ผู้ยืม" value={form.borrowerName} onChange={e=>set("borrowerName",e.target.value)} placeholder="นายสมชาย ใจดี"/>
              <Grid2>
                <div style={{ marginBottom:14 }}>
                  <label style={LS_STYLE}>ตำแหน่ง</label>
                  <select value={form.position} onChange={e=>set("position",e.target.value)} style={DROP}>
                    <option value="">-- เลือกตำแหน่ง --</option>
                    {POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={LS_STYLE}>สังกัด</label>
                  <select value={form.department} onChange={e=>set("department",e.target.value)} style={DROP}>
                    <option value="">-- เลือกสังกัด --</option>
                    {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </Grid2>
              <Field label="อีเมล (e-mail)" value={form.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="name@kku.ac.th"/>
            </>}

            {/* ── STEP 2 ── */}
            {step===2 && <>
              <SH text="💰 รายละเอียดการยืมเงิน"/>
              <Field label="เลขที่หนังสืออ้างอิง (อว...)" value={form.refDocNo} onChange={e=>set("refDocNo",e.target.value)}/>
              <Field label="ชื่อกิจกรรม / โครงการ" value={form.project} onChange={e=>set("project",e.target.value)} placeholder="โครงการ..."/>
              <div style={{ marginBottom:14 }}>
                <label style={LS_STYLE}>แหล่งเงินงบประมาณ</label>
                <div style={{ display:"flex", gap:20 }}>
                  {["งบประมาณแผ่นดิน","งบประมาณเงินรายได้"].map(t=>(
                    <label key={t} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:14 }}>
                      <input type="radio" checked={form.budgetType===t} onChange={()=>set("budgetType",t)}
                        style={{ accentColor:"#2563EB", width:16, height:16 }}/>{t}
                    </label>
                  ))}
                </div>
              </div>
              <Grid2>
                <Field label="จำนวนเงินรวม (บาท)" value={form.totalAmount} onChange={e=>set("totalAmount",e.target.value)} type="number" placeholder="0.00"/>
                <div style={{ marginBottom:14 }}>
                  <label style={LS_STYLE}>จำนวนเงิน (ตัวอักษร)</label>
                  <input value={form.totalAmountText||(form.totalAmount?toThaiNum(form.totalAmount):"")}
                    onChange={e=>set("totalAmountText",e.target.value)} style={IS_STYLE} placeholder="อัตโนมัติ"/>
                </div>
                <Field label="วันครบกำหนดคืนเงิน" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} type="date"/>
              </Grid2>
              <Card title="📅 งวดที่ 1" color="#FBBF24">
                <Grid2>
                  <Field label="จำนวนเงิน (บาท)" value={form.inst1Amount} onChange={e=>set("inst1Amount",e.target.value)} type="number"/>
                  <Field label="วันที่ต้องใช้เงิน" value={form.inst1NeedDate} onChange={e=>set("inst1NeedDate",e.target.value)} type="date"/>
                </Grid2>
              </Card>
              <div style={{ background:"#0F1117", border:"1px solid #2D3148", borderRadius:10, padding:14 }}>
                <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:form.useInst2?14:0 }}>
                  <input type="checkbox" checked={form.useInst2} onChange={e=>set("useInst2",e.target.checked)}
                    style={{ accentColor:"#2563EB", width:16, height:16 }}/>
                  <span style={{ fontSize:14, fontWeight:600, color:"#9CA3AF" }}>📅 มีงวดที่ 2</span>
                </label>
                {form.useInst2 && <Grid2>
                  <Field label="จำนวนเงิน (บาท)" value={form.inst2Amount} onChange={e=>set("inst2Amount",e.target.value)} type="number"/>
                  <Field label="วันที่ต้องใช้เงิน" value={form.inst2NeedDate} onChange={e=>set("inst2NeedDate",e.target.value)} type="date"/>
                </Grid2>}
              </div>
            </>}

            {/* ── STEP 3: แผนการยืม ── */}
            {step===3 && <>
              <SH text="📋 แผนการยืมเงิน (เอกสารแนบ)"/>
              <Field label="ชื่อโครงการ (ว่างไว้ = ดึงจากหน้าหลัก)" value={form.planProject} onChange={e=>set("planProject",e.target.value)}/>
              <Field label="จำนวนเงินโครงการที่ได้รับอนุมัติ (บาท)" value={form.planTotalAmount} onChange={e=>set("planTotalAmount",e.target.value)} type="number" placeholder="ดึงจากหน้าหลักถ้าว่าง"/>

              {/* Sync button */}
              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
                <button onClick={() => {
                  setForm(p => {
                    const mk = (no, nd, amt, ex) => ({ no:String(no), needDate:nd||"", items:ex?.items?.length?ex.items:[{name:"",amount:amt||""}], reason:ex?.reason||"" });
                    const rows = [mk(1,p.inst1NeedDate,p.inst1Amount,p.planRows[0])];
                    if (p.useInst2) rows.push(mk(2,p.inst2NeedDate,p.inst2Amount,p.planRows[1]));
                    return {...p, planRows:rows};
                  });
                }} style={{ background:"rgba(52,211,153,.12)", border:"1px solid rgba(52,211,153,.35)", color:"#34D399",
                  borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>
                  ⬇️ ดึงข้อมูลจากรายละเอียด
                </button>
              </div>

              {/* Plan rows */}
              {form.planRows.map((r,ri) => {
                const total = r.items.reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
                return (
                  <div key={ri} style={{ background:"#0F1117", border:"1px solid #2D3148", borderRadius:10, padding:14, marginBottom:12 }}>
                    {/* Row header */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:"#FBBF24" }}>งวดที่ {r.no}</span>
                      {form.planRows.length>1 && (
                        <button onClick={()=>delPlanRow(ri)}
                          style={{ background:"rgba(239,68,68,.15)", border:"none", color:"#F87171", borderRadius:6, padding:"2px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>ลบงวด</button>
                      )}
                    </div>
                    <Grid2>
                      {/* วันที่ */}
                      <div style={{ marginBottom:12 }}>
                        <label style={LS_STYLE}>วันที่ต้องใช้เงิน</label>
                        <input type="date" value={r.needDate} onChange={e=>updateRow(ri,"needDate",e.target.value)}
                          style={{ ...IS, background:r.needDate?"rgba(52,211,153,.07)":"#0F1117",
                            border:`1px solid ${r.needDate?"rgba(52,211,153,.35)":"#2D3148"}` }}/>
                      </div>
                      {/* รวม */}
                      <div style={{ marginBottom:12 }}>
                        <label style={LS_STYLE}>จำนวนเงินรวม (บาท)</label>
                        <div style={{ ...IS, background:"rgba(37,99,235,.08)", border:"1px solid rgba(37,99,235,.3)",
                          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <span style={{ fontWeight:700, color:"#60A5FA", fontSize:15 }}>{fmtNum(total) || "0"}</span>
                          <span style={{ fontSize:11, color:"#4B5563" }}>คำนวณอัตโนมัติ</span>
                        </div>
                      </div>
                    </Grid2>

                    {/* Items */}
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <label style={{ ...LS, marginBottom:0 }}>รายการ <span style={{ color:"#4B5563", fontWeight:400 }}>เช่น ค่าอาหาร ค่าลงทะเบียน ค่าที่พัก ค่าตั๋วเครื่องบิน เป็นต้น</span></label>
                        <button onClick={()=>addItem(ri)}
                          style={{ background:"rgba(37,99,235,.15)", border:"1px solid rgba(37,99,235,.35)", color:"#60A5FA",
                            borderRadius:6, padding:"3px 12px", cursor:"pointer", fontSize:12, fontFamily:"inherit", flexShrink:0, marginLeft:8 }}>
                          + เพิ่มรายการ
                        </button>
                      </div>
                      {/* Items header */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 32px", gap:"0 6px", marginBottom:4 }}>
                        <span style={{ fontSize:11, color:"#4B5563", paddingLeft:22 }}>ชื่อรายการ</span>
                        <span style={{ fontSize:11, color:"#4B5563", textAlign:"right" }}>จำนวนเงิน (บาท)</span>
                        <span/>
                      </div>
                      {r.items.map((it, ii) => (
                        <div key={ii} style={{ display:"grid", gridTemplateColumns:"1fr 120px 32px", gap:"0 6px", marginBottom:6, alignItems:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ color:"#6B7280", fontSize:12, minWidth:18, textAlign:"right", flexShrink:0 }}>{ii+1}.</span>
                            <input type="text" value={it.name}
                              onChange={e=>updateItem(ri,ii,"name",e.target.value)}
                              placeholder="ระบุรายการค่าใช้จ่าย"
                              style={{ flex:1, background:"#1A1D27", border:"1px solid #374151", color:"#E8EAF0",
                                borderRadius:6, padding:"7px 8px", fontSize:13, fontFamily:"inherit", outline:"none" }}/>
                          </div>
                          <input type="number" value={it.amount}
                            onChange={e=>updateItem(ri,ii,"amount",e.target.value)}
                            placeholder="0"
                            style={{ width:"100%", background:"#1A1D27", border:"1px solid #374151", color:"#E8EAF0",
                              borderRadius:6, padding:"7px 8px", fontSize:13, fontFamily:"inherit", outline:"none", textAlign:"right" }}/>
                          {r.items.length>1 ? (
                            <button onClick={()=>delItem(ri,ii)}
                              style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.25)", color:"#F87171",
                                borderRadius:6, width:32, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" }}>×</button>
                          ) : <span/>}
                        </div>
                      ))}
                      {/* Total bar */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 32px", gap:"0 6px",
                        borderTop:"1px solid #2D3148", paddingTop:8, marginTop:4 }}>
                        <span style={{ fontSize:12, color:"#9CA3AF", fontWeight:600, paddingLeft:24 }}>รวม</span>
                        <div style={{ background:"rgba(37,99,235,.1)", border:"1px solid rgba(37,99,235,.3)",
                          borderRadius:6, padding:"6px 8px", textAlign:"right", fontSize:13, fontWeight:700, color:"#60A5FA" }}>
                          {fmtNum(total) || "0"}
                        </div>
                        <span/>
                      </div>
                    </div>

                    {/* เหตุผล */}
                    <div style={{ marginTop:12 }}>
                      <label style={LS_STYLE}>เหตุผลความจำเป็น</label>
                      <input type="text" value={r.reason} onChange={e=>updateRow(ri,"reason",e.target.value)}
                        style={IS_STYLE} placeholder="ระบุเหตุผล"/>
                    </div>
                  </div>
                );
              })}
              <button onClick={addPlanRow}
                style={{ background:"rgba(37,99,235,.1)", border:"1px dashed rgba(37,99,235,.4)", color:"#60A5FA",
                  borderRadius:8, padding:10, cursor:"pointer", fontSize:13, width:"100%", fontFamily:"inherit" }}>
                + เพิ่มงวด
              </button>
            </>}

            {/* ── STEP 4: ผู้เกี่ยวข้อง ── */}
            {step===4 && <>
              <SH text="✍️ ข้อมูลผู้เกี่ยวข้อง 4 ฝ่าย"/>
              <Card title="[1] เจ้าหน้าที่การเงินคณะ/หน่วยงาน" color="#60A5FA">
                <Grid2>
                  <Field label="ชื่อเจ้าหน้าที่การเงิน" value={form.fin1Name} onChange={e=>set("fin1Name",e.target.value)}/>
                  <Field label="ความเห็นเพิ่มเติม (ถ้ามี)" value={form.fin1Note} onChange={e=>set("fin1Note",e.target.value)}/>
                </Grid2>
              </Card>
              <Card title="[2] หัวหน้างานคลังคณะฯ / ผู้ได้รับมอบหมาย" color="#818CF8">
                <Grid2>
                  <Field label="ชื่อหัวหน้างานคลัง" value={form.fin2Name} onChange={e=>set("fin2Name",e.target.value)}/>
                  <Field label="ความเห็นเพิ่มเติม (ถ้ามี)" value={form.fin2Note} onChange={e=>set("fin2Note",e.target.value)}/>
                </Grid2>
              </Card>
              <Card title="[3] ผู้อำนวยการกองบริหารงานคณะฯ (ผู้เสนอ)" color="#34D399">
                <Grid2>
                  <Field label="ชื่อผู้อำนวยการกองบริหาร" value={form.dir3Name} onChange={e=>set("dir3Name",e.target.value)}/>
                  <Field label="วันที่เสนอ" value={form.dir3Date} onChange={e=>set("dir3Date",e.target.value)} type="date"/>
                </Grid2>
              </Card>
              <Card title="[4] คณบดี / ผู้อนุมัติ" color="#FBBF24">
                <Grid2>
                  <Field label="ชื่อคณบดี / ผู้อนุมัติ" value={form.approverName} onChange={e=>set("approverName",e.target.value)}/>
                  <Field label="วันที่อนุมัติ" value={form.approverDate} onChange={e=>set("approverDate",e.target.value)} type="date"/>
                  <Field label="จำนวนที่อนุมัติ (บาท) — ว่าง = ตามยอดขอ" value={form.approvedAmount} onChange={e=>set("approvedAmount",e.target.value)} type="number"/>
                  <Field label="ความเห็นเพิ่มเติม (ถ้ามี)" value={form.approverNote} onChange={e=>set("approverNote",e.target.value)}/>
                </Grid2>
              </Card>
            </>}

            {/* ── STEP 5: Preview & Print ── */}
            {step===5 && <>
              <SH text="🖨️ ตรวจสอบและพิมพ์สัญญา"/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                {[
                  ["ผู้ยืม", form.borrowerName||"-"],
                  ["ตำแหน่ง", form.position||"-"],
                  ["สังกัด", form.department||"-"],
                  ["โครงการ", form.project||"-"],
                  ["จำนวนเงิน", form.totalAmount?`${fmtNum(form.totalAmount)} บาท`:"-"],
                  ["วันครบกำหนด", toThaiDate(form.dueDate)||"-"],
                  ["ผู้อนุมัติ", form.approverName||"-"],
                  ["เลขที่สัญญา", form.contractNo||"-"],
                ].map(([k,v])=>(
                  <div key={k} style={{ background:"#0F1117", border:"1px solid #2D3148", borderRadius:8, padding:"10px 14px" }}>
                    <div style={{ fontSize:11, color:"#6B7280" }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:500, marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setPreview(true)}
                style={{ width:"100%", background:"#1A1D27", border:"1px solid #374151", color:"#9CA3AF",
                  borderRadius:8, padding:11, cursor:"pointer", fontSize:14, marginBottom:10, fontFamily:"inherit" }}>
                👁️ ดู Preview สัญญาก่อนพิมพ์
              </button>
              <button onClick={handlePrint}
                style={{ width:"100%", background:"linear-gradient(135deg,#1D4ED8,#4F46E5)", border:"none", color:"white",
                  borderRadius:10, padding:14, cursor:"pointer", fontSize:16, fontWeight:700, fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                🖨️ พิมพ์ / บันทึกเป็น PDF
              </button>
              <div style={{ fontSize:12, color:"#4B5563", textAlign:"center", marginTop:8 }}>เลือก "Save as PDF" ใน Dialog การพิมพ์ของ Browser</div>
            </>}
          </div>

          {/* Navigation */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:14 }}>
            <button onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1}
              style={{ background:step===1?"rgba(255,255,255,.03)":"rgba(255,255,255,.07)",
                border:"1px solid #374151", color:step===1?"#374151":"#9CA3AF",
                borderRadius:8, padding:"10px 20px", cursor:step===1?"not-allowed":"pointer", fontSize:14, fontFamily:"inherit" }}>
              ← ก่อนหน้า
            </button>
            {step<5 && (
              <button onClick={()=>setStep(s=>Math.min(5,s+1))}
                style={{ background:"#2563EB", border:"none", color:"white", borderRadius:8,
                  padding:"10px 24px", cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:"inherit" }}>
                ถัดไป →
              </button>
            )}
          </div>
        </div>

      ) : (
        /* Preview */
        <div>
          <div style={{ background:"#141620", borderBottom:"1px solid #2D3148", padding:"12px 20px",
            display:"flex", gap:10, alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
            <button onClick={()=>setPreview(false)}
              style={{ background:"rgba(255,255,255,.08)", border:"1px solid #374151", color:"#9CA3AF",
                borderRadius:8, padding:"8px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
              ← กลับแก้ไข
            </button>
            <button onClick={handlePrint}
              style={{ background:"linear-gradient(135deg,#1D4ED8,#4F46E5)", border:"none", color:"white",
                borderRadius:8, padding:"8px 20px", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:700 }}>
              🖨️ พิมพ์ / Save PDF
            </button>
            <span style={{ fontSize:12, color:"#4B5563" }}>เลือก "Save as PDF" ใน Dialog การพิมพ์</span>
          </div>
          <div style={{ background:"#D1D5DB", minHeight:"100vh", padding:20, display:"flex", justifyContent:"center" }}>
            <div style={{ background:"white", width:"210mm", boxShadow:"0 4px 24px rgba(0,0,0,.25)" }}>
              <ContractPreview d={form}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
