import re,json,subprocess,shutil
from pathlib import Path
root=Path('sequence-evidence');text=(root/'runner.log').read_text(errors='replace');owned=[];is_chrome=False
for line in text.splitlines():
 if 'pw:browser <launching>' in line:is_chrome='chrome-headless-shell' in line
 match=re.search(r'pw:browser <launched> pid=(\d+)',line)
 if match and is_chrome:owned.append(int(match[1]))
crashed=sorted(set(int(p) for p in re.findall(r'\[pid=(\d+)\]\[err\] Received signal 11',text))&set(owned));receipts=[]
if shutil.which('coredumpctl'):
 for pid in crashed[:3]:
  receipt={'pid':pid,'ownedLaunchedChrome':True};receipts.append(receipt)
  for operation,args in [('info',['--no-pager','info',str(pid)]),('dump',['dump',str(pid),'--output='+str(root/'dumps'/('chrome-'+str(pid)+'.core'))])]:
   try:
    result=subprocess.run(['coredumpctl',*args],capture_output=True,timeout=30);(root/('coredumpctl-'+str(pid)+'-'+operation+'.txt')).write_bytes(result.stdout+result.stderr);receipt[operation]={'exitCode':result.returncode}
   except subprocess.TimeoutExpired as e:
    (root/('coredumpctl-'+str(pid)+'-'+operation+'-timeout.txt')).write_bytes((e.stdout or b'')+(e.stderr or b''));receipt[operation]={'result':'INCOMPLETE_TIMEOUT','seconds':30}
else:receipts.append({'result':'UNAVAILABLE','reason':'coredumpctl is not installed'})
binary=next((line.split(None,1)[1] for line in (root/'executable-sha256.txt').read_text().splitlines() if 'chrome-headless-shell' in line),None)
for receipt in receipts:
 pid=receipt.get('pid');core=root/'dumps'/('chrome-'+str(pid)+'.core')
 if receipt.get('dump',{}).get('exitCode')==0 and core.is_file():
  if shutil.which('gdb') and binary:
   try:
    result=subprocess.run(['gdb','--batch','-ex','set pagination off','-ex','info sharedlibrary','-ex','thread apply all bt',binary,str(core)],capture_output=True,timeout=30)
    (root/('gdb-'+str(pid)+'.txt')).write_bytes(result.stdout+result.stderr);receipt['symbolizationAttempt']={'exitCode':result.returncode,'limitation':'Available local symbols only; inspect unresolved frames before claiming symbolization.'}
   except subprocess.TimeoutExpired as e:
    (root/('gdb-'+str(pid)+'-timeout.txt')).write_bytes((e.stdout or b'')+(e.stderr or b''));receipt['symbolizationAttempt']={'result':'INCOMPLETE_TIMEOUT'}
  else:receipt['symbolizationAttempt']={'result':'UNAVAILABLE','reason':'gdb or executable path unavailable'}
(root/'coredump-extraction-receipts.json').write_text(json.dumps({'ownedChromePids':owned,'signal11Pids':crashed,'receipts':receipts,'bound':'At most three owned native Chrome dumps, 30 seconds per extraction; partial/failed results retained.'},indent=2))
