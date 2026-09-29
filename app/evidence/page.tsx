import EvidenceLab from '@/components/evidence-lab';
import AccountGate from '@/components/server-account-gate';
import { accountsEnabled } from '@/server/account';
export default function EvidencePage(){return accountsEnabled() ? <AccountGate><EvidenceLab/></AccountGate> : <EvidenceLab/>;}
