"""External Linux observer. No Playwright API changes or application callbacks."""
import os,time,json,re
from pathlib import Path
binary=os.environ['DIAG_BROWSER_BINARY'];mounts=[]
for line in Path('/proc/self/mountinfo').read_text().splitlines():
 left,right=line.split(' - ',1)
 if right.split()[0]=='cgroup2':
  fields=left.split();mounts.append({'root':fields[3].replace('\\040',' '),'mount':fields[4].replace('\\040',' ')})
membership=next((l.split(':',2)[2] for l in Path('/proc/self/cgroup').read_text().splitlines() if l.startswith('0:')),None)
candidates=[]
for m in mounts:
 member=membership or '/';relative=member[len(m['root']):] if m['root']!='/' and member.startswith(m['root']) else member
 for relative_path in [relative,member,'/']:
  candidate=Path(m['mount'])/relative_path.lstrip('/')
  if candidate not in candidates:candidates.append(candidate)
  # Ancestor accounting may carry effective limits that are absent at the leaf.
  while candidate.parent!=candidate and candidate!=Path(m['mount']):
   candidate=candidate.parent
   if candidate.is_relative_to(Path(m['mount'])) and candidate not in candidates:candidates.append(candidate)
names=['memory.current','memory.peak','memory.max','memory.events','memory.pressure','pids.current','pids.max','pids.events']
print(json.dumps({'event':'observer-metadata','epoch':time.time_ns()//1000000,'binary':binary,'cgroupMembership':membership,'cgroupMounts':mounts,'candidateDirectories':[str(p) for p in candidates]}),flush=True)
while True:
 processes=[]
 for directory in Path('/proc').iterdir():
  if not directory.name.isdigit():continue
  try:
   executable=os.readlink(directory/'exe')
   if executable!=binary:continue
   status={key:value.strip() for key,value in (line.split(':',1) for line in (directory/'status').read_text().splitlines())}
   processes.append({'pid':int(directory.name),'ppid':int(status['PPid']),'name':status['Name'],'exe':executable,'rssKiB':int(status.get('VmRSS','0 kB').split()[0]),'threads':int(status['Threads']),'fdCount':len(list((directory/'fd').iterdir()))})
  except (OSError,ValueError,KeyError):continue
 values={}
 for directory in candidates:
  for name in names:
   p=directory/name
   try:values[str(p)]=p.read_text().strip()
   except OSError:pass
 mem={}
 for line in Path('/proc/meminfo').read_text().splitlines():
  key,value=line.split(':',1)
  if key in ['MemTotal','MemAvailable','SwapTotal','SwapFree']:mem[key]=value.strip()
 print(json.dumps({'event':'resource-sample','epoch':time.time_ns()//1000000,'processes':processes,'cgroup':values,'systemMemory':mem}),flush=True)
 time.sleep(1)
