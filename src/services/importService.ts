import { insertImportBatch } from '../utils/importBatch';
import { format } from 'date-fns';
import { parseBankCsv, parseBankAmount, parseBankDate } from '../utils/bankCsv';
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

  private stripAccents(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  parseDelimitedText(text: string, hasHeader: boolean, separator?: string): CSVRow[] {
    return parseBankCsv(text, hasHeader, separator);
  }

  parseRawText(rawText: string): CSVRow[] {
    const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    // Pasted straight from a bank export (separated by ; or tabs): reuse the CSV parser
    const delimited = lines.filter(line => (line.match(/[;\t]/g) || []).length >= 2).length;
    if (lines.length > 0 && delimited / lines.length >= 0.7) {
      const hasHeader = /date/.test(this.stripAccents(lines[0])) && !/\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(lines[0]);
      const rows = this.parseDelimitedText(lines.join('\n'), hasHeader);
      if (rows.length > 0) return rows;
    }

    const dateRegex = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{2,4})\b/;
    const amountRegex = /[-+]?\d[\d\s]*(?:[,.]\d{2})\s*(?:€|eur)?/i;

    return lines.map(line => {
      const date = line.match(dateRegex)?.[0] || '';
      const amountMatches = [...line.matchAll(new RegExp(amountRegex, 'gi'))];
      const amount = amountMatches[amountMatches.length - 1]?.[0] || '';
      let description = line;

      if (date) description = description.replace(date, ' ');
      if (amount) description = description.replace(amount, ' ');
      description = description
        .replace(/\b(carte|cb|visa|mastercard|sepa|prelevement|virement|paiement)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        Date: date,
        Description: description || line,
        Montant: amount,
        Original: line,
      };
    });
  }

  // Generate duplicate hash
  private generateDuplicateHash(userId: string, date: Date, amount: number, description: string): string {
    const dateStr = format(date, 'yyyy-MM-dd');
    const amountCents = Math.round(amount * 100);
    const normalizedDesc = this.normalizeText(description);
    const hashInput = `${userId}-${dateStr}-${amountCents}-${normalizedDesc}`;
    return CryptoJS.SHA1(hashInput).toString();
  }

  // Parse CSV file (auto-detects UTF-8 vs Windows-1252, which French banks use)
  async parseCSV(file: File, settings: ImportSettings): Promise<CSVRow[]> {
    const buffer = await file.arrayBuffer();
    let text: string;
    if (settings.encoding && settings.encoding !== 'auto') {
      text = new TextDecoder(settings.encoding).decode(buffer);
    } else {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder('windows-1252').decode(buffer);
      }
    }
    return this.parseDelimitedText(text, settings.hasHeader, settings.separator || undefined);
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
        const parsedDate = parseBankDate(dateStr);

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          errors.push(`Format de date invalide: ${dateStr}`);
        } else {
          transaction.date = parsedDate;
        }
      }
    } catch {
      errors.push('Erreur lors du parsing de la date');
    }

    // Parse amount
    try {
      const amountStr = row[mapping.amount];
      if (!amountStr) {
        errors.push('Montant manquant');
      } else {
        const amount = parseBankAmount(amountStr);
        if (isNaN(amount)) {
          errors.push(`Montant invalide: ${amountStr}`);
        } else {
          transaction.amount = Math.abs(amount);
          transaction.type = amount >= 0 ? 'income' : 'expense';
        }
      }
    } catch {
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

    // Parse balance (optional)
    if (mapping.balance && row[mapping.balance]) {
      const balStr = row[mapping.balance];
      const numBal = parseBankAmount(balStr);
      if (!isNaN(numBal)) {
        transaction.rowBalance = numBal;
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
    const preparedRules = activeRules.map(r => ({
      ...r,
      normalizedPattern: this.normalizeText(r.pattern),
      regex: r.matchType === 'regex' ? new RegExp(r.pattern, 'i') : null
    }));
    const preparedNonFuzzy = preparedRules.filter(r => r.matchType !== 'fuzzy');
    const preparedFuzzy = preparedRules.filter(r => r.matchType === 'fuzzy');

    // Load vendor aliases (tolerant to missing table/RLS)
    let vendorAliases: { alias: string; normalized: string; category_id?: string; account_id?: string }[] = [];
    try {
      const { data, error } = await supabase
        .from('vendor_aliases')
        .select('*')
        .eq('user_id', userId);
      if (error) {
        // Soft-fail: continue without aliases
        console.warn('ImportService: vendor_aliases fetch error (ignored):', error.message);
      } else {
        vendorAliases = data || [];
      }
    } catch (e: unknown) {
      console.warn('ImportService: vendor_aliases fetch exception (ignored):', e instanceof Error ? e.message : String(e));
    }

    return transactions.map(transaction => {
      const suggestions: CategorySuggestion[] = [];
      const normalizedDesc = this.normalizeText(transaction.description);

      // Apply rules (non-fuzzy first)
      for (const rule of preparedNonFuzzy) {
        let confidence = 0;
        switch (rule.matchType) {
          case 'exact':
            confidence = normalizedDesc === rule.normalizedPattern ? 1.0 : 0.0;
            break;
          case 'contains':
            confidence = normalizedDesc.includes(rule.normalizedPattern) ? 0.9 : 0.0;
            break;
          case 'regex':
            confidence = rule.regex?.test(transaction.description) ? 0.95 : 0.0;
            break;
        }

        if (confidence >= rule.confidenceThreshold) {
          const category = categories.find(c => c.id === rule.targetCategoryId);
          if (category) {
            suggestions.push({
              categoryId: rule.targetCategoryId,
              categoryName: category.name,
              confidence,
              reason: `Règle: "${rule.pattern}"`,
              ruleId: rule.id,
              source: 'personal'
            });
          }
        }
      }

      // If nothing matched, try fuzzy rules
      if (suggestions.length === 0 && preparedFuzzy.length > 0) {
        for (const rule of preparedFuzzy) {
          const maxLength = Math.max(normalizedDesc.length, rule.normalizedPattern.length);
          const confidence = maxLength === 0 ? 0 : Math.max(0, 1 - (distance(normalizedDesc, rule.normalizedPattern) / maxLength));
          if (confidence >= rule.confidenceThreshold) {
            const category = categories.find(c => c.id === rule.targetCategoryId);
            if (category) {
              suggestions.push({
                categoryId: rule.targetCategoryId,
                categoryName: category.name,
                confidence,
                reason: `Règle: "${rule.pattern}"`,
                ruleId: rule.id,
                source: 'personal'
              });
            }
          }
        }
      }

      // Check vendor aliases
      for (const alias of vendorAliases) {
        if (normalizedDesc.includes(alias.normalized)) {
          const category = categories.find(c => c.id === alias.category_id);
          if (category) {
            suggestions.push({
              categoryId: category.id,
              categoryName: category.name,
              confidence: 0.95,
              reason: `Alias: "${alias.alias}"`,
              source: 'alias'
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
      
      case 'fuzzy': {
        const maxLength = Math.max(normalizedDesc.length, normalizedPattern.length);
        if (maxLength === 0) return 0.0;
        
        const dist = distance(normalizedDesc, normalizedPattern);
        return Math.max(0, 1 - (dist / maxLength));
      }
      
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

    // Check existing hashes in database (tolerant to missing column/table)
    let existingHashSet = new Set<string>();
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('dup_hash')
        .eq('user_id', userId)
        .in('dup_hash', hashes);
      if (error) {
        console.warn('ImportService: dup_hash check error (ignored):', error.message);
      } else {
        existingHashSet = new Set((data || []).map((h: { dup_hash: string }) => h.dup_hash));
      }
    } catch (e: unknown) {
      console.warn('ImportService: dup_hash check exception (ignored):', e instanceof Error ? e.message : String(e));
    }

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
    skipDuplicates: boolean = true,
    onProgress?: (done: number, total: number) => void
  ): Promise<ImportResult> {
    // Only send rows that respect DB NOT NULL constraints
    const validTransactions = transactions.filter(t => 
      t.errors.length === 0 &&
      t.date && t.amount !== undefined && t.description &&
      t.categoryId && t.accountId &&
      (!skipDuplicates || !t.isDuplicate) &&
      t.isSelected !== false
    );

    const errors: string[] = [];
    let imported = 0;
    const skipped = transactions.length - validTransactions.length;
    const duplicates = transactions.filter(t => t.isDuplicate).length;

    // Process in smaller chunks for responsiveness
    const chunkSize = 50;
    for (let i = 0; i < validTransactions.length; i += chunkSize) {
      const chunk = validTransactions.slice(i, i + chunkSize);
      
      const rows = chunk.map(t => ({
        user_id: userId,
        account_id: t.accountId,
        amount: t.amount,
        description: t.description,
        date: format(t.date!, 'yyyy-MM-dd'),
        category_id: t.categoryId,
        type: t.type,
        status: 'completed',
        source: 'import',
        dup_hash: t.duplicateHash,
        is_recurring: false,
      }));
      const result = await insertImportBatch(rows, (payload, signal) =>
        supabase.from('transactions').insert(payload).abortSignal(signal)
      );
      imported += result.imported;
      errors.push(...result.errors);
      // Never resend an ambiguous request or continue unattended after it.
      if (result.uncertain) break;

      // Report progress regardless of success to avoid UI stalls
      try { onProgress?.(Math.min(i + chunk.length, validTransactions.length), validTransactions.length); } catch { /* A progress observer must not interrupt the import. */ }
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
      errorsJson?: unknown;
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
      }).filter(([, v]) => v !== undefined)
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
