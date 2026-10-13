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

  private extractCommunityPattern(description: string): string {
    return this.normalizeText(description)
      .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, ' ')
      .replace(/\b\d+[,.]\d{2}\b/g, ' ')
      .replace(/\b\d{3,}\b/g, ' ')
      .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  private stripAccents(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // "1 234,56" / "-12,50" / "12.5" -> number (NaN when empty / not numeric)
  private toNumber(value: string | undefined): number {
    if (!value) return NaN;
    const cleaned = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return cleaned === '' ? NaN : parseFloat(cleaned);
  }

  // Guesses column names from the content when there is no header line (e.g. pasted rows)
  private inferHeader(table: string[][]): string[] {
    const width = Math.max(...table.map(row => row.length));
    const sample = table.slice(0, 50);
    const dateRe = /^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{2,4})$/;
    const numRe = /^[-+]?\d[\d\s]*(?:[,.]\d+)?\s*(?:€|eur)?$/i;

    const kind = (col: number): 'date' | 'number' | 'text' | 'empty' => {
      const values = sample.map(row => row[col] || '').filter(Boolean);
      if (values.length === 0) return 'empty';
      const ratio = (re: RegExp) => values.filter(v => re.test(v)).length / values.length;
      if (ratio(dateRe) >= 0.7) return 'date';
      if (ratio(numRe) >= 0.7) return 'number';
      return 'text';
    };

    const kinds = Array.from({ length: width }, (_, i) => kind(i));
    const names: string[] = kinds.map((_, i) => `Colonne ${i + 1}`);

    const dateCols = kinds.map((k, i) => (k === 'date' ? i : -1)).filter(i => i >= 0);
    dateCols.forEach((col, n) => (names[col] = n === 0 ? 'Date' : 'Date de valeur'));

    const textCols = kinds.map((k, i) => (k === 'text' ? i : -1)).filter(i => i >= 0);
    if (textCols.length > 0) {
      const avg = (col: number) => sample.reduce((sum, row) => sum + (row[col] || '').length, 0) / sample.length;
      const best = textCols.reduce((a, b) => (avg(b) > avg(a) ? b : a));
      names[best] = 'Libellé';
    }

    const numCols = kinds.map((k, i) => (k === 'number' ? i : -1)).filter(i => i >= 0);
    const bothFilled = (a: number, b: number) => sample.some(row => row[a] && row[b]);
    if (numCols.length >= 3) {
      names[numCols[0]] = 'Débit';
      names[numCols[1]] = 'Crédit';
      names[numCols[numCols.length - 1]] = 'Solde';
    } else if (numCols.length === 2) {
      if (!bothFilled(numCols[0], numCols[1])) {
        names[numCols[0]] = 'Débit';
        names[numCols[1]] = 'Crédit';
      } else {
        names[numCols[0]] = 'Montant';
        names[numCols[1]] = 'Solde';
      }
    } else if (numCols.length === 1) {
      names[numCols[0]] = 'Montant';
    }
    return names;
  }

  /**
   * Turns delimited bank text (CSV file or pasted lines) into rows keyed by header.
   * Tolerant by design: auto-detects the separator, skips preamble lines before the header,
   * merges extra fields (a label containing the separator) into the description column,
   * and builds a signed "Montant" column when the bank splits Débit / Crédit.
   */
  parseDelimitedText(text: string, hasHeader: boolean, separator?: string): CSVRow[] {
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
      header: false,
      delimiter: separator || '',
      delimitersToGuess: [';', '\t', ',', '|'],
      skipEmptyLines: 'greedy',
    });

    // Field count mismatches are expected with real bank exports: only give up if nothing was read
    const table = (result.data as string[][]).map(row => row.map(cell => (cell ?? '').trim()));
    if (table.length === 0) {
      throw new Error('Aucune ligne lisible dans ce fichier');
    }

    let headerIndex = 0;
    if (hasHeader) {
      const found = table.findIndex(
        row => row.filter(Boolean).length >= 3 && row.some(cell => /date/.test(this.stripAccents(cell)))
      );
      headerIndex = found >= 0 ? found : 0;
    }

    const rawHeader = hasHeader ? table[headerIndex] : this.inferHeader(table);
    const seen = new Map<string, number>();
    const header = rawHeader.map((name, i) => {
      const base = name || `Colonne ${i + 1}`;
      const count = (seen.get(base) || 0) + 1;
      seen.set(base, count);
      return count > 1 ? `${base} (${count})` : base;
    });

    const notDate = (h: string) => !/date/.test(this.stripAccents(h));
    let descIdx = header.findIndex(h => /libelle|label|description|motif|intitule/.test(this.stripAccents(h)));
    if (descIdx < 0) descIdx = header.findIndex(h => notDate(h) && /detail|operation/.test(this.stripAccents(h)));
    const body = hasHeader ? table.slice(headerIndex + 1) : table;

    const rows: CSVRow[] = body
      .filter(cells => cells.filter(Boolean).length >= 2)
      .map(cells => {
        let fields = cells;
        const extra = fields.length - header.length;
        if (extra > 0 && descIdx >= 0) {
          // The label itself contained the separator: glue the pieces back together
          const label = fields.slice(descIdx, descIdx + extra + 1).join(' ');
          fields = [...fields.slice(0, descIdx), label, ...fields.slice(descIdx + extra + 1)];
        }
        const row: CSVRow = {};
        header.forEach((name, i) => {
          row[name] = fields[i] ?? '';
        });
        return row;
      });

    // Débit / Crédit columns -> one signed "Montant" column
    const debitCol = header.find(h => /^debit/.test(this.stripAccents(h)));
    const creditCol = header.find(h => /^credit/.test(this.stripAccents(h)));
    const hasAmountCol = header.some(h => /montant|amount/.test(this.stripAccents(h)));
    if (debitCol && creditCol && !hasAmountCol) {
      rows.forEach(row => {
        const debit = this.toNumber(row[debitCol]);
        const credit = this.toNumber(row[creditCol]);
        let amount = 0;
        if (!isNaN(credit)) amount += Math.abs(credit);
        if (!isNaN(debit)) amount -= Math.abs(debit);
        row['Montant'] = amount === 0 && isNaN(debit) && isNaN(credit) ? '' : amount.toFixed(2).replace('.', ',');
      });
    }

    return rows;
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
    const dateStr = date.toISOString().split('T')[0];
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
    const categoriesById = new Map(categories.map(c => [c.id, c]));
    const preparedRules = activeRules.map(r => ({
      ...r,
      normalizedPattern: this.normalizeText(r.pattern),
      regex: r.matchType === 'regex' ? new RegExp(r.pattern, 'i') : null
    }));
    const preparedNonFuzzy = preparedRules.filter(r => r.matchType !== 'fuzzy');
    const preparedFuzzy = preparedRules.filter(r => r.matchType === 'fuzzy');

    // Load vendor aliases (tolerant to missing table/RLS)
    let vendorAliases: any[] = [];
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
    } catch (e: any) {
      console.warn('ImportService: vendor_aliases fetch exception (ignored):', e?.message || e);
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
          const category = categories.find(c => c.id === alias.categoryId);
          if (category) {
            suggestions.push({
              categoryId: alias.categoryId,
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

  async applyCommunitySuggestions(
    transactions: ParsedTransaction[],
    categories: Category[]
  ): Promise<ParsedTransaction[]> {
    const patterns = Array.from(new Set(
      transactions
        .filter(transaction => !transaction.categoryId && transaction.description)
        .map(transaction => this.extractCommunityPattern(transaction.description))
        .filter(pattern => pattern.length >= 3)
    ));

    if (patterns.length === 0) return transactions;

    let rows: any[] = [];
    try {
      const { data, error } = await supabase
        .from('community_rules')
        .select('*')
        .in('normalized_pattern', patterns)
        .order('confidence_score', { ascending: false });

      if (error) {
        console.warn('ImportService: community_rules fetch error (ignored):', error.message);
        return transactions;
      }
      rows = data || [];
    } catch (e: any) {
      console.warn('ImportService: community_rules fetch exception (ignored):', e?.message || e);
      return transactions;
    }

    const rulesByPattern = new Map<string, any[]>();
    for (const row of rows) {
      const items = rulesByPattern.get(row.normalized_pattern) || [];
      items.push(row);
      rulesByPattern.set(row.normalized_pattern, items);
    }

    const localCategoriesByKey = new Map(
      categories.map(category => [
        `${this.normalizeText(category.name)}:${category.type}`,
        category,
      ])
    );

    return transactions.map(transaction => {
      if (transaction.categoryId || !transaction.description) return transaction;

      const pattern = this.extractCommunityPattern(transaction.description);
      const matches = rulesByPattern.get(pattern) || [];
      const communitySuggestions: CategorySuggestion[] = [];

      for (const rule of matches.slice(0, 3)) {
        const category = localCategoriesByKey.get(
          `${this.normalizeText(rule.suggested_category_name)}:${rule.suggested_category_type}`
        );
        if (!category) continue;

        communitySuggestions.push({
          categoryId: category.id,
          categoryName: category.name,
          confidence: parseFloat(rule.confidence_score),
          reason: 'Suggestion Pathly',
          ruleId: rule.id,
          source: 'community',
        });
      }

      const suggestions = [...(transaction.suggestions || []), ...communitySuggestions]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      return {
        ...transaction,
        suggestions,
        categoryId: suggestions[0]?.confidence >= 0.9 ? suggestions[0].categoryId : transaction.categoryId,
      };
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
        existingHashSet = new Set((data || []).map((h: any) => h.dup_hash));
      }
    } catch (e: any) {
      console.warn('ImportService: dup_hash check exception (ignored):', e?.message || e);
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
      
      try {
        const insertPromise = supabase
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
            })),
            { returning: 'minimal' }
          );

        // Guard against long network waits with a timeout, but try a generous window
        const timeoutMs = 20000;
        const raced = await Promise.race([
          insertPromise,
          new Promise<{ error: any }>((resolve) => setTimeout(() => resolve({ error: new Error('timeout') }), timeoutMs))
        ]);
        let error = (raced as any)?.error;

        if (error) {
          // Fallback: try row-by-row to surface real error messages and keep progressing
          for (const t of chunk) {
            try {
              const { error: rowError } = await supabase
                .from('transactions')
                .insert([
                  {
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
                  }
                ], { returning: 'minimal' });
              if (rowError) {
                errors.push(`Row insert error: ${rowError.message}`);
              } else {
                imported += 1;
              }
            } catch (e: any) {
              errors.push(`Row insert exception: ${e?.message || e}`);
            }
            try { onProgress?.(Math.min(i + (imported % (i + chunk.length) || 0), validTransactions.length), validTransactions.length); } catch {}
          }
        } else {
          imported += chunk.length;
        }
      } catch (error: any) {
        errors.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
      }

      // Report progress regardless of success to avoid UI stalls
      try { onProgress?.(Math.min(i + chunk.length, validTransactions.length), validTransactions.length); } catch {}
    }

    return { imported, skipped, duplicates, errors };
  }

  async submitCommunityLearning(
    transactions: ParsedTransaction[],
    userId: string,
    categories: Category[]
  ): Promise<void> {
    const categoryById = new Map(categories.map(category => [category.id, category]));
    const confirmed = transactions.filter(transaction =>
      transaction.errors.length === 0 &&
      transaction.description &&
      transaction.categoryId &&
      transaction.isSelected !== false
    );

    for (const transaction of confirmed) {
      const category = categoryById.get(transaction.categoryId!);
      const normalizedPattern = this.extractCommunityPattern(transaction.description);
      if (!category || normalizedPattern.length < 3) continue;

      try {
        const { data, error } = await supabase
          .from('community_rules')
          .upsert({
            normalized_pattern: normalizedPattern,
            suggested_category_name: category.name,
            suggested_category_type: category.type,
            locale: 'fr',
          }, {
            onConflict: 'normalized_pattern,suggested_category_name,suggested_category_type,locale',
          })
          .select('*')
          .single();

        if (error) {
          console.warn('ImportService: community rule upsert error (ignored):', error.message);
          continue;
        }

        const confirmations = (data.confirmations_count || 0) + 1;
        const corrections = data.corrections_count || 0;
        const confidence = Math.min(0.98, Math.max(0.6, confirmations / (confirmations + corrections + 1)));

        await supabase
          .from('community_rules')
          .update({
            confirmations_count: confirmations,
            confidence_score: confidence,
          })
          .eq('id', data.id);

        await supabase
          .from('rule_feedback')
          .insert({
            user_id: userId,
            community_rule_id: data.id,
            normalized_pattern: normalizedPattern,
            accepted: true,
            corrected_category_name: category.name,
            corrected_category_type: category.type,
          });
      } catch (e: any) {
        console.warn('ImportService: community learning exception (ignored):', e?.message || e);
      }
    }
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
