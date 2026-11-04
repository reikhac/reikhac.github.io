/* KCET Class Agent enhancements: faculty management, analytics and CSV export. */
(() => {
  const $ = id => document.getElementById(id);
  const endpointKey = "cs25c12_exit_ticket_endpoint";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const endpoint = () => { try { return localStorage.getItem(endpointKey) || ""; } catch (_) { return ""; } };
  const token = () => { try { return sessionStorage.getItem("kcet_class_agent_token") || ""; } catch (_) { return ""; } };

  function request(payload, callback) {
    const url = endpoint();
    if (!url) { callback({success:false,error:"Connect the Class Agent endpoint first."}); return; }
    const id = "ca2_" + Date.now() + "_" + Math.random().toString(36).slice(2,10);
    const body = Object.assign({}, payload, {requestId:id});
    let frame = $("ca2PostFrame");
    if (!frame) { frame=document.createElement("iframe"); frame.name="ca2PostFrame"; frame.id="ca2PostFrame"; frame.hidden=true; document.body.appendChild(frame); }
    const form=document.createElement("form"); form.method="POST"; form.action=url; form.target="ca2PostFrame"; form.style.display="none";
    const field=document.createElement("input"); field.type="hidden"; field.name="payload"; field.value=JSON.stringify(body); form.appendChild(field); document.body.appendChild(form);
    try { form.submit(); } catch(e) { form.remove(); callback({success:false,error:e.message}); return; }
    setTimeout(()=>form.remove(),1200);
    let attempts=0, finished=false;
    const poll=()=>{
      if(finished) return;
      attempts++;
      const cb="ca2Result_"+id.replace(/[^A-Za-z0-9_]/g,"");
      const script=document.createElement("script"); let settled=false;
      const clean=()=>{if(settled)return;settled=true;delete window[cb];script.remove();};
      window[cb]=data=>{clean();if(data&&data.pending){if(attempts<30)setTimeout(poll,700);else{finished=true;callback({success:false,error:"Request timed out. Check Apps Script Executions."});}return;}finished=true;callback(data||{success:false,error:"Empty response."});};
      script.onerror=()=>{clean();if(attempts<30)setTimeout(poll,700);else{finished=true;callback({success:false,error:"Could not read Apps Script response."});}};
      script.src=url+(url.includes("?")?"&":"?")+"action=apiResult&id="+encodeURIComponent(id)+"&callback="+cb+"&_="+Date.now();
      document.head.appendChild(script);
    };
    setTimeout(poll,900);
  }

  function getPublicAssignments() {
    const url=endpoint(); if(!url)return;
    const cb="ca2Public_"+Date.now(); const script=document.createElement("script");
    window[cb]=data=>{delete window[cb];script.remove();if(!data||!data.success)return;
      const items=data.assignments||[];
      if($("caMetricPublished"))$("caMetricPublished").textContent=items.length;
    };
    script.onerror=()=>{delete window[cb];script.remove();};
    script.src=url+(url.includes("?")?"&":"?")+"action=assignments&callback="+cb+"&_="+Date.now();
    document.head.appendChild(script);
  }

  function loadAnalytics() {
    const box=$("caAnalytics"); if(!box)return;
    box.textContent="Loading analytics…";
    request({action:"facultyAnalytics",token:token()},r=>{
      if(!r||!r.success){box.textContent=(r&&r.error)||"Could not load analytics.";return;}
      const s=r.summary||{};
      const stats=[["Assignments",s.assignments],["Published",s.published],["Closed",s.closed],["Submissions",s.submissions],["Awaiting review",s.pending],["Marks released",s.released],["Average released mark",s.averageReleased==null?"—":s.averageReleased]];
      box.innerHTML=stats.map(x=>'<div class="ca-stat"><span>'+esc(x[0])+'</span><strong>'+esc(x[1]??0)+'</strong></div>').join("");
      const units=Object.entries(r.units||{});
      if(units.length)box.innerHTML+='<div class="ca-unit-summary"><strong>Unit-wise evidence</strong>'+units.map(([u,v])=>'<p>'+esc(u)+': '+esc(v.assignments)+' assignments · '+esc(v.submissions)+' submissions · '+esc(v.co)+' · '+esc(v.btl)+'</p>').join("")+'</div>';
    });
  }

  function loadManager() {
    const box=$("caManageAssignments"); if(!box)return;
    box.textContent="Loading assignments…";
    request({action:"manageAssignments",token:token()},r=>{
      if(!r||!r.success){box.textContent=(r&&r.error)||"Could not load assignments.";return;}
      const list=r.assignments||[];
      if(!list.length){box.textContent="No assignments have been created.";return;}
      box.innerHTML=list.map(a=>'<article class="ca-manage-card" data-ca-card="'+esc(a.id)+'"><h4>'+esc(a.title)+' <small>('+esc(a.status)+')</small></h4><div class="ca-manage-grid"><div><label>Title<input data-f="title" value="'+esc(a.title)+'" maxlength="160"></label><label>Unit<select data-f="unit">'+["Unit I","Unit II","Unit III","Unit IV","Unit V","Unit VI"].map(u=>'<option '+(a.unit===u?"selected":"")+'>'+u+'</option>').join("")+'</select></label><label>Due date<input data-f="dueDate" type="date" value="'+esc(a.dueDate)+'"></label><label>Maximum marks<input data-f="maxMarks" type="number" min="1" max="100" value="'+esc(a.maxMarks)+'"></label></div><div><label>Instructions<textarea data-f="description" rows="3">'+esc(a.description)+'</textarea></label><label>Rubric<textarea data-f="rubric" rows="2">'+esc(a.rubric)+'</textarea></label><label>CO<input data-f="co" value="'+esc(a.co)+'" placeholder="CO1"></label><label>BTL<input data-f="btl" value="'+esc(a.btl)+'" placeholder="BTL3 – Apply"></label><label>Status<select data-f="status">'+["Published","Closed","Unpublished"].map(v=>'<option '+(a.status===v?"selected":"")+'>'+v+'</option>').join("")+'</select></label></div></div><button type="button" class="btn btn-primary" data-ca-save="'+esc(a.id)+'">Save changes</button><span class="agent-status" data-ca-msg="'+esc(a.id)+'"></span></article>').join("");
      box.querySelectorAll("[data-ca-save]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=btn.closest("[data-ca-card]"),id=btn.dataset.caSave,p={action:"updateAssignment",token:token(),id};
        card.querySelectorAll("[data-f]").forEach(el=>p[el.dataset.f]=el.value);
        const msg=card.querySelector("[data-ca-msg]");msg.textContent="Saving…";btn.disabled=true;
        request(p,x=>{btn.disabled=false;msg.textContent=x&&x.success?"Saved.":(x&&x.error)||"Update failed.";if(x&&x.success){loadAnalytics();}});
      }));
    });
  }

  function exportSubmissions() {
    const btn=$("caExportSubmissions");if(btn)btn.disabled=true;
    request({action:"facultySubmissions",token:token()},r=>{
      if(btn)btn.disabled=false;
      if(!r||!r.success){alert((r&&r.error)||"Could not export submissions.");return;}
      const rows=[["Assignment","Student Name","Roll Number","Submitted At","Status","Final Marks","Maximum Marks","AI Feedback","Answer","Drive Link"]];
      (r.submissions||[]).forEach(s=>rows.push([s.assignmentTitle,s.name,s.roll,s.submittedAt,s.status,s.finalMarks,s.maxMarks,s.aiFeedback,s.answer,s.driveLink]));
      const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
      const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="KCET_CS25C12_Submissions_"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    });
  }

  document.addEventListener("DOMContentLoaded",()=>{
    getPublicAssignments();
    if($("caRefreshAnalytics"))$("caRefreshAnalytics").addEventListener("click",loadAnalytics);
    if($("caLoadManage"))$("caLoadManage").addEventListener("click",loadManager);
    if($("caExportSubmissions"))$("caExportSubmissions").addEventListener("click",exportSubmissions);
    if($("facultyLogin"))$("facultyLogin").addEventListener("click",()=>setTimeout(()=>{if(token()){loadAnalytics();loadManager();}},1200));
    if($("loadAgentSubmissions"))$("loadAgentSubmissions").addEventListener("click",()=>setTimeout(loadAnalytics,1800));
    if(token()){loadAnalytics();loadManager();}
  });
})();
