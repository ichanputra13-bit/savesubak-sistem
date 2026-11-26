// CSS dashboard kawasan — tema gelap/terang via atribut data-theme pada .ssd
export const DASH_CSS = `
.ssd{--g:#4caf50;--leaf:#8bc34a;--w:#3fb6d3;--dry:#c9a46a;--warn:#f0a43a;--red:#e05545;min-height:100vh;background:var(--bg);color:var(--ink);font-size:14px}
.ssd[data-theme=dark]{--bg:#0d1410;--card:#151f19;--card2:#1b2820;--ink:#e8efe6;--mut:#8ea292;--line:#25352b;--chip:#1f2e25}
.ssd[data-theme=light]{--bg:#f2f5ef;--card:#fff;--card2:#f6f9f3;--ink:#17251b;--mut:#66766a;--line:#dfe6da;--chip:#eef3ea}
.ssd *{box-sizing:border-box}
.ssd .hdr{display:flex;align-items:center;gap:14px;padding:12px 22px;background:var(--card);border-bottom:1px solid var(--line);flex-wrap:wrap}
.ssd .hdr h1{margin:0;font-size:20px;font-weight:800}.ssd .mut{color:var(--mut)}
.ssd .terr{height:5px;background:repeating-linear-gradient(90deg,var(--g) 0 40px,var(--leaf) 40px 70px,var(--w) 70px 90px);opacity:.85}
.ssd .btn{background:var(--g);color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer;font-size:13px}
.ssd .ghost{background:var(--chip);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:7px 12px;cursor:pointer;font-size:13px}
.ssd .wrap{max-width:1460px;margin:0 auto;padding:16px 22px;display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:16px}
.ssd .full{grid-column:1/-1}
.ssd .card{background:var(--card);border:1px solid var(--line);border-radius:6px 18px 6px 18px;padding:16px 18px}
.ssd h3{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);display:flex;align-items:center;gap:8px;font-weight:700}
.ssd h3:before{content:"";width:14px;height:3px;background:var(--leaf);border-radius:2px}
.ssd .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ssd .strip{display:flex;gap:10px;overflow-x:auto}
.ssd .chip{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:9px 14px;min-width:150px;flex:1;white-space:nowrap}
.ssd .chip .l{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em}.ssd .chip .v{font-size:18px;font-weight:700;margin-top:2px}.ssd .chip .s{font-size:11px;color:var(--mut)}
.ssd .chip.hot{border-color:var(--warn)}.ssd .chip.hot .v{color:var(--warn)}
.ssd .tabs{display:flex;gap:3px;background:var(--chip);border-radius:99px;padding:3px}
.ssd .tabs button{border:0;background:none;color:var(--mut);padding:5px 12px;border-radius:99px;cursor:pointer;font-size:12px}.ssd .tabs .on{background:var(--g);color:#fff}
.ssd .dot{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:middle}
.ssd .note{font-size:11px;color:var(--mut);margin-top:8px}
.ssd .kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ssd .k{background:var(--card2);border-radius:12px;padding:10px 12px}.ssd .k .v{font-size:20px;font-weight:700}.ssd .k .l{font-size:11px;color:var(--mut)}
.ssd .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ssd .todo{list-style:none;padding:0;margin:0}.ssd .todo li{display:flex;gap:10px;padding:10px 0;border-bottom:1px dashed var(--line)}
.ssd .todo input{accent-color:var(--g);width:18px;height:18px;margin-top:2px;flex:none}.ssd .todo b{display:block}.ssd .todo span{font-size:12px;color:var(--mut)}
.ssd .todo li.done b{text-decoration:line-through;opacity:.5}
.ssd .tag{font-size:10px;padding:1px 7px;border-radius:99px;background:var(--chip);color:var(--mut);margin-left:4px;font-weight:500}
.ssd table.pt{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}.ssd .pt th{color:var(--mut);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:6px}
.ssd .pt td{padding:7px 6px;border-top:1px solid var(--line)}.ssd .pt tbody tr{cursor:pointer}.ssd .pt tr.sel{background:var(--chip)}
.ssd .pbar{height:6px;border-radius:99px;background:var(--chip);width:60px;display:inline-block;vertical-align:middle;margin-left:6px;overflow:hidden}.ssd .pbar i{display:block;height:100%;background:var(--leaf)}
.ssd .wc{display:grid;gap:2px;font-size:10px}.ssd .wc .c{height:14px;border-radius:2px}.ssd .wc .n{color:var(--mut);padding-right:6px;white-space:nowrap}
.ssd .ss{display:grid;grid-template-columns:110px repeat(12,minmax(0,1fr));font-size:11px;border-top:1px solid var(--line)}
.ssd .ss>div{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:6px 4px;min-height:34px;position:relative;overflow:hidden}
.ssd .ss .hd{font-weight:700;text-align:center;background:var(--card2)}.ssd .ss .hd small{display:block;font-weight:400;color:var(--mut)}
.ssd .ss .lab{color:var(--mut);font-weight:600;background:var(--card2)}
.ssd .ev{display:block;margin:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ssd .lane{grid-column:2/-1!important;height:44px;padding:0!important}
.ssd .seg{position:absolute;top:8px;height:28px;border-radius:6px;font-size:11px;display:flex;align-items:center;padding:0 8px;color:#fff;font-weight:600;overflow:hidden;white-space:nowrap}
.ssd .seg.est{background:transparent!important;border:2px dashed;color:var(--ink)}
.ssd .today{position:absolute;top:0;bottom:0;width:2px;background:var(--red);z-index:2}
.ssd .scroll10{max-height:390px;overflow-y:auto;margin-top:8px;border-radius:8px}.ssd .scroll10 table.pt{margin-top:0}
.ssd .scroll10 thead th{position:sticky;top:0;background:var(--card);z-index:1}
.ssd .wc{overflow-y:hidden;scrollbar-gutter:stable}.ssd .wc.wcbody{max-height:160px;overflow-y:auto}
.ssd .btn:disabled{opacity:.7;cursor:default}
.ssd .charts2{display:grid;grid-template-columns:1fr 1.4fr;gap:24px}
.ssd .pbars{display:flex;gap:12px;align-items:flex-end;height:200px;padding-top:6px}
.ssd .pcol{flex:1;max-width:80px;display:flex;flex-direction:column;align-items:center;height:100%;font-size:11px;color:var(--mut)}
.ssd .pcol b{color:var(--ink);font-size:13px}.ssd .pcol .pb{flex:1;width:100%;display:flex;align-items:flex-end;margin:4px 0}
.ssd .pcol .pb div{width:100%;background:linear-gradient(var(--leaf),var(--g));border-radius:6px 6px 0 0;min-height:3px}
.ssd .pcol span{text-align:center;white-space:nowrap}
@media(max-width:1050px){.ssd .charts2{grid-template-columns:1fr}.ssd .wrap{grid-template-columns:1fr}.ssd .sum{grid-template-columns:1fr 1fr}}
`
