const CA={COURSE:'CS25C12 - Algorithms',TZ:'Asia/Kolkata',SHEETS:{assignments:['ID','Title','Unit','Description','DueDate','MaxMarks','Rubric','Status','CreatedAt','CO','BTL','AllowLate'],submissions:['ID','AssignmentID','AssignmentTitle','Name','Roll','Answer','DriveLink','SubmittedAt','ReceiptHash','DraftMarks','AIFeedback','Status','FinalMarks','FacultyFeedback','ReleasedAt'],marks:['SubmissionID','AssignmentTitle','Name','Roll','Marks','MaxMarks','Feedback','ApprovedAt'],audit:['Timestamp','Actor','Action','RecordID','Details']}};
function doGet(e){
  const p=e&&e.parameter||{};
  let r;
  try{
    if(p.action==='assignments'){
      r={success:true,assignments:caPublicAssignments_()};
    }else if(p.action==='apiResult'){
      const id=String(p.id||'');
      if(!/^[A-Za-z0-9_-]{8,100}$/.test(id))throw Error('Invalid request ID');
      const cache=CacheService.getScriptCache(),stored=cache.get('ca_result_'+id);
      if(stored){cache.remove('ca_result_'+id);r=JSON.parse(stored)}
      else{r={success:false,pending:true}}
    }else if(typeof getExitTicketDashboardData_==='function'){
      r=getExitTicketDashboardData_();
    }else{
      r={success:true,service:'KCET Class Agent',course:CA.COURSE};
    }
  }catch(x){r={success:false,error:String(x.message||x),groups:[]}}
  const b=JSON.stringify(r),c=String(p.callback||'');
  if(c&&/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(c))return ContentService.createTextOutput(c+'('+b+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(b).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  let requestId='',result;
  try{
    const raw=e&&e.parameter&&e.parameter.payload;
    if(!raw)throw Error('Missing payload');
    const payload=JSON.parse(raw);
    requestId=String(payload.requestId||'');
    delete payload.requestId;
    if(!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))throw Error('Missing or invalid request ID');
    result=caDispatch_(payload);
  }catch(err){result={success:false,error:String(err.message||err)}}
  if(requestId){
    try{CacheService.getScriptCache().put('ca_result_'+requestId,JSON.stringify(result),120)}
    catch(cacheError){result={success:false,error:'Could not store response: '+String(cacheError.message||cacheError)}}
  }
  return ContentService.createTextOutput('KCET Class Agent request processed.').setMimeType(ContentService.MimeType.TEXT);
}
function setupClassAgent(){const p=PropertiesService.getScriptProperties();let id=p.getProperty('SPREADSHEET_ID'),ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('KCET Class Agent - CS25C12');if(!id)p.setProperty('SPREADSHEET_ID',ss.getId());Object.keys(CA.SHEETS).forEach(k=>{const n=k==='assignments'?'CA Assignments':k==='submissions'?'CA Submissions':'CA Marks';let s=ss.getSheetByName(n);if(!s)s=ss.insertSheet(n);if(!s.getLastRow()){s.appendRow(CA.SHEETS[k]);s.setFrozenRows(1);s.getRange(1,1,1,CA.SHEETS[k].length).setFontWeight('bold')}});if(!p.getProperty('CA_DRIVE_FOLDER_ID')){const f=DriveApp.createFolder('KCET Class Agent - CS25C12 Submissions');p.setProperty('CA_DRIVE_FOLDER_ID',f.getId())}Logger.log('Setup complete: '+ss.getUrl());Logger.log('Add GEMINI_API_KEY and FACULTY_PASSWORD_SHA256 in Script Properties.')}
function caDispatch_(p){switch(p.action){case'login':return caLogin_(p.password);case'createAssignmentPin':return caCreateWithPin_(p);case'createAssignment':caAuth_(p.token);return caCreate_(p);case'submit':return caSubmit_(p);case'ask':caRateLimit_('ask_'+caHash_(String(p.clientId||'anonymous')),12,3600);return{success:true,answer:caGemini_(caTutorPrompt_(p))};case'facultySubmissions':caAuth_(p.token);return{success:true,submissions:caSubmissions_()};case'evaluate':caAuth_(p.token);return caEvaluate_(p.submissionId);case'approve':caAuth_(p.token);return caApprove_(p);case'releasedMark':return caReleased_(p);case'manageAssignments':caAuth_(p.token);return{success:true,assignments:caAllAssignments_()};case'updateAssignment':caAuth_(p.token);return caUpdateAssignment_(p);case'facultyAnalytics':caAuth_(p.token);return caAnalytics_();default:throw Error('Unknown action')}}
function caDb_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('Run setupClassAgent() first');return SpreadsheetApp.openById(id)}
function caSh_(n){const s=caDb_().getSheetByName(n);if(!s)throw Error('Missing '+n+'; run setupClassAgent()');return s}
function caRows_(n){return caSh_(n).getDataRange().getValues()}
function caPublicAssignments_(){return caRows_('CA Assignments').slice(1).filter(r=>r[7]==='Published').map(r=>({id:String(r[0]),title:String(r[1]),unit:String(r[2]),description:String(r[3]),dueDate:String(r[4]),maxMarks:Number(r[5])})).reverse()}
function caCreateWithPin_(p){caRateLimit_('pin_attempts',12,600);const expected=PropertiesService.getScriptProperties().getProperty('CA_ASSIGNMENT_PIN_SHA256');if(!expected)throw Error('Assignment posting PIN is not configured. Ask the Apps Script administrator to set CA_ASSIGNMENT_PIN_SHA256.');const supplied=String(p.pin||'');if(!supplied||caHash_(supplied)!==expected){caRateLimit_('pin_failures',5,1800);throw Error('Incorrect assignment posting PIN. If attempts continue, contact the administrator.')}return caCreate_(p)}
function caCreate_(p){const t=String(p.title||'').trim(),d=String(p.description||'').trim(),due=String(p.dueDate||''),m=Number(p.maxMarks),co=String(p.co||''),btl=String(p.btl||'');if(!t||!d||!/^\\d{4}-\\d{2}-\\d{2}$/.test(due)||!Number.isFinite(m)||m<1||m>100)throw Error('Enter title, instructions, valid due date and marks (1–100)');const id=Utilities.getUuid();caSh_('CA Assignments').appendRow([id,t,String(p.unit||'Unit I'),d,due,m,String(p.rubric||'Correctness, explanation, complexity and presentation'),'Published',new Date(),co,btl,'No']);caAudit_('Faculty PIN','CREATE_ASSIGNMENT',id,t);return{success:true,id}}
function caSubmit_(p){const name=String(p.name||'').trim(),roll=String(p.roll||'').trim(),aid=String(p.assignmentId||''),answer=String(p.answer||'').trim(),externalLink=String(p.driveLink||'').trim();if(!name||!roll||!aid||(!answer&&!externalLink))throw Error('Enter name, roll number, assignment and answer or Drive link');if(name.length>100||roll.length>40||answer.length>12000)throw Error('Input too long');if(externalLink&&!/^https:\/\/drive\.google\.com\//i.test(externalLink))throw Error('Use a Google Drive share link');const a=caPublicAssignments_().find(x=>x.id===aid);if(!a)throw Error('This assignment is closed or unavailable.');const deadline=Utilities.parseDate(a.dueDate+' 23:59:59',CA.TZ,'yyyy-MM-dd HH:mm:ss');if(new Date()>deadline)throw Error('The submission deadline has passed. Contact your faculty member if an extension is required.');const receipt=Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase(),id=Utilities.getUuid();const folderId=PropertiesService.getScriptProperties().getProperty('CA_DRIVE_FOLDER_ID');if(!folderId)throw Error('Drive folder not configured. Run setupClassAgent() first.');const fileName=(roll+'_'+a.title+'_'+Utilities.formatDate(new Date(),CA.TZ,'yyyyMMdd_HHmmss')+'.txt').replace(/[\\/:*?"<>|]/g,'_');const content='KCET Class Agent — '+CA.COURSE+'\nAssignment: '+a.title+'\nStudent: '+name+'\nRoll number: '+roll+'\nSubmitted: '+new Date()+'\n\nStudent answer:\n'+(answer||'[No typed answer; see shared file link below.]')+'\n\nStudent-provided Drive link (faculty must verify access):\n'+(externalLink||'Not supplied');const file=DriveApp.getFolderById(folderId).createFile(fileName,content,MimeType.PLAIN_TEXT);caSh_('CA Submissions').appendRow([id,aid,a.title,name,roll,answer,file.getUrl(),new Date(),caHash_(receipt+'|'+roll.toLowerCase()),'','','Submitted','','','']);return{success:true,receiptCode:receipt}}
function caLogin_(pw){const expected=PropertiesService.getScriptProperties().getProperty('FACULTY_PASSWORD_SHA256');if(!expected)throw Error('Faculty password is not configured; follow CLASS_AGENT_SETUP.md');if(!pw||caHash_(pw)!==expected)throw Error('Incorrect faculty password');const token=Utilities.getUuid()+Utilities.getUuid();CacheService.getScriptCache().put('ca_'+caHash_(token),'1',21600);return{success:true,token}}
function caAuth_(t){if(!t||CacheService.getScriptCache().get('ca_'+caHash_(String(t)))!=='1')throw Error('Faculty session expired; sign in again')}
function caMax_(aid){const r=caRows_('CA Assignments').slice(1).find(x=>String(x[0])===aid);return r?Number(r[5]):0}
function caSubmissions_(){return caRows_('CA Submissions').slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),assignmentId:String(r[1]),assignmentTitle:String(r[2]),name:String(r[3]),roll:String(r[4]),answer:String(r[5]),driveLink:String(r[6]),finalMarks:r[12]===''?'':Number(r[12]),submittedAt:r[7] instanceof Date?Utilities.formatDate(r[7],CA.TZ,'dd MMM yyyy HH:mm'):String(r[7]),draftMarks:r[9]===''?'':Number(r[9]),aiFeedback:String(r[10]),status:String(r[11]),maxMarks:caMax_(String(r[1]))})).reverse()}
function caFind_(id){const s=caSh_('CA Submissions'),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===String(id))return{s,row:i+1,data:r[i]};throw Error('Submission not found')}
function caEvaluate_(id){const x=caFind_(id),r=x.data,all=caRows_('CA Assignments').slice(1),a=all.find(v=>String(v[0])===String(r[1]));if(!a)throw Error('Assignment not found');const max=Number(a[5]);const prompt='Evaluate this undergraduate Algorithms submission against the rubric. Give provisional score 0-'+max+', evidence-based feedback, strengths and gaps. If only a Drive link is supplied, do not claim to have opened it; say faculty must inspect it and assign no assumed score. Return only JSON {"score":number,"feedback":"...","strengths":"...","gaps":"..."}. Assignment: '+a[1]+' Instructions: '+a[3]+' Rubric: '+a[6]+' Answer: '+r[5]+' Drive link (not opened): '+r[6];const raw=caGemini_(prompt),clean=raw.replace(/^\x60{3}json\s*|\x60{3}\s*$/g,''),v=JSON.parse(clean),score=Math.max(0,Math.min(max,Number(v.score)));if(!Number.isFinite(score))throw Error('AI score invalid');const fb='PROVISIONAL AI FEEDBACK — '+(v.feedback||'')+'\nStrengths: '+(v.strengths||'')+'\nGaps: '+(v.gaps||'');x.s.getRange(x.row,10).setValue(score);x.s.getRange(x.row,11).setValue(fb);x.s.getRange(x.row,12).setValue('AI Draft — Faculty Review Required');return{success:true,score,feedback:fb}}
function caApprove_(p){const x=caFind_(p.submissionId),r=x.data,max=caMax_(String(r[1])),m=Number(p.marks);if(!Number.isFinite(m)||m<0||m>max)throw Error('Marks must be between 0 and '+max);const fb=String(p.feedback||r[10]||'Faculty approved');x.s.getRange(x.row,12).setValue('Released');x.s.getRange(x.row,13).setValue(m);x.s.getRange(x.row,14).setValue(fb);x.s.getRange(x.row,15).setValue(new Date());const ms=caSh_('CA Marks'),rows=ms.getDataRange().getValues();let row=rows.findIndex((v,i)=>i>0&&String(v[0])===String(r[0]));const values=[r[0],r[2],r[3],r[4],m,max,fb,new Date()];if(row>0)ms.getRange(row+1,1,1,values.length).setValues([values]);else ms.appendRow(values);caAudit_('Faculty','APPROVE_RELEASE',String(r[0]),'Marks '+m+'/'+max);return{success:true}}
function caReleased_(p){const roll=String(p.roll||'').trim(),receipt=String(p.receiptCode||'').trim();if(!roll||!receipt)throw Error('Enter roll number and receipt code');const h=caHash_(receipt+'|'+roll.toLowerCase()),r=caRows_('CA Submissions').slice(1).find(x=>String(x[4]).toLowerCase()===roll.toLowerCase()&&String(x[8])===h);if(!r)throw Error('No matching record; check both values');if(r[11]!=='Released')return{success:true,released:false};return{success:true,released:true,assignment:String(r[2]),marks:Number(r[12]),maxMarks:caMax_(String(r[1])),feedback:String(r[13])}}
function caGemini_(prompt){
  const key=PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if(!key)throw Error('GEMINI_API_KEY is missing in Script Properties. Add it under Project Settings > Script Properties.');
  const url='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
  const response=UrlFetchApp.fetch(url,{
    method:'post',
    contentType:'application/json',
    headers:{'x-goog-api-key':key},
    payload:JSON.stringify({
      contents:[{parts:[{text:String(prompt)}]}],
      generationConfig:{temperature:0.2,maxOutputTokens:1200}
    }),
    muteHttpExceptions:true
  });
  const status=response.getResponseCode();
  const raw=response.getContentText();
  let body;
  try{body=JSON.parse(raw)}catch(parseError){throw Error('Gemini returned a non-JSON response (HTTP '+status+'). Check the Apps Script execution log.')}
  if(status<200||status>=300){
    const apiMessage=body&&body.error&&body.error.message?body.error.message:raw.slice(0,700);
    throw Error('Gemini API HTTP '+status+': '+apiMessage);
  }
  const candidate=body&&body.candidates&&body.candidates[0];
  const parts=candidate&&candidate.content&&candidate.content.parts;
  const out=parts?parts.map(part=>part.text||'').join(''):'';
  if(!out)throw Error('Gemini returned no text. Finish reason: '+(candidate&&candidate.finishReason||'unknown'));
  return out.trim();
}
function testGeminiConnection(){
  const answer=caGemini_('Reply with exactly: KCET Gemini connection successful');
  Logger.log(answer);
  return answer;
}

function caRateLimit_(key,limit,seconds){const c=CacheService.getScriptCache(),k='rate_'+key,n=Number(c.get(k)||0);if(n>=limit)throw Error('Too many requests. Please wait and try again.');c.put(k,String(n+1),seconds)}
function caAudit_(actor,action,id,details){try{caSh_('CA Audit').appendRow([new Date(),actor,action,id,String(details||'').slice(0,500)])}catch(e){}}
function caTutorPrompt_(p){const q=String(p.question||'').slice(0,2000),mode=String(p.mode||'explain');const guides={hint:'Give one progressive hint at a time. Do not reveal the complete solution unless asked after attempting.',pseudocode:'Explain the logic and provide language-neutral pseudocode, assumptions and edge cases.',dryrun:'Use a small input and show a clear step-by-step trace in a table.',complexity:'Analyse best, average and worst-case time and auxiliary space, explaining the reasoning.',explain:'Explain the concept at undergraduate level with an example, pseudocode where useful and a short check-for-understanding question.'};return 'You are KCET Class Agent for undergraduate course CS25C12 Algorithms. Stay within algorithm design and analysis. If a question is unrelated, politely redirect to the course. Never invent citations or claim to inspect external files. Encourage independent reasoning and academic integrity. Mode: '+(guides[mode]||guides.explain)+' Student question: '+q}
function caAllAssignments_(){return caRows_('CA Assignments').slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),title:String(r[1]),unit:String(r[2]),description:String(r[3]),dueDate:String(r[4]),maxMarks:Number(r[5]),rubric:String(r[6]),status:String(r[7]),co:String(r[9]||''),btl:String(r[10]||'')})).reverse()}
function caUpdateAssignment_(p){const id=String(p.id||''),s=caSh_('CA Assignments'),rows=s.getDataRange().getValues(),i=rows.findIndex((r,n)=>n>0&&String(r[0])===id);if(i<1)throw Error('Assignment not found');const title=String(p.title||'').trim(),desc=String(p.description||'').trim(),due=String(p.dueDate||''),marks=Number(p.maxMarks),status=String(p.status||'Published');if(!title||!desc||!/^\\d{4}-\\d{2}-\\d{2}$/.test(due)||!Number.isFinite(marks)||marks<1||marks>100||!['Published','Closed','Unpublished'].includes(status))throw Error('Check title, instructions, due date, marks and status.');s.getRange(i+1,2,1,10).setValues([[title,String(p.unit||'Unit I'),desc,due,marks,String(p.rubric||''),status,rows[i][8],String(p.co||''),String(p.btl||'')]]);caAudit_('Faculty','UPDATE_ASSIGNMENT',id,status+'; '+title);return{success:true}}
function caAnalytics_(){const assignments=caAllAssignments_(),subs=caSubmissions_(),released=subs.filter(s=>s.status==='Released'),sum=released.reduce((a,s)=>a+Number(s.finalMarks||0),0),units={};assignments.forEach(a=>{if(!units[a.unit])units[a.unit]={assignments:0,submissions:0,co:a.co||'Not mapped',btl:a.btl||'Not mapped'};units[a.unit].assignments++});subs.forEach(s=>{const a=assignments.find(x=>x.id===s.assignmentId);if(a&&units[a.unit])units[a.unit].submissions++});return{success:true,summary:{assignments:assignments.length,published:assignments.filter(a=>a.status==='Published').length,closed:assignments.filter(a=>a.status==='Closed').length,submissions:subs.length,pending:subs.filter(s=>s.status!=='Released').length,released:released.length,averageReleased:released.length?Math.round(sum/released.length*100)/100:null},units}}

function caHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('')}
