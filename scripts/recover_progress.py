import json,re
from pathlib import Path
history=Path('C:/Users/nitip/.codex/sessions/2026/10/24/rollout-2026-10-24T12-30-05-01a16c63-3bbd-7a22-9bd2-097a81c2cb54.jsonl')
logs=[json.loads(x) for x in history.read_text(encoding='utf-8').splitlines()]
def norm(s):return s.replace('\r\r\n','\n').replace('\r\n','\n')
base=norm(logs[4093]['payload']['item']['aggregated_output'])
s=base[base.index('# ECOSPHERE development progress'):base.index('# ECOSPHERE — first playable slice')].rstrip()+'\n'
failed=set()
for o in logs:
 q=o.get('payload',{})
 if q.get('type')=='custom_tool_call_output' and 'apply_patch verification failed' in str(q.get('output','')):failed.add(q.get('call_id'))
issues=[];applied=[]
for i,o in enumerate(logs):
 if not 4093<i<20359:continue
 q=o.get('payload',{});inp=q.get('input','')
 if q.get('type')=='custom_tool_call' and 'PROGRESS.md' in inp and q.get('call_id') not in failed:
  for m in re.finditer(r'(?:tools\.apply_patch\(|const patch\s*=\s*)("(?:\\.|[^"\\])*")',inp):
   patch=json.loads(m[1]);sections=re.split(r'(?=\*\*\* (?:Update|Add|Delete) File:)',patch)
   for section in sections:
    if not re.match(r'\*\*\* Update File: [^\n]*PROGRESS.md\n',section):continue
    hunks=re.split(r'^@@[^\n]*\n',section,flags=re.M)[1:]
    for h in hunks:
     rows=[]
     for row in h.splitlines():
      if row.startswith('***'):break
      if row and row[0] in ' +-':rows.append(row)
     before='\n'.join(row[1:] for row in rows if row[0] in ' -')
     after='\n'.join(row[1:] for row in rows if row[0] in ' +')
     if not before:s=s.rstrip()+'\n'+after+'\n';applied.append(i)
     elif before in s:s=s.replace(before,after,1);applied.append(i)
     elif after in s:pass
     else:issues.append((i,before[:100]))
 if i==13943:
  cmd=norm(q['item']['command'][-1]);replacement=cmd.split("s.replace('# ECOSPHERE development progress',`",1)[1].split('`))',1)[0]
  s=s.replace('# ECOSPHERE development progress',replacement,1)
 if i==16471:
  s=s.replace('isolated missing-corpse-GLB test remains open.','isolated missing-corpse-GLB test was subsequently completed using a file-free native nursery/simulation/same-origin snapshot (see current result above).',1)
Path('artifacts/progress-recovered.md').write_text(s,encoding='utf-8')
print('bytes',len(s.encode()),'patches',len(applied),'issues',issues)
