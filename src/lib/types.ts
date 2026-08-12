export type Role = "super_admin" | "landlord_admin" | "admin" | "tenant";
export type UnitStatus = "active" | "inactive" | "empty" | "not_used";
export type BillingPeriodStatus = "draft" | "review" | "issued" | "locked";
export type ReadingStatus = "draft" | "confirmed" | "billed";
export type PaidStatus = "unpaid" | "part_paid" | "paid" | "credited";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";
export type SmsStatus = "queued" | "sent" | "failed" | "simulated";
export type RentFrequency = "weekly_monday" | "calendar_month" | "manual";
export type RentChargeStatus = "due" | "paid" | "credited" | "cancelled";

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  createdAt: string;
}

export interface Estate {
  id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
  defaultKwhRatePence: number;
  defaultStandingChargePence: number;
  defaultLevyPence: number;
  currency: "GBP";
  smsSenderName: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  estateId: string;
  unitReference: string;
  tenantName: string;
  tenantContactName: string;
  tenantEmail: string;
  tenantMobile: string;
  status: UnitStatus;
  notes?: string;
  freeSupplyMeter: boolean;
  customKwhRatePence?: number;
  customStandingChargePence?: number;
  openingBalancePence: number;
  currentBalancePence: number;
  tenantAccessToken: string;
  tenantAccessTokenCreatedAt?: string;
  tenantAccessEnabled: boolean;
  createdAt: string;
}

export interface BillingPeriod {
  id: string;
  estateId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: BillingPeriodStatus;
  kwhRatePence: number;
  standingChargePence: number;
  levyPence: number;
  createdBy: string;
  issuedAt?: string;
  createdAt: string;
}

export interface MeterReading {
  id: string;
  billingPeriodId: string;
  unitId: string;
  previousReading: number;
  currentReading: number;
  usage: number;
  isEstimated: boolean;
  readingNotes?: string;
  readingStatus: ReadingStatus;
  enteredBy: string;
  enteredAt: string;
  photoUrl?: string;
}

export interface Bill {
  id: string;
  billingPeriodId: string;
  unitId: string;
  previousReading: number;
  currentReading: number;
  usage: number;
  kwhRatePence: number;
  standingChargePence: number;
  levyPence: number;
  usageCostPence: number;
  subtotalPence: number;
  outstandingCarriedForwardPence: number;
  totalDuePence: number;
  roundedTotalPence: number;
  amountPaidPence: number;
  remainingBalancePence: number;
  paidStatus: PaidStatus;
  paymentDate?: string;
  adminNotes?: string;
  tenantNotes?: string;
  pdfUrl?: string;
  issuedAt?: string;
  smsSentAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  billId: string;
  unitId: string;
  amountPence: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
  recordedBy: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  createdAt: string;
}

export interface SmsTemplate {
  id: string;
  templateKey: import("./sms-template-definitions").SmsTemplateKey;
  displayName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmsLog {
  id: string;
  billId: string;
  unitId: string;
  mobile: string;
  message: string;
  status: SmsStatus;
  provider: string;
  providerReference: string;
  failureReason?: string;
  sentAt?: string;
  createdAt: string;
}



export interface RentSetting {
  id: string;
  unitId: string;
  enabled: boolean;
  frequency: RentFrequency;
  amountPence: number;
  startDate: string;
  dueDayOfMonth?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentCharge {
  id: string;
  unitId: string;
  dueDate: string;
  amountPence: number;
  status: RentChargeStatus;
  notes?: string;
  createdAt: string;
}

export interface RentPayment {
  id: string;
  unitId: string;
  amountPence: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
  recordedBy: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  createdAt: string;
}