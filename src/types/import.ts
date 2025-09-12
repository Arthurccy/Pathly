export interface ImportRule {
  id: string;
  userId: string;
  pattern: string;
  targetCategoryId: string;
  targetAccountId?: string;
  notes?: string;
  priority: number;
  isActive: boolean;
  matchType: 'exact' | 'contains' | 'regex' | 'fuzzy';
  confidenceThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorAlias {
  id: string;
  userId: string;
  alias: string;
  normalized: string;
  categoryId?: string;
  accountId?: string;
  createdAt: Date;
}

export interface ImportJob {
  id: string;
  userId: string;
  filename: string;
  startedAt: Date;
  completedAt?: Date;
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsDuplicates: number;
  errorsJson?: any;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface CSVRow {
  [key: string]: string;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  account?: string;
  category?: string;
}

export interface ImportSettings {
  hasHeader: boolean;
  separator: string;
  encoding: string;
  skipDuplicates: boolean;
  autoApplyRules: boolean;
  confidenceThreshold: number;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reason: string;
  ruleId?: string;
}

export interface ParsedTransaction {
  originalRow: CSVRow;
  date?: Date;
  description: string;
  amount?: number;
  type?: 'income' | 'expense';
  accountId?: string;
  categoryId?: string;
  duplicateHash?: string;
  isDuplicate?: boolean;
  errors: string[];
  suggestions: CategorySuggestion[];
  isSelected?: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  jobId?: string;
}