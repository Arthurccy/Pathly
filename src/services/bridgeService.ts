import { BankAccount, Category, Transaction } from '../types';

const BRIDGE_BASE_URL = 'https://api.bridgeapi.io/v2';
const BRIDGE_PROXY_URL = '/api/bridge-proxy';
const STORAGE_KEY_CLIENT_ID = 'pathly_bridge_client_id';
const STORAGE_KEY_CLIENT_SECRET = 'pathly_bridge_client_secret';
const STORAGE_KEY_USER_UUID = 'pathly_bridge_user_uuid';
const STORAGE_KEY_USER_TOKEN = 'pathly_bridge_user_token';

export interface BridgeBank {
  id: number;
  name: string;
  country_code: string;
  logo_url?: string;
  primary_color?: string;
}

export interface BridgeAccount {
  id: number;
  name: string;
  balance: number;
  status: number;
  status_code_info?: string;
  currency_code: string;
  type: string;
  updated_at: string;
  bank_id?: number;
}

export interface BridgeRawTransaction {
  id: number;
  clean_description?: string;
  raw_description?: string;
  bank_description?: string;
  amount: number;
  date: string;
  booking_date?: string;
  value_date?: string;
  account_id: number;
  category_id?: number;
  is_deleted?: boolean;
}

export class BridgeService {
  public static setCredentials(clientId: string, clientSecret: string) {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
    localStorage.setItem(STORAGE_KEY_CLIENT_SECRET, clientSecret.trim());
  }

  public static getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID) || import.meta.env.VITE_BRIDGE_CLIENT_ID || 'sandbox_id_2eadbe7777b344cba29daa5da1aefb4e';
    const clientSecret = localStorage.getItem(STORAGE_KEY_CLIENT_SECRET) || import.meta.env.VITE_BRIDGE_CLIENT_SECRET || 'sandbox_secret_XxYMBmXOJQnIszup9zNZFc7GhKKzOc1NqsbOsU4IOVukEzncamgNJZSTVorLzuzR';
    return { clientId, clientSecret };
  }

  public static isConfigured(): boolean {
    const { clientId, clientSecret } = this.getCredentials();
    return Boolean(clientId && clientSecret);
  }

  private static getHeaders(userToken?: string): Record<string, string> {
    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Veuillez d\'abord saisir votre Client ID et Client Secret Bridge (Bankin\').');
    }

    const headers: Record<string, string> = {
      'Client-Id': clientId,
      'Client-Secret': clientSecret,
      'Bridge-Version': '2021-06-01',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    return headers;
  }

  private static async fetchWithFallback(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // 1. Try Vercel / Vite proxy endpoint (/api/bridge-proxy/...)
    try {
      const response = await fetch(`${BRIDGE_PROXY_URL}${endpoint}`, options);
      if (response.status !== 404) {
        return response;
      }
    } catch (e) {
      // Ignore proxy error and fall through
    }

    // 2. Try CORS proxy fallback
    try {
      const corsUrl = `https://corsproxy.io/?${encodeURIComponent(`${BRIDGE_BASE_URL}${endpoint}`)}`;
      const response = await fetch(corsUrl, options);
      if (response.ok || response.status === 400 || response.status === 401 || response.status === 403) {
        return response;
      }
    } catch (e) {
      // Ignore CORS proxy error and fall through
    }

    // 3. Fallback to direct URL
    return fetch(`${BRIDGE_BASE_URL}${endpoint}`, options);
  }

  public static async listBanks(): Promise<BridgeBank[]> {
    const headers = this.getHeaders();
    const response = await this.fetchWithFallback(`/banks?limit=100&country_code=FR`, { headers });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Erreur lors de la récupération des banques Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || [];
  }

  public static async getOrCreateUserToken(email = 'user@pathly.app'): Promise<string> {
    const cachedToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN);
    if (cachedToken) return cachedToken;

    const headers = this.getHeaders();
    
    // Create a new user for Bridge API
    const response = await this.fetchWithFallback(`/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      // If user already exists, attempt authentication directly
      if (response.status !== 400 && response.status !== 409) {
        throw new Error(err.message || `Impossible de créer l'utilisateur Bridge (${response.status})`);
      }
    }

    const data = await response.json().catch(() => ({}));
    const userUuid = data.uuid;
    
    // Authenticate user to get user_token
    const authResp = await this.fetchWithFallback(`/users/authenticate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email }),
    });

    if (!authResp.ok) {
      const err = await authResp.json().catch(() => ({}));
      throw new Error(err.message || `Impossible d'authentifier l'utilisateur Bridge (${authResp.status})`);
    }

    const authData = await authResp.json();
    const token = authData.user_token;

    if (userUuid) localStorage.setItem(STORAGE_KEY_USER_UUID, userUuid);
    if (token) localStorage.setItem(STORAGE_KEY_USER_TOKEN, token);

    return token;
  }

  public static async createConnectUrl(redirectUrl: string): Promise<string> {
    const userToken = await this.getOrCreateUserToken();
    const headers = this.getHeaders(userToken);

    const response = await this.fetchWithFallback(`/connect/items/add/url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        callback_url: redirectUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Erreur de création du lien de connexion Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.redirect_url;
  }

  public static async listAccounts(): Promise<BridgeAccount[]> {
    const userToken = await this.getOrCreateUserToken();
    const headers = this.getHeaders(userToken);

    const response = await this.fetchWithFallback(`/accounts`, { headers });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Impossible de récupérer les comptes Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || [];
  }

  public static async listTransactions(): Promise<BridgeRawTransaction[]> {
    const userToken = await this.getOrCreateUserToken();
    const headers = this.getHeaders(userToken);

    const response = await this.fetchWithFallback(`/transactions?limit=500`, { headers });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Impossible de récupérer les transactions Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || [];
  }

  public static autoCategorizeTransaction(
    description: string,
    amount: number,
    categories: Category[]
  ): string {
    const descLower = description.toLowerCase();

    const categoryRules: Array<{ keywords: string[]; nameMatches: string[] }> = [
      { keywords: ['leclerc', 'carrefour', 'auchan', 'lidl', 'intermarche', 'aldi', 'monoprix', 'casino', 'picard', 'super u'], nameMatches: ['courses', 'alimentation'] },
      { keywords: ['total', 'shell', 'bp', 'esso', 'station', 'carburant', 'essence', 'gazole'], nameMatches: ['essence', 'carburant', 'transport'] },
      { keywords: ['mcdonald', 'burger', 'kebab', 'restaurant', 'ubereats', 'deliveroo', 'starbucks', 'dominos'], nameMatches: ['restaurants', 'resto'] },
      { keywords: ['uber', 'vtc', 'sncf', 'ratp', 'navigo', 'blablacar'], nameMatches: ['transport', 'déplacement'] },
      { keywords: ['edf', 'engie', 'totalenergies', 'veolia', 'eau', 'électricité'], nameMatches: ['logement', 'factures'] },
      { keywords: ['sfr', 'orange', 'free', 'bouygues', 'internet', 'mobile', 'sosh', 'red'], nameMatches: ['tél & internet', 'téléphone', 'internet'] },
      { keywords: ['assurance', 'macif', 'maaf', 'gmf', 'allianz', 'axa'], nameMatches: ['assurances', 'assurance'] },
      { keywords: ['salaire', 'virement recu', 'paie', 'valdepharm', 'vdp'], nameMatches: ['salaire', 'revenus'] },
      { keywords: ['prêt', 'credit', 'emprunt', 'mensualité'], nameMatches: ['dettes', 'prêt'] },
      { keywords: ['coiffeur', 'salon', 'barber'], nameMatches: ['coiffeur', 'beauté'] },
      { keywords: ['amazon', 'fnac', 'darty', 'steam', 'netflix', 'spotify', 'apple'], nameMatches: ['loisirs & plaisirs', 'achats', 'culture'] },
    ];

    for (const rule of categoryRules) {
      if (rule.keywords.some(kw => descLower.includes(kw))) {
        const categoryMatch = categories.find(cat =>
          rule.nameMatches.some(match => cat.name.toLowerCase().includes(match))
        );
        if (categoryMatch) return categoryMatch.id;
      }
    }

    if (amount > 0) {
      const incomeCat = categories.find(c => c.type === 'income');
      if (incomeCat) return incomeCat.id;
    }

    const expenseCat = categories.find(c => c.type === 'expense');
    return expenseCat ? expenseCat.id : categories[0]?.id || '';
  }

  public static normalizeTransaction(
    rawTx: BridgeRawTransaction,
    accountId: string,
    userId: string,
    categories: Category[]
  ): Transaction {
    const amount = rawTx.amount;
    const dateStr = rawTx.date || rawTx.booking_date || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr);
    const description = rawTx.clean_description || rawTx.raw_description || rawTx.bank_description || 'Opération bancaire';

    const txId = `bridge_${rawTx.id}`;
    const isIncome = amount > 0;
    const categoryId = this.autoCategorizeTransaction(description, amount, categories);

    return {
      id: txId,
      userId,
      accountId,
      amount: Math.abs(amount),
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
