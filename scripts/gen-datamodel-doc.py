# Erzeugt die Feld-/Enum-Referenz fuer docs/datenmodell.md aus prisma/schema.prisma.
# Aufruf aus dem Repo-Root: python3 scripts/gen-datamodel-doc.py > /tmp/ref.md
import re,sys
with open('prisma/schema.prisma') as f:
    src=f.read().splitlines()
blocks=[];cur=None;doc=[]
for l in src:
    s=l.strip()
    m=re.match(r'^(model|enum)\s+(\w+)\s*\{',s)
    if m and cur is None:
        cur={'kind':m[1],'name':m[2],'lines':[],'doc':doc};doc=[];continue
    if cur is None:
        if s.startswith('///') or s.startswith('//'): doc.append(s.lstrip('/').strip())
        elif s: doc=[]
        continue
    if s=='}': blocks.append(cur);cur=None;continue
    cur['lines'].append(s)
models={b['name']:b for b in blocks if b['kind']=='model'}
enums={b['name']:b for b in blocks if b['kind']=='enum'}
groups=[
('Identität, Auth & Rollen',['User','Account','Session','VerificationToken','OwnerSetupToken','UserRole','AppRole','Permission','AppRolePermission','UserAppRole']),
('Produktionen & Mitgliedschaft',['Show','ProductionMembership','MemberInvite','MemberInviteRedemption','MemberOnboardingProfile','ProductionOnboarding','PhotoConsent']),
('Stück: Figuren, Szenen, Besetzung',['Character','CharacterCasting','Scene','SceneCharacter','SceneBreakdownItem']),
('Gewerke (Departments)',['Department','DepartmentMembership','DepartmentTask','DepartmentTaskAssignment','DepartmentPermission','DepartmentEvent','DepartmentDocument']),
('Proben & Anwesenheit',['Rehearsal','RehearsalTemplate','RehearsalInvitee','RehearsalAttendance','RehearsalAttendanceLog','RehearsalProposal','FinalRehearsalDuty','Notification','NotificationRecipient']),
('Verfügbarkeit & Sperrliste',['AvailabilityDay','AvailabilityTemplate','BlockedDay','Availability']),
('Persönliche Mitgliedsdaten',['MemberMeasurement','MemberSize','DietaryRestriction','Interest','UserInterest','MemberRolePreference']),
('Finanzen',['FinanceBudget','FinanceEntry','FinanceAttachment','FinanceLog']),
('Dateien, Issues, Aufgaben',['FileLibraryFolder','FileLibraryItem','FileLibraryFolderAccess','Issue','IssueComment','Task','Announcement']),
('Inventar, Tickets & Offline-Sync',['InventoryItem','Ticket','TicketScanEvent','SyncEvent','SyncMutation']),
('Website & Einstellungen (Singletons)',[]),
('Analytics',[]),
]
used={n for _,ns in groups for n in ns}
rest=[n for n in models if n not in used]
groups[-2]=(groups[-2][0],[n for n in rest if not n.startswith('Analytics')])
groups[-1]=(groups[-1][0],[n for n in rest if n.startswith('Analytics')])
out=[]
def esc(x): return x.replace('|','\\|')
for title,names in groups:
    out.append(f'\n## {title}\n')
    for n in names:
        b=models[n]
        out.append(f'### `{n}`\n')
        if b['doc']: out.append('> '+' '.join(b['doc'])+'\n')
        out.append('| Feld | Typ | Attribute / Beschreibung |\n|---|---|---|')
        extra=[];pend=[]
        for l in b['lines']:
            if l.startswith('///') or l.startswith('//'): pend.append(l.lstrip('/').strip());continue
            if not l: continue
            if l.startswith('@@'): extra.append(l);pend=[];continue
            cm=''
            if '//' in l: l,cm=l.split('//',1);l=l.strip();cm=cm.strip()
            p=l.split(None,2)
            if len(p)<2: continue
            f,t=p[0],p[1];a=p[2] if len(p)>2 else ''
            a=re.sub(r'\s+',' ',a)
            desc=' '.join([x for x in [a,' '.join(pend),cm] if x])
            tt=t.rstrip('[]?')
            if tt in models: t=f'→ `{t}`'
            elif tt in enums: t=f'`{t}` (enum)'
            else: t=f'`{t}`'
            out.append(f'| `{f}` | {t} | {esc(desc)} |');pend=[]
        if extra: out.append('\n'+'\n'.join(f'- `{e}`' for e in extra))
        out.append('')
out.append('\n## Enums\n')
out.append('| Enum | Werte |\n|---|---|')
for n,b in enums.items():
    vals=[]
    for l in b['lines']:
        if not l or l.startswith('//'): continue
        v,_,c=l.partition('//');v=v.strip()
        vals.append(f'`{v}`'+(f' ({c.strip()})' if c.strip() else ''))
    out.append(f'| `{n}` | {esc(", ".join(vals))} |')
print('\n'.join(out))
print(len(models),len(enums),file=sys.stderr)
