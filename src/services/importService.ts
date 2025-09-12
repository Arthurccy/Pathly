import Papa from 'papaparse';
import { distance } from 'fastest-levenshtein';
import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';
import { 
  CSVRow, 
  ColumnMapping, 
  ImportSettings, 
  ParsedTransaction, 
  ImportRule, 
  VendorAlias, 
  ImportJob, 
  CategorySuggestion,
  ImportResult
} from '../types/import';
import { BankAccount, Category } from '../types';

class ImportService {
  // Normalize text for matching
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/\b(cb|paiement|visa|sepa|virement|prelevement)\b/g, '') // Remove stopwords
      .replace(/\s+/g, ' ') // Collapse spaces
      .trim();
  }

  // Generate duplicate hash
  private generateDuplicateHash(userId: string, date: Date, amount: number, description: string): string {
    const dateStr = date.toISOString().split('T')[0];
    const amountCents = Math.round(amount * 100);
    const normalizedDesc = this.normalizeText(description);
    const hashInput = `${userId}-${dateStr}-${amountCents}-${normalizedDesc}`;
    return CryptoJS.SHA1(hashInput).toString();
  }

  // Parse CSV file
  async parseCSV(file: File, settings: ImportSettings): Promise<CSVRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: settings.hasHeader,
        delimiter: settings.separator,
        encoding: settings.encoding,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(results.data as CSVRow[]);
          }
        },
        error: (error) => reject(error)
      });
    });
  }

  // Validate and parse transaction data
  parseTransaction(
    row: CSVRow, 
    mapping: ColumnMapping, 
    accounts: BankAccount[]
  ): { transaction: ParsedTransaction; errors: string[] } {
    const errors: string[] = [];
    const transaction: Partial<ParsedTransaction> = {
      originalRow: row,
      errors: [],
      suggestions: [],
      isSelected: true
    };

    // Parse date
    try {
      const dateStr = row[mapping.date];
      if (!dateStr) {
        errors.push('Date manquante');
      } else {
        let parsedDate: Date | null = null;
        const dateFormats = [
          /^\d{4}-\d{2}-\d{2}$/, // ISO: 2024-01-15
          /^\d{2}\/\d{2}\/\d{4}$/, // FR: 15/01/2024
          /^\d{2}-\d{2}-\d{4}$/, // FR: 15-01-2024
        ];

        for (const format of dateFormats) {
          if (format.test(dateStr)) {
            if (dateStr.includes('/')) {
              const [day, month, year] = dateStr.split('/');
              parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else if (dateStr.includes('-')) {
              if (dateStr.startsWith('20')) {
                parsedDate = new Date(dateStr);
              } else {
                const [day, month, year] = dateStr.split('-');
                parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              }
            }
            break;
          }
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          errors.push(`Format de date invalide: ${dateStr}`);
        } else {
          transaction.date = parsedDate;
        }
      }
    } catch (e) {
      errors.push('Erreur lors du parsing de la date');
    }

    // Parse amount
    try {
      const amountStr = row[mapping.amount];
      if (!amountStr) {
        errors.push('Montant manquant');
      } else {
        const cleanAmount = amountStr
          .replace(/\s/g, '')
          .replace(',', '.')
          .replace(/[^\d.-]/g, '');
        
        const amount = parseFloat(cleanAmount);
        if (isNaN(amount)) {
          errors.push(`Montant invalide: ${amountStr}`);
        } else {
          transaction.amount = Math.abs(amount);
          transaction.type = amount >= 0 ? 'income' : 'expense';
        }
      }
    } catch (e) {
      errors.push('Erreur lors du parsing du montant');
    }

    // Parse description
    const description = row[mapping.description];
    if (!description || description.trim().length === 0) {
      errors.push('Description manquante');
    } else {
      transaction.description = description.trim();
    }

    // Parse account (optional)
    if (mapping.account && row[mapping.account]) {
      const accountName = row[mapping.account].trim();
      const account = accounts.find(a => 
        a.name.toLowerCase().includes(accountName.toLowerCase()) ||
        accountName.toLowerCase().includes(a.name.toLowerCase())
      );
      if (account) {
        transaction.accountId = account.id;
      }
    }

    transaction.errors = errors;
    return { transaction: transaction as ParsedTransaction, errors };
  }

  // Apply rules to suggest categories
  async applyCategorization(
    transactions: ParsedTransaction[],
    rules: ImportRule[],
    categories: Category[],
    userId: string
  ): Promise<ParsedTransaction[]> {
    const activeRules = rules
      .filter(r => r.isActive)
      .sort((a, b) => b.priority - a.priority);

    // Load vendor aliases
    const { data: aliases } = await supabase
      .from('vendor_aliases')
      .select('*')
      .eq('user_id', userId);

    const vendorAliases = aliases || [];

    return transactions.map(transaction => {
      const suggestions: CategorySuggestion[] = [];
      const normalizedDesc = this.normalizeText(transaction.description);

      // Apply rules
      for (const rule of activeRules) {
        const confidence = this.calculateRuleConfidence(
          transaction.description,
          rule.pattern,
          rule.matchType
        );

        if (confidence >= rule.confidenceThreshold) {
          const category = categories.find(c => c.id === rule.targetCategoryId);
          if (category) {
            suggestions.push({
              categoryId: rule.targetCategoryId,
              categoryName: category.name,
              confidence,
              reason: `Règle: "${rule.pattern}"`,
              ruleId: rule.id
            });
          }
        }
      }

      // Check vendor aliases
      for (const alias of vendorAliases) {
        if (normalizedDesc.includes(alias.normalized)) {
          const category = categories.find(c => c.id === alias.categoryId);
          if (category) {
            suggestions.push({
              categoryId: alias.categoryId,
              categoryName: category.name,
              confidence: 0.95,
              reason: `Alias: "${alias.alias}"`
            });
          }
        }
      }

      // Sort suggestions by confidence
      transaction.suggestions = suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      // Auto-apply highest confidence if above threshold
      if (transaction.suggestions.length > 0 && transaction.suggestions[0].confidence >= 0.9) {
        transaction.categoryId = transaction.suggestions[0].categoryId;
      }

      return transaction;
    });
  }

  // Calculate rule confidence
  private calculateRuleConfidence(description: string, pattern: string, matchType: string): number {
    const normalizedDesc = this.normalizeText(description);
    const normalizedPattern = this.normalizeText(pattern);

    switch (matchType) {
      case 'exact':
        return normalizedDesc === normalizedPattern ? 1.0 : 0.0;
      
      case 'contains':
        return normalizedDesc.includes(normalizedPattern) ? 0.9 : 0.0;
      
      case 'regex':
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(description) ? 0.95 : 0.0;
        } catch {
          return 0.0;
        }
      
      case 'fuzzy':
        const maxLength = Math.max(normalizedDesc.length, normalizedPattern.length);
        if (maxLength === 0) return 0.0;
        
        const dist = distance(normalizedDesc, normalizedPattern);
        return Math.max(0, 1 - (dist / maxLength));
      
      default:
        return 0.0;
    }
  }

  // Check for duplicates
  async checkDuplicates(
    transactions: ParsedTransaction[],
    userId: string
  ): Promise<ParsedTransaction[]> {
    const hashes = transactions
      .filter(t => t.date && t.amount !== undefined && t.description)
      .map(t => this.generateDuplicateHash(userId, t.date!, t.amount!, t.description!));

    if (hashes.length === 0) return transactions;

    // Check existing hashes in database
    const { data: existingHashes } = await supabase
      .from('transactions')
      .select('dup_hash')
      .eq('user_id', userId)
      .in('dup_hash', hashes);

    const existingHashSet = new Set((existingHashes || []).map(h => h.dup_hash));

    return transactions.map(transaction => {
      if (transaction.date && transaction.amount !== undefined && transaction.description) {
        const hash = this.generateDuplicateHash(
          userId, 
          transaction.date, 
          transaction.amount, 
          transaction.description
        );
        
        transaction.duplicateHash = hash;
        transaction.isDuplicate = existingHashSet.has(hash);
      }
      
      return transaction;
    });
  }

  // Import transactions to Supabase
  async importTransactions(
    transactions: ParsedTransaction[],
    userId: string,
    skipDuplicates: boolean = true
  ): Promise<ImportResult> {
    const validTransactions = transactions.filter(t => 
      t.errors.length === 0 && 
      (!skipDuplicates || !t.isDuplicate) &&
      t.isSelected !== false
    );

    const errors: string[] = [];
    let imported = 0;
    const skipped = transactions.length - validTransactions.length;
    const duplicates = transactions.filter(t => t.isDuplicate).length;

    // Process in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < validTransactions.length; i += chunkSize) {
      const chunk = validTransactions.slice(i, i + chunkSize);
      
      try {
        const { error } = await supabase
          .from('transactions')
          .insert(
            chunk.map(t => ({
              user_id: userId,
              account_id: t.accountId,
              amount: t.amount,
              description: t.description,
              date: t.date!.toISOString().split('T')[0],
              category_id: t.categoryId,
              type: t.type,
              status: 'completed',
              source: 'import',
              dup_hash: t.duplicateHash,
              is_recurring: false
            }))
          );

        if (error) {
          errors.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
        } else {
          imported += chunk.length;
        }
      } catch (error: any) {
        errors.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
      }
    }

    return { imported, skipped, duplicates, errors };
  }

  // Create import job record
  async createImportJob(
    userId: string,
    filename: string,
    rowsTotal: number
  ): Promise<string> {
    const { data, error } = await supabase
      .from('import_jobs')
      .insert({
        user_id: userId,
        filename,
        rows_total: rowsTotal,
        status: 'processing'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // Update import job
  async updateImportJob(
    jobId: string,
    updates: {
      rowsImported?: number;
      rowsSkipped?: number;
      rowsDuplicates?: number;
      errorsJson?: any;
      status?: 'processing' | 'completed' | 'failed';
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('import_jobs')
      .update({
        rows_imported: updates.rowsImported,
        rows_skipped: updates.rowsSkipped,
        rows_duplicates: updates.rowsDuplicates,
        errors_json: updates.errorsJson,
        status: updates.status,
        completed_at: updates.status !== 'processing' ? new Date().toISOString() : undefined
      })
      .eq('id', jobId);

    if (error) throw error;
  }

  // Get user's import rules
  async getUserRules(userId: string): Promise<ImportRule[]> {
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      pattern: row.pattern,
      targetCategoryId: row.target_category_id,
      targetAccountId: row.target_account_id,
      notes: row.notes,
      priority: row.priority,
      isActive: row.is_active,
      matchType: row.match_type,
      confidenceThreshold: parseFloat(row.confidence_threshold),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  // Create new rule
  async createRule(rule: Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImportRule> {
    const { data, error } = await supabase
      .from('rules')
      .insert({
        user_id: rule.userId,
        pattern: rule.pattern,
        target_category_id: rule.targetCategoryId,
        target_account_id: rule.targetAccountId,
        notes: rule.notes,
        priority: rule.priority,
        is_active: rule.isActive,
        match_type: rule.matchType,
        confidence_threshold: rule.confidenceThreshold
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      pattern: data.pattern,
      targetCategoryId: data.target_category_id,
      targetAccountId: data.target_account_id,
      notes: data.notes,
      priority: data.priority,
      isActive: data.is_active,
      matchType: data.match_type,
      confidenceThreshold: parseFloat(data.confidence_threshold),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  // Update rule
  async updateRule(ruleId: string, updates: Partial<ImportRule>): Promise<void> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries({
        pattern: updates.pattern,
        target_category_id: updates.targetCategoryId,
        target_account_id: updates.targetAccountId,
        notes: updates.notes,
        priority: updates.priority,
        is_active: updates.isActive,
        match_type: updates.matchType,
        confidence_threshold: updates.confidenceThreshold
      }).filter(([_, v]) => v !== undefined)
    );

    const { error } = await supabase
      .from('rules')
      .update(cleanedUpdates)
      .eq('id', ruleId);

    if (error) throw error;
  }

  // Delete rule
  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await supabase
      .from('rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
  }

  // Test rule against existing transactions
  async testRule(rule: ImportRule, userId: string, categories: Category[]): Promise<{
    matches: number;
    examples: Array<{ description: string; confidence: number; categoryName: string }>;
  }> {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('description, category_id')
      .eq('user_id', userId)
      .limit(1000);

    if (!transactions) return { matches: 0, examples: [] };

    const matches = [];
    for (const transaction of transactions) {
      const confidence = this.calculateRuleConfidence(
        transaction.description,
        rule.pattern,
        rule.matchType
      );

      if (confidence >= rule.confidenceThreshold) {
        const category = categories.find(c => c.id === rule.targetCategoryId);
        matches.push({
          description: transaction.description,
          confidence,
          categoryName: category?.name || 'Catégorie inconnue'
        });
      }
    }

    return {
      matches: matches.length,
      examples: matches.slice(0, 5)
    };
  }

  // Create vendor alias
  async createVendorAlias(alias: Omit<VendorAlias, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase
      .from('vendor_aliases')
      .insert({
        user_id: alias.userId,
        alias: alias.alias,
        normalized: alias.normalized,
        category_id: alias.categoryId,
        account_id: alias.accountId
      });

    if (error) throw error;
  }

  // Get import jobs history
  async getImportJobs(userId: string): Promise<ImportJob[]> {
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      filename: row.filename,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      rowsTotal: row.rows_total,
      rowsImported: row.rows_imported || 0,
      rowsSkipped: row.rows_skipped || 0,
      rowsDuplicates: row.rows_duplicates || 0,
      errorsJson: row.errors_json,
      status: row.status,
      createdAt: new Date(row.created_at)
    }));
  }
}

export const importService = new ImportService();