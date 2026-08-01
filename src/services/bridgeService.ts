import { BankAccount, Category, Transaction } from '../types';

const BRIDGE_BASE_URL = 'https://api.bridgeapi.io/v2';
const BRIDGE_PROXY_URL = '/api/bridge-proxy';
const STORAGE_KEY_CLIENT_ID = 'pathly_bridge_client_id';
const STORAGE_KEY_CLIENT_SECRET = 'pathly_bridge_client_secret';

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

  private static getHeaders(): Record<string, string> {
    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Veuillez d\'abord saisir votre Client ID et Client Secret Bridge (Bankin\').');
    }

    return {
      'Client-Id': clientId,
      'Client-Secret': clientSecret,
      'Bridge-Version': '2025-01-15',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private static async fetchWithFallback(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // 1. Try Vercel Serverless Proxy endpoint (/api/bridge-proxy?path=...)
    try {
      const proxyPath = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
      const proxyUrl = `${BRIDGE_PROXY_URL}/${proxyPath}`;
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

  public static async listBanks(): Promise<BridgeBank[]> {
    const headers = this.getHeaders();
    const response = await this.fetchWithFallback(`/banks?limit=100&country_code=FR`, { headers });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Erreur lors de la récupération des banques Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || [];
  }

  public static async createConnectUrl(redirectUrl: string): Promise<string> {
    const headers = this.getHeaders();
    const payload = JSON.stringify({
      callback_url: redirectUrl,
      redirect_url: redirectUrl,
    });

    const candidateEndpoints = [
      '/connect/sessions',
      '/connect/url',
      '/connect/items/add/url',
      '/single-sign-on/url',
    ];

    let lastError = '';

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await this.fetchWithFallback(endpoint, {
          method: 'POST',
          headers,
          body: payload,
        });

        if (response.ok) {
          const data = await response.json();
          const url = data.redirect_url || data.url || data.link || data.connect_url;
          if (url) return url;
        } else if (response.status !== 404) {
          const err = await response.json().catch(() => ({}));
          lastError = err.message || err.description || `Erreur Bridge API (${response.status})`;
        }
      } catch (e: any) {
        lastError = e.message || 'Erreur réseau';
      }
    }

    throw new Error(lastError || 'Impossible de générer le lien de connexion bancaire Bridge (Vérifiez les clés Sandbox).');
  }

  public static async listAccounts(): Promise<BridgeAccount[]> {
    const headers = this.getHeaders();

    const response = await this.fetchWithFallback(`/accounts`, { headers });
    
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Impossible de récupérer les comptes Bridge (${response.status})`);
    }

    const data = await response.json();
    return data.resources || [];
  }

  public static async listTransactions(): Promise<BridgeRawTransaction[]> {
    const headers = this.getHeaders();

    const response = await this.fetchWithFallback(`/transactions?limit=500`, { headers });
    
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.description || `Impossible de récupérer les transactions Bridge (${response.status})`);
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
