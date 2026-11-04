const CA={COURSE:'CS25C12 - Algorithms',TZ:'Asia/Kolkata',SHEETS:{assignments:['ID','Title','Unit','Description','DueDate','MaxMarks','Rubric','Status','CreatedAt'],submissions:['ID','AssignmentID','AssignmentTitle','Name','Roll','Answer','DriveLink','SubmittedAt','ReceiptHash','DraftMarks','AIFeedback','Status','FinalMarks','FacultyFeedback','ReleasedAt'],marks:['SubmissionID','AssignmentTitle','Name','Roll','Marks','MaxMarks','Feedback','ApprovedAt']}};
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
function caDispatch_(p){switch(p.action){case'login':return caLogin_(p.password);case'createAssignmentPin':return caCreateWithPin_(p);case'createAssignment':caAuth_(p.token);return caCreate_(p);case'submit':return caSubmit_(p);case'ask':return{success:true,answer:caGemini_('You are KCET Class Agent for undergraduate CS25C12 Algorithms. Explain concepts clearly with examples and pseudocode, encourage learning, do not fabricate references, redirect unrelated questions to Algorithms. Question: '+String(p.question||'').slice(0,2000))};case'facultySubmissions':caAuth_(p.token);return{success:true,submissions:caSubmissions_()};case'evaluate':caAuth_(p.token);return caEvaluate_(p.submissionId);case'approve':caAuth_(p.token);return caApprove_(p);case'releasedMark':return caReleased_(p);default:throw Error('Unknown action')}}
function caDb_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('Run setupClassAgent() first');return SpreadsheetApp.openById(id)}
function caSh_(n){const s=caDb_().getSheetByName(n);if(!s)throw Error('Missing '+n+'; run setupClassAgent()');return s}
function caRows_(n){return caSh_(n).getDataRange().getValues()}
function caPublicAssignments_(){return caRows_('CA Assignments').slice(1).filter(r=>r[7]==='Published').map(r=>({id:String(r[0]),title:String(r[1]),unit:String(r[2]),description:String(r[3]),dueDate:String(r[4]),maxMarks:Number(r[5])})).reverse()}
function caCreateWithPin_(p){const expected=PropertiesService.getScriptProperties().getProperty('CA_ASSIGNMENT_PIN_SHA256');if(!expected)throw Error('Assignment posting PIN is not configured. Ask the Apps Script administrator to set CA_ASSIGNMENT_PIN_SHA256.');const supplied=String(p.pin||'');if(!supplied||caHash_(supplied)!==expected)throw Error('Incorrect assignment posting PIN');return caCreate_(p)}
function caCreate_(p){const t=String(p.title||'').trim(),d=String(p.description||'').trim(),due=String(p.dueDate||''),m=Number(p.maxMarks);if(!t||!d||!due||!Number.isFinite(m)||m<1||m>100)throw Error('Enter title, instructions, due date and marks (1–100)');const id=Utilities.getUuid();caSh_('CA Assignments').appendRow([id,t,String(p.unit||'Unit I'),d,due,m,String(p.rubric||'Correctness, explanation, complexity and presentation'),'Published',new Date()]);return{success:true,id}}
function caSubmit_(p){
  const name=String(p.name||'').trim(),roll=String(p.roll||'').trim(),aid=String(p.assignmentId||''),fileName=String(p.fileName||'').trim(),mime=String(p.mimeType||'').trim().toLowerCase(),encoded=String(p.fileBase64||'');
  if(!name||!roll||!aid||!fileName||!encoded)throw Error('Enter your name and roll number, select an assignment and attach one file');
  if(name.length>100||roll.length>40||fileName.length>180)throw Error('Input too long');
  const ext=(fileName.match(/\.([^.]+)$/)||[])[1],allowed={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',zip:'application/zip'};
  if(!ext||!allowed[ext.toLowerCase()])throw Error('Unsupported file type. Upload PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX or ZIP');
  if(encoded.length>Math.ceil(8*1024*1024*4/3)+8)throw Error('File exceeds the 8 MB upload limit');
  if(mime&&mime!=='application/octet-stream'&&mime!==allowed[ext.toLowerCase()])throw Error('The file type does not match its extension. Please select the original file');
  const assignment=caPublicAssignments_().find(x=>x.id===aid);if(!assignment)throw Error('Assignment is not active');
  const receipt=Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase(),id=Utilities.getUuid(),folderId=PropertiesService.getScriptProperties().getProperty('CA_DRIVE_FOLDER_ID');
  if(!folderId)throw Error('Drive folder not configured. Run setupClassAgent() first');
  let bytes;try{bytes=Utilities.base64Decode(encoded)}catch(err){throw Error('The uploaded file could not be decoded. Please try again')}
  if(bytes.length>8*1024*1024)throw Error('File exceeds the 8 MB upload limit');
  const safeName=(roll+'_'+assignment.title+'_'+Utilities.formatDate(new Date(),CA.TZ,'yyyyMMdd_HHmmss')+'_'+fileName).replace(/[\\\\/:*?"<>|]/g,'_');
  const blob=Utilities.newBlob(bytes,allowed[ext.toLowerCase()],safeName),file=DriveApp.getFolderById(folderId).createFile(blob);
  caSh_('CA Submissions').appendRow([id,aid,assignment.title,name,roll,'',file.getUrl(),new Date(),caHash_(receipt+'|'+roll.toLowerCase()),'','','Submitted','','','']);
  return{success:true,receiptCode:receipt};
}
function caLogin_(pw){const expected=PropertiesService.getScriptProperties().getProperty('FACULTY_PASSWORD_SHA256');if(!expected)throw Error('Faculty password is not configured; follow CLASS_AGENT_SETUP.md');if(!pw||caHash_(pw)!==expected)throw Error('Incorrect faculty password');const token=Utilities.getUuid()+Utilities.getUuid();CacheService.getScriptCache().put('ca_'+caHash_(token),'1',21600);return{success:true,token}}
function caAuth_(t){if(!t||CacheService.getScriptCache().get('ca_'+caHash_(String(t)))!=='1')throw Error('Faculty session expired; sign in again')}
function caMax_(aid){const r=caRows_('CA Assignments').slice(1).find(x=>String(x[0])===aid);return r?Number(r[5]):0}
function caSubmissions_(){return caRows_('CA Submissions').slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),assignmentTitle:String(r[2]),name:String(r[3]),roll:String(r[4]),answer:String(r[5]),driveLink:String(r[6]),submittedAt:r[7] instanceof Date?Utilities.formatDate(r[7],CA.TZ,'dd MMM yyyy HH:mm'):String(r[7]),draftMarks:r[9]===''?'':Number(r[9]),aiFeedback:String(r[10]),status:String(r[11]),maxMarks:caMax_(String(r[1]))})).reverse()}
function caFind_(id){const s=caSh_('CA Submissions'),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===String(id))return{s,row:i+1,data:r[i]};throw Error('Submission not found')}
function caEvaluate_(id){const x=caFind_(id),r=x.data,all=caRows_('CA Assignments').slice(1),a=all.find(v=>String(v[0])===String(r[1]));if(!a)throw Error('Assignment not found');const max=Number(a[5]);const prompt='Evaluate this undergraduate Algorithms submission against the rubric. Give provisional score 0-'+max+', evidence-based feedback, strengths and gaps. The submission is a file attachment stored in Drive; you cannot open or inspect the attachment contents in this function. Do not infer its contents or assign a score. Return a provisional score of 0 and feedback stating that faculty must open and assess the attached file manually. Return only JSON {"score":number,"feedback":"...","strengths":"...","gaps":"..."}. Assignment: '+a[1]+' Instructions: '+a[3]+' Rubric: '+a[6]+' Answer: '+r[5]+' Drive link (not opened): '+r[6];const raw=caGemini_(prompt),clean=raw.replace(/^\x60{3}json\s*|\x60{3}\s*$/g,''),v=JSON.parse(clean),score=Math.max(0,Math.min(max,Number(v.score)));if(!Number.isFinite(score))throw Error('AI score invalid');const fb='PROVISIONAL AI FEEDBACK — '+(v.feedback||'')+'\nStrengths: '+(v.strengths||'')+'\nGaps: '+(v.gaps||'');x.s.getRange(x.row,10).setValue(score);x.s.getRange(x.row,11).setValue(fb);x.s.getRange(x.row,12).setValue('AI Draft — Faculty Review Required');return{success:true,score,feedback:fb}}
function caApprove_(p){const x=caFind_(p.submissionId),r=x.data,max=caMax_(String(r[1])),m=Number(p.marks);if(!Number.isFinite(m)||m<0||m>max)throw Error('Marks must be between 0 and '+max);const fb=String(p.feedback||r[10]||'Faculty approved');x.s.getRange(x.row,12).setValue('Released');x.s.getRange(x.row,13).setValue(m);x.s.getRange(x.row,14).setValue(fb);x.s.getRange(x.row,15).setValue(new Date());caSh_('CA Marks').appendRow([r[0],r[2],r[3],r[4],m,max,fb,new Date()]);return{success:true}}
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
function caHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('')}
