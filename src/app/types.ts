export type TxType =
  | 'income'
  | 'expense'
  | 'salary'
  | 'transfer'
  | 'credit'
  | 'egg-collection'
  | 'owner-fund'
  | 'fund-return';

export type Tab = 'dashboard' | 'ledger' | 'credit' | 'people' | 'report' | 'settings';
export type AppMode = 'locked' | 'master' | 'view';

export interface ColorDef {
  bg: string;
  text: string;
}

export interface Payment {
  amount: number;
  receiver: string;
  receiverName?: string;
  date: string;
  note: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  date: string;
  ts: number;
  person?: string;
  desc: string;
  cat?: string;
  note?: string;
  crates?: number;
  source?: string;
  buyer?: string;
  transferFrom?: string;
  transferTo?: string;
  transferRef?: string;
  creditBuyer?: string;
  creditTotal?: number;
  creditPaid?: number;
  creditSeller?: string;
  creditReceiver?: string;
  creditReceiverName?: string;
  payments?: Payment[];
  seller?: string;
  sellerName?: string;
  ownerSender?: string;
  ownerReceiver?: string;
  ownerName?: string;
  frSender?: string;
  frReceiver?: string;
  employee?: string;
  employeeName?: string;
  salaryPaidBy?: string;
  isPickup?: boolean;
  // Tray inventory fields
  trayPacks?: number;          // set when expense cat === 'Tray Stock'
  trayPiecesPerPack?: number;  // set when expense cat === 'Tray Stock'
  eggTraysUsed?: number;       // trays deducted (computed from eggPieces ÷ 30)
  eggPieces?: number;          // raw eggs collected in pieces
}
