import { BankAccount, Category, Transaction } from '../types';

const GOCARDLESS_BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';
const STORAGE_KEY_SECRET_ID = 'pathly_gocardless_secret_id';
const STORAGE_KEY_SECRET_KEY = 'pathly_gocardless_secret_key';
const STORAGE_KEY_TOKEN = 'pathly_gocardless_token';
const STORAGE_KEY_TOKEN_EXP = 'pathly_gocardless_token_exp';

export interface GoCardlessInstitution {
  id: string;
  name: string;
  bic?: string;
  transaction_total_days?: string;
  countries: string[];
  logo?: string;
}

export interface GoCardlessRequisition {
  id: string;
  created: string;
  redirect: string;
  status: string;
  institution_id: string;
  agreement: string;
  reference: string;
  accounts: string[];
  link: string;
}

export interface GoCardlessBalance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
  referenceDate?: string;
}

export interface GoCardlessRawTransaction {
  transactionId?: string;
  entryReference?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  debtorName?: string;
  debtorAccount?: { iban?: string };
  creditorName?: string;
  creditorAccount?: { iban?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
}

export interface GoCardlessAccountDetails {
  id: string;
  iban?: string;
  institution_id?: string;
  status?: string;
  ownerName?: string;
  name?: string;
  product?: string;
  cashAccountType?: string;
}

export class GoCardlessService {
  private static getStoredCredentials(): { secretId: string; secretKey: string } {
    const secretId = localStorage.getItem(STORAGE_KEY_SECRET_ID) || import.meta.env.VITE_GOCARDLESS_SECRET_ID || '';
    const secretKey = localStorage.getItem(STORAGE_KEY_SECRET_KEY) || import.meta.env.VITE_GOCARDLESS_SECRET_KEY || '';
    return { secretId, secretKey };
  }

  public static setCredentials(secretId: string, secretKey: string) {
    localStorage.setItem(STORAGE_KEY_SECRET_ID, secretId.trim());
    localStorage.setItem(STORAGE_KEY_SECRET_KEY, secretKey.trim());
    // Invalidate cached token when credentials change
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_TOKEN_EXP);
  }

  public static getCredentials(): { secretId: string; secretKey: string } {
    return this.getStoredCredentials();
  }

  public static isConfigured(): boolean {
    const { secretId, secretKey } = this.getStoredCredentials();
    return Boolean(secretId && secretKey);
  }

  private static async getAccessToken(): Promise<string> {
    const cachedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const tokenExpStr = localStorage.getItem(STORAGE_KEY_TOKEN_EXP);
    const now = Math.floor(Date.now() / 1000);

    if (cachedToken && tokenExpStr && parseInt(tokenExpStr, 10) > now + 60) {
      return cachedToken;
    }

    const { secretId, secretKey } = this.getStoredCredentials();
    if (!secretId || !secretKey) {
      throw new Error('Veuillez d\'abord configurer votre Secret ID et Secret Key GoCardless dans les paramètres.');
    }

    const response = await fetch(`${GOCARDLESS_BASE_URL}/token/new/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        secret_id: secretId,
        secret_key: secretKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.summary || `Erreur d'authentification GoCardless (${response.status})`);
    }

    const data = await response.json();
    const token = data.access;
    const accessExpires = data.access_expires || 86400; // 24 hours default
    const expirationTimestamp = now + accessExpires;

    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_TOKEN_EXP, expirationTimestamp.toString());

    return token;
  }

  private static async authFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(`${GOCARDLESS_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.summary || `Erreur API GoCardless (${response.status})`);
    }

    return response.json();
  }

  public static async getInstitutions(country = 'FR'): Promise<GoCardlessInstitution[]> {
    return this.authFetch(`/institutions/?country=${country}`);
  }

  public static async createRequisition(
    institutionId: string,
    redirectUrl: string,
    reference?: string
  ): Promise<GoCardlessRequisition> {
    const ref = reference || `pathly_${Date.now()}`;
    return this.authFetch('/requisitions/', {
      method: 'POST',
      body: JSON.stringify({
        redirect: redirectUrl,
        institution_id: institutionId,
        reference: ref,
        user_language: 'FR',
      }),
    });
  }

  public static async getRequisition(requisitionId: string): Promise<GoCardlessRequisition> {
    return this.authFetch(`/requisitions/${requisitionId}/`);
  }

  public static async getAccountDetails(accountId: string): Promise<GoCardlessAccountDetails> {
    const data = await this.authFetch(`/accounts/${accountId}/`);
    return {
      id: accountId,
      ...data.account,
    };
  }

  public static async getAccountBalances(accountId: string): Promise<number> {
    const data = await this.authFetch(`/accounts/${accountId}/balances/`);
    const balances: GoCardlessBalance[] = data.balances || [];
    
    // Prefer expected / interimAvailable / closingBooked balance
    const preferredTypes = ['expected', 'interimAvailable', 'interimBooked', 'closingBooked'];
    let selectedBalance = balances.find(b => preferredTypes.includes(b.balanceType));
    
    if (!selectedBalance && balances.length > 0) {
      selectedBalance = balances[0];
    }

    if (selectedBalance && selectedBalance.balanceAmount?.amount) {
      return parseFloat(selectedBalance.balanceAmount.amount);
    }

    return 0;
  }

  public static async getAccountTransactions(accountId: string): Promise<GoCardlessRawTransaction[]> {
    const data = await this.authFetch(`/accounts/${accountId}/transactions/`);
    const booked = data.transactions?.booked || [];
    const pending = data.transactions?.pending || [];
    return [...booked, ...pending];
  }

  public static autoCategorizeTransaction(
    description: string,
    amount: number,
    categories: Category[]
  ): string {
    const descLower = description.toLowerCase();

    // Map common keywords to category names
    const categoryRules: Array<{ keywords: string[]; nameMatches: string[] }> = [
      { keywords: ['leclerc', 'carrefour', 'auchan', 'lidl', 'intermarche', 'aldi', 'monoprix', 'casino', 'picard', 'super u'], nameMatches: ['courses', 'alimentation'] },
      { keywords: ['total', 'shell', 'bp', 'esso', 'station', 'carburant', 'essence', 'gazole'], nameMatches: ['essence', 'carburant', 'transport'] },
      { keywords: ['mcdonald', 'burger', 'kebab', 'restaurant', 'ubereats', 'deliveroo', 'starbucks', 'dominos'], nameMatches: ['restaurants', 'resto'] },
      { keywords: ['uber', 'vtc', 'sncf', 'ratp', 'navigo', 'blablacar', 'subway'], nameMatches: ['transport', 'déplacement'] },
      { keywords: ['edf', 'engie', 'totalenergies', 'veolia', 'water', 'eau', 'électricité'], nameMatches: ['logement', 'factures'] },
      { keywords: ['sfr', 'orange', 'free', 'bouygues', 'internet', 'mobile', 'sosh', 'red'], nameMatches: ['tél & internet', 'téléphone', 'internet'] },
      { keywords: ['assurance', 'macif', 'maaf', 'gmf', 'allianz', 'axa'], nameMatches: ['assurances', 'assurance'] },
      { keywords: ['salaire', 'virement recu', 'paie', 'valdepharm', 'vdp'], nameMatches: ['salaire', 'revenus'] },
      { keywords: ['prêt', 'credit', 'emprunt', 'mensualité'], nameMatches: ['dettes', 'prêt'] },
      { keywords: ['coiffeur', 'salon', 'barber'], nameMatches: ['coiffeur', 'beauté'] },
      { keywords: ['amazon', 'fnac', 'darty', 'steam', 'netflix', 'spotify', 'apple', 'google'], nameMatches: ['loisirs & plaisirs', 'achats', 'culture'] },
    ];

    for (const rule of categoryRules) {
      if (rule.keywords.some(kw => descLower.includes(kw))) {
        const categoryMatch = categories.find(cat =>
          rule.nameMatches.some(match => cat.name.toLowerCase().includes(match))
        );
        if (categoryMatch) return categoryMatch.id;
      }
    }

    // Default fallbacks
    if (amount > 0) {
      const incomeCat = categories.find(c => c.type === 'income');
      if (incomeCat) return incomeCat.id;
    }

    const expenseCat = categories.find(c => c.type === 'expense');
    return expenseCat ? expenseCat.id : categories[0]?.id || '';
  }

  public static normalizeTransaction(
    rawTx: GoCardlessRawTransaction,
    accountId: string,
    userId: string,
    categories: Category[]
  ): Transaction {
    const rawAmount = parseFloat(rawTx.transactionAmount.amount);
    const dateStr = rawTx.bookingDate || rawTx.valueDate || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr);

    const parts: string[] = [];
    if (rawTx.remittanceInformationUnstructured) {
      parts.push(rawTx.remittanceInformationUnstructured);
    } else if (rawTx.remittanceInformationUnstructuredArray && rawTx.remittanceInformationUnstructuredArray.length > 0) {
      parts.push(rawTx.remittanceInformationUnstructuredArray.join(' '));
    }
    if (rawTx.debtorName) parts.push(rawTx.debtorName);
    if (rawTx.creditorName) parts.push(rawTx.creditorName);
    if (rawTx.additionalInformation) parts.push(rawTx.additionalInformation);

    const description = parts.join(' - ').trim() || 'Opération bancaire';
    const txId = rawTx.transactionId || rawTx.entryReference || `${accountId}_${dateStr}_${Math.abs(rawAmount)}_${description.substring(0, 10)}`;

    const isIncome = rawAmount > 0;
    const categoryId = this.autoCategorizeTransaction(description, rawAmount, categories);

    return {
      id: `gc_${txId}`,
      userId,
      accountId,
      amount: Math.abs(rawAmount),
      description,
      date,
      categoryId,
      type: isIncome ? 'income' : 'expense',
      status: 'completed',
      isRecurring: false,
      gocardlessTransactionId: txId,
    };
  }
}
