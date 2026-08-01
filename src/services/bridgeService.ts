import { BankAccount, Category, Transaction } from '../types';

const BRIDGE_BASE_URL = 'https://api.bridgeapi.io';
const BRIDGE_PROXY_URL = '/api/bridge-proxy';
const STORAGE_KEY_CLIENT_ID = 'pathly_bridge_client_id';
const STORAGE_KEY_CLIENT_SECRET = 'pathly_bridge_client_secret';
const STORAGE_KEY_USER_UUID = 'pathly_bridge_user_uuid';

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

  private static getHeaders(accessToken?: string): Record<string, string> {
    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Veuillez d\'abord saisir votre Client ID et Client Secret Bridge (Bankin\').');
    }

    const headers: Record<string, string> = {
      'Client-Id': clientId,
      'Client-Secret': clientSecret,
      'Bridge-Version': '2025-01-15',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  }

  private static async fetchWithFallback(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // 1. Try Vercel Serverless Proxy endpoint (/api/bridge-proxy?path=...)
    try {
      const proxyPath = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
      const proxyUrl = `${BRIDGE_PROXY_URL}?path=${encodeURIComponent(proxyPath)}`;
      const response = await fetch(proxyUrl, options);
      if (response.status < 500) {
        return response;
      }
    } catch (e) {
      // Fall through if local network issue
    }

    // 2. Try CORS proxy fallback
    try {
      const corsUrl = `https://corsproxy.io/?${encodeURIComponent(`${BRIDGE_BASE_URL}${endpoint}`)}`;
      const response = await fetch(corsUrl, options);
      if (response.status < 500) {
        return response;
      }
    } catch (e) {
      // Fall through
    }

    // 3. Fallback to direct API call
    return fetch(`${BRIDGE_BASE_URL}${endpoint}`, options);
  }

  public static async getOrCreateUserUuid(): Promise<string> {
    const cachedUuid = localStorage.getItem(STORAGE_KEY_USER_UUID);
    if (cachedUuid) return cachedUuid;

    const headers = this.getHeaders();
    
    // Bridge API v3 POST /users creates user and returns { uuid }
    const response = await this.fetchWithFallback(`/v3/aggregation/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Impossible de créer l'utilisateur Bridge API v3 (${response.status})`);
    }

    const data = await response.json();
    const userUuid = data.uuid || data.id;

    if (!userUuid) {
      throw new Error('UUID utilisateur Bridge non reçu.');
    }

    localStorage.setItem(STORAGE_KEY_USER_UUID, userUuid);
    return userUuid;
  }

  public static async getAccessToken(): Promise<string> {
    const userUuid = await this.getOrCreateUserUuid();
    const headers = this.getHeaders(); // Just Client-Id and Client-Secret

    const response = await this.fetchWithFallback(`/v3/aggregation/authorization/token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_uuid: userUuid }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Impossible d'obtenir le token d'accès Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.access_token;
  }

  public static async listBanks(): Promise<BridgeBank[]> {
    const accessToken = await this.getAccessToken();
    const headers = this.getHeaders(accessToken);
    const response = await this.fetchWithFallback(`/v3/aggregation/banks?limit=100&country_code=FR`, { headers });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Erreur lors de la récupération des banques Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || data.data || [];
  }

  public static async createConnectUrl(redirectUrl: string): Promise<string> {
    const userUuid = await this.getOrCreateUserUuid();
    const accessToken = await this.getAccessToken();
    const headers = this.getHeaders(accessToken);
    
    const payload = JSON.stringify({
      user_uuid: userUuid,
      callback_url: redirectUrl,
    });

    const response = await this.fetchWithFallback(`/v3/aggregation/connect-sessions`, {
      method: 'POST',
      headers,
      body: payload,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Impossible de générer le lien de connexion bancaire Bridge (${response.status}). Vérifiez vos clés Sandbox.`);
    }

    const data = await response.json();
    return data.redirect_url || data.url || data.link || data.connect_url;
  }

  public static async listAccounts(): Promise<BridgeAccount[]> {
    const accessToken = await this.getAccessToken();
    const headers = this.getHeaders(accessToken);

    const response = await this.fetchWithFallback(`/v3/aggregation/accounts`, { headers });
    
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Impossible de récupérer les comptes Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || data.data || [];
  }

  public static async listTransactions(): Promise<BridgeRawTransaction[]> {
    const accessToken = await this.getAccessToken();
    const headers = this.getHeaders(accessToken);

    const response = await this.fetchWithFallback(`/v3/aggregation/transactions?limit=500`, { headers });
    
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Impossible de récupérer les transactions Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || data.data || [];
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
